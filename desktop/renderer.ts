type AttentionState = 'working' | 'needsYou' | 'done' | 'error';
type AgentKind = 'claude' | 'codex' | 'opencode' | 'unknown';
interface AgentSession {
  sessionId: string;
  windowId: string;
  terminalId: string;
  workspaceName: string;
  agent: AgentKind;
  state: AttentionState;
  reason?: string;
  preview?: string;
  updatedAt: number;
}
interface DesktopSnapshot { connected: boolean; sessions: AgentSession[]; }
interface AgentGardenDesktopApi {
  onSessions: (listener: (snapshot: DesktopSnapshot) => void) => () => void;
  onCompact: (listener: (compact: boolean) => void) => () => void;
  focus: (request: { targetWindowId: string; terminalId: string }) => Promise<void>;
  toggleCompact: () => void;
  minimize: () => void;
  close: () => void;
  setPinned: (pinned: boolean) => void;
  setHeight: (height: number) => void;
}

const api = (window as unknown as { agentGarden: AgentGardenDesktopApi }).agentGarden;

const stateOrder: AttentionState[] = ['needsYou', 'error', 'working', 'done'];
let sessions: AgentSession[] = [];
let connected = false;
let compact = false;
let pinned = true;

const list = requiredElement('session-list');
const empty = requiredElement('empty');
const summary = requiredElement('summary');
const compactSummary = requiredElement('compact-summary');
const connection = requiredElement('connection');

api.onSessions((snapshot) => {
  ({ connected, sessions } = snapshot);
  render();
});
api.onCompact((value) => {
  compact = value;
  document.body.classList.toggle('compact', compact);
});

document.querySelector('[data-action="compact"]')?.addEventListener('click', () => api.toggleCompact());
document.querySelector('[data-action="expand"]')?.addEventListener('click', () => api.toggleCompact());
document.querySelector('[data-action="minimize"]')?.addEventListener('click', () => api.minimize());
document.querySelector('[data-action="close"]')?.addEventListener('click', () => api.close());
document.querySelector('[data-action="pin"]')?.addEventListener('click', (event) => {
  pinned = !pinned;
  api.setPinned(pinned);
  (event.currentTarget as HTMLElement).classList.toggle('active', pinned);
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !compact) {
    api.toggleCompact();
  }
});

function render(): void {
  const sorted = [...sessions].sort((left, right) => {
    const stateDifference = stateOrder.indexOf(left.state) - stateOrder.indexOf(right.state);
    return stateDifference || right.updatedAt - left.updatedAt;
  });
  const byWorkspace = new Map<string, AgentSession[]>();
  for (const session of sorted) {
    const group = byWorkspace.get(session.workspaceName) ?? [];
    group.push(session);
    byWorkspace.set(session.workspaceName, group);
  }

  list.replaceChildren(...[...byWorkspace.entries()].map(([workspace, group]) => workspaceGroup(workspace, group)));
  empty.hidden = sorted.length > 0;
  list.hidden = sorted.length === 0;
  connection.classList.toggle('online', connected);
  connection.title = connected ? 'Connected to local broker' : 'Waiting for VS Code';

  const counts = countStates(sorted);
  summary.textContent = `${sorted.length} agent${sorted.length === 1 ? '' : 's'} · ${counts.needsYou} needs you`;
  compactSummary.replaceChildren(...summaryPills(counts));

  if (!compact) {
    const height = Math.min(720, 112 + byWorkspace.size * 34 + sorted.length * 78 + (sorted.length === 0 ? 170 : 20));
    api.setHeight(height);
  }
}

function workspaceGroup(workspace: string, group: AgentSession[]): HTMLElement {
  const section = document.createElement('section');
  section.className = 'workspace';
  const heading = document.createElement('div');
  heading.className = 'workspace-name';
  heading.innerHTML = '<span class="folder-mark"></span>';
  const label = document.createElement('span');
  label.textContent = workspace;
  heading.append(label);
  section.append(heading, ...group.map(sessionCard));
  return section;
}

function sessionCard(session: AgentSession): HTMLElement {
  const button = document.createElement('button');
  button.className = `session-card state-${session.state}`;
  button.title = `Focus ${agentLabel(session.agent)} in ${session.workspaceName}`;
  button.addEventListener('click', () => {
    void api.focus({
      targetWindowId: session.windowId,
      terminalId: session.terminalId,
    });
  });

  const pet = document.createElement('span');
  pet.className = `pet pet-${session.agent}`;
  pet.setAttribute('aria-hidden', 'true');
  pet.innerHTML = '<i class="ear ear-left"></i><i class="ear ear-right"></i><i class="eye eye-left"></i><i class="eye eye-right"></i><i class="mouth"></i><b class="signal">?</b>';

  const copy = document.createElement('span');
  copy.className = 'session-copy';
  const top = document.createElement('span');
  top.className = 'session-top';
  const agent = document.createElement('strong');
  agent.textContent = agentLabel(session.agent);
  const badge = document.createElement('span');
  badge.className = 'state-badge';
  badge.textContent = stateLabel(session.state, session.updatedAt);
  top.append(agent, badge);
  const detail = document.createElement('span');
  detail.className = 'session-detail';
  detail.textContent = session.preview || session.reason || 'Agent is active';
  copy.append(top, detail);
  button.append(pet, copy, arrowIcon());
  return button;
}

function arrowIcon(): HTMLElement {
  const arrow = document.createElement('span');
  arrow.className = 'focus-arrow';
  arrow.textContent = '↗';
  return arrow;
}

function countStates(items: AgentSession[]): Record<AttentionState, number> {
  return items.reduce<Record<AttentionState, number>>((counts, session) => {
    counts[session.state] += 1;
    return counts;
  }, { working: 0, needsYou: 0, done: 0, error: 0 });
}

function summaryPills(counts: Record<AttentionState, number>): HTMLElement[] {
  return stateOrder.map((state) => {
    const pill = document.createElement('span');
    pill.className = `summary-pill state-${state}`;
    pill.innerHTML = '<i></i>';
    const text = document.createElement('span');
    text.textContent = `${counts[state]} ${stateLabel(state).toLowerCase()}`;
    pill.append(text);
    return pill;
  });
}

function stateLabel(state: AttentionState, updatedAt?: number): string {
  switch (state) {
    case 'working': return 'Working';
    case 'needsYou': return 'Needs you';
    case 'error': return 'Error';
    case 'done': return updatedAt ? `Done · ${relativeTime(updatedAt)}` : 'Done';
  }
}

function agentLabel(agent: AgentSession['agent']): string {
  switch (agent) {
    case 'claude': return 'Claude';
    case 'codex': return 'GPT · Codex';
    case 'opencode': return 'OpenCode';
    default: return 'Agent';
  }
}

function relativeTime(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function requiredElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element;
}
