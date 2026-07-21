# Warren for VS Code

**All your coding agents, at a glance.**

Warren is a cute always-on-top desktop companion for real CLI coding agents running across multiple VS Code windows. It shows what each Claude, GPT · Codex, or OpenCode session is doing, which one needs attention, and lets you jump back to the originating terminal.

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

## Install Warren (recommended)

Requirements:

- Windows 10 or Windows 11
- Desktop VS Code 1.125 or newer
- At least one supported CLI: Claude Code, Codex, or OpenCode

1. Download `Warren-Setup-0.0.1.exe` from the GitHub Releases page.
2. Run the installer once. If Windows SmartScreen appears, select **More info → Run anyway**.
3. Warren automatically installs the desktop companion, VS Code bridge, and bundled Claude, Codex, and OpenCode adapters.
4. Reload every open VS Code window.
5. Open a new integrated terminal in each workspace, then start the supported agents you want to monitor.
6. Codex users should open `/hooks`, review the Warren user hook, and trust it.

Normal users do not need to install the VSIX separately. Opening new terminals after reloading VS Code is important because Warren injects a unique routing ID for every VS Code window.

## Manual fallback installation

Use this route if automatic VS Code bridge setup fails or when testing a development build.

### 1. Install the VS Code bridge manually

Download `agent-garden-0.0.1.vsix` from the GitHub Release assets. The filename retains the original internal package ID for upgrade compatibility, but it appears as **Warren** inside VS Code.

In VS Code:

1. Open the Extensions view.
2. Select the `...` menu.
3. Choose **Install from VSIX...**.
4. Select `agent-garden-0.0.1.vsix`.
5. Run **Developer: Reload Window** in every open VS Code window.

You can also install it from PowerShell:

```powershell
code --install-extension .\agent-garden-0.0.1.vsix --force
```

### 2. Install the agent adapters manually

Run the adapters you need from the VS Code Command Palette:

- **Warren: Install Claude Code Adapter**
- **Warren: Install Codex Adapter**
- **Warren: Install OpenCode Adapter**

Restart the corresponding CLI after installation. Codex users must also open `/hooks`, review the Warren user hook, and trust it.

Adapter locations:

- Claude: merges marked hooks into `~/.claude/settings.json`.
- Codex: merges marked hooks into `~/.codex/hooks.json`.
- OpenCode: installs `~/.config/opencode/plugins/agent-garden.js`.

Existing settings are preserved and an `.agent-garden.bak` backup is created before the first modification. Warren's uninstall commands remove only Warren-owned entries.

If the Windows installer already installed the desktop application, start **Warren** normally after completing these steps.

### 3. Run the desktop companion from source

Use this only if you cannot use the Windows installer.

Requirements:

- Node.js 20 or newer
- Desktop VS Code 1.125 or newer

```powershell
npm.cmd install
npm.cmd run desktop:dev
```

## Build packages from source

Build the VSIX:

```powershell
npm.cmd run package
```

Build the Windows installer:

```powershell
npm.cmd run desktop:pack
```

Build artifacts:

- `agent-garden-0.0.1.vsix`
- `release/Warren-Setup-0.0.1.exe`

## Uninstall

Use **Settings → Apps → Installed apps → Warren → Uninstall**. The uninstaller removes the Warren desktop application, VS Code extension, marked Claude/Codex hooks, OpenCode plugin, bridge files, and app cache. It preserves `.agent-garden.bak` backups and unrelated user configuration.

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

The current Build Week package is tested on Windows with desktop VS Code. The extension uses stable VS Code APIs and the desktop companion uses Electron. The Windows installer is not yet code-signed, so Windows SmartScreen may identify the publisher as unknown; judges can use **More info → Run anyway** or run the app from source. macOS, Linux, remote workspaces, and web-based VS Code are not yet part of the supported test matrix.

## How Codex and GPT-5.6 were used

Codex with GPT-5.6 was the primary engineering collaborator. It helped define the attention model, validate official Claude Code/OpenCode/Codex lifecycle integrations, implement the extension, adapters, local broker and Electron companion, visually verify the floating UI, and build the test and packaging workflows. Warren does not add a runtime model call.

## License

MIT
