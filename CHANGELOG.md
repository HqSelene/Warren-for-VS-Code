# Changelog

## 0.0.1

- Added the four-state agent attention model.
- Added Claude, Codex, and OpenCode shell-command discovery.
- Added loopback-only cross-window session aggregation and focus routing.
- Added Utility Mode, Garden Mode, transition notifications, and status bar counts.
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
