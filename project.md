# Project Overview

## Purpose

Warren for VS Code is a desktop companion and VS Code bridge that helps developers see what multiple AI coding CLI sessions are doing and which one needs attention, without replacing their terminal workflow.

## Main Parts

- VS Code extension: discovers relevant integrated terminals and provides in-editor status and navigation.
- Desktop companion: an Electron, always-on-top, frameless floating window with workspace grouping, compact animated pets, resizable fixed-size scrolling, target-workspace activation, and a draggable status capsule.
- Agent adapters: official Claude Code Hooks, Codex lifecycle Hooks, and an OpenCode Plugin normalize real prompts, permissions, work, completion, and failure events.
- Embedded loopback broker: the first active extension window owns a local-only broker and other windows connect as clients to aggregate sessions and route focus commands.
- Presentation modes: a full pet dashboard and a compact status capsule, both limited to real detected sessions.

## Key Workflows

- Detect AI coding agents already running in VS Code integrated terminals.
- Group sessions by attention state: Needs You, Error, Working, and Done.
- Click a session to focus its original VS Code window and terminal.
- Notify only on meaningful state transitions such as permission required or completion.
- Show a single-line, locally transported preview of the latest user instruction so each session is identifiable at a glance.
- Remove a session as soon as its agent process or terminal ends.

## Constraints

- Preserve the user's current CLI and terminal workflow.
- Treat inferred states honestly and distinguish them from hook-confirmed events.
- VS Code shell integration can identify shell-level command lifecycle events, but reliable in-agent states require tool-specific hooks or adapters.
- The extension API is scoped to the current VS Code window, so cross-window attention and navigation require coordination between extension instances through a local broker.
- Avoid expanding the first release into orchestration, worktree management, analytics, or code review.
- Validate extension API limitations before committing to automatic discovery across terminals and windows.
- For the OpenAI Build Week submission, target the Developer Tools track and provide both a runnable desktop companion and its VS Code bridge.
- Provide a prebuilt Windows installer and VSIX, document supported platforms, and give judges a concise real-session test path.
- Make installation and removal one-click on Windows: the NSIS installer bundles the VS Code bridge and adapters, and its uninstaller removes only Warren integrations while preserving backups and unrelated user configuration.

## Recent Major Changes

- Initial product direction documented: an attention layer for AI coding CLI sessions, starting as a VS Code extension and evaluating a later desktop companion.
- Build Week scope selected: demonstrate the four attention states, multi-window/session aggregation, and click-to-focus in a narrow working prototype built with Codex and GPT-5.6.
- Engineering plan established in `docs/BUILD_PLAN.md`: build the TypeScript VS Code extension first, then add the loopback cross-window broker and Warren presentation.
- Build Week MVP implemented: installable TypeScript extension, four-state model, terminal discovery/focus, cross-window broker, Utility/Warren views, notifications, tests, and VSIX packaging.
- Real Claude Code and OpenCode adapters implemented: local event bridges feed the loopback broker, route by VS Code window ID, bind by working directory/external session ID, drive confirmed states, and carry only a short user-instruction preview. Safe install/uninstall commands preserve a Claude settings backup.
- Demo Mode removed; ended agent processes now disappear immediately, and real Claude/OpenCode sessions display a locally transported one-line user-instruction preview.
- Electron desktop companion added with an always-on-top frameless window, CSS-drawn animated pets, workspace grouping, click-to-focus, user-controlled sizing, internal scrolling, and a draggable compact status capsule.
- Codex lifecycle adapter added from official user-level hooks, enabling real GPT · Codex prompt previews and Working/Needs You/Done states after hook trust approval.
- Visible state model finalized as Working, Needs You, Done, and Error; unconfirmed name-only terminals remain hidden and ended processes are removed.
- Desktop interaction refined around a 410×420 default and 330×260 minimum: cards highlight only on hover, reference animations are used at a smaller scale, additional agents scroll inside the window, the collapsed capsule remains draggable, and click-to-focus activates the target VS Code workspace before focusing its terminal.
- Windows packaging refined with bundled first-run setup and custom uninstall cleanup for the VS Code extension, Warren hooks, OpenCode plugin, bridge files, and app cache.
- Initial shell detection now shows a session as Needs You / “Ready for your instruction” until a real Claude Hook, Codex Hook, or OpenCode Plugin event confirms active work.
- Cross-window event routing now resolves unscoped adapter events by unique external session ID or workspace path and drops ambiguous events instead of mirroring one Agent's state into another window.
- Windows first-run setup now passes `code.cmd` as a separate `cmd.exe` argument with `CALL`, so the bundled VS Code bridge installs correctly from paths such as `Program Files`.
- First-run setup marker advanced to v2 so upgrades retry the bundled Warren VS Code bridge installation once.
