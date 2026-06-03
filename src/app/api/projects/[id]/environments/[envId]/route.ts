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

    const portNum = port !== undefined ? parseInt(String(port), 10) : undefined;
    if (portNum !== undefined && (isNaN(portNum) || portNum < 1 || portNum > 65535)) {
      return NextResponse.json({ error: 'Port must be between 1 and 65535' }, { status: 400 });
    }

    const existing = await db.environment.findUnique({ where: { id: envId } });
    if (!existing) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }
    if (existing.projectId !== id) {
      return NextResponse.json({ error: 'Environment does not belong to this project' }, { status: 403 });
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

    const existing = await db.environment.findUnique({ where: { id: envId } });
    if (!existing) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }
    if (existing.projectId !== id) {
      return NextResponse.json({ error: 'Environment does not belong to this project' }, { status: 403 });
    }

    // Stop the process if running
    await stopProcess(id, existing.name, existing.port);

    await db.environment.delete({ where: { id: envId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
