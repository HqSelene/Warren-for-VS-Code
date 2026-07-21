import assert = require('node:assert/strict');
import { test } from 'node:test';
import { BrokerClient } from '../src/broker/client';
import type { AgentSession, BrokerSnapshot, FocusCommand } from '../src/core/types';

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function demoSession(windowId: string, terminalId: string): AgentSession {
  return {
    sessionId: `${windowId}-${terminalId}`,
    windowId,
    terminalId,
    workspaceName: `Workspace ${windowId}`,
    agent: 'demo',
    state: 'working',
    confidence: 'confirmed',
    source: 'demo',
    updatedAt: Date.now(),
  };
}

test('broker aggregates two windows and routes a focus command', async () => {
  let latestSnapshot: BrokerSnapshot | undefined;
  let receivedCommand: FocusCommand | undefined;

  const first = new BrokerClient({
    window: { id: 'window-a', workspaceName: 'Workspace A' },
    getLocalSessions: () => [demoSession('window-a', 'terminal-a')],
    onSnapshot: (snapshot) => {
      latestSnapshot = snapshot;
    },
    onFocusCommand: () => undefined,
  });
  const second = new BrokerClient({
    window: { id: 'window-b', workspaceName: 'Workspace B' },
    getLocalSessions: () => [demoSession('window-b', 'terminal-b')],
    onSnapshot: (snapshot) => {
      latestSnapshot = snapshot;
    },
    onFocusCommand: (command) => {
      receivedCommand = command;
    },
  });

  try {
    await first.start();
    await second.start();
    first.publishNow();
    await wait(150);

    assert.equal(latestSnapshot?.sessions.length, 2);
    assert.deepEqual(
      latestSnapshot?.sessions.map((session) => session.windowId).sort(),
      ['window-a', 'window-b'],
    );

    await first.requestFocus({
      targetWindowId: 'window-b',
      terminalId: 'terminal-b',
    });
    second.publishNow();
    await wait(150);

    assert.equal(receivedCommand?.terminalId, 'terminal-b');
  } finally {
    first.dispose();
    second.dispose();
  }
});
