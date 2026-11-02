#!/usr/bin/env node
// Encola texto para la app de voz.
//  - Hook Stop de Claude Code: stdin es JSON con transcript_path -> habla la ultima respuesta.
//  - Cualquier otra herramienta: stdin es texto plano (echo "hola" | say.js).
const fs = require('fs');
const { enqueue } = require('./lib');

function lastAssistantText(transcriptPath) {
  let last = '';
  for (const line of fs.readFileSync(transcriptPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry.type !== 'assistant' || !Array.isArray(entry.message?.content)) continue;
    for (const block of entry.message.content) {
      if (block.type === 'text' && block.text?.trim()) last = block.text;
    }
  }
  return last;
}

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  let text = input;
  try {
    const hook = JSON.parse(input);
    if (hook && typeof hook === 'object') {
      text = hook.transcript_path ? lastAssistantText(hook.transcript_path) : (hook.text || '');
    }
  } catch { /* texto plano */ }
  enqueue(text);
});
