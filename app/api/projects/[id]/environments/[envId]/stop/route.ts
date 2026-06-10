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

    if (environment.status === 'stopped') {
      return NextResponse.json({ error: 'Environment is already stopped' }, { status: 400 })
    }

    const updated = await db.environment.update({
      where: { id: envId },
      data: {
        status: 'stopped',
        pid: null,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to stop environment:', error)
    return NextResponse.json({ error: 'Failed to stop environment' }, { status: 500 })
  }
}
