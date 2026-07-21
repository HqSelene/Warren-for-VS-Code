export type AttentionState = 'working' | 'needsYou' | 'done' | 'unknown';

export type Confidence = 'confirmed' | 'inferred' | 'unknown';

export type AgentKind = 'claude' | 'codex' | 'opencode' | 'demo' | 'unknown';

export type SessionSource = 'shell' | 'hook' | 'demo';

export interface AgentSession {
  sessionId: string;
  windowId: string;
  terminalId: string;
  workspaceName: string;
  agent: AgentKind;
  state: AttentionState;
  reason?: string;
  confidence: Confidence;
  source: SessionSource;
  cwd?: string;
  externalSessionId?: string;
  updatedAt: number;
}

export interface ExternalAgentEvent {
  sequence: number;
  agent: Exclude<AgentKind, 'demo' | 'unknown'>;
  eventType: string;
  externalSessionId?: string;
  targetWindowId?: string;
  cwd?: string;
  status?: string;
  reason?: string;
  notificationType?: string;
  toolName?: string;
  timestamp: number;
}

export type ExternalAgentEventInput = Omit<ExternalAgentEvent, 'sequence'>;

export interface AgentEventsResponse {
  events: ExternalAgentEvent[];
  latestSequence: number;
}

export interface WindowDescriptor {
  id: string;
  workspaceName: string;
  workspaceUri?: string;
}

export interface BrokerSnapshot {
  windows: WindowDescriptor[];
  sessions: AgentSession[];
  serverTime: number;
}

export interface HeartbeatPayload {
  window: WindowDescriptor;
  sessions: AgentSession[];
}

export interface FocusRequest {
  targetWindowId: string;
  terminalId: string;
}

export interface FocusCommand {
  id: string;
  terminalId: string;
  createdAt: number;
}
