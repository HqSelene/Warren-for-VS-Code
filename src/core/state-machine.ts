import type {
  AgentKind,
  AgentSession,
  AttentionState,
  Confidence,
  ExternalAgentEvent,
} from './types';

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

export function externalEventState(event: ExternalAgentEvent): {
  state: AttentionState;
  reason: string;
  confidence: Confidence;
} | undefined {
  if (event.agent === 'claude') {
    switch (event.eventType) {
      case 'UserPromptSubmit':
      case 'PreToolUse':
      case 'PostToolUse':
        return confirmed('working', event.toolName ? `Using ${event.toolName}` : 'Claude is working');
      case 'PermissionRequest':
        return confirmed(
          'needsYou',
          event.toolName ? `Permission required: ${event.toolName}` : 'Permission required',
        );
      case 'Notification':
        if (event.notificationType === 'permission_prompt') {
          return confirmed('needsYou', event.reason ?? 'Permission required');
        }
        if (event.notificationType === 'idle_prompt') {
          return confirmed('needsYou', event.reason ?? 'Claude is waiting for input');
        }
        return undefined;
      case 'Stop':
        return confirmed('done', 'Claude finished responding');
      case 'StopFailure':
      case 'PostToolUseFailure':
        return confirmed('needsYou', event.reason ?? 'Claude reported an error');
      case 'SessionEnd':
        return confirmed('done', event.reason ?? 'Claude session ended');
      default:
        return undefined;
    }
  }

  if (event.agent === 'opencode') {
    switch (event.eventType) {
      case 'session.status':
        if (event.status === 'busy' || event.status === 'retry') {
          return confirmed('working', event.reason ?? (event.status === 'retry' ? 'OpenCode is retrying' : 'OpenCode is working'));
        }
        if (event.status === 'idle') {
          return confirmed('done', 'OpenCode finished responding');
        }
        return undefined;
      case 'user.prompt':
        return confirmed('working', 'OpenCode is working');
      case 'session.idle':
        return confirmed('done', 'OpenCode finished responding');
      case 'permission.asked':
        return confirmed('needsYou', event.reason ?? 'OpenCode needs permission');
      case 'question.asked':
        return confirmed('needsYou', event.reason ?? 'OpenCode has a question');
      case 'permission.replied':
      case 'question.replied':
      case 'question.rejected':
        return confirmed('working', 'OpenCode resumed');
      case 'session.error':
        return confirmed('needsYou', event.reason ?? 'OpenCode reported an error');
      default:
        return undefined;
    }
  }

  return undefined;
}

function confirmed(state: AttentionState, reason: string): {
  state: AttentionState;
  reason: string;
  confidence: Confidence;
} {
  return { state, reason, confidence: 'confirmed' };
}
