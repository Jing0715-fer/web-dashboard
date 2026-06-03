import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stopProcess } from '@/lib/process-manager';

// PUT /api/projects/[id]/environments/[envId]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;
    const body = await req.json();
    const { name, cmd, port, envVars } = body;

    // Verify project exists
    const project = await db.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const environment = await db.environment.update({
      where: { id: envId },
      data: {
        ...(name !== undefined && { name }),
        ...(cmd !== undefined && { cmd }),
        ...(port !== undefined && { port: parseInt(String(port), 10) }),
        ...(envVars !== undefined && { envVars: JSON.stringify(envVars) }),
      },
    });

    return NextResponse.json({ environment });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/environments/[envId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;

    // Stop the process if running
    const env = await db.environment.findUnique({ where: { id: envId } });
    if (env) {
      await stopProcess(id, env.name, env.port);
    }

    await db.environment.delete({ where: { id: envId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
