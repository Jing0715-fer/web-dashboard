import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import * as fs from 'fs';
import { db } from '@/lib/db';
import { batchCheckPorts } from '@/lib/process-manager';

const execp = promisify(exec);

interface ServiceHealth {
  projectId: string;
  projectName: string;
  envId: string;
  envName: string;
  port: number;
  status: 'running' | 'stopped';
  httpStatus: number | null;
  responseTime: number | null;
  gatewayAccessible: boolean;
}

interface GatewayStatus {
  caddyRunning: boolean;
  caddyVersion: string;
  gatewayPort: number;
  gatewayListening: boolean;
  configValid: boolean;
  uptime: number;
  systemUptime: number;
  memoryUsage: { total: number; used: number; free: number; percentage: number };
  cpuUsage: number;
  services: ServiceHealth[];
  lastChecked: string;
}

async function isCaddyRunning(): Promise<boolean> {
  try {
    const { stdout } = await execp('pgrep -x caddy 2>/dev/null || echo ""');
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function getCaddyVersion(): Promise<string> {
  try {
    const { stdout } = await execp('caddy version 2>/dev/null');
    return stdout.trim().split('\n')[0] || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

async function isPortListening(port: number): Promise<boolean> {
  try {
    const { stdout } = await execp(`ss -tlnp 2>/dev/null | grep ':${port} '`);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function getCaddyUptimeSeconds(): Promise<number> {
  try {
    const { stdout } = await execp('ps -o etimes= -p $(pgrep -x caddy | head -1) 2>/dev/null || echo 0');
    return parseInt(stdout.trim(), 10) || 0;
  } catch {
    return 0;
  }
}

async function getCpuUsage(): Promise<number> {
  try {
    if (fs.existsSync('/proc/stat')) {
      const stat1 = fs.readFileSync('/proc/stat', 'utf8');
      const lines1 = stat1.split('\n')[0];
      const vals1 = lines1.split(/\s+/).slice(1).map(Number);
      const idle1 = vals1[3] + vals1[4];
      const total1 = vals1.reduce((a: number, b: number) => a + b, 0);

      await new Promise(r => setTimeout(r, 200));

      const stat2 = fs.readFileSync('/proc/stat', 'utf8');
      const lines2 = stat2.split('\n')[0];
      const vals2 = lines2.split(/\s+/).slice(1).map(Number);
      const idle2 = vals2[3] + vals2[4];
      const total2 = vals2.reduce((a: number, b: number) => a + b, 0);

      const idleDiff = idle2 - idle1;
      const totalDiff = total2 - total1;
      if (totalDiff === 0) return 0;
      return Math.round(((totalDiff - idleDiff) / totalDiff) * 100);
    }
    return 0;
  } catch {
    return 0;
  }
}

async function checkHttpHealth(port: number): Promise<{ status: number | null; responseTime: number | null }> {
  try {
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`http://127.0.0.1:${port}/`, {
      signal: controller.signal,
      headers: { 'Accept': 'text/html' },
    });
    clearTimeout(timeout);
    const responseTime = Date.now() - start;
    return { status: response.status, responseTime };
  } catch {
    return { status: null, responseTime: null };
  }
}

// GET /api/gateway/status
export async function GET() {
  try {
    const [
      caddyRunning,
      caddyVersion,
      gatewayListening,
      caddyUptime,
      cpuUsage,
    ] = await Promise.all([
      isCaddyRunning(),
      getCaddyVersion(),
      isPortListening(81),
      getCaddyUptimeSeconds(),
      getCpuUsage(),
    ]);

    // System memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Get all projects with environments
    const projects = await db.project.findMany({
      include: { environments: true },
    });

    // Check health for each environment
    const allPorts = projects.flatMap(p => p.environments.map(e => e.port));
    const activePorts = await batchCheckPorts(allPorts);

    const serviceHealthChecks = projects.flatMap(project =>
      project.environments.map(async (env) => {
        const isRunning = activePorts.has(env.port);
        let httpStatus: number | null = null;
        let responseTime: number | null = null;
        let gatewayAccessible = false;

        if (isRunning) {
          const health = await checkHttpHealth(env.port);
          httpStatus = health.status;
          responseTime = health.responseTime;
          gatewayAccessible = health.status !== null;
        }

        return {
          projectId: project.id,
          projectName: project.name,
          envId: env.id,
          envName: env.name,
          port: env.port,
          status: isRunning ? 'running' as const : 'stopped' as const,
          httpStatus,
          responseTime,
          gatewayAccessible,
        };
      })
    );

    const services = await Promise.all(serviceHealthChecks);

    const status: GatewayStatus = {
      caddyRunning,
      caddyVersion,
      gatewayPort: 81,
      gatewayListening,
      configValid: caddyRunning && gatewayListening,
      uptime: caddyUptime,
      systemUptime: Math.floor(os.uptime()),
      memoryUsage: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percentage: Math.round((usedMem / totalMem) * 100),
      },
      cpuUsage,
      services,
      lastChecked: new Date().toISOString(),
    };

    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
