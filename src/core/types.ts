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
  updatedAt: number;
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

