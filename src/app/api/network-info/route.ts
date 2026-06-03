import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execp = promisify(exec);

// GET /api/network-info - Get LAN IP addresses
export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    const lanIPs: Array<{ address: string; interface: string; family: string }> = [];

    for (const [name, nets] of Object.entries(interfaces)) {
      if (!nets) continue;
      for (const net of nets) {
        // Skip internal (loopback) and non-IPv4 addresses
        if (!net.internal && net.family === 'IPv4') {
          lanIPs.push({
            address: net.address,
            interface: name,
            family: net.family,
          });
        }
      }
    }

    // Try to get the primary/default gateway IP
    let primaryIP = '';
    try {
      if (process.platform === 'linux' || process.platform === 'darwin') {
        // Get default route interface
        const { stdout } = await execp("ip route show default 2>/dev/null | awk '{print $5}' || route -n get default 2>/dev/null | grep interface | awk '{print $2}'");
        const defaultIface = stdout.trim().split('\n')[0].trim();
        if (defaultIface && interfaces[defaultIface]) {
          const net = interfaces[defaultIface]?.find(n => !n.internal && n.family === 'IPv4');
          if (net) {
            primaryIP = net.address;
          }
        }
      }
    } catch {
      // Ignore errors, just use first IP
    }

    // Fallback: use first LAN IP if primary not found
    if (!primaryIP && lanIPs.length > 0) {
      primaryIP = lanIPs[0].address;
    }

    // Get hostname
    const hostname = os.hostname();

    return NextResponse.json({
      lanIPs,
      primaryIP,
      hostname,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
