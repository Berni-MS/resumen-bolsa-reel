# Reel diario RESUMEN BOLSA

Make guarda cada día el resumen en la tabla RESUMEN_BOLSA y lanza este flujo de trabajo
(`.github/workflows/reel.yml`) con el registro en base64. El flujo:

1. `prepare.mjs` convierte el registro en `data.json` (titular, nombres cortos, factores, texto del post).
2. `render.mjs` dibuja las 8 pantallas (1080×1920) con Chromium y las une en un MP4 vertical (24 s, H.264).
3. Sube el vídeo a la rama `gh-pages` (GitHub Pages) y avisa por webhook a Make, que lo publica como Reel.

Secreto necesario: `MAKE_WEBHOOK_URL` (URL del webhook de Make que recibe el aviso).

Prueba local: `node prepare.mjs record.sample.json data.json && node render.mjs data.json out`
