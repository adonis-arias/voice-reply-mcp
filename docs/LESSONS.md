# Lecciones aprendidas

## Limpiar el texto antes de hablar (`lib.js`, `clean()`)
- Bloques de codigo (```` ``` ````): se eliminan por completo; leer codigo en voz alta es ruido.
- Codigo en linea: se conserva el contenido, sin las comillas invertidas.
- Enlaces `[texto](url)`: queda solo el texto. URLs sueltas: se descartan.
- Tablas (lineas con `|`): se eliminan.
- Vinetas y simbolos de markdown (`#`, `*`, `_`, `>`, `~`): se quitan.
- Limite de 500 caracteres, cortando en final de frase (`.`, `?`, `!`), no a mitad de palabra.
- Si tras limpiar no queda nada, no se encola.

## Voz hablada (modo automatico)
- Un resumen recortado se comio la pregunta final ("¿Como quieres que te llame?"). La voz debe incluir **siempre**
  la conclusion y cualquier pregunta o decision pendiente, con las mismas palabras que el texto.
- La voz es conversacion (1 a 4 frases), no un extracto del texto.
- El modo automatico depende de que el modelo siga las instrucciones del MCP. Para garantizarlo hace falta un hook `Stop`.
- Las instrucciones del MCP (`instructions`) se cargan solo al iniciar la sesion: los cambios de modo/personalidad
  aplican a sesiones nuevas; en la sesion en curso hay que aplicarlos a mano.

## Voces y servicios
- Un VPS sin tarjeta de sonido no puede hablar ni escuchar: `voice-mode` no sirve ahi. La voz sale en el equipo del usuario.
- Kokoro en un VPS saturado (carga ~9 en 6 nucleos) fue ~60 veces mas lento que el tiempo real (2,6 s de audio en 151 s).
  El problema era el servidor, no Kokoro. En un equipo local normal deberia ir mucho mejor (medirlo).
- Las voces naturales de Windows 11 (Narrador) solo las usa Narrador. **NaturalVoiceSAPIAdapter** (proyecto de la comunidad)
  las expone a SAPI; asi aparecen en `System.Speech`. Las que terminan en "Online" necesitan internet.
- `speechSynthesis` de Electron no listaba esas voces: la app tuvo que listar y hablar via PowerShell `System.Speech`.

## Arquitectura
- Una cola en un archivo + `ssh ... tail -F` es simple, robusto y agnostico de herramienta.
- MCP sobre stdio por SSH: necesita clave sin contrasena y `-T`; cualquier texto extra al conectar rompe el protocolo.
- El estado (`mode`, `persona.json`) vive en archivos: se comparte entre sesiones y dispositivos.
- `node --test tests/` toma la carpeta como archivo en Node 24; usar `node --test`.

## Seguridad
- Host y ruta de la cola se pasan a `ssh` como argumentos separados y se validan; nada se concatena en un shell local.
- No hay claves en el repo; la app usa solo autenticacion por clave SSH.
