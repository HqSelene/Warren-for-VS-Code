// Agent Garden OpenCode bridge. Sends state metadata and a short user-instruction preview.
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

const oneLine = (value) => typeof value === 'string'
  ? value.replace(/\s+/g, ' ').trim().slice(0, 160) || undefined
  : undefined;

const post = (body) => {
  const port = Number(process.env.AGENT_GARDEN_BROKER_PORT || 47832);
  void fetch(`http://127.0.0.1:${port}/agent-event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, timestamp: Date.now() }),
  }).catch(() => {});
};

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
    post({
      agent: 'opencode',
      eventType: event.type,
      externalSessionId: properties.sessionID || properties.info?.id,
      targetWindowId: process.env.AGENT_GARDEN_WINDOW_ID,
      cwd: directory,
      status: properties.status?.type,
      reason: typeof reason === 'string' ? reason.slice(0, 500) : undefined,
    });
  },
  'chat.message': async (input, output) => {
    const prompt = output.parts
      ?.filter((part) => part?.type === 'text')
      .map((part) => part.text)
      .join(' ');
    post({
      agent: 'opencode',
      eventType: 'user.prompt',
      externalSessionId: input.sessionID,
      targetWindowId: process.env.AGENT_GARDEN_WINDOW_ID,
      cwd: directory,
      preview: oneLine(prompt),
    });
  },
});
