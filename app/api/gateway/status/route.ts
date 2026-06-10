import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Mock gateway status with realistic data
    const uptimeSeconds = Math.floor(Math.random() * 864000) + 3600 // 1-10 days
    const systemUptimeSeconds = uptimeSeconds + Math.floor(Math.random() * 172800) // slightly longer
    const memoryTotal = 16384 // 16GB
    const memoryUsed = Math.floor(Math.random() * 8192) + 2048 // 2-10GB
    const cpuUsage = Math.floor(Math.random() * 60) + 5 // 5-65%

    const status = {
      caddyRunning: true,
      caddyVersion: '2.8.4',
      gatewayPort: 3000,
      gatewayListening: true,
      configValid: true,
      uptime: formatUptime(uptimeSeconds),
      uptimeSeconds,
      systemUptime: formatUptime(systemUptimeSeconds),
      systemUptimeSeconds,
      memoryUsage: {
        total: memoryTotal,
        used: memoryUsed,
        free: memoryTotal - memoryUsed,
        percentage: Math.round((memoryUsed / memoryTotal) * 100),
      },
      cpuUsage: {
        percentage: cpuUsage,
        cores: 4,
        loadAverage: [cpuUsage / 25, cpuUsage / 25 - 0.2, cpuUsage / 25 - 0.4].map((v) =>
          Math.max(0.1, Math.round(v * 100) / 100)
        ),
      },
      services: [
        {
          name: 'nextjs-app',
          status: 'running',
          port: 3000,
          pid: 1001,
          uptime: formatUptime(uptimeSeconds),
          memory: Math.floor(Math.random() * 512) + 128,
        },
        {
          name: 'caddy-gateway',
          status: 'running',
          port: 80,
          pid: 1002,
          uptime: formatUptime(uptimeSeconds),
          memory: Math.floor(Math.random() * 64) + 16,
        },
        {
          name: 'prisma-engine',
          status: 'running',
          port: 0,
          pid: 1003,
          uptime: formatUptime(uptimeSeconds),
          memory: Math.floor(Math.random() * 128) + 32,
        },
      ],
      agentGateways: [
        {
          name: 'primary',
          url: 'localhost:3000',
          connected: true,
          lastPing: new Date(Date.now() - 5000).toISOString(),
        },
      ],
      lastChecked: new Date().toISOString(),
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error('Failed to fetch gateway status:', error)
    return NextResponse.json({ error: 'Failed to fetch gateway status' }, { status: 500 })
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}d`)
  if (hours > 0) parts.push(`${hours}h`)
  parts.push(`${minutes}m`)

  return parts.join(' ')
}
