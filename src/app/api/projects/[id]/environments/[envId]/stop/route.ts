import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stopProcess } from '@/lib/process-manager';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params;

    const env = await db.environment.findUnique({ where: { id: envId } });
    if (!env) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
    }
    if (env.projectId !== id) {
      return NextResponse.json({ error: 'Environment does not belong to this project' }, { status: 403 });
    }

    const result = await stopProcess(id, env.name, env.port);

    // Update DB status
    await db.environment.update({
      where: { id: envId },
      data: { status: 'stopped', pid: null },
    });

    return NextResponse.json({ ok: result.success, error: result.error });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
