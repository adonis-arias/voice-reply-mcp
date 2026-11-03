const test = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'voice-reply-'));

function mcp(queueDir, messages) {
  const input = messages.map((m) => JSON.stringify(m)).join('\n') + '\n';
  const out = spawnSync('node', [path.join(ROOT, 'mcp-server.js')], {
    input, encoding: 'utf8', env: { ...process.env, VOICE_QUEUE: path.join(queueDir, 'queue.jsonl') },
  }).stdout;
  return out.trim().split('\n').map((l) => JSON.parse(l));
}
const call = (id, name, args) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });

test('clean() quita codigo, enlaces, tablas y markdown', () => {
  const { clean } = require('../lib');
  assert.strictEqual(clean('## Hola\n```js\nx()\n```\nMira `a.js` y https://x.com **bien**'), 'Hola Mira a.js y bien');
  assert.strictEqual(clean('```solo codigo```'), '');
  assert.strictEqual(clean('| a | b |\ntexto'), 'texto');
});

test('clean() corta en limite de frase', () => {
  const { clean } = require('../lib');
  const long = 'Frase uno. '.repeat(100);
  const out = clean(long);
  assert.ok(out.length <= 500 && out.endsWith('.'));
});

test('MCP: initialize, tools/list y speak encolan', () => {
  const dir = tmp();
  const res = mcp(dir, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    call(3, 'speak', { text: 'Hola **mundo**' }),
    call(4, 'speak', { text: '```solo```' }),
  ]);
  assert.ok(res[0].result.instructions.includes('MANUAL'));
  assert.deepStrictEqual(res[1].result.tools.map((t) => t.name), ['speak', 'voice_mode', 'voice_persona']);
  assert.strictEqual(res[3].result.isError, true);
  const line = JSON.parse(fs.readFileSync(path.join(dir, 'queue.jsonl'), 'utf8').trim());
  assert.strictEqual(line.text, 'Hola mundo');
});

test('MCP: speak con mood valido lo encola, mood invalido falla', () => {
  const dir = tmp();
  const res = mcp(dir, [
    call(1, 'speak', { text: 'Listo.', mood: 'proud' }),
    call(2, 'speak', { text: 'Hola', mood: 'enojado' }),
  ]);
  assert.strictEqual(res[0].result.isError, false);
  assert.ok(res[1].error);
  const line = JSON.parse(fs.readFileSync(path.join(dir, 'queue.jsonl'), 'utf8').trim());
  assert.strictEqual(line.mood, 'proud');
});

test('MCP: voice_mode y voice_persona persisten y validan', () => {
  const dir = tmp();
  mcp(dir, [call(1, 'voice_mode', { mode: 'auto' }), call(2, 'voice_persona', { style: 'jarvis', humor: 75, address: 'joven' })]);
  const res = mcp(dir, [
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    call(2, 'voice_mode', { mode: 'xx' }),
    call(3, 'voice_persona', { humor: 150 }),
  ]);
  assert.ok(res[0].result.instructions.includes('AUTOMATICO'));
  assert.ok(res[0].result.instructions.includes('Humor al 75'));
  assert.ok(res[0].result.instructions.includes('joven'));
  assert.ok(res[1].error && res[2].error);
});

test('say.js: texto plano y hook Stop con transcript', () => {
  const dir = tmp();
  const env = { ...process.env, VOICE_QUEUE: path.join(dir, 'queue.jsonl') };
  spawnSync('node', [path.join(ROOT, 'say.js')], { input: 'Prueba plana.', env });
  const tr = path.join(dir, 't.jsonl');
  fs.writeFileSync(tr, [
    '{"type":"user","message":{"content":"hola"}}',
    '{"type":"assistant","message":{"content":[{"type":"text","text":"Primero."},{"type":"tool_use","name":"Bash","input":{}}]}}',
    '{"type":"assistant","message":{"content":[{"type":"text","text":"Respuesta **final**."}]}}',
  ].join('\n'));
  spawnSync('node', [path.join(ROOT, 'say.js')], { input: JSON.stringify({ transcript_path: tr }), env });
  const lines = fs.readFileSync(path.join(dir, 'queue.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepStrictEqual(lines.map((l) => l.text), ['Prueba plana.', 'Respuesta final.']);
});
