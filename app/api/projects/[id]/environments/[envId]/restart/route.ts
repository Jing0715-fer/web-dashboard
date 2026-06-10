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

    // Then start with new PID
    const pid = Math.floor(Math.random() * 50000) + 10000

    const updated = await db.environment.update({
      where: { id: envId },
      data: {
        status: 'running',
        pid,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to restart environment:', error)
    return NextResponse.json({ error: 'Failed to restart environment' }, { status: 500 })
  }
}
