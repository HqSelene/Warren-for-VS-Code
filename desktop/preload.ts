import { contextBridge, ipcRenderer } from 'electron';
import type { AgentSession, FocusRequest } from '../src/core/types';

export interface DesktopSnapshot {
  connected: boolean;
  sessions: AgentSession[];
}

export interface AgentGardenDesktopApi {
  onSessions: (listener: (snapshot: DesktopSnapshot) => void) => () => void;
  onCompact: (listener: (compact: boolean) => void) => () => void;
  focus: (request: FocusRequest) => Promise<void>;
  toggleCompact: () => void;
  minimize: () => void;
  close: () => void;
  setPinned: (pinned: boolean) => void;
  setHeight: (height: number) => void;
}

const api: AgentGardenDesktopApi = {
  onSessions: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: DesktopSnapshot): void => listener(snapshot);
    ipcRenderer.on('garden:sessions', handler);
    return () => ipcRenderer.off('garden:sessions', handler);
  },
  onCompact: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, compact: boolean): void => listener(compact);
    ipcRenderer.on('garden:compact', handler);
    return () => ipcRenderer.off('garden:compact', handler);
  },
  focus: (request) => ipcRenderer.invoke('garden:focus', request) as Promise<void>,
  toggleCompact: () => ipcRenderer.send('garden:toggle-compact'),
  minimize: () => ipcRenderer.send('garden:minimize'),
  close: () => ipcRenderer.send('garden:close'),
  setPinned: (pinned) => ipcRenderer.send('garden:set-pin', pinned),
  setHeight: (height) => ipcRenderer.send('garden:set-height', height),
};

contextBridge.exposeInMainWorld('agentGarden', api);
