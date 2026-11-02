# Prompts de mejora para la app de escritorio

Pegar en una sesion de Claude Code **en el equipo donde esta la app Voice Reply**, dentro de su carpeta.

## 1. Voces de Windows (listar y hablar via System.Speech)

Necesario si `speechSynthesis` no muestra las voces naturales (tras instalar NaturalVoiceSAPIAdapter).

```
En Voice Reply, el selector de voz usa speechSynthesis (Web Speech) y solo muestra 2 voces de Windows.
Ya instale voces SAPI nuevas (visibles con System.Speech en PowerShell). Cambia la app para:
1. Listar las voces desde el proceso principal ejecutando PowerShell con System.Speech
   (GetInstalledVoices, solo Enabled), y mostrarlas en el selector de Ajustes, filtradas por idioma.
2. Hablar con esa voz seleccionada ejecutando PowerShell (SelectVoice + SpeakAsync), pasando el texto
   por stdin, nunca concatenado en el comando. Respetar interrupt (cortar lo anterior), Silenciar y Parar.
3. Mantener speechSynthesis como respaldo en macOS y si PowerShell falla.
Anade tests y no rompas el resto.
```

## 2. Dictado por voz con configuracion del microfono

```
Anade dictado por voz a Voice Reply, con la configuracion del microfono dentro de Ajustes.

Requisitos:
1. Ajustes > Microfono:
   - Desplegable de dispositivos de entrada (navigator.mediaDevices.enumerateDevices) y guardar el elegido.
   - Medidor de nivel en vivo y boton "Probar microfono".
   - Idioma del dictado (por defecto espanol).
   - Atajo global configurable de pulsar para hablar (por defecto Ctrl+Alt+Espacio): mientras esta pulsado graba,
     al soltar transcribe.
2. Motor de transcripcion seleccionable:
   a) Whisper local con whisper.cpp: la app descarga el binario y un modelo (base o small) la primera vez, con
      barra de progreso y opcion de elegir tamano, en app.getPath('userData'). Corre en local y sin internet.
      Pasa el audio como archivo WAV temporal, y borralo despues.
   b) "Dictado de Windows": boton/atajo que simula Win+H para usar el transcriptor del sistema (solo Windows).
3. Destino del texto: pegarlo donde este el cursor. Guarda el portapapeles, copia el texto, simula Ctrl+V
   (Cmd+V en macOS) y restaura el portapapeles. Opcion alternativa "solo copiar al portapapeles".
4. Indicador visible en la ventana flotante: grabando / transcribiendo / listo, y ultimos dictados en el historial.
5. Permisos: pedir el microfono y mostrar un mensaje claro si esta denegado (con enlace a la configuracion de
   privacidad de Windows/macOS).
6. Seguridad: nada de concatenar texto en comandos de shell; argumentos separados; validar rutas.
7. Tests unitarios para la logica (estados de grabacion, cola, restauracion del portapapeles); no romper lo existente.

Trabaja por pasos con commits: microfono + grabacion + medidor, luego Whisper local, luego pegar en cursor,
luego el boton de Win+H. Al final explica como probarlo.
```

## 3. Modo local (sin SSH)

Para cuando Claude Code, el MCP y la app corren en la misma maquina.

```
Anade a Voice Reply un "Modo local" ademas del modo SSH.
1. En Ajustes, selector de origen: "SSH (servidor remoto)" o "Local".
2. En modo local, la app lee el archivo de cola local, por defecto ~/.claude-voice/queue.jsonl
   (os.homedir()), editable en Ajustes. Si no existe, lo crea vacio (con su carpeta).
3. Procesa solo las lineas NUEVAS desde que arranca (empieza al final del archivo), con fs.watch + lectura
   incremental por offset (o polling cada 300 ms como respaldo). Maneja que el archivo se trunque o rote.
4. Cada linea es JSON {"t","text","interrupt?"}; ignora las invalidas y limita text a 2000 caracteres. Mismo
   comportamiento de voz, historial e interrupt que en modo SSH.
5. El indicador de estado muestra "local: escuchando <ruta>". Nada de SSH en este modo.
6. Valida la ruta (sin caracteres de shell) y no la pases nunca a un shell.
7. Tests para el lector incremental (lineas nuevas, truncado, lineas invalidas). No rompas el modo SSH.
```
