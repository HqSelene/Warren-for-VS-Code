import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { DemoAdapter } from './adapters/demo-adapter';
import { BrokerClient } from './broker/client';
import { shouldNotify } from './core/state-machine';
import { SessionRegistry } from './core/session-registry';
import type { AgentSession, WindowDescriptor } from './core/types';
import { TerminalDiscovery } from './terminal/discovery';
import { DashboardProvider, type PresentationMode } from './view/provider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const windowDescriptor: WindowDescriptor = {
    id: randomUUID(),
    workspaceName: vscode.workspace.name ?? 'Untitled workspace',
    workspaceUri: vscode.workspace.workspaceFolders?.[0]?.uri.toString(),
  };

  const registry = new SessionRegistry((previous, next) => {
    if (!shouldNotify(previous, next)) {
      return;
    }
    const label = `${agentLabel(next)} · ${next.workspaceName}`;
    if (next.state === 'needsYou') {
      void vscode.window.showWarningMessage(`${label} needs you: ${next.reason ?? 'Attention required'}`);
    } else if (next.state === 'done') {
      void vscode.window.showInformationMessage(`${label} finished.`);
    }
  });

  const discovery = new TerminalDiscovery(
    registry,
    windowDescriptor.id,
    windowDescriptor.workspaceName,
  );
  discovery.initialize();
  const demo = new DemoAdapter(registry, discovery);

  let mode = context.globalState.get<PresentationMode>('presentationMode', 'utility');
  let latestSessions: AgentSession[] = [];
  let broker: BrokerClient;

  const provider = new DashboardProvider(windowDescriptor.id, mode, {
    focus: async (sessionId) => {
      const session = provider.getSession(sessionId);
      if (!session) {
        return;
      }
      if (session.windowId === windowDescriptor.id) {
        if (!discovery.focus(session.terminalId)) {
          void vscode.window.showWarningMessage('The original terminal is no longer available.');
        }
        return;
      }
      try {
        await broker.requestFocus({
          targetWindowId: session.windowId,
          terminalId: session.terminalId,
        });
        void vscode.window.showInformationMessage(`Focus request sent to ${session.workspaceName}.`);
      } catch {
        void vscode.window.showWarningMessage(
          `Could not reach ${session.workspaceName}. The cross-window broker is reconnecting.`,
        );
      }
    },
    startDemo: () => {
      demo.start();
      broker.publishNow();
    },
    advanceDemo: () => {
      demo.advance();
      broker.publishNow();
    },
    resetDemo: () => {
      demo.reset();
      broker.publishNow();
    },
    toggleMode: () => {
      mode = mode === 'utility' ? 'garden' : 'utility';
      void context.globalState.update('presentationMode', mode);
      provider.setMode(mode);
    },
    refresh: () => broker.publishNow(),
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('agentGarden.panel', provider),
    discovery,
    demo,
  );

  broker = new BrokerClient({
    window: windowDescriptor,
    getLocalSessions: () => registry.getAll(),
    onSnapshot: (snapshot) => {
      latestSessions = snapshot.sessions;
      provider.setSessions(latestSessions);
      updateStatusBar(statusBar, latestSessions);
    },
    onFocusCommand: (command) => {
      if (discovery.focus(command.terminalId)) {
        void vscode.window.showInformationMessage('Agent Garden focused the requested terminal.');
      }
    },
    onStatusChange: (connected) => provider.setBrokerConnected(connected),
  });

  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    20,
  );
  statusBar.name = 'Agent Garden';
  statusBar.command = 'agentGarden.open';
  statusBar.text = '$(hubot) Agent Garden';
  statusBar.tooltip = 'Open Agent Garden';
  statusBar.show();

  context.subscriptions.push(
    statusBar,
    { dispose: () => broker.dispose() },
    registry.subscribe((sessions) => {
      const remote = latestSessions.filter(
        (session) => session.windowId !== windowDescriptor.id,
      );
      const merged = [...sessions, ...remote];
      provider.setSessions(merged);
      updateStatusBar(statusBar, merged);
      broker?.publishNow();
    }),
    vscode.commands.registerCommand('agentGarden.open', async () => {
      await vscode.commands.executeCommand('workbench.view.extension.agentGarden');
    }),
    vscode.commands.registerCommand('agentGarden.startDemo', () => demo.start()),
    vscode.commands.registerCommand('agentGarden.advanceDemo', () => demo.advance()),
    vscode.commands.registerCommand('agentGarden.resetDemo', () => demo.reset()),
    vscode.commands.registerCommand('agentGarden.toggleMode', () => {
      mode = mode === 'utility' ? 'garden' : 'utility';
      void context.globalState.update('presentationMode', mode);
      provider.setMode(mode);
    }),
    vscode.commands.registerCommand('agentGarden.refresh', () => broker.publishNow()),
  );

  await broker.start();
}

function updateStatusBar(
  statusBar: vscode.StatusBarItem,
  sessions: readonly AgentSession[],
): void {
  const needsYou = sessions.filter((session) => session.state === 'needsYou').length;
  const working = sessions.filter((session) => session.state === 'working').length;
  statusBar.text = needsYou > 0
    ? `$(bell) ${needsYou} need you · ${working} working`
    : `$(hubot) ${working} working`;
  statusBar.backgroundColor = needsYou > 0
    ? new vscode.ThemeColor('statusBarItem.warningBackground')
    : undefined;
}

function agentLabel(session: AgentSession): string {
  switch (session.agent) {
    case 'claude':
      return 'Claude';
    case 'codex':
      return 'Codex';
    case 'opencode':
      return 'OpenCode';
    default:
      return 'CLI Agent';
  }
}
