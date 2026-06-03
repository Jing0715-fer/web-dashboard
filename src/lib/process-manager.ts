import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { mkdirSync, existsSync, readFileSync, appendFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

const execp = promisify(exec);

// Global process registry
const processes = new Map<string, ChildProcess>();

// Log directory
const LOG_DIR = '/tmp/web-dashboard-logs';
const MAX_LOG_SIZE = 1024 * 1024; // 1MB max log file size

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

function getLogKey(projectId: string, envName: string): string {
  return `${projectId}:${envName}`;
}

function getLogFilePath(key: string): string {
  // Sanitize key for filename
  const safeKey = key.replace(/[^a-zA-Z0-9:._-]/g, '_');
  return join(LOG_DIR, `${safeKey}.log`);
}

function appendLog(key: string, line: string) {
  try {
    const filePath = getLogFilePath(key);
    appendFileSync(filePath, line + '\n', 'utf8');
    
    // Trim log file if too large
    try {
      const stat = statSync(filePath);
      if (stat.size > MAX_LOG_SIZE) {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const trimmed = lines.slice(-200).join('\n');
        writeFileSync(filePath, trimmed, 'utf8');
      }
    } catch {
      // ignore trim errors
    }
  } catch {
    // ignore file write errors
  }
}

export function getLogs(projectId: string, envName: string): string[] {
  const key = getLogKey(projectId, envName);
  const filePath = getLogFilePath(key);
  try {
    if (!existsSync(filePath)) return [];
    const content = readFileSync(filePath, 'utf8');
    return content.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if a port is currently in use (listening)
 */
export async function checkPortStatus(port: number): Promise<boolean> {
  try {
    // Try lsof first
    const { stdout: lsofOut } = await execp(`lsof -iTCP:${port} -sTCP:LISTEN -n -P 2>/dev/null`);
    if (lsofOut.trim().length > 0) return true;
  } catch {
    // lsof not available, try ss
  }
  try {
    const { stdout: ssOut } = await execp(`ss -tlnp 2>/dev/null | grep ':${port} '`);
    if (ssOut.trim().length > 0) return true;
  } catch {
    // ss not available either
  }
  return false;
}

/**
 * Get the PID of a process listening on a port
 */
export async function getPidOnPort(port: number): Promise<number | null> {
  // Try lsof first
  try {
    const { stdout } = await execp(`lsof -iTCP:${port} -sTCP:LISTEN -n -P -t 2>/dev/null`);
    const pid = parseInt(stdout.trim().split('\n')[0], 10);
    if (!isNaN(pid) && pid > 0) return pid;
  } catch {
    // lsof not available
  }

  // Fallback: use ss
  try {
    const { stdout } = await execp(`ss -tlnp 'sport = :${port}' 2>/dev/null`);
    // ss output format: LISTEN  0  128  *:3000  *:*  users:(("node",pid=12345,fd=18))
    const match = stdout.match(/pid=(\d+)/);
    if (match) {
      const pid = parseInt(match[1], 10);
      if (!isNaN(pid) && pid > 0) return pid;
    }
  } catch {
    // ss not available
  }

  // Fallback: use fuser
  try {
    const { stdout } = await execp(`fuser ${port}/tcp 2>/dev/null`);
    const pid = parseInt(stdout.trim().split(/\s+/)[0], 10);
    if (!isNaN(pid) && pid > 0) return pid;
  } catch {
    // fuser not available
  }

  return null;
}

/**
 * Parse a command string into shell-compatible format.
 * For complex commands (with &&, ||, pipes), use shell mode.
 */
function parseCommand(cmd: string): { useShell: boolean; command: string; args: string[] } {
  // If the command contains shell operators, use shell mode
  const shellOperators = ['&&', '||', '|', '>', '<', '>>', '<<', ';', '$(', '`'];
  const needsShell = shellOperators.some(op => cmd.includes(op));

  if (needsShell) {
    return { useShell: true, command: '/bin/sh', args: ['-c', cmd] };
  }

  const parts = cmd.split(' ');
  return { useShell: false, command: parts[0], args: parts.slice(1) };
}

/**
 * Start a process for a project environment
 */
export async function startProcess(
  projectId: string,
  envName: string,
  cmd: string,
  cwd: string,
  envVars: Record<string, string> = {},
  port: number
): Promise<{ success: boolean; pid?: number; error?: string }> {
  const key = getLogKey(projectId, envName);

  // Check if already running on this port
  const isRunning = await checkPortStatus(port);
  if (isRunning) {
    return { success: false, error: `Port ${port} is already in use` };
  }

  // Kill any existing tracked process
  const existing = processes.get(key);
  if (existing) {
    try { existing.kill('SIGTERM'); } catch { /* ignore */ }
    processes.delete(key);
  }

  // Check if the cwd exists
  if (!existsSync(cwd)) {
    return { success: false, error: `Directory does not exist: ${cwd}` };
  }

  try {
    const env = {
      ...process.env,
      ...envVars,
      PORT: String(port),
    };

    const { useShell, command, args } = parseCommand(cmd);

    appendLog(key, `[${new Date().toISOString()}] Starting: ${cmd} (port: ${port}, cwd: ${cwd})`);
    appendLog(key, `[${new Date().toISOString()}] Shell mode: ${useShell}`);

    const child = spawn(command, args, {
      cwd,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach(line => appendLog(key, line));
    });

    child.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n').filter(Boolean);
      lines.forEach(line => appendLog(key, `[stderr] ${line}`));
    });

    child.on('error', (err) => {
      appendLog(key, `[${new Date().toISOString()}] Spawn Error: ${err.message}`);
      processes.delete(key);
    });

    child.on('exit', (code, signal) => {
      appendLog(key, `[${new Date().toISOString()}] Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`);
      processes.delete(key);
    });

    // Detach so process survives parent exit
    child.unref();

    processes.set(key, child);

    // Wait for the process to initialize, then check if it's still alive
    await new Promise(resolve => setTimeout(resolve, 2000));

    if (child.exitCode !== null) {
      // Process already exited - get the error from logs
      const logs = getLogs(projectId, envName);
      const errorLines = logs.filter(l => l.includes('[stderr]') || l.includes('Error') || l.includes('error') || l.includes('ENOENT') || l.includes('not found'));
      const errorMsg = errorLines.length > 0
        ? errorLines.slice(-3).map(l => l.replace('[stderr] ', '')).join('; ')
        : 'Process exited immediately. Check logs for details.';
      return { success: false, error: errorMsg };
    }

    // Check if port is now in use
    const portActive = await checkPortStatus(port);
    if (portActive) {
      appendLog(key, `[${new Date().toISOString()}] ✅ Port ${port} is now active`);
    } else {
      appendLog(key, `[${new Date().toISOString()}] ⏳ Port ${port} is not yet active (process may still be starting)`);
    }

    return { success: true, pid: child.pid || undefined };
  } catch (err: any) {
    appendLog(key, `[${new Date().toISOString()}] Failed to start: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Stop a process for a project environment
 */
export async function stopProcess(
  projectId: string,
  envName: string,
  port: number
): Promise<{ success: boolean; error?: string }> {
  const key = getLogKey(projectId, envName);

  // Try to kill via tracked process first
  const child = processes.get(key);
  if (child && child.pid) {
    try {
      process.kill(child.pid, 'SIGTERM');
      appendLog(key, `[${new Date().toISOString()}] Sent SIGTERM to tracked process ${child.pid}`);
    } catch {
      // Process might already be dead
    }
    processes.delete(key);
  }

  // Also try to kill via port
  const pid = await getPidOnPort(port);
  if (pid) {
    try {
      process.kill(pid, 'SIGTERM');
      appendLog(key, `[${new Date().toISOString()}] Sent SIGTERM to process ${pid} on port ${port}`);
    } catch {
      // Process might already be dead
    }
  }

  // Wait and verify
  await new Promise(resolve => setTimeout(resolve, 1500));
  const stillRunning = await checkPortStatus(port);
  if (stillRunning) {
    // Force kill
    const pid2 = await getPidOnPort(port);
    if (pid2) {
      try {
        process.kill(pid2, 'SIGKILL');
        appendLog(key, `[${new Date().toISOString()}] Force killed process ${pid2}`);
      } catch {
        // ignore
      }
    }
  }

  return { success: true };
}

/**
 * Restart a process
 */
export async function restartProcess(
  projectId: string,
  envName: string,
  cmd: string,
  cwd: string,
  envVars: Record<string, string> = {},
  port: number
): Promise<{ success: boolean; pid?: number; error?: string }> {
  await stopProcess(projectId, envName, port);
  await new Promise(resolve => setTimeout(resolve, 500));
  return startProcess(projectId, envName, cmd, cwd, envVars, port);
}

/**
 * Read a project directory and gather info for LLM analysis
 */
export async function readProjectDir(dirPath: string): Promise<{
  success: boolean;
  files?: string[];
  packageJson?: any;
  configFile?: { name: string; content: string }[];
  error?: string;
}> {
  try {
    // Check directory exists
    await execp(`ls -la "${dirPath}" 2>&1`);
    
    // List top-level files
    const { stdout: findOutput } = await execp(
      `find "${dirPath}" -maxdepth 2 -type f \\( -name "*.json" -o -name "*.yaml" -o -name "*.yml" -o -name "*.toml" -o -name "*.env*" -o -name "Dockerfile" -o -name "docker-compose*" -o -name "Makefile" -o -name "*.config.*" -o -name "next.config.*" -o -name "vite.config.*" -o -name "nuxt.config.*" -o -name "vue.config.*" -o -name ".env*" \\) 2>/dev/null | head -30`
    );

    const files = findOutput.trim().split('\n').filter(Boolean);

    // Try to read package.json
    let packageJson = null;
    try {
      const { stdout: pjContent } = await execp(`cat "${dirPath}/package.json" 2>/dev/null`);
      packageJson = JSON.parse(pjContent);
    } catch {
      // No package.json, might not be a Node.js project
    }

    // Read key config files
    const configFileNames = [
      'package.json', 'next.config.js', 'next.config.ts', 'next.config.mjs',
      'vite.config.ts', 'vite.config.js', 'nuxt.config.ts', 'nuxt.config.js',
      'vue.config.js', 'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
      '.env', '.env.local', '.env.development', '.env.production',
      'tsconfig.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml',
      'go.mod', 'Makefile',
    ];

    const configFiles: { name: string; content: string }[] = [];
    for (const fname of configFileNames) {
      try {
        const fpath = join(dirPath, fname);
        const { stdout: content } = await execp(`cat "${fpath}" 2>/dev/null | head -100`);
        if (content.trim()) {
          configFiles.push({ name: fname, content: content.trim() });
        }
      } catch {
        // skip
      }
    }

    return {
      success: true,
      files,
      packageJson,
      configFile: configFiles,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
