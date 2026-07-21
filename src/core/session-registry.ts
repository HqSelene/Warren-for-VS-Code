import type { AgentSession } from './types';

type Listener = (sessions: AgentSession[]) => void;
type TransitionListener = (
  previous: AgentSession | undefined,
  next: AgentSession,
) => void;

export class SessionRegistry {
  private readonly sessions = new Map<string, AgentSession>();
  private readonly listeners = new Set<Listener>();

  public constructor(private readonly onTransition?: TransitionListener) {}

  public upsert(session: AgentSession): void {
    const previous = this.sessions.get(session.sessionId);
    const next = { ...session };
    this.sessions.set(session.sessionId, next);
    this.onTransition?.(previous, next);
    this.emit();
  }

  public get(sessionId: string): AgentSession | undefined {
    const session = this.sessions.get(sessionId);
    return session ? { ...session } : undefined;
  }

  public getAll(): AgentSession[] {
    return [...this.sessions.values()].map((session) => ({ ...session }));
  }

  public remove(sessionId: string): void {
    if (this.sessions.delete(sessionId)) {
      this.emit();
    }
  }

  public subscribe(listener: Listener): { dispose(): void } {
    this.listeners.add(listener);
    listener(this.getAll());
    return {
      dispose: () => this.listeners.delete(listener),
    };
  }

  private emit(): void {
    const snapshot = this.getAll();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
