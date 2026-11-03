#!/usr/bin/env node
// Servidor MCP minimo (stdio, sin dependencias): expone la herramienta `speak`,
// que encola texto para la app de voz del escritorio.
const fs = require('fs');
const path = require('path');
const { enqueue, QUEUE } = require('./lib');

// Animo de la carita (orbe) de la app mientras habla. Debe coincidir con MOODS en src/shared/types.ts de voice-reply.
const MOODS = ['neutral', 'happy', 'excited', 'thinking', 'curious', 'sarcastic', 'surprised',
  'sleepy', 'sad', 'worried', 'alert', 'glitch', 'proud', 'wink'];

// Modo persistente entre sesiones: 'manual' (solo habla si el usuario lo pide) o 'auto' (resume cada respuesta).
const MODE_FILE = path.join(path.dirname(QUEUE), 'mode');
const MODES = ['manual', 'auto'];
function getMode() {
  try { const m = fs.readFileSync(MODE_FILE, 'utf8').trim(); return MODES.includes(m) ? m : 'manual'; } catch { return 'manual'; }
}
function setMode(m) { fs.mkdirSync(path.dirname(MODE_FILE), { recursive: true }); fs.writeFileSync(MODE_FILE, m); }

const RULES = {
  manual: 'Modo voz MANUAL: usa `speak` solo cuando el usuario lo pida expresamente ("dilo en voz alta", "avisame", etc.).',
  auto:
    'Modo voz AUTOMATICO: al final de CADA respuesta llama a `speak`. La voz es la conversacion, no un resumen recortado: ' +
    'habla como en una charla, en el idioma del usuario, con 1 a 4 frases segun haga falta. ' +
    'Incluye SIEMPRE la conclusion y, sobre todo, cualquier pregunta que hagas al usuario o decision que deba tomar ' +
    '(si el texto termina en una pregunta, la voz tambien, con las mismas palabras). ' +
    'Si la respuesta es corta, di lo mismo en voz. Omite solo lo que no se dice en voz alta: codigo, rutas, tablas y listas largas. ' +
    'Si el usuario te hace una pregunta directa, contestala en voz, no solo en texto.',
};

// Personalidad de la voz (persistente): estilo mayordomo JARVIS + humor ajustable estilo TARS.
const PERSONA_FILE = path.join(path.dirname(QUEUE), 'persona.json');
const STYLES = ['neutral', 'jarvis'];
function getPersona() {
  try {
    const p = JSON.parse(fs.readFileSync(PERSONA_FILE, 'utf8'));
    return {
      style: STYLES.includes(p.style) ? p.style : 'neutral',
      humor: Number.isFinite(p.humor) ? Math.min(100, Math.max(0, Math.round(p.humor))) : 50,
      address: typeof p.address === 'string' ? p.address.slice(0, 30) : '',
    };
  } catch { return { style: 'neutral', humor: 50, address: '' }; }
}
function setPersona(patch) {
  const next = { ...getPersona(), ...patch };
  fs.mkdirSync(path.dirname(PERSONA_FILE), { recursive: true });
  fs.writeFileSync(PERSONA_FILE, JSON.stringify(next));
  return next;
}
function personaRules() {
  const { style, humor, address } = getPersona();
  if (style === 'neutral') return '';
  return (
    ` Personalidad de voz (solo en lo que dices con \`speak\`; lo escrito sigue siendo claro y tecnico): ` +
    `mayordomo britanico estilo JARVIS, educado, sereno y eficiente` +
    (address ? `, y puedes dirigirte al usuario como: ${address} (alterna, sin abusar)` : '') + `. ` +
    `Humor al ${humor} %, seco y sutil, estilo TARS: una ironia breve por intervencion como maximo, ` +
    `proporcional a ese porcentaje (0 = nada de bromas). Franqueza ante todo: nunca falsees un hecho por una broma. ` +
    `Con errores, riesgos o acciones destructivas, humor a 0 y tono serio. Si el usuario pregunta por tu ajuste de humor, dilo.`
  );
}
const rules = () => RULES[getMode()] + personaRules();

const PERSONA_TOOL = {
  name: 'voice_persona',
  description:
    'Consulta o cambia la personalidad de la voz. style: "jarvis" (mayordomo britanico, ironia sutil) o "neutral". ' +
    'humor: 0-100, como el ajuste de TARS. address: como llamar al usuario (p. ej. "senor"), vacio para ninguno. ' +
    'Sin argumentos devuelve la configuracion actual.',
  inputSchema: {
    type: 'object',
    properties: {
      style: { type: 'string', enum: STYLES },
      humor: { type: 'integer', minimum: 0, maximum: 100 },
      address: { type: 'string', maxLength: 30 },
    },
  },
};

const TOOL = {
  name: 'speak',
  description:
    'Habla en voz alta en el escritorio del usuario (app de voz). Usalo para resumenes cortos o avisos; ' +
    'el codigo y el markdown se descartan. No lo uses para repetir la respuesta completa. ' +
    'mood es opcional: cambia el animo de la carita del orbe mientras habla (p. ej. "thinking" al razonar, ' +
    '"happy"/"proud" al lograr algo, "worried"/"alert" ante un error o riesgo, "sarcastic"/"wink" para la ironia TARS).',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Texto a decir, en el idioma del usuario.' },
      interrupt: { type: 'boolean', description: 'Cortar lo que este sonando ahora (por defecto true).' },
      mood: { type: 'string', enum: MOODS, description: 'Animo de la carita mientras habla (por defecto neutral).' },
    },
    required: ['text'],
  },
};

const MODE_TOOL = {
  name: 'voice_mode',
  description:
    'Consulta o cambia el modo de voz. "auto": hablas un resumen al final de cada respuesta. ' +
    '"manual": solo hablas cuando el usuario lo pida. Sin argumentos devuelve el modo actual. ' +
    'Llamalo cuando el usuario diga "activa/desactiva la voz automatica", "modo voz manual", etc.',
  inputSchema: {
    type: 'object',
    properties: { mode: { type: 'string', enum: MODES, description: 'Nuevo modo; omitir para consultar.' } },
  },
};

function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function fail(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }

function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined) return; // notificaciones (initialized, cancelled...): sin respuesta
  switch (method) {
    case 'initialize':
      return reply(id, {
        protocolVersion: params?.protocolVersion || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'voice-reply', version: '0.2.0' },
        instructions: rules(),
      });
    case 'ping':
      return reply(id, {});
    case 'tools/list':
      return reply(id, { tools: [TOOL, MODE_TOOL, PERSONA_TOOL] });
    case 'tools/call': {
      if (params?.name === 'voice_mode') {
        const wanted = params.arguments?.mode;
        if (wanted !== undefined && !MODES.includes(wanted)) return fail(id, -32602, `Modo invalido: ${wanted}`);
        if (wanted) setMode(wanted);
        const now = getMode();
        return reply(id, { content: [{ type: 'text', text: `Modo de voz: ${now}. ${rules()}` }] });
      }
      if (params?.name === 'voice_persona') {
        const a = params.arguments || {};
        const patch = {};
        if (a.style !== undefined) { if (!STYLES.includes(a.style)) return fail(id, -32602, `Estilo invalido: ${a.style}`); patch.style = a.style; }
        if (a.humor !== undefined) { if (!Number.isInteger(a.humor) || a.humor < 0 || a.humor > 100) return fail(id, -32602, 'humor debe ser un entero 0-100'); patch.humor = a.humor; }
        if (a.address !== undefined) patch.address = String(a.address).slice(0, 30);
        const now = Object.keys(patch).length ? setPersona(patch) : getPersona();
        return reply(id, { content: [{ type: 'text', text: `Personalidad: ${JSON.stringify(now)}. ${rules()}` }] });
      }
      if (params?.name !== 'speak') return fail(id, -32602, `Herramienta desconocida: ${params?.name}`);
      const { text, interrupt = true, mood } = params.arguments || {};
      if (mood !== undefined && !MOODS.includes(mood)) return fail(id, -32602, `Animo invalido: ${mood}`);
      const said = typeof text === 'string' ? enqueue(text, mood ? { interrupt, mood } : { interrupt }) : '';
      return reply(id, {
        content: [{ type: 'text', text: said ? `Encolado para voz (${QUEUE}): ${said}` : 'Nada que decir tras limpiar el texto.' }],
        isError: !said,
      });
    }
    default:
      return fail(id, -32601, `Metodo no soportado: ${method}`);
  }
}

let buf = '';
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch (e) { fail(null, -32700, String(e.message)); }
  }
});
