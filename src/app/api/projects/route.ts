import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkPortStatus } from '@/lib/process-manager';

// GET /api/projects - List all projects with environments and status
export async function GET() {
  try {
    const projects = await db.project.findMany({
      include: { environments: true },
      orderBy: { updatedAt: 'desc' },
    });

    // Enrich with running status
    const enriched = await Promise.all(
      projects.map(async (project) => ({
        ...project,
        environments: await Promise.all(
          project.environments.map(async (env) => ({
            ...env,
            status: (await checkPortStatus(env.port)) ? 'running' : 'stopped',
          }))
        ),
      }))
    );

    return NextResponse.json({ projects: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/projects - Create a new project
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { path, name, description, icon } = body;

    if (!path) {
      return NextResponse.json({ error: 'Project path is required' }, { status: 400 });
    }

    // Extract name from path if not provided
    const projectName = name || path.split('/').filter(Boolean).pop() || 'Untitled';

    const project = await db.project.create({
      data: {
        name: projectName,
        path,
        description: description || '',
        icon: icon || '📦',
      },
      include: { environments: true },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return NextResponse.json({ error: 'A project with this path already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
