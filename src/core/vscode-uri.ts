import { fileURLToPath } from 'node:url';

export function toVsCodeWorkspaceUrl(workspaceUri: string): string | undefined {
  try {
    const workspacePath = fileURLToPath(workspaceUri).replaceAll('\\', '/');
    const encodedPath = encodeURI(workspacePath).replaceAll('#', '%23').replaceAll('?', '%3F');
    return `vscode://file/${encodedPath}`;
  } catch {
    return undefined;
  }
}
