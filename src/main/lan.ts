import dgram from 'node:dgram';
import os from 'node:os';
import { getStoredConfig } from './db';

export const LAN_BROADCAST_PORT = 41234;
const BROADCAST_INTERVAL_MS = 5000;

let broadcastTimer: NodeJS.Timeout | null = null;
let broadcastSocket: dgram.Socket | null = null;
let isBroadcasting = false;

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return '127.0.0.1';
}

function buildPayload() {
  const config = getStoredConfig();
  return JSON.stringify({
    type: 'best12-server',
    host: getLocalIpAddress(),
    dbHost: config.host,
    dbPort: config.port,
    database: config.database,
    timestamp: Date.now(),
  });
}

export function getBroadcastStatus() {
  return {
    isBroadcasting,
    port: LAN_BROADCAST_PORT,
    localIp: getLocalIpAddress(),
  };
}

export function startBroadcast(): { success: true } | { success: false; error: string } {
  if (isBroadcasting) {
    return { success: true };
  }

  try {
    broadcastSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    broadcastSocket.bind(LAN_BROADCAST_PORT, () => {
      broadcastSocket?.setBroadcast(true);
    });

    const send = () => {
      const message = Buffer.from(buildPayload());
      broadcastSocket?.send(
        message,
        0,
        message.length,
        LAN_BROADCAST_PORT,
        '255.255.255.255',
        () => undefined,
      );
    };

    send();
    broadcastTimer = setInterval(send, BROADCAST_INTERVAL_MS);
    isBroadcasting = true;
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start broadcast',
    };
  }
}

export function stopBroadcast(): void {
  if (broadcastTimer) {
    clearInterval(broadcastTimer);
    broadcastTimer = null;
  }
  if (broadcastSocket) {
    broadcastSocket.close();
    broadcastSocket = null;
  }
  isBroadcasting = false;
}

export function discoverServer(
  timeoutMs = 5000,
): Promise<{ success: true; host: string; dbPort: number; database: string } | { success: false; error: string }> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    let settled = false;

    const finish = (
      result:
        | { success: true; host: string; dbPort: number; database: string }
        | { success: false; error: string },
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      resolve(result);
    };

    socket.on('message', (msg) => {
      try {
        const payload = JSON.parse(msg.toString()) as {
          type?: string;
          host?: string;
          dbHost?: string;
          dbPort?: number;
          database?: string;
        };
        if (payload.type === 'best12-server' && payload.dbHost) {
          finish({
            success: true,
            host: payload.dbHost,
            dbPort: payload.dbPort ?? 5432,
            database: payload.database ?? 'best12_dev',
          });
        }
      } catch {
        // ignore malformed packets
      }
    });

    socket.bind(LAN_BROADCAST_PORT, () => {
      socket.setBroadcast(true);
      const probe = Buffer.from(JSON.stringify({ type: 'best12-discover' }));
      socket.send(probe, 0, probe.length, LAN_BROADCAST_PORT, '255.255.255.255', () => undefined);
    });

    const timer = setTimeout(() => {
      finish({ success: false, error: 'No server found on the LAN. Enter the server IP manually.' });
    }, timeoutMs);
  });
}
