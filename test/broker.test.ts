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
const TEST_PORT = 47_931;

function agentSession(windowId: string, terminalId: string): AgentSession {
  return {
    sessionId: `${windowId}-${terminalId}`,
    windowId,
    terminalId,
    workspaceName: `Workspace ${windowId}`,
    agent: 'codex',
    state: 'working',
    confidence: 'confirmed',
    source: 'shell',
    updatedAt: Date.now(),
  };
}

test('broker aggregates two windows and routes a focus command', async () => {
  let latestSnapshot: BrokerSnapshot | undefined;
  let receivedCommand: FocusCommand | undefined;
  let receivedEvent: ExternalAgentEvent | undefined;

  const first = new BrokerClient({
    port: TEST_PORT,
    window: { id: 'window-a', workspaceName: 'Workspace A' },
    getLocalSessions: () => [agentSession('window-a', 'terminal-a')],
    onSnapshot: (snapshot) => {
      latestSnapshot = snapshot;
    },
    onFocusCommand: () => undefined,
  });
  const second = new BrokerClient({
    port: TEST_PORT,
    window: { id: 'window-b', workspaceName: 'Workspace B' },
    getLocalSessions: () => [agentSession('window-b', 'terminal-b')],
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

    await runHookBridge('agent-garden-claude-hook.cjs', {
      hook_event_name: 'Stop',
      session_id: 'claude-real-session',
      cwd: process.cwd(),
      prompt: '  Refactor the broker\n and keep all tests green.  ',
    });
    second.publishNow();
    await wait(150);
    assert.equal(receivedEvent?.eventType, 'Stop');
    assert.equal(receivedEvent?.preview, 'Refactor the broker and keep all tests green.');

    await runHookBridge('agent-garden-codex-hook.cjs', {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'codex-real-session',
      cwd: process.cwd(),
      prompt: '  Build the floating window\n with animated agent pets.  ',
    });
    second.publishNow();
    await wait(150);
    assert.equal(receivedEvent?.agent, 'codex');
    assert.equal(receivedEvent?.preview, 'Build the floating window with animated agent pets.');

    await runOpenCodePlugin({
      type: 'session.status',
      properties: { sessionID: 'opencode-real-session', status: { type: 'busy' } },
    });
    await wait(50);
    second.publishNow();
    await wait(150);
    assert.equal(receivedEvent?.eventType, 'session.status');
    assert.equal(receivedEvent?.status, 'busy');

    await runOpenCodePrompt();
    await wait(50);
    second.publishNow();
    await wait(150);
    assert.equal(receivedEvent?.eventType, 'user.prompt');
    assert.equal(receivedEvent?.preview, 'Fix the parser and add regression tests.');
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
      port: TEST_PORT,
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
  const previousPort = process.env.AGENT_GARDEN_BROKER_PORT;
  process.env.AGENT_GARDEN_BROKER_PORT = String(TEST_PORT);
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
  try {
    const hooks = await pluginModule.AgentGardenPlugin({ directory: process.cwd() });
    await hooks.event({ event });
  } finally {
    if (previousPort === undefined) {
      delete process.env.AGENT_GARDEN_BROKER_PORT;
    } else {
      process.env.AGENT_GARDEN_BROKER_PORT = previousPort;
    }
  }
}

async function runOpenCodePrompt(): Promise<void> {
  const previousPort = process.env.AGENT_GARDEN_BROKER_PORT;
  process.env.AGENT_GARDEN_BROKER_PORT = String(TEST_PORT);
  const source = await readFile(
    path.join(process.cwd(), 'media', 'integrations', 'agent-garden-opencode.js'),
    'utf8',
  );
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#prompt`;
  const pluginModule = await import(url) as {
    AgentGardenPlugin: (input: { directory: string }) => Promise<{
      'chat.message': (
        input: { sessionID: string },
        output: { parts: Array<{ type: string; text?: string }> },
      ) => Promise<void>;
    }>;
  };
  try {
    const hooks = await pluginModule.AgentGardenPlugin({ directory: process.cwd() });
    await hooks['chat.message'](
      { sessionID: 'opencode-real-session' },
      { parts: [{ type: 'text', text: '  Fix the parser\n and add regression tests.  ' }] },
    );
  } finally {
    if (previousPort === undefined) {
      delete process.env.AGENT_GARDEN_BROKER_PORT;
    } else {
      process.env.AGENT_GARDEN_BROKER_PORT = previousPort;
    }
  }
}

function runHookBridge(filename: string, input: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(process.cwd(), 'media', 'integrations', filename)],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, AGENT_GARDEN_BROKER_PORT: String(TEST_PORT) },
      },
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
