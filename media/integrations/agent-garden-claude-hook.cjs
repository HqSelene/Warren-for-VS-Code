// Agent Garden Claude bridge. Keep stdout/stderr empty: hook output can affect Claude.
const http = require('node:http');

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  try {
    const raw = JSON.parse(input || '{}');
    const payload = JSON.stringify({
      agent: 'claude',
      eventType: String(raw.hook_event_name || ''),
      externalSessionId: text(raw.session_id),
      targetWindowId: text(process.env.AGENT_GARDEN_WINDOW_ID),
      cwd: text(raw.cwd),
      notificationType: text(raw.notification_type),
      toolName: text(raw.tool_name),
      reason: text(raw.message || raw.error),
      preview: oneLine(raw.prompt),
      timestamp: Date.now(),
    });
    const request = http.request({
      host: '127.0.0.1',
      port: Number(process.env.AGENT_GARDEN_BROKER_PORT || 47832),
      path: '/agent-event',
      method: 'POST',
      timeout: 500,
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      },
    });
    request.on('error', () => process.exit(0));
    request.on('timeout', () => request.destroy());
    request.on('response', (response) => {
      response.resume();
      response.on('end', () => process.exit(0));
    });
    request.end(payload);
  } catch {
    process.exit(0);
  }
});

function text(value) {
  return typeof value === 'string' && value ? value.slice(0, 500) : undefined;
}

function oneLine(value) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, 160) || undefined
    : undefined;
}
