import * as http from 'node:http';
import type {
  AgentSession,
  AgentEventsResponse,
  BrokerSnapshot,
  ExternalAgentEvent,
  FocusCommand,
  FocusRequest,
  WindowDescriptor,
} from '../core/types';
import {
  BROKER_HOST,
  BROKER_PORT,
  BROKER_SERVICE,
  HEARTBEAT_INTERVAL_MS,
} from './protocol';
import { BrokerServer } from './server';

interface CommandsResponse {
  commands: FocusCommand[];
}

export interface BrokerClientOptions {
  window: WindowDescriptor;
  getLocalSessions: () => AgentSession[];
  onSnapshot: (snapshot: BrokerSnapshot) => void;
  onFocusCommand: (command: FocusCommand) => void | Promise<void>;
  onAgentEvent?: (event: ExternalAgentEvent) => void | Promise<void>;
  onStatusChange?: (connected: boolean) => void;
}

export class BrokerClient {
  private server: BrokerServer | undefined;
  private timer: NodeJS.Timeout | undefined;
  private running = false;
  private connected = false;
  private lastEventSequence = 0;

  public constructor(private readonly options: BrokerClientOptions) {}

  public async start(): Promise<void> {
    await this.ensureBroker();
    await this.tick();
    this.timer = setInterval(() => void this.tick(), HEARTBEAT_INTERVAL_MS);
  }

  public publishNow(): void {
    void this.tick();
  }

  public async requestFocus(request: FocusRequest): Promise<void> {
    await this.requestJson('POST', '/focus', request);
  }

  public dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.server?.dispose();
    this.setConnected(false);
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;

    try {
      await this.ensureBroker();
      await this.requestJson('POST', '/heartbeat', {
        window: this.options.window,
        sessions: this.options.getLocalSessions(),
      });
      const snapshot = await this.requestJson<BrokerSnapshot>('GET', '/snapshot');
      const commands = await this.requestJson<CommandsResponse>(
        'GET',
        `/commands?windowId=${encodeURIComponent(this.options.window.id)}`,
      );
      const agentEvents = await this.requestJson<AgentEventsResponse>(
        'GET',
        `/agent-events?since=${this.lastEventSequence}`,
      );

      this.options.onSnapshot(snapshot);
      for (const command of commands.commands) {
        await this.options.onFocusCommand(command);
      }
      for (const event of agentEvents.events) {
        await this.options.onAgentEvent?.(event);
      }
      this.lastEventSequence = agentEvents.latestSequence;
      this.setConnected(true);
    } catch {
      this.setConnected(false);
    } finally {
      this.running = false;
    }
  }

  private async ensureBroker(): Promise<void> {
    try {
      const health = await this.requestJson<{ service: string }>('GET', '/health');
      if (health.service === BROKER_SERVICE) {
        return;
      }
    } catch {
      // The first active extension window becomes the broker owner.
    }

    this.server?.dispose();
    const candidate = new BrokerServer();
    const ownsServer = await candidate.start();
    if (ownsServer) {
      this.server = candidate;
      return;
    }
    candidate.dispose();
  }

  private setConnected(value: boolean): void {
    if (this.connected !== value) {
      this.connected = value;
      this.options.onStatusChange?.(value);
    }
  }

  private requestJson<T = unknown>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body));

    return new Promise<T>((resolve, reject) => {
      const request = http.request(
        {
          host: BROKER_HOST,
          port: BROKER_PORT,
          path,
          method,
          timeout: 750,
          headers: data
            ? {
                'content-type': 'application/json',
                'content-length': data.length,
              }
            : undefined,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            if (!response.statusCode || response.statusCode >= 400) {
              reject(new Error(`Broker returned ${response.statusCode ?? 'unknown'}`));
              return;
            }
            try {
              resolve((text ? JSON.parse(text) : undefined) as T);
            } catch (error) {
              reject(error);
            }
          });
        },
      );

      request.on('timeout', () => request.destroy(new Error('Broker timeout')));
      request.on('error', reject);
      if (data) {
        request.write(data);
      }
      request.end();
    });
  }
}
