import type { AgentKind, AgentSession, AttentionState, Confidence } from './types';

const priority: Record<AttentionState, number> = {
  needsYou: 0,
  working: 1,
  done: 2,
  unknown: 3,
};

export function detectAgent(commandLine: string): AgentKind {
  const value = commandLine.trim().toLowerCase();

  if (/(^|[\\/\s])claude(?:\.exe)?(?:\s|$)/.test(value)) {
    return 'claude';
  }

  if (
    /(^|[\\/\s])codex(?:\.exe)?(?:\s|$)/.test(value) ||
    value.includes('@openai/codex')
  ) {
    return 'codex';
  }

  if (/(^|[\\/\s])opencode(?:\.exe)?(?:\s|$)/.test(value)) {
    return 'opencode';
  }

  return 'unknown';
}

export function executionEndState(exitCode: number | undefined): {
  state: AttentionState;
  reason: string;
  confidence: Confidence;
} {
  if (exitCode === 0) {
    return { state: 'done', reason: 'Command completed', confidence: 'confirmed' };
  }

  if (typeof exitCode === 'number') {
    return {
      state: 'needsYou',
      reason: `Command failed with exit code ${exitCode}`,
      confidence: 'confirmed',
    };
  }

  return {
    state: 'unknown',
    reason: 'Command ended without a reported exit code',
    confidence: 'unknown',
  };
}

export function sortSessions(sessions: readonly AgentSession[]): AgentSession[] {
  return [...sessions].sort((left, right) => {
    const stateDifference = priority[left.state] - priority[right.state];
    if (stateDifference !== 0) {
      return stateDifference;
    }

    return right.updatedAt - left.updatedAt;
  });
}

export function shouldNotify(
  previous: AgentSession | undefined,
  next: AgentSession,
): boolean {
  if (!previous || previous.state === next.state) {
    return false;
  }

  return next.state === 'needsYou' || next.state === 'done';
}

export function stateLabel(state: AttentionState): string {
  switch (state) {
    case 'needsYou':
      return 'Needs You';
    case 'working':
      return 'Working';
    case 'done':
      return 'Done';
    case 'unknown':
      return 'Unknown';
  }
}

