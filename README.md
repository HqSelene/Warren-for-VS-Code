# Agent Garden

Agent Garden is a cute always-on-top desktop companion for real CLI coding agents running across multiple VS Code windows. It shows what each Claude, GPT · Codex, or OpenCode session is doing, which one needs attention, and lets you jump back to the originating terminal.

## What it does

- Aggregates real sessions from every active VS Code window.
- Shows four states: Working, Needs You, Done, and Error.
- Displays a whitespace-normalized, one-line preview of the latest user instruction, limited to 160 characters.
- Uses compact animated CSS pets: typing wiggle, permission hop, sleeping `z`, error dizzy, blinking, and pulsing status dots.
- Groups agents by workspace and activates the originating VS Code workspace and terminal when a card is selected.
- Starts at 410×420, can be resized down to 330×260, and scrolls internally instead of growing when more agents appear.
- Stays on top, can be unpinned or moved, and collapses into a draggable compact status capsule.
- Removes a session immediately when its agent process or terminal ends.

The desktop app and VS Code extensions communicate only through an in-memory HTTP broker bound to `127.0.0.1`. Full prompts, responses, tool inputs, terminal output, source code, and credentials are not persisted.

## Run the desktop companion

Requirements:

- Node.js 20 or newer
- VS Code 1.125 or newer

```powershell
npm.cmd install
npm.cmd run desktop:dev
```

Build the Windows installer:

```powershell
npm.cmd run desktop:pack
```

The installer is generated under `release/` as `Agent-Garden-Setup-0.0.1.exe`. Running it once installs the desktop companion, VS Code bridge, and bundled Claude, Codex, and OpenCode adapters.

To remove Agent Garden, use the normal Windows path **Settings → Apps → Installed apps → Agent Garden → Uninstall**. The uninstaller removes the Agent Garden VS Code extension, its Claude/Codex hook entries, the OpenCode plugin, bridge files, and app cache. It preserves the `.agent-garden.bak` backups and unrelated hooks/configuration.

## Install the VS Code bridge

Build the VSIX:

```powershell
npm.cmd run package
```

The setup executable installs `agent-garden-0.0.1.vsix` automatically. Reload VS Code and open a new integrated terminal. The extension injects a per-window routing ID, discovers agent commands, publishes sessions to the broker, and handles click-to-focus requests from the desktop companion.

## Connect real agents

Run these commands from the VS Code Command Palette:

- **Agent Garden: Install Claude Code Adapter**
- **Agent Garden: Install Codex Adapter**
- **Agent Garden: Install OpenCode Adapter**

Restart the corresponding CLI after installing an adapter. Codex requires one additional trust step: open `/hooks`, review the Agent Garden user hook, and trust it. This is Codex's standard trust flow for non-managed command hooks.

Adapter locations:

- Claude: merges hooks into `~/.claude/settings.json`.
- Codex: merges hooks into `~/.codex/hooks.json`.
- OpenCode: installs `~/.config/opencode/plugins/agent-garden.js`.

The installers preserve existing settings and create an `.agent-garden.bak` backup before the first modification. Matching uninstall commands remove only Agent Garden entries.

## Real event mapping

| Agent | Working | Needs You | Done | Error |
|---|---|---|---|---|
| Claude | prompt/tool hooks | permission or idle prompt | stop | tool/stop failure |
| GPT · Codex | prompt/tool hooks | permission request | stop | terminal-level failure where reported |
| OpenCode | busy status/user prompt | permission/question | idle | session error |

## Test

```powershell
npm.cmd test
```

For a real end-to-end check, start the desktop app, open two VS Code windows, create new integrated terminals, then run different agents in each. Submit tasks, trigger a permission request, finish a turn, and exit an agent. The floating window should update and the exited session should disappear.

## Supported platforms

The current Build Week package is tested on Windows with desktop VS Code. The extension uses stable VS Code APIs and the desktop companion uses Electron. The portable executable is not yet code-signed, so Windows SmartScreen may identify the publisher as unknown; judges can use **More info → Run anyway** or run the app from source. macOS, Linux, remote workspaces, and web-based VS Code are not yet part of the supported test matrix.

## How Codex and GPT-5.6 were used

Codex with GPT-5.6 was the primary engineering collaborator. It helped define the attention model, validate official Claude Code/OpenCode/Codex lifecycle integrations, implement the extension, adapters, local broker and Electron companion, visually verify the floating UI, and build the test and packaging workflows. Agent Garden does not add a runtime model call.

## License

MIT
