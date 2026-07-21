const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const home = process.env.AGENT_GARDEN_UNINSTALL_HOME || os.homedir();
const CLAUDE_MARKER = 'agent-garden-claude-hook.cjs';
const CODEX_MARKER = 'agent-garden-codex-hook.cjs';
const OPENCODE_MARKER = 'Agent Garden OpenCode bridge';

const result = {
  extension: 'not attempted',
  claude: 'not found',
  codex: 'not found',
  opencode: 'not found',
  bridges: 'not found',
  warnings: [],
};

removeVsCodeExtension();
removeMarkedHooks(path.join(home, '.claude', 'settings.json'), CLAUDE_MARKER, 'claude');
removeMarkedHooks(path.join(home, '.codex', 'hooks.json'), CODEX_MARKER, 'codex');
removeOpenCodePlugin();
removeBridges();

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

function removeVsCodeExtension() {
  const extensionId = 'agent-garden-labs.agent-garden';
  const codeCli = findCodeCli();
  if (codeCli) {
    try {
      execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `"${codeCli}" --uninstall-extension ${extensionId}`], {
        stdio: 'ignore',
        windowsHide: true,
      });
      result.extension = 'removed';
    } catch (error) {
      result.warnings.push(`VS Code CLI cleanup failed: ${error.message}`);
    }
  } else {
    result.warnings.push('VS Code CLI was not found; using direct extension-folder cleanup.');
  }

  const extensionDirs = [
    path.join(home, '.vscode', 'extensions', extensionId),
    path.join(home, '.vscode-insiders', 'extensions', extensionId),
  ];
  let removedFolder = false;
  for (const extensionDir of extensionDirs) {
    try {
      if (fs.existsSync(extensionDir)) {
        fs.rmSync(extensionDir, { recursive: true, force: true });
        removedFolder = true;
      }
    } catch (error) {
      result.warnings.push(`Could not remove extension folder ${extensionDir}: ${error.message}`);
    }
  }
  if (removedFolder) {
    result.extension = 'removed';
  } else if (result.extension !== 'removed') {
    result.extension = codeCli ? 'not installed' : 'not found';
  }
}

function findCodeCli() {
  const candidates = [
    process.env.VSCODE_CLI,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'bin', 'code.cmd'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft VS Code', 'bin', 'code.cmd'),
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft VS Code', 'bin', 'code.cmd'),
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    const found = execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'where code.cmd'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim().split(/\r?\n/)[0];
    return found || null;
  } catch {
    return null;
  }
}

function removeMarkedHooks(filePath, marker, key) {
  if (!fs.existsSync(filePath)) return;
  try {
    const config = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const hooks = config && typeof config.hooks === 'object' && !Array.isArray(config.hooks)
      ? config.hooks
      : {};
    let removed = 0;
    for (const [eventName, rawGroups] of Object.entries(hooks)) {
      if (!Array.isArray(rawGroups)) continue;
      const groups = rawGroups.map((group) => {
        if (!group || typeof group !== 'object' || !Array.isArray(group.hooks)) return group;
        const kept = group.hooks.filter((hook) => {
          const marked = hook && typeof hook.command === 'string' && hook.command.includes(marker);
          if (marked) removed += 1;
          return !marked;
        });
        return { ...group, hooks: kept };
      }).filter((group) => !(group && typeof group === 'object' && Array.isArray(group.hooks) && group.hooks.length === 0));
      if (groups.length > 0) hooks[eventName] = groups;
      else delete hooks[eventName];
    }
    if (removed > 0) {
      config.hooks = hooks;
      fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
      result[key] = `removed ${removed} hook${removed === 1 ? '' : 's'}`;
    } else {
      result[key] = 'no Warren hooks';
    }
  } catch (error) {
    result[key] = 'not removed';
    result.warnings.push(`Could not update ${filePath}: ${error.message}`);
  }
}

function removeOpenCodePlugin() {
  const pluginPath = path.join(home, '.config', 'opencode', 'plugins', 'agent-garden.js');
  if (!fs.existsSync(pluginPath)) return;
  try {
    const content = fs.readFileSync(pluginPath, 'utf8');
    if (!content.includes(OPENCODE_MARKER)) {
      result.opencode = 'unrelated plugin preserved';
      return;
    }
    fs.unlinkSync(pluginPath);
    result.opencode = 'removed';
  } catch (error) {
    result.opencode = 'not removed';
    result.warnings.push(`Could not remove OpenCode plugin: ${error.message}`);
  }
}

function removeBridges() {
  const bridgeDir = path.join(home, '.agent-garden');
  const bridgeNames = [CLAUDE_MARKER, CODEX_MARKER];
  let removed = 0;
  for (const name of bridgeNames) {
    const filePath = path.join(bridgeDir, name);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        removed += 1;
      }
    } catch (error) {
      result.warnings.push(`Could not remove bridge ${filePath}: ${error.message}`);
    }
  }
  try {
    if (fs.existsSync(bridgeDir) && fs.readdirSync(bridgeDir).length === 0) fs.rmdirSync(bridgeDir);
  } catch (error) {
    result.warnings.push(`Could not remove empty bridge directory: ${error.message}`);
  }
  result.bridges = removed > 0 ? `removed ${removed} bridge${removed === 1 ? '' : 's'}` : 'no Warren bridges';
}
