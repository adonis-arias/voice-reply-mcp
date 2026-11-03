# Voice Reply

Hace que Claude Code **hable** en tu escritorio, con personalidad (mayordomo estilo JARVIS + humor ajustable estilo TARS).
Funciona de dos formas: con Claude Code en un **VPS** (por SSH) o **todo en local**.

```
 Claude Code ──► MCP voice-reply ──► cola  ~/.claude-voice/queue.jsonl ──► app de escritorio ──► voz del sistema
   (speak, voice_mode,                (una linea JSON por evento)           (lee la cola, habla)
    voice_persona)
```

La app de escritorio (Electron, Windows y macOS) **no sabe nada de Claude**: solo lee la cola y habla. Por eso sirve
para cualquier herramienta que escriba lineas en ella.

## Contenido

| Archivo | Para que sirve |
|---|---|
| `mcp-server.js` | Servidor MCP (stdio, sin dependencias) con `speak`, `voice_mode` y `voice_persona` |
| `lib.js` | Limpieza de texto para voz y escritura en la cola |
| `say.js` | CLI / hook `Stop`: encola texto plano o la ultima respuesta de un transcript |
| `voice-window.ps1` | Ventana flotante minima para Windows (prototipo; la app real es la de Electron) |
| `docs/PERSONALITY.md` | Prompt completo de personalidad de voz |
| `docs/APP_PROMPT.md` | Prompt para construir la app de escritorio |
| `docs/APP_PROMPTS_V2.md` | Mejoras de la app: voces de Windows, dictado, modo local |
| `docs/LESSONS.md` | Lo aprendido por el camino |
| `tests/` | Pruebas (`npm test`) |

## Herramientas MCP

- **`speak`** `{text, interrupt?, mood?}`: encola texto para decirlo. Limpia markdown, codigo, URLs y tablas; recorta a 500 caracteres en limite de frase. `mood` (opcional) cambia el animo de la carita del orbe mientras habla: `neutral, happy, excited, thinking, curious, sarcastic, surprised, sleepy, sad, worried, alert, glitch, proud, wink`.
- **`voice_mode`** `{mode?}`: `manual` (solo habla si se lo pides) o `auto` (habla al final de cada respuesta). Persistente.
- **`voice_persona`** `{style?, humor?, address?}`: `style` `jarvis`|`neutral`, `humor` 0-100, `address` como llamarte. Persistente.

El estado vive en `~/.claude-voice/` (`queue.jsonl`, `mode`, `persona.json`). Cambia la carpeta con `VOICE_QUEUE=/ruta/queue.jsonl`.

## Protocolo de la cola

Una linea JSON por evento:

```json
{"t": 1793248777313, "text": "Hola, termine la tarea.", "interrupt": true, "mood": "proud"}
```

`interrupt` (opcional, por defecto `true`): corta lo que suena; `false` lo encola.
`mood` (opcional, por defecto `neutral`): animo de la carita del orbe mientras habla.

## Modo A: Claude Code en un VPS

1. En el VPS:
   ```
   git clone <este repo> ~/projects/voice-reply
   claude mcp add --scope user voice-reply -- node ~/projects/voice-reply/mcp-server.js
   ```
2. En tu PC/Mac: instala la app de escritorio (ver `docs/APP_PROMPT.md`), elige el host SSH y "Probar conexion".
   La app ejecuta `ssh <host> tail -F ~/.claude-voice/queue.jsonl` y habla cada linea.
3. Reinicia Claude Code y dile: "activa la voz automatica".

### Usarlo desde otro dispositivo (el MCP sigue en el VPS)

```
claude mcp add --scope user voice-reply -- ssh -T -o BatchMode=yes -o ServerAliveInterval=15 TU_ALIAS node /ruta/en/el/vps/mcp-server.js
```

Requiere SSH por clave, y que el VPS no imprima nada al conectar (banners o `echo` en `.bashrc` rompen el protocolo MCP).

## Modo B: todo en local

Claude Code, el MCP y la app corren en la misma maquina; no hay SSH.

1. Clona el repo y registra el MCP (Windows: usa la ruta completa a `mcp-server.js`):
   ```
   git clone <este repo>
   claude mcp add --scope user voice-reply -- node /ruta/a/voice-reply/mcp-server.js
   ```
   La cola queda en `~/.claude-voice/queue.jsonl` (en Windows `C:\Users\<tu usuario>\.claude-voice\queue.jsonl`).
2. La app debe leer ese archivo **en vez de usar SSH**. Esto requiere el "modo local" de la app: ver `docs/APP_PROMPTS_V2.md`.
3. Reinicia Claude Code y activa la voz automatica.

## Pruebas

```
npm test
echo "Hola desde cualquier herramienta." | node say.js
```

## Notas

- El modo automatico depende de que el modelo siga las instrucciones del MCP; el hook `Stop` (`say.js`) es la via fiable si se quiere garantizar que se lea cada respuesta.
- Las instrucciones del MCP se cargan al iniciar la sesion: los cambios de modo o personalidad aplican a sesiones nuevas.
- No hay claves ni secretos en este repo.
