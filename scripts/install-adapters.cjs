const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const home = os.homedir();
const marker = 'agent-garden-claude-hook.cjs';
const bridgePath = path.join(home, '.agent-garden', marker);
const settingsPath = path.join(home, '.claude', 'settings.json');
const openCodePath = path.join(home, '.config', 'opencode', 'plugins', 'agent-garden.js');
const events = [
  'SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest',
  'PostToolUse', 'PostToolUseFailure', 'Notification', 'Stop',
  'StopFailure', 'SessionEnd',
];

fs.mkdirSync(path.dirname(bridgePath), { recursive: true });
fs.copyFileSync(path.join(projectRoot, 'media', 'integrations', marker), bridgePath);

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
const settings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  : {};
if (fs.existsSync(settingsPath) && !fs.existsSync(`${settingsPath}.agent-garden.bak`)) {
  fs.copyFileSync(settingsPath, `${settingsPath}.agent-garden.bak`);
}
const hooks = settings.hooks && typeof settings.hooks === 'object' && !Array.isArray(settings.hooks)
  ? settings.hooks
  : {};
const command = `node "${bridgePath.replaceAll('"', '\\"')}"`;
for (const eventName of events) {
  const groups = Array.isArray(hooks[eventName]) ? hooks[eventName] : [];
  if (!groups.some((group) => group?.hooks?.some((hook) => hook?.command?.includes(marker)))) {
    groups.push({ hooks: [{ type: 'command', command, timeout: 5 }] });
  }
  hooks[eventName] = groups;
}
settings.hooks = hooks;
fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');

fs.mkdirSync(path.dirname(openCodePath), { recursive: true });
if (fs.existsSync(openCodePath)) {
  const existing = fs.readFileSync(openCodePath, 'utf8');
  if (!existing.includes('Agent Garden OpenCode bridge')) {
    throw new Error(`Refusing to replace an unrelated OpenCode plugin: ${openCodePath}`);
  }
}
fs.copyFileSync(
  path.join(projectRoot, 'media', 'integrations', 'agent-garden-opencode.js'),
  openCodePath,
);

process.stdout.write(JSON.stringify({ settingsPath, bridgePath, openCodePath }, null, 2));
