import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { toVsCodeWorkspaceUrl } from '../src/core/vscode-uri';

test('builds a VS Code activation URL for a workspace folder', () => {
  assert.equal(
    toVsCodeWorkspaceUrl('file:///E:/Project/My%20Garden/%23docs'),
    'vscode://file/E:/Project/My%20Garden/%23docs',
  );
});

test('rejects non-file workspace URIs', () => {
  assert.equal(toVsCodeWorkspaceUrl('https://example.com/workspace'), undefined);
});
