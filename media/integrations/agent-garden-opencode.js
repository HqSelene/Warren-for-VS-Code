// Agent Garden OpenCode bridge. Sends only state metadata, never prompts or tool inputs.
const supported = new Set([
  'session.status',
  'session.idle',
  'session.error',
  'permission.asked',
  'permission.replied',
  'question.asked',
  'question.replied',
  'question.rejected',
]);

export const AgentGardenPlugin = async ({ directory }) => ({
  event: async ({ event }) => {
    if (!supported.has(event.type)) return;
    const properties = event.properties || {};
    const error = properties.error || {};
    const reason = event.type === 'permission.asked'
      ? `Permission required: ${properties.permission || 'tool'}`
      : event.type === 'question.asked'
        ? 'OpenCode has a question'
        : error.data?.message || error.message || error.name;
    void fetch('http://127.0.0.1:47832/agent-event', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agent: 'opencode',
        eventType: event.type,
        externalSessionId: properties.sessionID || properties.info?.id,
        targetWindowId: process.env.AGENT_GARDEN_WINDOW_ID,
        cwd: directory,
        status: properties.status?.type,
        reason: typeof reason === 'string' ? reason.slice(0, 500) : undefined,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  },
});
