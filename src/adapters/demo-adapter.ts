import * as vscode from 'vscode';
import type { AgentKind, AttentionState } from '../core/types';
import { SessionRegistry } from '../core/session-registry';
import { TerminalDiscovery } from '../terminal/discovery';

interface DemoRecord {
  terminal: vscode.Terminal;
  sessionId: string;
}

const cycle: AttentionState[] = ['working', 'needsYou', 'done', 'unknown'];

const reasons: Record<AttentionState, string> = {
  working: 'Editing and running tests',
  needsYou: 'Permission required',
  done: 'Task completed',
  unknown: 'Waiting for a confirmed adapter signal',
};

export class DemoAdapter implements vscode.Disposable {
  private readonly records: DemoRecord[] = [];

  public constructor(
    private readonly registry: SessionRegistry,
    private readonly discovery: TerminalDiscovery,
  ) {}

  public start(): void {
    if (this.records.length === 0) {
      this.records.push(
        this.createTerminal('Claude · API refactor', 'claude'),
        this.createTerminal('Codex · Test suite', 'codex'),
        this.createTerminal('Claude · README', 'claude'),
      );
    }
    this.reset();
  }

  public advance(): void {
    if (this.records.length === 0) {
      this.start();
      return;
    }

    for (const record of this.records) {
      const current = this.registry.get(record.sessionId);
      if (!current) {
        continue;
      }
      const currentIndex = cycle.indexOf(current.state);
      const next = cycle[(currentIndex + 1) % cycle.length] ?? 'unknown';
      this.registry.upsert({
        ...current,
        state: next,
        reason: reasons[next],
        confidence: next === 'unknown' ? 'unknown' : 'confirmed',
        updatedAt: Date.now(),
      });
    }
  }

  public reset(): void {
    const initial: AttentionState[] = ['working', 'needsYou', 'done'];
    this.records.forEach((record, index) => {
      const current = this.registry.get(record.sessionId);
      if (!current) {
        return;
      }
      const state = initial[index] ?? 'unknown';
      this.registry.upsert({
        ...current,
        state,
        reason: reasons[state],
        confidence: state === 'unknown' ? 'unknown' : 'confirmed',
        source: 'demo',
        updatedAt: Date.now() + index,
      });
    });
  }

  public dispose(): void {
    for (const record of this.records) {
      record.terminal.dispose();
    }
    this.records.length = 0;
    this.registry.clearSource('demo');
  }

  private createTerminal(label: string, agent: AgentKind): DemoRecord {
    const terminal = vscode.window.createTerminal({
      name: `Agent Garden Demo · ${label}`,
      message: 'Agent Garden demo terminal. No API key or agent account is required.',
    });
    const sessionId = this.discovery.trackTerminal(terminal, agent, 'demo');
    return { terminal, sessionId };
  }
}

