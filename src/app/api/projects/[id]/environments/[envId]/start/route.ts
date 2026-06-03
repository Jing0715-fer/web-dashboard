import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { startProcess } from '@/lib/process-manager';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;

    const env = await db.environment.findUnique({
      where: { id: envId },
      include: { project: true },
    });

    if (!env || env.projectId !== id) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }

    let envVars: Record<string, string> = {};
    try {
      envVars = JSON.parse(env.envVars);
    } catch {
      // ignore parse errors
    }

    const result = await startProcess(
      id,
      env.name,
      env.cmd,
      env.project.path,
      envVars,
      env.port
    );

    if (result.success) {
      return NextResponse.json({ ok: true, pid: result.pid });
    } else {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
