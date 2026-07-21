import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { detectAgent, externalEventState } from '../core/state-machine';
import type {
  AgentKind,
  AgentSession,
  Confidence,
  ExternalAgentEvent,
  SessionSource,
} from '../core/types';
import { SessionRegistry } from '../core/session-registry';

export class TerminalDiscovery implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private readonly terminalIds = new Map<vscode.Terminal, string>();
  private readonly terminalsById = new Map<string, vscode.Terminal>();

  public constructor(
    private readonly registry: SessionRegistry,
    private readonly windowId: string,
    private readonly workspaceName: string,
  ) {}

  public initialize(): void {
    for (const terminal of vscode.window.terminals) {
      this.observeTerminalName(terminal);
    }

    this.disposables.push(
      vscode.window.onDidOpenTerminal((terminal) => this.observeTerminalName(terminal)),
      vscode.window.onDidCloseTerminal((terminal) => this.handleClose(terminal)),
      vscode.window.onDidStartTerminalShellExecution((event) => {
        const commandLine = event.execution.commandLine;
        const agent = detectAgent(commandLine.value);
        if (agent === 'unknown') {
          return;
        }
        const confidence: Confidence =
          commandLine.confidence === vscode.TerminalShellExecutionCommandLineConfidence.High
            ? 'confirmed'
            : 'inferred';
        const sessionId = this.trackTerminal(event.terminal, agent, 'shell');
        this.registry.upsert({
          ...this.baseSession(sessionId, event.terminal, agent, 'shell'),
          cwd: event.execution.cwd?.fsPath,
          state: 'needsYou',
          reason: 'Ready for your instruction',
          // Starting a shell command only proves that the CLI exists. The
          // adapter hook/plugin is what confirms that it is actively working.
          confidence: confidence === 'confirmed' ? 'inferred' : confidence,
          updatedAt: Date.now(),
        });
      }),
      vscode.window.onDidEndTerminalShellExecution((event) => {
        const agent = detectAgent(event.execution.commandLine.value);
        const knownSessionId = this.terminalIds.get(event.terminal);
        if (!knownSessionId && agent === 'unknown') {
          return;
        }
        this.forgetTerminal(event.terminal, knownSessionId);
      }),
    );
  }

  public trackTerminal(
    terminal: vscode.Terminal,
    agent: AgentKind,
    source: SessionSource,
  ): string {
    const existing = this.terminalIds.get(terminal);
    if (existing) {
      return existing;
    }

    const terminalId = randomUUID();
    this.terminalIds.set(terminal, terminalId);
    this.terminalsById.set(terminalId, terminal);

    return terminalId;
  }

  public focus(terminalId: string): boolean {
    const terminal = this.terminalsById.get(terminalId);
    if (!terminal) {
      return false;
    }
    terminal.show(false);
    return true;
  }

  public applyExternalEvent(event: ExternalAgentEvent): boolean {
    if (event.targetWindowId && event.targetWindowId !== this.windowId) {
      return false;
    }
    const transition = externalEventState(event);
    if (!transition) {
      return false;
    }

    const candidates = this.registry.getAll().filter((session) => {
      if (session.windowId !== this.windowId || session.agent !== event.agent) {
        return false;
      }
      if (session.externalSessionId && event.externalSessionId) {
        return session.externalSessionId === event.externalSessionId;
      }
      return true;
    });
    const eventCwd = event.cwd;
    const cwdMatches = eventCwd
      ? candidates.filter((session) => samePath(session.cwd, eventCwd))
      : [];
    const target = (cwdMatches.length > 0 ? cwdMatches : candidates)
      .sort((left, right) => right.updatedAt - left.updatedAt)[0];
    if (!target) {
      return false;
    }

    this.registry.upsert({
      ...target,
      ...transition,
      source: 'hook',
      cwd: event.cwd ?? target.cwd,
      externalSessionId: event.externalSessionId ?? target.externalSessionId,
      preview: event.preview ?? target.preview,
      updatedAt: event.timestamp,
    });
    return true;
  }

  public dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private observeTerminalName(terminal: vscode.Terminal): void {
    const agent = detectAgent(terminal.name);
    if (agent !== 'unknown') {
      this.trackTerminal(terminal, agent, 'shell');
    }
  }

  private handleClose(terminal: vscode.Terminal): void {
    this.forgetTerminal(terminal);
  }

  private forgetTerminal(terminal: vscode.Terminal, knownSessionId?: string): void {
    const sessionId = knownSessionId ?? this.terminalIds.get(terminal);
    if (!sessionId) {
      return;
    }
    this.registry.remove(sessionId);
    this.terminalIds.delete(terminal);
    this.terminalsById.delete(sessionId);
  }

  private baseSession(
    sessionId: string,
    terminal: vscode.Terminal,
    agent: AgentKind,
    source: SessionSource,
  ): Omit<AgentSession, 'state' | 'confidence' | 'updatedAt'> {
    return {
      sessionId,
      terminalId: sessionId,
      windowId: this.windowId,
      workspaceName: this.workspaceName,
      agent,
      source,
    };
  }
}

function samePath(left: string | undefined, right: string): boolean {
  if (!left) {
    return false;
  }
  const normalize = (value: string): string =>
    value.replace(/[\\/]+$/, '').replaceAll('\\', '/').toLowerCase();
  return normalize(left) === normalize(right);
}
