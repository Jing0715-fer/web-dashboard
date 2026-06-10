import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const projects = await db.project.findMany({
      include: { environments: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, path, description, icon, tags } = body

    if (!name || !path) {
      return NextResponse.json({ error: 'Name and path are required' }, { status: 400 })
    }

    const existing = await db.project.findUnique({ where: { path } })
    if (existing) {
      return NextResponse.json({ error: 'Project with this path already exists' }, { status: 400 })
    }

    const project = await db.project.create({
      data: {
        name,
        path,
        description: description || '',
        icon: icon || 'folder',
        tags: tags ? JSON.stringify(tags) : '[]',
      },
      include: { environments: true },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
