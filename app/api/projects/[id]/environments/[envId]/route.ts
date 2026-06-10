import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; envId: string }> }
) {
  try {
    const { id, envId } = await params
    const body = await request.json()
    const { port, envVars, name, cmd } = body

    const environment = await db.environment.findFirst({
      where: { id: envId, projectId: id },
    })

    if (!environment) {
      return NextResponse.json({ error: 'Environment not found' }, { status: 404 })
    }

    const updated = await db.environment.update({
      where: { id: envId },
      data: {
        ...(name !== undefined && { name }),
        ...(cmd !== undefined && { cmd }),
        ...(port !== undefined && { port }),
        ...(envVars !== undefined && { envVars: JSON.stringify(envVars) }),
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update environment:', error)
    return NextResponse.json({ error: 'Failed to update environment' }, { status: 500 })
  }
}

export async function DELETE(
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

    await db.environment.delete({ where: { id: envId } })

    return NextResponse.json({ message: 'Environment deleted successfully' })
  } catch (error) {
    console.error('Failed to delete environment:', error)
    return NextResponse.json({ error: 'Failed to delete environment' }, { status: 500 })
  }
}
