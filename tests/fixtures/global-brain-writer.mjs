import assert from 'node:assert/strict';
import { once } from 'node:events';

const [moduleUrl, dbPath, writer] = process.argv.slice(2);
const { GlobalBrain } = await import(moduleUrl);
const brain = GlobalBrain.getInstance({ dbPath, syncIntervalMs: 60_000 });
await brain.init();

const barrier = once(process, 'message');
process.send({ ready: true });
const [action] = await barrier;
assert.equal(action, 'write');

brain.registerAgent('codex');
const writes = Array.from({ length: 10 }, (_, index) => brain.write({
  projectId: writer,
  projectName: writer,
  agentTool: 'codex',
  category: 'lesson',
  content: `synthetic memory ${writer}-${index}`,
  importance: 0.5,
  metadata: {},
}));

await brain.sync();
assert.deepEqual(await Promise.all(writes), Array(10).fill(true));
const ids = brain.recall({ projectId: writer, limit: 10 }).map(entry => entry.id);
assert.equal(ids.length, 10);
await brain.shutdown();
process.send({ ids }, () => process.disconnect());

