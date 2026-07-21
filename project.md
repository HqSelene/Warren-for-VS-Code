# Project Overview

## Purpose

AgentTool is an early-stage product concept for helping developers see which AI coding CLI session currently needs their attention, without replacing their existing VS Code terminal workflow.

## Main Parts

- VS Code extension: discovers relevant integrated terminals and provides in-editor status and navigation.
- Agent adapters: official Claude Code Hooks and an OpenCode Plugin normalize real permission, work, completion, and failure events. Codex remains shell-lifecycle-only in the MVP.
- Embedded loopback broker: the first active extension window owns a local-only broker and other windows connect as clients to aggregate sessions and route focus commands.
- Presentation modes: a compact utility view and an optional pet-themed visual layer.
- Demo adapter: provides a deterministic, account-free judging path through all four attention states.

## Key Workflows

- Detect AI coding agents already running in VS Code integrated terminals.
- Group sessions by attention state: Needs You, Working, Done, and Error/Unknown.
- Click a session to focus its original VS Code window and terminal.
- Notify only on meaningful state transitions such as permission required or completion.

## Constraints

- Preserve the user's current CLI and terminal workflow.
- Treat inferred states honestly and distinguish them from hook-confirmed events.
- VS Code shell integration can identify shell-level command lifecycle events, but reliable in-agent states require tool-specific hooks or adapters.
- The extension API is scoped to the current VS Code window, so cross-window attention and navigation require coordination between extension instances through a local broker.
- Avoid expanding the first release into orchestration, worktree management, analytics, or code review.
- Validate extension API limitations before committing to automatic discovery across terminals and windows.
- For the OpenAI Build Week submission, target the Developer Tools track and prioritize a runnable, judge-testable VS Code extension over the full desktop companion architecture.
- Provide a prebuilt VSIX or equivalent test path, document supported platforms, and include a deterministic demo mode so judges do not need live agent accounts.

## Recent Major Changes

- Initial product direction documented: an attention layer for AI coding CLI sessions, starting as a VS Code extension and evaluating a later desktop companion.
- Build Week scope selected: demonstrate the four attention states, multi-window/session aggregation, and click-to-focus in a narrow working prototype built with Codex and GPT-5.6.
- Engineering plan established in `docs/BUILD_PLAN.md`: build the TypeScript VS Code extension first, guarantee Demo Mode, then add the loopback cross-window broker and Garden presentation.
- Build Week MVP implemented: installable TypeScript extension, four-state model, deterministic Demo Mode, terminal discovery/focus, cross-window broker, Utility/Garden views, notifications, tests, and VSIX packaging.
- Real Claude Code and OpenCode adapters implemented: metadata-only event bridges feed the loopback broker, route by VS Code window ID, bind by working directory/external session ID, and drive confirmed states. Safe install/uninstall commands preserve a Claude settings backup.
