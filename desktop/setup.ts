import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { app, dialog, type BrowserWindow } from 'electron';

const execFileAsync = promisify(execFile);
const SETUP_VERSION = 1;

interface SetupResult {
  bridgeInstalled: boolean;
  adaptersInstalled: boolean;
  errors: string[];
}

export async function runFirstLaunchSetup(window: BrowserWindow): Promise<void> {
  if (!app.isPackaged) {
    return;
  }

  const markerPath = path.join(app.getPath('userData'), `setup-v${SETUP_VERSION}.json`);
  if (await exists(markerPath)) {
    return;
  }

  const result = await installBundledIntegrations();
  if (result.bridgeInstalled && result.adaptersInstalled) {
    await fs.writeFile(markerPath, `${JSON.stringify({ version: SETUP_VERSION, installedAt: Date.now() })}\n`, 'utf8');
    await dialog.showMessageBox(window, {
      type: 'info',
      title: 'Agent Garden setup complete',
      message: 'Agent Garden is ready.',
      detail: 'The VS Code bridge and Claude, Codex, and OpenCode adapters were installed. Reload VS Code, then open a new terminal. Codex users should review and trust the hook with /hooks.',
      buttons: ['Got it'],
    });
    return;
  }

  await dialog.showMessageBox(window, {
    type: 'warning',
    title: 'Agent Garden needs one more step',
    message: 'Automatic setup could not finish.',
    detail: `${result.errors.join('\n')}\n\nYou can still install agent-garden-0.0.1.vsix manually from the project folder.`,
    buttons: ['Got it'],
  });
}

async function installBundledIntegrations(): Promise<SetupResult> {
  const setupRoot = path.join(process.resourcesPath, 'setup');
  const vsixPath = path.join(setupRoot, 'agent-garden.vsix');
  const adapterScript = path.join(setupRoot, 'scripts', 'install-adapters.cjs');
  const errors: string[] = [];
  let bridgeInstalled = false;
  let adaptersInstalled = false;

  try {
    const codeCli = await findCodeCli();
    const command = `"${codeCli}" --install-extension "${vsixPath}" --force`;
    await execFileAsync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', command], {
      windowsHide: true,
      timeout: 60_000,
    });
    bridgeInstalled = true;
  } catch (error) {
    errors.push(`VS Code bridge: ${errorMessage(error)}`);
  }

  try {
    await execFileAsync(process.execPath, [adapterScript], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
      timeout: 30_000,
    });
    adaptersInstalled = true;
  } catch (error) {
    errors.push(`Agent adapters: ${errorMessage(error)}`);
  }

  return { bridgeInstalled, adaptersInstalled, errors };
}

async function findCodeCli(): Promise<string> {
  const candidates = [
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft VS Code', 'bin', 'code.cmd'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft VS Code', 'bin', 'code.cmd'),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate;
    }
  }

  const { stdout } = await execFileAsync('where.exe', ['code.cmd'], { windowsHide: true });
  const discovered = stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (!discovered) {
    throw new Error('VS Code command-line launcher was not found. Install desktop VS Code first.');
  }
  return discovered;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
