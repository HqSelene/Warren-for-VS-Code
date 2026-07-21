import { constants as fsConstants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

const CLAUDE_MARKER = 'agent-garden-claude-hook.cjs';
const CODEX_MARKER = 'agent-garden-codex-hook.cjs';
const OPENCODE_MARKER = 'Agent Garden OpenCode bridge';
const CLAUDE_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PostToolUseFailure',
  'Notification',
  'Stop',
  'StopFailure',
  'SessionEnd',
] as const;
const CODEX_EVENTS = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'Stop',
] as const;

interface JsonObject {
  [key: string]: unknown;
}

interface ClaudeHook {
  type?: string;
  command?: string;
  timeout?: number;
  [key: string]: unknown;
}

interface ClaudeHookGroup {
  matcher?: string;
  hooks?: ClaudeHook[];
  [key: string]: unknown;
}

export async function installClaudeAdapter(context: vscode.ExtensionContext): Promise<string> {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const bridgePath = path.join(os.homedir(), '.agent-garden', CLAUDE_MARKER);
  await fs.mkdir(path.dirname(bridgePath), { recursive: true });
  await fs.copyFile(path.join(context.extensionPath, 'media', 'integrations', CLAUDE_MARKER), bridgePath);

  const settings = await readJsonObject(settingsPath);
  const hooks = asObject(settings.hooks);
  const command = `node "${bridgePath.replaceAll('"', '\\"')}"`;
  for (const eventName of CLAUDE_EVENTS) {
    const groups = asHookGroups(hooks[eventName]);
    const alreadyInstalled = groups.some((group) =>
      group.hooks?.some((hook) => hook.command?.includes(CLAUDE_MARKER)),
    );
    if (!alreadyInstalled) {
      groups.push({ hooks: [{ type: 'command', command, timeout: 5 }] });
    }
    hooks[eventName] = groups;
  }
  settings.hooks = hooks;
  await writeJsonWithBackup(settingsPath, settings);
  return settingsPath;
}

export async function uninstallClaudeAdapter(): Promise<string> {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  const settings = await readJsonObject(settingsPath);
  const hooks = asObject(settings.hooks);
  for (const [eventName, rawGroups] of Object.entries(hooks)) {
    const groups = asHookGroups(rawGroups)
      .map((group) => ({
        ...group,
        hooks: group.hooks?.filter((hook) => !hook.command?.includes(CLAUDE_MARKER)),
      }))
      .filter((group) => (group.hooks?.length ?? 0) > 0);
    if (groups.length > 0) {
      hooks[eventName] = groups;
    } else {
      delete hooks[eventName];
    }
  }
  settings.hooks = hooks;
  await writeJsonWithBackup(settingsPath, settings);
  return settingsPath;
}

export async function installCodexAdapter(context: vscode.ExtensionContext): Promise<string> {
  const hooksPath = path.join(os.homedir(), '.codex', 'hooks.json');
  const bridgePath = path.join(os.homedir(), '.agent-garden', CODEX_MARKER);
  await fs.mkdir(path.dirname(bridgePath), { recursive: true });
  await fs.copyFile(path.join(context.extensionPath, 'media', 'integrations', CODEX_MARKER), bridgePath);

  const config = await readJsonObject(hooksPath);
  const hooks = asObject(config.hooks);
  const command = `node "${bridgePath.replaceAll('"', '\\"')}"`;
  for (const eventName of CODEX_EVENTS) {
    const groups = asHookGroups(hooks[eventName]);
    if (!groups.some((group) => group.hooks?.some((hook) => hook.command?.includes(CODEX_MARKER)))) {
      groups.push({ hooks: [{ type: 'command', command, timeout: 5 }] });
    }
    hooks[eventName] = groups;
  }
  config.description = 'User-level lifecycle hooks, including Agent Garden session events.';
  config.hooks = hooks;
  await writeJsonWithBackup(hooksPath, config);
  return hooksPath;
}

export async function uninstallCodexAdapter(): Promise<string> {
  const hooksPath = path.join(os.homedir(), '.codex', 'hooks.json');
  const config = await readJsonObject(hooksPath);
  const hooks = asObject(config.hooks);
  removeMarkedHooks(hooks, CODEX_MARKER);
  config.hooks = hooks;
  await writeJsonWithBackup(hooksPath, config);
  return hooksPath;
}

export async function installOpenCodeAdapter(context: vscode.ExtensionContext): Promise<string> {
  const pluginPath = openCodePluginPath();
  await fs.mkdir(path.dirname(pluginPath), { recursive: true });
  try {
    const existing = await fs.readFile(pluginPath, 'utf8');
    if (!existing.includes(OPENCODE_MARKER)) {
      throw new Error(`Refusing to replace an unrelated plugin: ${pluginPath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  await fs.copyFile(
    path.join(context.extensionPath, 'media', 'integrations', 'agent-garden-opencode.js'),
    pluginPath,
  );
  return pluginPath;
}

export async function uninstallOpenCodeAdapter(): Promise<string> {
  const pluginPath = openCodePluginPath();
  try {
    const content = await fs.readFile(pluginPath, 'utf8');
    if (content.includes(OPENCODE_MARKER)) {
      await fs.unlink(pluginPath);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  return pluginPath;
}

function openCodePluginPath(): string {
  return path.join(os.homedir(), '.config', 'opencode', 'plugins', 'agent-garden.js');
}

async function readJsonObject(filePath: string): Promise<JsonObject> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(content);
    return asObject(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function writeJsonWithBackup(filePath: string, value: JsonObject): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.copyFile(
      filePath,
      `${filePath}.agent-garden.bak`,
      fsConstants.COPYFILE_EXCL,
    );
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' && code !== 'EEXIST') {
      throw error;
    }
  }
  await fs.writeFile(filePath, `${JSON.stringify(value, undefined, 2)}\n`, 'utf8');
}

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function asHookGroups(value: unknown): ClaudeHookGroup[] {
  return Array.isArray(value)
    ? value.filter((item): item is ClaudeHookGroup => Boolean(item && typeof item === 'object'))
    : [];
}

function removeMarkedHooks(hooks: JsonObject, marker: string): void {
  for (const [eventName, rawGroups] of Object.entries(hooks)) {
    const groups = asHookGroups(rawGroups)
      .map((group) => ({
        ...group,
        hooks: group.hooks?.filter((hook) => !hook.command?.includes(marker)),
      }))
      .filter((group) => (group.hooks?.length ?? 0) > 0);
    if (groups.length > 0) {
      hooks[eventName] = groups;
    } else {
      delete hooks[eventName];
    }
  }
}
