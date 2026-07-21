# Agent Garden

Agent Garden is an attention layer for CLI coding agents running across multiple VS Code windows. It shows which session is working, needs you, is done, or cannot be confirmed—and routes you back to the originating terminal.

## Build Week MVP

- Four normalized attention states: Working, Needs You, Done, and Unknown.
- Cross-window session aggregation over a loopback-only local broker.
- Current-window Claude, Codex, and OpenCode shell-command discovery.
- Click-to-focus terminal routing.
- Utility Mode and Garden Mode.
- Deterministic Demo Mode with no API key or agent account required.
- Notifications only on meaningful transitions into Needs You or Done.

## Install a packaged VSIX

1. Download `agent-garden-0.0.1.vsix` from the project release/artifacts.
2. In VS Code, open **Extensions**.
3. Select **Views and More Actions (…) → Install from VSIX…**.
4. Choose the downloaded file and reload VS Code if prompted.
5. Open the Agent Garden icon in the Activity Bar.

## Judge-friendly test path

1. Open Agent Garden.
2. Select **Start Demo**. Three real VS Code terminals are created and registered as demo sessions.
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
npm.cmd run compile
```

Press `F5` in VS Code to launch the Extension Development Host.

Run tests:

```powershell
npm.cmd test
```

Package the extension:

```powershell
npm.cmd run package
```

## Supported platforms

The Build Week package is tested on Windows with desktop VS Code. The extension uses only stable VS Code APIs and Node's loopback HTTP server, but macOS, Linux, remote workspaces, and web-based VS Code are not yet part of the supported test matrix.

## Status confidence

Agent Garden does not pretend that every inferred terminal state is certain:

- **Confirmed**: a hook, demo adapter, or high-confidence shell-integration event reported the state.
- **Inferred**: the terminal name or lower-confidence shell event suggests an agent.
- **Unknown**: the adapter is missing, stale, or the terminal lifecycle cannot establish the state.

The MVP does not persist prompts, terminal output, or source code. The cross-window broker binds only to `127.0.0.1`.

## How Codex and GPT-5.6 were used

Codex with GPT-5.6 was used as the primary engineering collaborator for the Build Week implementation. It helped:

- turn the product idea into the four-state attention model;
- design the normalized session protocol and honest confidence model;
- implement the TypeScript extension, terminal discovery, loopback broker, and Webview UI;
- identify VS Code terminal API limitations and keep unsupported claims out of the product;
- create the deterministic Demo Mode and unit tests;
- prepare packaging and judge-focused documentation.

The product does not add an unnecessary runtime model call. GPT-5.6 was used to build and reason about the tool itself.

## Known MVP limitations

- Interactive CLI states such as permission prompts require tool-specific hooks for reliable confirmation; generic shell integration cannot see every internal state.
- Cross-window focus commands are routed to the correct extension instance, but whether the operating system brings a background VS Code window to the foreground is platform-dependent.
- Closing the broker-owning VS Code window causes a short reconnect while another window becomes broker owner.

## License

MIT
