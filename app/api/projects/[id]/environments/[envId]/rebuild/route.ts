import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params

    const environment = await db.environment.findFirst({
      where: { id: envId, projectId: id },
    })

    if (!environment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 })
    }

    // Stop first
    await db.environment.update({
      where: { id: envId },
      data: {
        status: 'stopped',
        pid: null,
      },
    })

    // Simulate build phase (in a real app, this would run actual build commands)
    // Small delay to simulate build
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Start with new PID
    const pid = Math.floor(Math.random() * 50000) + 10000

    const updated = await db.environment.update({
      where: { id: envId },
      data: {
        status: 'running',
        pid,
      },
    })

    return NextResponse.json({
      ...updated,
      rebuildMessage: 'Environment rebuilt and started successfully',
    })
  } catch (error) {
    console.error('Failed to rebuild environment:', error)
    return NextResponse.json({ error: 'Failed to rebuild environment' }, { status: 500 })
  }
}
