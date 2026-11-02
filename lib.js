// Logica comun: limpiar texto para voz y encolarlo (hook Stop, CLI y servidor MCP).
const fs = require('fs');
const os = require('os');
const path = require('path');

const QUEUE = process.env.VOICE_QUEUE || path.join(os.homedir(), '.claude-voice', 'queue.jsonl');
const MAX_CHARS = Number(process.env.VOICE_MAX_CHARS || 500);

function clean(text) {
  let t = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s*\|.*\|\s*$/gm, ' ')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/[#*_>~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > MAX_CHARS) {
    const cut = t.slice(0, MAX_CHARS);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
    t = end > MAX_CHARS / 2 ? cut.slice(0, end + 1) : cut;
  }
  return t;
}

// Devuelve el texto encolado, o '' si no quedo nada que decir.
function enqueue(raw, extra = {}) {
  const text = clean(raw);
  if (!text) return '';
  fs.mkdirSync(path.dirname(QUEUE), { recursive: true });
  fs.appendFileSync(QUEUE, JSON.stringify({ t: Date.now(), text, ...extra }) + '\n');
  return text;
}

module.exports = { QUEUE, clean, enqueue };
