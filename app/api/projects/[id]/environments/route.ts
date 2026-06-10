import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const environments = await db.environment.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(environments)
  } catch (error) {
    console.error('Failed to fetch environments:', error)
    return NextResponse.json({ error: 'Failed to fetch environments' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, cmd, port, envVars } = body

    if (!name || !cmd || !port) {
      return NextResponse.json({ error: 'Name, cmd, and port are required' }, { status: 400 })
    }

    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const environment = await db.environment.create({
      data: {
        projectId: id,
        name,
        cmd,
        port,
        envVars: envVars ? JSON.stringify(envVars) : '{}',
        status: 'stopped',
      },
    })

    return NextResponse.json(environment, { status: 201 })
  } catch (error) {
    console.error('Failed to create environment:', error)
    return NextResponse.json({ error: 'Failed to create environment' }, { status: 500 })
  }
}
