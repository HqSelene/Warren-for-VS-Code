# Agent Garden

Agent Garden is an attention layer for CLI coding agents running across multiple VS Code windows. It shows which real session is working, needs you, is done, or cannot be confirmed, then routes you back to the originating terminal.

## Build Week MVP

- Four normalized attention states: Working, Needs You, Done, and Unknown.
- Real Claude Code Hook and OpenCode Plugin adapters.
- Cross-window aggregation over a loopback-only local broker.
- Current-window Claude, Codex, and OpenCode shell-command discovery.
- Click-to-focus terminal routing.
- Utility Mode, Garden Mode, and a deterministic account-free Demo Mode.
- Notifications only on meaningful transitions into Needs You or Done.

## Install a packaged VSIX

1. Download `agent-garden-0.0.1.vsix` from the project release or artifacts.
2. In VS Code, open **Extensions**.
3. Select **Views and More Actions (...) > Install from VSIX...**.
4. Choose the downloaded file and reload VS Code if prompted.
5. Open the Agent Garden icon in the Activity Bar.

## Connect real Claude Code and OpenCode sessions

From the VS Code Command Palette, run:

- **Agent Garden: Install Claude Code Adapter**
- **Agent Garden: Install OpenCode Adapter**

The Claude installer merges Agent Garden command hooks into `~/.claude/settings.json` and creates `settings.json.agent-garden.bak`. The OpenCode installer places a global plugin at `~/.config/opencode/plugins/agent-garden.js`. Both adapters can be removed with their matching uninstall commands.

After installation, reload VS Code and open a **new integrated terminal**, then start `claude` or `opencode`. New terminals inherit a per-window routing ID, which prevents events from another VS Code window being attached to the wrong session. Adapter events contain only state metadata; prompts, tool inputs, terminal output, source code, and credentials are never sent or stored.

Real state mappings include:

- Claude `UserPromptSubmit`/tool events -> Working
- Claude `PermissionRequest` -> Needs You
- Claude `Stop` -> Done
- OpenCode `session.status: busy` -> Working
- OpenCode `permission.asked`/`question.asked` -> Needs You
- OpenCode `session.idle` -> Done
- Claude/OpenCode failures -> Needs You with an error reason

## Judge-friendly test path

1. Open Agent Garden.
2. Select **Start Demo**. Three VS Code terminals are created and registered as demo sessions.
3. Confirm that Working, Needs You, and Done are visible.
4. Select a session card and verify that its terminal is revealed.
5. Select **Advance States** to exercise transitions and notifications.
6. Toggle **Garden Mode** to view the same data through the pet presentation.
7. Open a second VS Code window with Agent Garden installed and run Start Demo there to test cross-window aggregation.

Demo Mode never calls an external service and never needs Claude, Codex, OpenCode, or an OpenAI API key.

## Build from source

Requirements:

- Node.js 20 or newer
- VS Code 1.125 or newer

```powershell
npm.cmd install
npm.cmd test
npm.cmd run package
```

Press `F5` in VS Code to launch the Extension Development Host.

## Supported platforms

The Build Week package is tested on Windows with desktop VS Code. The extension uses stable VS Code APIs and a loopback-only Node HTTP server, but macOS, Linux, remote workspaces, and web-based VS Code are not yet part of the supported test matrix.

## Status confidence and limitations

- **Confirmed** means an official tool hook/plugin, Demo Adapter, or high-confidence shell event reported the state.
- **Inferred** means a terminal name or lower-confidence shell event suggests an agent.
- **Unknown** means the adapter is absent, stale, or the terminal lifecycle cannot establish the state.

Codex currently has shell-lifecycle discovery but no runtime adapter in this MVP. Two same-agent terminals launched in the same VS Code window and same working directory can still require a best-recent-session match until they acquire distinct external session IDs. Bringing a background VS Code window to the OS foreground remains platform-dependent.

## How Codex and GPT-5.6 were used

Codex with GPT-5.6 was the primary engineering collaborator. It helped define the honest attention model, validate official Claude Code/OpenCode integration points, implement the TypeScript extension and adapters, build the broker and Webview UI, test real event transport, and prepare judge-focused packaging and documentation. The product does not add an unnecessary runtime model call.

## License

MIT
