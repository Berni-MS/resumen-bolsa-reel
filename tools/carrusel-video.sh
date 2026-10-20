#!/usr/bin/env bash
# Vídeo vertical (1080x1920) para TikTok con las 7 diapositivas de un carrusel y la música de la marca.
# Si existe <VOZ_DIR>/durs.txt (y NN.mp3), añade voz en off: cada diapositiva dura lo que su locución + 0,8 s (mínimo 4 s).
# Uso: tools/carrusel-video.sh <carpeta con 01.jpg..07.jpg> <salida.mp4> [carpeta_voz]
set -euo pipefail
DIR="$1"; OUT="$2"; VOZ="${3:-}"
MIN=4.0      # segundos mínimos por diapositiva (texto denso: tiempo para leerla)
FADE=0.5   # fundido entre diapositivas
FILES=("$DIR"/0[1-7].jpg)
N=${#FILES[@]}
[ "$N" -ge 2 ] || { echo "Faltan diapositivas en $DIR"; exit 1; }
CONVOZ=0; [ -n "$VOZ" ] && [ -s "$VOZ/durs.txt" ] && CONVOZ=1
DUR=()
for i in "${!FILES[@]}"; do
  if [ "$CONVOZ" = 1 ]; then
    V=$(sed -n "$((i+1))p" "$VOZ/durs.txt")
    DUR+=("$(awk -v v="${V:-0}" -v m="$MIN" 'BEGIN{t=v+0.8; if(t<m)t=m; printf "%.2f", t}')")
  else DUR+=("$MIN"); fi
done
ARGS=(); FILTER=""
for i in "${!FILES[@]}"; do
  ARGS+=(-loop 1 -framerate 30 -t "${DUR[$i]}" -i "${FILES[$i]}")
  FILTER+="[$i:v]scale=1080:1350,pad=1080:1920:0:285:color=0x0F1B33,setsar=1,format=yuv420p[v$i];"
done
PREV="v0"; ACC="${DUR[0]}"; STARTS=(0)
for ((i=1;i<N;i++)); do
  OFF=$(awk -v a="$ACC" -v f="$FADE" 'BEGIN{print a-f}')
  FILTER+="[$PREV][v$i]xfade=transition=fade:duration=$FADE:offset=$OFF[x$i];"
  STARTS+=("$OFF")
  ACC=$(awk -v a="$ACC" -v d="${DUR[$i]}" -v f="$FADE" 'BEGIN{print a+d-f}')
  PREV="x$i"
done
TOTAL="$ACC"
FADEOUT=$(awk -v d="$TOTAL" 'BEGIN{print d-1.5}')
if [ "$CONVOZ" = 1 ]; then
  VARGS=(); VF=""; MIX=""
  for ((i=0;i<N;i++)); do
    NN=$(printf '%02d' $((i+1)))
    VARGS+=(-i "$VOZ/$NN.mp3")
    MS=$(awk -v s="${STARTS[$i]}" 'BEGIN{printf "%d", (s+0.25)*1000}')
    VF+="[$((N+1+i)):a]adelay=${MS}|${MS},volume=1.7[s$i];"
    MIX+="[s$i]"
  done
  FILTER+="${VF}${MIX}amix=inputs=$N:normalize=0,asplit=2[v][k];[$N:a]volume=0.5,afade=t=in:d=0.5,afade=t=out:st=${FADEOUT}:d=1.5[m];[m][k]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];[md][v]amix=inputs=2:duration=first:normalize=0[a]"
  ffmpeg -y "${ARGS[@]}" -stream_loop -1 -i assets/music.mp3 "${VARGS[@]}" \
    -filter_complex "$FILTER" -map "[$PREV]" -map "[a]" -t "$TOTAL" \
    -c:v libx264 -preset veryfast -pix_fmt yuv420p -r 30 -c:a aac -ar 44100 -ac 2 -b:a 128k -movflags +faststart "$OUT" > ffmpeg-carrusel.log 2>&1 \
    || { echo "::warning::ffmpeg con voz falló: $(tail -c 600 ffmpeg-carrusel.log | tr '\n' ' ')"; exit 1; }
else
  ffmpeg -y "${ARGS[@]}" -stream_loop -1 -i assets/music.mp3 \
    -filter_complex "${FILTER%;}" -map "[$PREV]" -map "$N:a" -t "$TOTAL" \
    -af "volume=0.55,afade=t=in:d=0.5,afade=t=out:st=${FADEOUT}:d=1.5" \
    -c:v libx264 -preset veryfast -pix_fmt yuv420p -r 30 -c:a aac -ar 44100 -ac 2 -b:a 128k -movflags +faststart "$OUT" > ffmpeg-carrusel.log 2>&1 \
    || { echo "::warning::ffmpeg falló: $(tail -c 600 ffmpeg-carrusel.log | tr '\n' ' ')"; exit 1; }
fi
echo "Vídeo listo: $OUT (${TOTAL}s)"
