const http = require('http');
const net = require('net');
const { spawn, exec } = require('child_process');
const path = require('path');

const PROJECT_DIR = '/Users/lijing/Projects/web-dashboard';
const STANDALONE_DIR = path.join(PROJECT_DIR, '.next/standalone');
const PROXY_SCRIPT = path.join(STANDALONE_DIR, 'proxy-server.js');

const PUBLIC_PORT = parseInt(process.env.PUBLIC_PORT, 10) || 3000;
const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT, 10) || 3001;
const OPENCLAW_PORT = parseInt(process.env.OPENCLAW_PORT, 10) || 18789;
const hostname = process.env.HOSTNAME || '0.0.0.0';

let dashboardProcess = null;
let shuttingDown = false;

function startDashboard() {
  const env = {
    ...process.env,
    PORT: String(DASHBOARD_PORT),
    HOSTNAME: '0.0.0.0',
    HOST: '0.0.0.0',
    NODE_ENV: 'production',
  };

  console.log(`[Proxy] Starting Dashboard on 127.0.0.1:${DASHBOARD_PORT}...`);
  dashboardProcess = spawn(
    'node',
    ['server.js'],
    {
      cwd: STANDALONE_DIR,
      env,
      stdio: 'ignore',
      detached: true,
    }
  );

  // Don't keep the parent waiting on the child
  dashboardProcess.unref();

  dashboardProcess.on('exit', (code, signal) => {
    console.log(`[Proxy] Dashboard exited with code ${code}, signal ${signal}`);
    dashboardProcess = null;
    // Auto-restart Dashboard after 2 seconds (unless proxy is shutting down)
    if (!shuttingDown) {
      setTimeout(() => {
        if (!shuttingDown) {
          console.log('[Proxy] Auto-restarting Dashboard...');
          startDashboard();
        }
      }, 2000);
    }
  });
}

function proxyRequest(req, res, targetPort) {
  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: `127.0.0.1:${targetPort}` },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`Proxy error (port ${targetPort}):`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway');
    }
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  if (url.startsWith('/openclaw')) {
    proxyRequest(req, res, OPENCLAW_PORT);
  } else {
    proxyRequest(req, res, DASHBOARD_PORT);
  }
});

// WebSocket upgrade handling - raw TCP tunnel
server.on('upgrade', (req, socket, head) => {
  const url = req.url || '/';
  const targetPort = url.startsWith('/openclaw') ? OPENCLAW_PORT : DASHBOARD_PORT;

  const targetSocket = net.connect(targetPort, '127.0.0.1', () => {
    const headers = Object.entries(req.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    targetSocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
    if (head && head.length > 0) {
      targetSocket.write(head);
    }
    socket.pipe(targetSocket);
    targetSocket.pipe(socket);
  });

  targetSocket.on('error', (err) => {
    console.error(`WS proxy error (port ${targetPort}):`, err.message);
    socket.destroy();
  });

  socket.on('error', () => {
    targetSocket.destroy();
  });
});

server.listen(PUBLIC_PORT, hostname, () => {
  console.log(`Proxy server listening on ${hostname}:${PUBLIC_PORT}`);
  console.log(`  Dashboard -> http://127.0.0.1:${DASHBOARD_PORT}`);
  console.log(`  OpenClaw  -> http://127.0.0.1:${OPENCLAW_PORT}`);

  // Start Dashboard after proxy is listening
  startDashboard();
});

// Cleanup Dashboard on proxy exit
process.on('SIGINT', () => {
  shuttingDown = true;
  if (dashboardProcess) dashboardProcess.kill('SIGTERM');
  process.exit(0);
});
process.on('SIGTERM', () => {
  shuttingDown = true;
  if (dashboardProcess) dashboardProcess.kill('SIGTERM');
  process.exit(0);
});
