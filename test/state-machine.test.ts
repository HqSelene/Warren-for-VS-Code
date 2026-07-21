import assert = require('node:assert/strict');
import { test } from 'node:test';
import {
  detectAgent,
  executionEndState,
  externalEventState,
  shouldNotify,
  sortSessions,
} from '../src/core/state-machine';
import type { AgentSession } from '../src/core/types';
import type { ExternalAgentEvent } from '../src/core/types';

function session(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    sessionId: 'session',
    windowId: 'window',
    terminalId: 'terminal',
    workspaceName: 'Workspace',
    agent: 'codex',
    state: 'working',
    confidence: 'confirmed',
    source: 'demo',
    updatedAt: 1,
    ...overrides,
  };
}

test('detects supported CLI agents without matching unrelated text', () => {
  assert.equal(detectAgent('claude --resume'), 'claude');
  assert.equal(detectAgent('C:\\tools\\codex.exe --model gpt'), 'codex');
  assert.equal(detectAgent('npx @openai/codex'), 'codex');
  assert.equal(detectAgent('opencode .'), 'opencode');
  assert.equal(detectAgent('echo codexical'), 'unknown');
});

test('normalizes shell completion outcomes', () => {
  assert.deepEqual(executionEndState(0), {
    state: 'done',
    reason: 'Command completed',
    confidence: 'confirmed',
  });
  assert.equal(executionEndState(2).state, 'needsYou');
  assert.equal(executionEndState(undefined).state, 'unknown');
});

test('sorts needs-you sessions before work, completion, and unknown', () => {
  const sessions = sortSessions([
    session({ sessionId: 'unknown', state: 'unknown' }),
    session({ sessionId: 'done', state: 'done' }),
    session({ sessionId: 'working', state: 'working' }),
    session({ sessionId: 'needs', state: 'needsYou' }),
  ]);
  assert.deepEqual(sessions.map((item) => item.sessionId), [
    'needs',
    'working',
    'done',
    'unknown',
  ]);
});

test('notifies only when an existing session transitions to attention or done', () => {
  const working = session({ state: 'working' });
  assert.equal(shouldNotify(undefined, working), false);
  assert.equal(shouldNotify(working, session({ state: 'needsYou' })), true);
  assert.equal(shouldNotify(working, session({ state: 'done' })), true);
  assert.equal(shouldNotify(working, session({ state: 'unknown' })), false);
});

function externalEvent(
  overrides: Partial<ExternalAgentEvent> = {},
): ExternalAgentEvent {
  return {
    sequence: 1,
    agent: 'claude',
    eventType: 'UserPromptSubmit',
    timestamp: Date.now(),
    ...overrides,
  };
}

test('maps real Claude hook events to attention states', () => {
  assert.equal(externalEventState(externalEvent())?.state, 'working');
  assert.deepEqual(
    externalEventState(externalEvent({ eventType: 'PermissionRequest', toolName: 'Bash' })),
    { state: 'needsYou', reason: 'Permission required: Bash', confidence: 'confirmed' },
  );
  assert.equal(externalEventState(externalEvent({ eventType: 'Stop' }))?.state, 'done');
  assert.equal(externalEventState(externalEvent({ eventType: 'Notification', notificationType: 'other' })), undefined);
});

test('maps real OpenCode plugin events to attention states', () => {
  assert.equal(
    externalEventState(externalEvent({ agent: 'opencode', eventType: 'session.status', status: 'busy' }))?.state,
    'working',
  );
  assert.equal(
    externalEventState(externalEvent({ agent: 'opencode', eventType: 'permission.asked' }))?.state,
    'needsYou',
  );
  assert.equal(
    externalEventState(externalEvent({ agent: 'opencode', eventType: 'session.idle' }))?.state,
    'done',
  );
  assert.equal(
    externalEventState(externalEvent({ agent: 'opencode', eventType: 'session.error' }))?.state,
    'needsYou',
  );
});
