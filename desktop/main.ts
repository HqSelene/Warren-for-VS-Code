import * as http from 'node:http';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  shell,
  type Rectangle,
} from 'electron';
import { BrokerServer } from '../src/broker/server';
import {
  BROKER_HOST,
  BROKER_PORT,
  BROKER_SERVICE,
} from '../src/broker/protocol';
import type { AgentSession, BrokerSnapshot, FocusRequest, WindowDescriptor } from '../src/core/types';
import { toVsCodeWorkspaceUrl } from '../src/core/vscode-uri';

const FULL_WIDTH = 410;
const FULL_HEIGHT = 420;
const MIN_WIDTH = 330;
const MIN_HEIGHT = 260;
const COMPACT_WIDTH = 320;
const COMPACT_HEIGHT = 48;
const POLL_INTERVAL_MS = 700;

let window: BrowserWindow | undefined;
let broker: BrokerServer | undefined;
let pollTimer: NodeJS.Timeout | undefined;
let compact = false;
let quitting = false;
let expandedSize = { width: FULL_WIDTH, height: FULL_HEIGHT };
let knownWindows = new Map<string, WindowDescriptor>();

async function createWindow(): Promise<void> {
  const display = screen.getPrimaryDisplay().workArea;
  const x = Math.round(display.x + display.width - FULL_WIDTH - 24);
  const y = Math.round(display.y + display.height - FULL_HEIGHT - 24);
  const rendererRoot = app.isPackaged
    ? path.join(app.getAppPath(), 'desktop')
    : path.resolve(__dirname, '..', '..', 'desktop');
  const iconPath = app.isPackaged
    ? path.join(app.getAppPath(), 'build', 'icon.png')
    : path.resolve(__dirname, '..', '..', 'build', 'icon.png');

  window = new BrowserWindow({
    width: FULL_WIDTH,
    height: FULL_HEIGHT,
    x,
    y,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setAlwaysOnTop(true, 'floating');
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.once('ready-to-show', () => window?.show());
  await window.loadFile(path.join(rendererRoot, 'index.html'));
  window.on('resize', () => {
    if (!window || compact) {
      return;
    }
    const bounds = window.getBounds();
    expandedSize = { width: bounds.width, height: bounds.height };
  });
  window.on('closed', () => { window = undefined; });
}

async function ensureBroker(): Promise<void> {
  try {
    const health = await requestJson<{ service: string }>('GET', '/health');
    if (health.service === BROKER_SERVICE) {
      return;
    }
  } catch {
    // The desktop app becomes the broker owner when no VS Code window owns it.
  }
  broker?.dispose();
  const candidate = new BrokerServer();
  if (await candidate.start()) {
    broker = candidate;
  } else {
    candidate.dispose();
  }
}

async function poll(): Promise<void> {
  try {
    await ensureBroker();
    const snapshot = await requestJson<BrokerSnapshot>('GET', '/snapshot');
    knownWindows = new Map(snapshot.windows.map((descriptor) => [descriptor.id, descriptor]));
    window?.webContents.send('garden:sessions', {
      connected: true,
      sessions: snapshot.sessions,
    });
  } catch {
    window?.webContents.send('garden:sessions', { connected: false, sessions: [] });
  }
}

function setCompact(value: boolean): void {
  if (!window || compact === value) {
    return;
  }
  const current = window.getBounds();
  compact = value;
  if (value) {
    expandedSize = { width: current.width, height: current.height };
    window.setMinimumSize(COMPACT_WIDTH, COMPACT_HEIGHT);
    window.setResizable(false);
    window.setBounds(anchoredBounds(current, COMPACT_WIDTH, COMPACT_HEIGHT), false);
  } else {
    window.setBounds(anchoredBounds(current, expandedSize.width, expandedSize.height), false);
    window.setMinimumSize(MIN_WIDTH, MIN_HEIGHT);
    window.setResizable(true);
  }
  window.webContents.send('garden:compact', compact);
}

function anchoredBounds(current: Rectangle, width: number, height: number): Rectangle {
  const area = screen.getDisplayMatching(current).workArea;
  const intendedX = current.x + current.width - width;
  return {
    x: Math.min(Math.max(intendedX, area.x), area.x + area.width - width),
    y: Math.min(Math.max(current.y, area.y), area.y + area.height - height),
    width,
    height,
  };
}

app.whenReady().then(async () => {
  ipcMain.handle('garden:focus', async (_event, request: FocusRequest) => {
    await requestJson('POST', '/focus', request);
    const workspaceUri = knownWindows.get(request.targetWindowId)?.workspaceUri;
    const vscodeUrl = workspaceUri ? toVsCodeWorkspaceUrl(workspaceUri) : undefined;
    if (vscodeUrl) {
      window?.blur();
      await shell.openExternal(vscodeUrl).catch(() => undefined);
    }
  });
  ipcMain.on('garden:toggle-compact', () => setCompact(!compact));
  ipcMain.on('garden:minimize', () => window?.minimize());
  ipcMain.on('garden:close', () => {
    quitting = true;
    app.quit();
  });
  ipcMain.on('garden:set-pin', (_event, pinned: boolean) => {
    window?.setAlwaysOnTop(pinned, 'floating');
  });
  await createWindow();
  if (process.env.AGENT_GARDEN_START_COMPACT === '1') {
    setCompact(true);
  }
  await poll();
  const visualFixtureEnabled = process.env.AGENT_GARDEN_VISUAL_FIXTURE === '1';
  if (visualFixtureEnabled) {
    window?.webContents.send('garden:sessions', {
      connected: true,
      sessions: visualFixture(),
    });
  }
  const screenshotPath = process.env.AGENT_GARDEN_SCREENSHOT_PATH;
  if (screenshotPath && window) {
    setTimeout(async () => {
      if (!window) return;
      const image = await window.webContents.capturePage();
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      await fs.writeFile(screenshotPath, image.toPNG());
      quitting = true;
      app.quit();
    }, 1_200);
  }
  if (!visualFixtureEnabled) {
    pollTimer = setInterval(() => void poll(), POLL_INTERVAL_MS);
  }
});

app.on('window-all-closed', () => {
  if (quitting || process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  broker?.dispose();
});

function requestJson<T = unknown>(
  method: 'GET' | 'POST',
  requestPath: string,
  body?: unknown,
): Promise<T> {
  const data = body === undefined ? undefined : Buffer.from(JSON.stringify(body));
  return new Promise<T>((resolve, reject) => {
    const request = http.request({
      host: BROKER_HOST,
      port: BROKER_PORT,
      path: requestPath,
      method,
      timeout: 800,
      headers: data ? {
        'content-type': 'application/json',
        'content-length': data.length,
      } : undefined,
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        if (!response.statusCode || response.statusCode >= 400) {
          reject(new Error(`Broker returned ${response.statusCode ?? 'unknown'}`));
          return;
        }
        const text = Buffer.concat(chunks).toString('utf8');
        resolve((text ? JSON.parse(text) : undefined) as T);
      });
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('Broker timeout')));
    if (data) {
      request.write(data);
    }
    request.end();
  });
}

function visualFixture(): AgentSession[] {
  const now = Date.now();
  const base = {
    confidence: 'confirmed' as const,
    source: 'hook' as const,
  };
  return [
    { ...base, sessionId: 'fixture-claude', terminalId: 'fixture-claude', windowId: 'window-a', workspaceName: 'SimArch', agent: 'claude', state: 'working', preview: 'Refactoring perception.py — updating the sensor pipeline and tests…', updatedAt: now },
    { ...base, sessionId: 'fixture-codex', terminalId: 'fixture-codex', windowId: 'window-a', workspaceName: 'SimArch', agent: 'codex', state: 'needsYou', reason: 'Permission: run pytest tests/ — allow command?', updatedAt: now - 5_000 },
    { ...base, sessionId: 'fixture-opencode', terminalId: 'fixture-opencode', windowId: 'window-b', workspaceName: 'Shopify', agent: 'opencode', state: 'done', preview: 'Fixed checkout flow — 3 files changed and regression tests added.', updatedAt: now - 240_000 },
    { ...base, sessionId: 'fixture-error', terminalId: 'fixture-error', windowId: 'window-c', workspaceName: 'KpopZoo', agent: 'claude', state: 'error', reason: "ModuleNotFoundError: no module named 'transformers'", updatedAt: now - 20_000 },
    { ...base, sessionId: 'fixture-codex-work', terminalId: 'fixture-codex-work', windowId: 'window-b', workspaceName: 'Shopify', agent: 'codex', state: 'working', preview: 'Adding checkout regression coverage and updating fixtures.', updatedAt: now - 9_000 },
    { ...base, sessionId: 'fixture-open-work', terminalId: 'fixture-open-work', windowId: 'window-a', workspaceName: 'SimArch', agent: 'opencode', state: 'working', preview: 'Reviewing the sensor data model and migration path.', updatedAt: now - 13_000 },
    { ...base, sessionId: 'fixture-open-done', terminalId: 'fixture-open-done', windowId: 'window-c', workspaceName: 'KpopZoo', agent: 'opencode', state: 'done', preview: 'Updated the dataset loader and validation messages.', updatedAt: now - 360_000 },
    { ...base, sessionId: 'fixture-claude-wait', terminalId: 'fixture-claude-wait', windowId: 'window-d', workspaceName: 'Docs', agent: 'claude', state: 'needsYou', reason: 'Choose which API example should be kept.', updatedAt: now - 4_000 },
  ];
}
