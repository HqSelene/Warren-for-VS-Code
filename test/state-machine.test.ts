import assert = require('node:assert/strict');
import { test } from 'node:test';
import {
  detectAgent,
  executionEndState,
  shouldNotify,
  sortSessions,
} from '../src/core/state-machine';
import type { AgentSession } from '../src/core/types';

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

