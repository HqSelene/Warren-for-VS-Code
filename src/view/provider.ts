import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';
import { sortSessions, stateLabel } from '../core/state-machine';
import type { AgentSession, AttentionState } from '../core/types';

export type PresentationMode = 'utility' | 'garden';

export interface DashboardActions {
  focus: (sessionId: string) => void | Promise<void>;
  toggleMode: () => void;
  refresh: () => void;
}

const stateOrder: AttentionState[] = ['needsYou', 'working', 'done', 'unknown'];

export class DashboardProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  private sessions: AgentSession[] = [];
  private brokerConnected = false;

  public constructor(
    private readonly currentWindowId: string,
    private mode: PresentationMode,
    private readonly actions: DashboardActions,
  ) {}

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.onDidReceiveMessage((message: { command?: string; sessionId?: string }) => {
      switch (message.command) {
        case 'focus':
          if (message.sessionId) {
            void this.actions.focus(message.sessionId);
          }
          break;
        case 'toggleMode':
          this.actions.toggleMode();
          break;
        case 'refresh':
          this.actions.refresh();
          break;
      }
    });
    this.render();
  }

  public setSessions(sessions: AgentSession[]): void {
    this.sessions = sortSessions(sessions);
    this.render();
  }

  public getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.find((session) => session.sessionId === sessionId);
  }

  public setBrokerConnected(connected: boolean): void {
    this.brokerConnected = connected;
    this.render();
  }

  public setMode(mode: PresentationMode): void {
    this.mode = mode;
    this.render();
  }

  private render(): void {
    if (!this.view) {
      return;
    }
    this.view.webview.html = this.html(this.view.webview);
  }

  private html(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString('base64');
    const groups = stateOrder
      .map((state) => {
        const sessions = this.sessions.filter((session) => session.state === state);
        if (sessions.length === 0) {
          return '';
        }
        return `<section class="group group-${state}">
          <div class="group-title"><span>${stateLabel(state)}</span><span>${sessions.length}</span></div>
          ${sessions.map((session) => this.sessionCard(session)).join('')}
        </section>`;
      })
      .join('');

    const content = groups || `<div class="empty">
      <div class="empty-icon">🌱</div>
      <strong>No agents detected yet</strong>
      <p>Open a new integrated terminal and start Claude, Codex, or OpenCode.</p>
    </div>`;

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 10px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); }
    button { font: inherit; }
    .header { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:10px; }
    .brand { display:flex; align-items:center; gap:7px; font-weight:700; }
    .connection { width:8px; height:8px; border-radius:50%; background:${this.brokerConnected ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-testing-iconQueued)'}; box-shadow:0 0 0 3px color-mix(in srgb, currentColor 12%, transparent); }
    .toolbar { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px; }
    .toolbar button { border:1px solid var(--vscode-button-border, transparent); color:var(--vscode-button-foreground); background:var(--vscode-button-background); padding:6px 8px; border-radius:5px; cursor:pointer; }
    .toolbar button.secondary { color:var(--vscode-button-secondaryForeground); background:var(--vscode-button-secondaryBackground); }
    .group { margin: 0 0 14px; }
    .group-title { display:flex; justify-content:space-between; margin:0 2px 6px; color:var(--vscode-descriptionForeground); font-size:11px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
    .session-card { width:100%; display:grid; grid-template-columns:${this.mode === 'garden' ? '36px' : '9px'} 1fr auto; gap:9px; align-items:center; margin:0 0 6px; padding:9px; border:1px solid var(--vscode-widget-border); border-left:3px solid var(--state-color); border-radius:7px; color:var(--vscode-foreground); background:var(--vscode-editorWidget-background); text-align:left; cursor:pointer; }
    .session-card:hover { background:var(--vscode-list-hoverBackground); }
    .session-card:focus-visible { outline:1px solid var(--vscode-focusBorder); outline-offset:1px; }
    .state-working { --state-color:var(--vscode-charts-blue); }
    .state-needsYou { --state-color:var(--vscode-charts-orange); }
    .state-done { --state-color:var(--vscode-testing-iconPassed); }
    .state-unknown { --state-color:var(--vscode-disabledForeground); }
    .dot { width:8px; height:8px; border-radius:50%; background:var(--state-color); }
    .pet { font-size:24px; line-height:1; transform-origin:center bottom; }
    .state-working .pet { animation:work .8s ease-in-out infinite alternate; }
    .state-needsYou .pet { animation:ask .7s ease-in-out infinite alternate; }
    .state-unknown .pet { filter:grayscale(1); opacity:.55; }
    @keyframes work { to { transform:translateY(-3px) rotate(-3deg); } }
    @keyframes ask { to { transform:scale(1.12); } }
    .session-main { min-width:0; }
    .session-title { display:flex; align-items:center; gap:5px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .session-meta, .session-content { display:block; margin-top:2px; color:var(--vscode-descriptionForeground); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .session-content { color:var(--vscode-foreground); opacity:.82; }
    .confidence { align-self:start; padding:2px 5px; border:1px solid var(--vscode-widget-border); border-radius:999px; color:var(--vscode-descriptionForeground); font-size:9px; text-transform:uppercase; }
    .other { color:var(--vscode-charts-purple); }
    .empty { padding:24px 10px; text-align:center; color:var(--vscode-descriptionForeground); }
    .empty-icon { margin-bottom:8px; font-size:32px; }
    .empty p { line-height:1.45; }
    .footer { display:flex; justify-content:space-between; gap:8px; padding-top:8px; border-top:1px solid var(--vscode-widget-border); color:var(--vscode-descriptionForeground); font-size:10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand"><span>🌿</span><span>Agent Garden</span></div>
    <div class="connection" title="${this.brokerConnected ? 'Cross-window broker connected' : 'Broker reconnecting'}"></div>
  </div>
  <div class="toolbar">
    <button class="secondary" data-command="toggleMode">${this.mode === 'garden' ? 'Utility Mode' : 'Garden Mode'}</button>
    <button class="secondary" data-command="refresh">Refresh</button>
  </div>
  ${content}
  <div class="footer"><span>${this.sessions.length} sessions</span><span>${this.mode} mode</span></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.querySelectorAll('[data-command]').forEach((button) => {
      button.addEventListener('click', () => vscode.postMessage({ command: button.dataset.command }));
    });
    document.querySelectorAll('[data-session-id]').forEach((button) => {
      button.addEventListener('click', () => vscode.postMessage({ command: 'focus', sessionId: button.dataset.sessionId }));
    });
  </script>
</body>
</html>`;
  }

  private sessionCard(session: AgentSession): string {
    const isOtherWindow = session.windowId !== this.currentWindowId;
    const visual = this.mode === 'garden'
      ? `<span class="pet" aria-hidden="true">${this.petFor(session)}</span>`
      : '<span class="dot" aria-hidden="true"></span>';
    return `<button class="session-card state-${session.state}" data-session-id="${escapeHtml(session.sessionId)}" title="Focus this terminal">
      ${visual}
      <span class="session-main">
        <span class="session-title">${escapeHtml(this.agentLabel(session))}</span>
        <span class="session-meta ${isOtherWindow ? 'other' : ''}">${escapeHtml(session.workspaceName)}${isOtherWindow ? ' · other window' : ''}</span>
        <span class="session-content">${escapeHtml(session.preview ? `› ${session.preview}` : session.reason ?? stateLabel(session.state))}</span>
      </span>
      <span class="confidence">${escapeHtml(session.confidence)}</span>
    </button>`;
  }

  private petFor(session: AgentSession): string {
    if (session.state === 'needsYou') {
      return '🙋';
    }
    if (session.state === 'done') {
      return '🎉';
    }
    if (session.state === 'unknown') {
      return '💤';
    }
    switch (session.agent) {
      case 'claude':
        return '🐱';
      case 'codex':
        return '🦊';
      case 'opencode':
        return '🐶';
      default:
        return '🤖';
    }
  }

  private agentLabel(session: AgentSession): string {
    switch (session.agent) {
      case 'claude':
        return 'Claude';
      case 'codex':
        return 'Codex';
      case 'opencode':
        return 'OpenCode';
      default:
        return 'CLI Agent';
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}
