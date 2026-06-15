#!/bin/bash
# build-dmg.sh — Build macOS Agent package as DMG
# Usage: ./scripts/build-dmg.sh [version]
#
# Prerequisites:
#   - create-dmg: brew install create-dmg
#   - Node.js 18+ with pkg: npm install -g pkg
#
# Output: dist/dashboard-agent-macos.dmg

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VERSION="${1:-1.0.0}"
AGENT_DIR="$PROJECT_ROOT/mini-services/agent-macos"
DIST_DIR="$PROJECT_ROOT/dist"
DMG_NAME="dashboard-agent-macos"
DMG_PATH="$DIST_DIR/${DMG_NAME}.dmg"
TMP_DIR="$PROJECT_ROOT/.tmp"

echo "🔨 Building macOS Agent v${VERSION}..."

# ── 1. Prepare agent source ──────────────────────────────────────────────
if [ ! -d "$AGENT_DIR" ]; then
  echo "📦 Creating agent-macos scaffold..."
  mkdir -p "$AGENT_DIR"

  # package.json
  cat > "$AGENT_DIR/package.json" << 'PKGJSON'
{
  "name": "dashboard-agent-macos",
  "version": "1.0.0",
  "private": true,
  "main": "agent.js",
  "scripts": {
    "start": "node agent.js",
    "setup": "node setup.js"
  },
  "dependencies": {
    "better-sqlite3": "^12.10.0"
  }
}
PKGJSON

  # agent.js — minimal HTTP agent server
  cat > "$AGENT_DIR/agent.js" << 'AGENTJS'
const http = require('http');
const { execSync } = require('child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const Database = require('better-sqlite3');

const PORT = parseInt(process.env.PORT || '3100', 10);
const API_KEY = process.env.API_KEY || generateApiKey();
const DB_PATH = process.env.DB_PATH || join(__dirname, 'db', 'agent.db');
const CONFIG_PATH = process.env.CONFIG_PATH || join(__dirname, '.env');

function generateApiKey() {
  return 'da_' + require('crypto').randomBytes(24).toString('hex');
}

function ensureDb() {
  const dbDir = join(__dirname, 'db');
  if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS health_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cpu REAL,
      memory REAL,
      uptime INTEGER,
      recorded_at TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function getSystemInfo() {
  try {
    const cpu = execSync("sysctl -n machdep.cpu.brand_string 2>/dev/null || echo 'Unknown'").toString().trim();
    const mem = execSync("sysctl -n hw.memsize 2>/dev/null").toString().trim();
    const hostname = execSync("hostname").toString().trim();
    const uptime = execSync("sysctl -n kern.boottime 2>/dev/null").toString().trim();
    return { cpu, memory: parseInt(mem) || 0, hostname, nodeVersion: process.version, platform: 'darwin' };
  } catch { return { platform: 'darwin', nodeVersion: process.version }; }
}

function collectHealth() {
  try {
    const cpuLoad = execSync("ps -A -o %cpu | awk '{s+=$1} END {print s}'").toString().trim();
    const memInfo = execSync("vm_stat | head -5").toString();
    const uptime = process.uptime();
    return { cpu: parseFloat(cpuLoad) || 0, memory: memInfo, uptime: Math.round(uptime) };
  } catch { return { cpu: 0, memory: 'N/A', uptime: Math.round(process.uptime()) }; }
}

const db = ensureDb();

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Auth
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ') || auth.slice(7) !== API_KEY) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  // Routes
  if (url.pathname === '/api/agent/health') {
    const health = collectHealth();
    const info = getSystemInfo();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString(), ...health, ...info }));
    return;
  }

  if (url.pathname === '/api/agent/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ apiKey: API_KEY, port: PORT, ...getSystemInfo() }));
    return;
  }

  if (url.pathname === '/api/agent/start-service') {
    try {
      // Launch agent as background service via launchd
      const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.dashboard.agent</string>
  <key>ProgramArguments</key><array><string>${process.execPath}</string><string>${__dirname}/agent.js</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>${__dirname}/logs/agent.log</string>
  <key>StandardErrorPath</key><string>${__dirname}/logs/agent-error.log</string>
</dict></plist>`;
      const logsDir = join(__dirname, 'logs');
      if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
      const plistPath = join(process.env.HOME || '/tmp', 'Library/LaunchAgents/com.dashboard.agent.plist');
      writeFileSync(plistPath, plist);
      execSync(`launchctl load ${plistPath} 2>/dev/null || true`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'service-installed', plistPath }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (url.pathname === '/api/agent/stop-service') {
    try {
      const plistPath = join(process.env.HOME || '/tmp', 'Library/LaunchAgents/com.dashboard.agent.plist');
      execSync(`launchctl unload ${plistPath} 2>/dev/null || true`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'service-stopped' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Default
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🔵 Dashboard Agent running on port ${PORT}`);
  console.log(`   API Key: ${API_KEY}`);
  console.log(`   DB: ${DB_PATH}`);
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
AGENTJS

  # setup.js
  cat > "$AGENT_DIR/setup.js" << 'SETUPJS'
const { execSync } = require('child_process');
const { existsSync, mkdirSync, writeFileSync } = require('fs');
const { join } = require('path');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q) { return new Promise(r => rl.question(q, r)); }

async function main() {
  console.log('\n🔵 Dashboard Agent — macOS Setup\n');

  // Check Node.js
  try {
    const v = execSync('node -v').toString().trim();
    console.log(`✅ Node.js: ${v}`);
  } catch {
    console.log('❌ Node.js not found. Install from https://nodejs.org');
    process.exit(1);
  }

  // Check npm
  try {
    const v = execSync('npm -v').toString().trim();
    console.log(`✅ npm: ${v}`);
  } catch {
    console.log('❌ npm not found.');
    process.exit(1);
  }

  const port = await ask('Agent port [3100]: ');
  const useService = await ask('Install as LaunchAgent (auto-start)? [y/N]: ');
  const apiKey = 'da_' + require('crypto').randomBytes(24).toString('hex');

  // Create .env
  const envContent = `PORT=${port || '3100'}\nAPI_KEY=${apiKey}\n`;
  writeFileSync(join(__dirname, '.env'), envContent);
  console.log('✅ .env created');

  // Install dependencies
  console.log('📦 Installing dependencies...');
  execSync('npm install', { cwd: __dirname, stdio: 'inherit' });

  if (useService.toLowerCase() === 'y') {
    const agentDir = __dirname;
    const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.dashboard.agent</string>
  <key>ProgramArguments</key><array><string>${execSync('which node').toString().trim()}</string><string>${agentDir}/agent.js</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>WorkingDirectory</key><string>${agentDir}</string>
  <key>StandardOutPath</key><string>${agentDir}/logs/agent.log</string>
  <key>StandardErrorPath</key><string>${agentDir}/logs/agent-error.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict></plist>`;
    const logsDir = join(__dirname, 'logs');
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
    const plistPath = join(process.env.HOME, 'Library/LaunchAgents/com.dashboard.agent.plist');
    writeFileSync(plistPath, plist);
    execSync(`launchctl load ${plistPath} 2>/dev/null || true`);
    console.log(`✅ LaunchAgent installed: ${plistPath}`);
  }

  console.log(`\n✅ Setup complete!`);
  console.log(`   API Key: ${apiKey}`);
  console.log(`   Start: node agent.js`);
  console.log(`   Health: http://localhost:${port || '3100'}/api/agent/health`);
  rl.close();
}

main().catch(e => { console.error(e); process.exit(1); });
SETUPJS

  # start.sh
  cat > "$AGENT_DIR/start.sh" << 'STARTSH'
#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi
echo "🔵 Starting Dashboard Agent..."
node agent.js
STARTSH
  chmod +x "$AGENT_DIR/start.sh"

  # README.md
  cat > "$AGENT_DIR/README.md" << 'README'
# Dashboard Agent — macOS

## Quick Start
```bash
./start.sh
```

## Setup Wizard
```bash
node setup.js
```

## Manual Start
```bash
npm install
node agent.js
```

## Install as Service (LaunchAgent)
```bash
node setup.js   # Choose 'y' for LaunchAgent
```

## Environment Variables
- `PORT` — HTTP port (default: 3100)
- `API_KEY` — Auth key (auto-generated)
- `DB_PATH` — SQLite database path

## API Endpoints
- `GET /api/agent/health` — Health check
- `GET /api/agent/info` — Agent info
- `POST /api/agent/start-service` — Install LaunchAgent
- `POST /api/agent/stop-service` — Stop LaunchAgent
README

  # .gitignore
  cat > "$AGENT_DIR/.gitignore" << 'GITIGNORE'
node_modules/
db/
logs/
.env
*.log
dist/
.tmp/
*.zip
*.dmg
GITIGNORE

  echo "✅ agent-macos scaffold created at $AGENT_DIR"
fi

# ── 2. Install dependencies ──────────────────────────────────────────────
echo "📦 Installing dependencies..."
cd "$AGENT_DIR"
if [ ! -d "node_modules" ]; then
  npm install --production 2>/dev/null || npm install
fi

# ── 3. Package with pkg (optional — standalone binary) ──────────────────
USE_PKG="${USE_PKG:-false}"
if [ "$USE_PKG" = "true" ] && command -v pkg &>/dev/null; then
  echo "📦 Building standalone binary with pkg..."
  pkg agent.js --targets node20-macos-x64 --output "$TMP_DIR/dashboard-agent-macos" 2>/dev/null || echo "⚠ pkg build failed, using node source instead"
fi

# ── 4. Create DMG ────────────────────────────────────────────────────────
echo "💿 Creating DMG..."

rm -f "$DMG_PATH"
mkdir -p "$DIST_DIR"

# Check for create-dmg
if command -v create-dmg &>/dev/null; then
  # Create a temp dir for the DMG contents
  STAGING="$TMP_DIR/dmg-staging"
  rm -rf "$STAGING"
  mkdir -p "$STAGING"

  # Copy agent files
  cp -r "$AGENT_DIR" "$STAGING/dashboard-agent-macos"

  # Create symlink to /Applications (optional)
  # ln -s /Applications "$STAGING/Applications"

  # Build DMG
  create-dmg \
    --volname "Dashboard Agent" \
    --volicon "$AGENT_DIR/../agent-windows/dashboard-agent-icon.icns" 2>/dev/null \
    --window-pos 200 120 \
    --window-size 600 400 \
    --icon-size 80 \
    --icon "dashboard-agent-macos" 150 200 \
    --hide-extension "dashboard-agent-macos" \
    --app-drop-link 450 200 \
    "$DMG_PATH" \
    "$STAGING" 2>/dev/null || {
    echo "⚠ create-dmg failed, falling back to zip..."
    USE_PKG="false"
  }
fi

# Fallback: zip
if [ ! -f "$DMG_PATH" ]; then
  ZIP_PATH="$DIST_DIR/${DMG_NAME}.zip"
  echo "📦 Creating ZIP instead (install create-dmg for DMG: brew install create-dmg)..."
  cd "$AGENT_DIR"
  zip -r "$ZIP_PATH" . \
    -x "node_modules/*" -x "db/*" -x "logs/*" -x "*.log" -x ".tmp/*" -x "dist/*" -x "*.zip" -x "*.dmg"
  echo "✅ ZIP created: $ZIP_PATH"
  DMG_PATH="$ZIP_PATH"
fi

# ── 5. Copy to mini-services for download API ────────────────────────────
echo "📋 Updating mini-services directory..."
cp -r "$AGENT_DIR" "$PROJECT_ROOT/mini-services/agent-macos"

echo ""
echo "✅ Build complete!"
echo "   Output: $DMG_PATH"
echo "   Agent:  $PROJECT_ROOT/mini-services/agent-macos"
echo ""
echo "📝 To rebuild: ./scripts/build-dmg.sh"
echo "📝 To serve:  cd mini-services/agent-macos && npm install && node agent.js"
