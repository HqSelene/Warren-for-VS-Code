# Changelog

## 0.0.1

- Added one-click Windows setup and uninstall cleanup for the VS Code extension, Warren hooks, OpenCode bridge, and desktop cache while preserving user backups and unrelated configuration.
- Fixed startup false positives: a newly launched CLI is shown as waiting for your instruction until an adapter confirms active work.
- Fixed cross-window Agent state bleed by routing adapter events to one matching VS Code window and ignoring ambiguous unscoped events.
- Fixed Windows first-run setup when VS Code is installed under a path containing spaces.
- Added the four-state agent attention model.
- Added Claude, Codex, and OpenCode shell-command discovery.
- Added loopback-only cross-window session aggregation and focus routing.
- Added Utility Mode, Warren Mode, transition notifications, and status bar counts.
- Added unit and broker integration tests plus VSIX packaging.
- Added real Claude Code Hook and OpenCode Plugin adapters for working, permission/question, completion, and failure events.
- Added per-window terminal routing metadata and safe adapter install/uninstall commands.
- Removed Demo Mode so the UI contains only real detected sessions.
- Removed sessions immediately when their agent process or terminal ends.
- Added a locally transported, 160-character one-line user-instruction preview.
- Added an Electron always-on-top desktop companion with workspace grouping, animated CSS pets, terminal focus, and a compact capsule.
- Added a branded pet application icon and repeatable Windows portable packaging.
- Added a real Codex lifecycle hook adapter for prompt, tool, permission, and completion events.
- Replaced the visible Unknown state with Error; unconfirmed terminals stay hidden and ended sessions disappear.
- Stabilized dynamic window sizing to prevent polling jitter and replaced the low collapse glyph with a centered right-pointing control.
- Replaced automatic height growth with user resizing and internal scrolling, reduced the complete interface scale, removed persistent card highlighting, adopted the reference pet animations/colors, made the compact capsule draggable, and added target-workspace activation to click-to-focus.
