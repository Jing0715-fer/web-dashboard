import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stopProcess, batchCheckPorts } from '@/lib/process-manager';

// GET /api/projects/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.project.findUnique({
      where: { id },
      include: { environments: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Batch check ports for efficiency
    const ports = project.environments.map(e => e.port);
    const activePorts = await batchCheckPorts(ports);

    const enriched = {
      ...project,
      environments: project.environments.map((env) => ({
        ...env,
        status: activePorts.has(env.port) ? 'running' : 'stopped',
      })),
    };

    return NextResponse.json({ project: enriched });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PUT /api/projects/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { name, description, icon } = body;

    const project = await db.project.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
      },
      include: { environments: true },
    });

    return NextResponse.json({ project });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Stop all running environments first
    const project = await db.project.findUnique({
      where: { id },
      include: { environments: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    for (const env of project.environments) {
      await stopProcess(id, env.name, env.port);
    }

    await db.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
