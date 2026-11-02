# Prompt: app de escritorio "Voice Reply" (Mac + Windows)

Pega esto tal cual en una sesion de Claude Code **en tu PC/Mac local** (no en el VPS), en una carpeta vacia.

---

Construye una app de escritorio multiplataforma (Windows 11 y macOS) llamada **Voice Reply**.
Es una ventana flotante pequena que lee en voz alta el texto que llega desde un servidor remoto por SSH.

## Contexto

En un VPS corre Claude Code (y potencialmente otras herramientas). Esas herramientas escriben lineas JSON en
`~/.claude-voice/queue.jsonl` del VPS, una por evento:

    {"t": 1793248777313, "text": "Hola, termine la tarea.", "interrupt": true}

- `text`: texto ya limpio, listo para decir.
- `interrupt` (opcional, por defecto true): si es true, corta lo que suena y dice este; si es false, se encola.

La app NO sabe nada de Claude: solo lee esa cola y habla. Asi sirve para cualquier herramienta.

## Stack

Electron (ultima LTS estable) + TypeScript, sin frameworks de UI pesados (HTML/CSS/TS planos o Preact).
Empaquetado con electron-builder: instalador NSIS para Windows y DMG para macOS (arm64 + x64). Sin firma de codigo
por ahora; documenta en el README los avisos de SmartScreen/Gatekeeper y como saltarlos.

## Requisitos funcionales

1. **Ventana flotante**: siempre encima (`alwaysOnTop`, nivel `floating`/`screen-saver` para que aparezca sobre
   apps a pantalla completa en macOS), ~360x180, redimensionable, arrastrable, opacidad ajustable, recuerda posicion
   y tamano. Modo compacto (solo barra con estado y botones). Icono en la bandeja/barra de menu con: mostrar/ocultar,
   silenciar, salir. Que se pueda iniciar con el sistema (opcion).
2. **Conexion SSH saliente** usando el binario `ssh` del sistema (OpenSSH viene en Win11 y macOS). Ejecuta
   `ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o BatchMode=yes <host> "mkdir -p ~/.claude-voice; touch ~/.claude-voice/queue.jsonl; tail -n0 -F ~/.claude-voice/queue.jsonl"`
   y procesa cada linea de stdout. Reconexion automatica con backoff (1s, 2s, 4s... maximo 30s). Indicador de estado
   visible: conectado / reconectando / error (con el mensaje de ssh en un tooltip). Nunca pedir contrasenas: solo claves.
3. **Configuracion facil (pantalla de ajustes, primera ejecucion guiada)**:
   - Desplegable de hosts leidos de `~/.ssh/config` (los mismos que usa VS Code Remote-SSH) + opcion "otro": host,
     usuario, puerto, ruta de clave privada.
   - Boton **Probar conexion** que ejecuta `ssh ... echo ok` y muestra el resultado o el error legible
     (clave rechazada, host desconocido, timeout).
   - Boton **Configurar servidor**: crea `~/.claude-voice/` en el VPS y comprueba que `tail` existe.
   - Ruta de la cola editable (por defecto `~/.claude-voice/queue.jsonl`).
   - Voz: lista de `speechSynthesis.getVoices()`, filtrada por idioma (por defecto el del sistema; el usuario usa
     espanol), velocidad, volumen y boton **Probar voz**.
   - Comportamiento: maximo de caracteres por mensaje, ignorar mensajes duplicados consecutivos, tecla global para
     silenciar/parar (por defecto Ctrl/Cmd+Alt+V).
   Guarda todo con `electron-store` o un JSON en `app.getPath('userData')`.
4. **Voz**: usa la Web Speech API (`speechSynthesis`) en el renderer, que emplea las voces del sistema en ambas
   plataformas. Respeta `interrupt`: true -> `cancel()` y hablar; false -> encolar. Botones Silenciar y Parar.
   Si no hay voces del idioma pedido, avisa en la UI.
5. **Panel de historial**: ultimos 50 mensajes con hora; clic para repetir uno.
6. **Un solo proceso**: `requestSingleInstanceLock`.

## Seguridad

- `contextIsolation: true`, `nodeIntegration: false`, preload con un puente minimo (IPC tipado).
- El host y la ruta de la cola se pasan a `ssh` como argumentos separados (nunca concatenados en un shell local) y
  se validan (host: `[A-Za-z0-9._@-]+`; ruta: sin comillas ni `;`, `&`, `|`, `$`, backticks).
- Ignora lineas que no sean JSON valido y limita `text` a 2000 caracteres.

## Estructura sugerida

    src/main/      (ventana, bandeja, ssh, ajustes, IPC)
    src/preload/
    src/renderer/  (UI: estado, historial, ajustes, voz)
    tests/         (parser de lineas, validacion de host/ruta, backoff)
    README.md      (instalacion, primer uso, solucion de problemas)

## Criterios de aceptacion

- `npm run dev` abre la ventana; sin configurar, muestra el asistente de primera ejecucion.
- Con un host valido, "Probar conexion" da OK, y al ejecutar en el VPS
  `echo '{"text":"hola"}' >> ~/.claude-voice/queue.jsonl` la app dice "hola" en menos de 2 s.
- Si se corta la red o el VPS reinicia, la app reconecta sola sin intervencion.
- Dos mensajes seguidos con `interrupt:true` cortan el primero; con `interrupt:false` suenan en orden.
- `npm run dist` genera instalador de la plataforma actual. Los tests unitarios pasan.

Trabaja por pasos: primero el esqueleto + conexion SSH + voz (demostrable), luego ajustes, luego historial y
empaquetado. Haz commit en cada paso. Al final explica como probarla en Windows y en macOS.

---

## Lado del VPS (ya hecho)

En el VPS (`<ruta-del-repo>/`):

- `say.js`: encola texto (hook `Stop` de Claude Code o `echo "texto" | node say.js`).
- `mcp-server.js`: servidor MCP con la herramienta `speak`, para que Claude hable cuando quiera.
- Registro del MCP:  `claude mcp add --scope user voice-reply -- node <ruta-del-repo>/mcp-server.js`
- Hook para leer automaticamente cada respuesta (en `~/.claude/settings.json`):

      {"hooks":{"Stop":[{"hooks":[{"type":"command","command":"node <ruta-del-repo>/say.js"}]}]}}
