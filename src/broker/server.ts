import { randomUUID } from 'node:crypto';
import * as http from 'node:http';
import type {
  AgentSession,
  BrokerSnapshot,
  FocusCommand,
  FocusRequest,
  HeartbeatPayload,
  WindowDescriptor,
} from '../core/types';
import {
  BROKER_HOST,
  BROKER_PORT,
  BROKER_SERVICE,
  STALE_WINDOW_MS,
} from './protocol';

interface WindowRecord {
  window: WindowDescriptor;
  sessions: AgentSession[];
  lastSeen: number;
}

export class BrokerServer {
  private server: http.Server | undefined;
  private readonly windows = new Map<string, WindowRecord>();
  private readonly commands = new Map<string, FocusCommand[]>();

  public async start(): Promise<boolean> {
    if (this.server) {
      return true;
    }

    const server = http.createServer((request, response) => {
      void this.handle(request, response);
    });

    const started = await new Promise<boolean>((resolve, reject) => {
      const onError = (error: NodeJS.ErrnoException): void => {
        server.off('listening', onListening);
        if (error.code === 'EADDRINUSE') {
          resolve(false);
          return;
        }
        reject(error);
      };
      const onListening = (): void => {
        server.off('error', onError);
        resolve(true);
      };

      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(BROKER_PORT, BROKER_HOST);
    });

    if (started) {
      this.server = server;
    } else {
      server.close();
    }

    return started;
  }

  public dispose(): void {
    this.server?.close();
    this.server = undefined;
  }

  private async handle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): Promise<void> {
    try {
      const url = new URL(request.url ?? '/', `http://${BROKER_HOST}:${BROKER_PORT}`);
      this.cleanup();

      if (request.method === 'GET' && url.pathname === '/health') {
        this.json(response, 200, { service: BROKER_SERVICE });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/heartbeat') {
        const payload = await this.readJson<HeartbeatPayload>(request);
        if (!payload.window?.id || !Array.isArray(payload.sessions)) {
          this.json(response, 400, { error: 'Invalid heartbeat payload' });
          return;
        }
        this.windows.set(payload.window.id, {
          window: payload.window,
          sessions: payload.sessions,
          lastSeen: Date.now(),
        });
        this.json(response, 200, { ok: true });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/snapshot') {
        this.json(response, 200, this.snapshot());
        return;
      }

      if (request.method === 'POST' && url.pathname === '/focus') {
        const payload = await this.readJson<FocusRequest>(request);
        if (!payload.targetWindowId || !payload.terminalId) {
          this.json(response, 400, { error: 'Invalid focus request' });
          return;
        }
        const queue = this.commands.get(payload.targetWindowId) ?? [];
        queue.push({
          id: randomUUID(),
          terminalId: payload.terminalId,
          createdAt: Date.now(),
        });
        this.commands.set(payload.targetWindowId, queue);
        this.json(response, 202, { ok: true });
        return;
      }

      if (request.method === 'GET' && url.pathname === '/commands') {
        const windowId = url.searchParams.get('windowId');
        if (!windowId) {
          this.json(response, 400, { error: 'windowId is required' });
          return;
        }
        const queue = this.commands.get(windowId) ?? [];
        this.commands.set(windowId, []);
        this.json(response, 200, { commands: queue });
        return;
      }

      this.json(response, 404, { error: 'Not found' });
    } catch (error) {
      this.json(response, 500, {
        error: error instanceof Error ? error.message : 'Unknown broker error',
      });
    }
  }

  private snapshot(): BrokerSnapshot {
    return {
      windows: [...this.windows.values()].map((record) => record.window),
      sessions: [...this.windows.values()].flatMap((record) => record.sessions),
      serverTime: Date.now(),
    };
  }

  private cleanup(): void {
    const staleBefore = Date.now() - STALE_WINDOW_MS;
    for (const [windowId, record] of this.windows) {
      if (record.lastSeen < staleBefore) {
        this.windows.delete(windowId);
        this.commands.delete(windowId);
      }
    }
  }

  private async readJson<T>(request: http.IncomingMessage): Promise<T> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > 1_000_000) {
        throw new Error('Request body too large');
      }
      chunks.push(buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
  }

  private json(response: http.ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    response.end(JSON.stringify(body));
  }
}

