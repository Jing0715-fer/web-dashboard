import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const project = await db.project.findUnique({
      where: { id },
      include: { environments: true },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Mock AI analysis based on project data
    const envCount = project.environments.length
    const runningEnvs = project.environments.filter((e) => e.status === 'running').length
    const tags = JSON.parse(project.tags) as string[]

    const analysis = {
      projectId: id,
      projectName: project.name,
      analyzedAt: new Date().toISOString(),
      summary: `Project "${project.name}" has ${envCount} environment(s) with ${runningEnvs} currently running. ${project.description ? `Description: ${project.description}` : 'No description provided.'}`,
      insights: [
        {
          type: 'architecture',
          severity: 'info',
          message: envCount === 0
            ? 'No environments configured. Consider adding at least a development environment.'
            : `${envCount} environment(s) detected. Consider ensuring each environment has distinct configuration.`,
        },
        {
          type: 'security',
          severity: 'warning',
          message: 'Ensure environment variables containing secrets are not committed to version control. Use .env files with proper .gitignore rules.',
        },
        {
          type: 'performance',
          severity: 'info',
          message: runningEnvs > 2
            ? `${runningEnvs} environments are running simultaneously. Monitor resource usage to prevent system overload.`
            : 'Current resource usage appears optimal.',
        },
        {
          type: 'best_practices',
          severity: 'info',
          message: tags.length === 0
            ? 'No tags defined. Adding tags improves project discoverability and organization.'
            : `Tags detected: ${tags.join(', ')}. Consider adding more descriptive tags for better categorization.`,
        },
        {
          type: 'configuration',
          severity: 'info',
          message: project.path.length > 80
            ? 'Project path is unusually long. Consider using shorter directory names to avoid potential path resolution issues.'
            : 'Project path length is within normal range.',
        },
      ],
      recommendations: [
        'Set up CI/CD pipeline for automated deployments',
        'Implement health check endpoints for each service',
        'Configure log aggregation for better observability',
        'Add monitoring alerts for critical service downtime',
        'Consider containerizing environments for consistency',
      ],
      riskLevel: runningEnvs > 3 ? 'high' : runningEnvs > 1 ? 'medium' : 'low',
    }

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('Failed to analyze project:', error)
    return NextResponse.json({ error: 'Failed to analyze project' }, { status: 500 })
  }
}
