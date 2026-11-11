import assert from 'node:assert/strict';
import { once } from 'node:events';

const [moduleUrl, filePath, sessionId] = process.argv.slice(2);
const { ActivityJournal } = await import(moduleUrl);
const journal = new ActivityJournal({ filePath, lockTimeoutMs: 5000 });
const barrier = once(process, 'message');
process.send({ ready: true });
const [action] = await barrier;
assert.equal(action, 'write');

const ids = [];
for (let index = 0; index < 10; index++) {
  const event = await journal.append({
    kind: 'tool-end', source: 'measured', transport: 'mcp',
    tool: 'context_pack', correlationId: sessionId + '-' + index,
    durationMs: index, outcome: 'success', sessionId, projectId: 'fixture-project',
  });
  ids.push(event.id);
}
process.send({ ids }, () => process.disconnect());
