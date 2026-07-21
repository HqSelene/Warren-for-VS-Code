import assert = require('node:assert/strict');
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import * as http from 'node:http';
import * as path from 'node:path';
import { test } from 'node:test';
import { BrokerClient } from '../src/broker/client';
import type {
  AgentSession,
  BrokerSnapshot,
  ExternalAgentEvent,
  FocusCommand,
} from '../src/core/types';

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
  let receivedEvent: ExternalAgentEvent | undefined;

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
    onAgentEvent: (event) => {
      receivedEvent = event;
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

    await postAgentEvent({
      agent: 'claude',
      eventType: 'PermissionRequest',
      externalSessionId: 'claude-real-session',
      cwd: 'C:\\project',
      timestamp: Date.now(),
    });
    second.publishNow();
    await wait(150);

    assert.equal(receivedEvent?.eventType, 'PermissionRequest');
    assert.equal(receivedEvent?.externalSessionId, 'claude-real-session');

    await runClaudeBridge({
      hook_event_name: 'Stop',
      session_id: 'claude-real-session',
      cwd: process.cwd(),
    });
    second.publishNow();
    await wait(150);
    assert.equal(receivedEvent?.eventType, 'Stop');

    await runOpenCodePlugin({
      type: 'session.status',
      properties: { sessionID: 'opencode-real-session', status: { type: 'busy' } },
    });
    await wait(50);
    second.publishNow();
    await wait(150);
    assert.equal(receivedEvent?.eventType, 'session.status');
    assert.equal(receivedEvent?.status, 'busy');
  } finally {
    first.dispose();
    second.dispose();
  }
});

function postAgentEvent(body: unknown): Promise<void> {
  const data = Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port: 47832,
      path: '/agent-event',
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': data.length,
      },
    }, (response) => {
      response.resume();
      response.on('end', resolve);
    });
    request.on('error', reject);
    request.end(data);
  });
}

async function runOpenCodePlugin(event: unknown): Promise<void> {
  const source = await readFile(
    path.join(process.cwd(), 'media', 'integrations', 'agent-garden-opencode.js'),
    'utf8',
  );
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const pluginModule = await import(url) as {
    AgentGardenPlugin: (input: { directory: string }) => Promise<{
      event: (input: { event: unknown }) => Promise<void>;
    }>;
  };
  const hooks = await pluginModule.AgentGardenPlugin({ directory: process.cwd() });
  await hooks.event({ event });
}

function runClaudeBridge(input: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(process.cwd(), 'media', 'integrations', 'agent-garden-claude-hook.cjs')],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        assert.equal(code, 0);
        assert.equal(output, '');
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}
