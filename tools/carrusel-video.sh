#!/usr/bin/env bash
# Vídeo vertical (1080x1920) para TikTok con las 7 diapositivas de un carrusel y la música de la marca.
# Uso: tools/carrusel-video.sh <carpeta con 01.jpg..07.jpg> <salida.mp4>
set -euo pipefail
DIR="$1"; OUT="$2"
SEC=5      # segundos por diapositiva (texto denso: tiempo para leerla)
FADE=0.5   # fundido entre diapositivas
FILES=("$DIR"/0[1-7].jpg)
N=${#FILES[@]}
[ "$N" -ge 2 ] || { echo "Faltan diapositivas en $DIR"; exit 1; }
TOTAL=$(awk -v n="$N" -v s="$SEC" -v f="$FADE" 'BEGIN{print n*s-(n-1)*f}')
ARGS=(); FILTER=""
for i in "${!FILES[@]}"; do
  ARGS+=(-loop 1 -framerate 30 -t "$SEC" -i "${FILES[$i]}")
  FILTER+="[$i:v]scale=1080:1350,pad=1080:1920:0:285:color=0x0F1B33,setsar=1,format=yuv420p[v$i];"
done
PREV="v0"
for ((i=1;i<N;i++)); do
  OFF=$(awk -v i="$i" -v s="$SEC" -v f="$FADE" 'BEGIN{print i*(s-f)}')
  FILTER+="[$PREV][v$i]xfade=transition=fade:duration=$FADE:offset=$OFF[x$i];"
  PREV="x$i"
done
ffmpeg -y "${ARGS[@]}" -stream_loop -1 -i assets/music.mp3 \
  -filter_complex "${FILTER%;}" -map "[$PREV]" -map "$N:a" -t "$TOTAL" \
  -af "volume=0.55,afade=t=in:d=0.5,afade=t=out:st=$(awk -v d="$TOTAL" 'BEGIN{print d-1.5}'):d=1.5" \
  -c:v libx264 -preset veryfast -pix_fmt yuv420p -r 30 -c:a aac -ar 44100 -ac 2 -b:a 128k -movflags +faststart "$OUT" > ffmpeg-carrusel.log 2>&1 \
  || { echo "::warning::ffmpeg falló: $(tail -c 600 ffmpeg-carrusel.log | tr '\n' ' ')"; exit 1; }
echo "Vídeo listo: $OUT (${TOTAL}s)"
