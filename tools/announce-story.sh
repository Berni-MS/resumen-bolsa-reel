#!/usr/bin/env bash
# Historia de aviso de 15 s para un carrusel o un reel recién publicado, con el enlace al post en pantalla.
# Espera a que Instagram muestre el post, lee su enlace real y lo dibuja en la historia.
# Entorno: KIND (carrusel|reel), COVER (imagen de portada), LABEL, IG_TOKEN, IG_USER, GITHUB_TOKEN, GITHUB_REPOSITORY, DRY ("true" = no publica ni espera)
set -uo pipefail
KIND="${KIND:-carrusel}"; DRY="${DRY:-false}"
START=$(date -u +%s)
IG_TOKEN=$(printf %s "${IG_TOKEN:-}" | tr -d "[:space:]\"'")
case "$IG_TOKEN" in IG*) API="https://graph.instagram.com/v21.0";; *) API="https://graph.facebook.com/v21.0";; esac
LINK=""
if [ -n "$IG_TOKEN" ]; then
  # esperar (hasta 12 min) a que aparezca el post nuevo del tipo esperado; en pruebas, coge el último que haya
  MAXI=36; MINT=$((START - 300)); [ "$DRY" = "true" ] && { MAXI=1; MINT=0; }
  for i in $(seq 1 $MAXI); do
    JSON=$(curl -sS "$API/$IG_USER/media?fields=permalink,media_type,media_product_type,timestamp&limit=6&access_token=$IG_TOKEN" || true)
    while IFS=$'\t' read -r PL MT PT TS; do
      [ -z "$PL" ] && continue
      T=$(date -u -d "$TS" +%s 2>/dev/null || echo 0)
      [ "$T" -lt "$MINT" ] && continue
      if { [ "$KIND" = "carrusel" ] && [ "$MT" = "CAROUSEL_ALBUM" ]; } || { [ "$KIND" = "reel" ] && [ "$PT" = "REELS" ]; }; then LINK="$PL"; break; fi
    done < <(echo "$JSON" | jq -r '.data[]? | [.permalink, .media_type, .media_product_type, .timestamp] | @tsv')
    [ -n "$LINK" ] && break
    echo "Esperando a que se publique el post (intento $i)"; sleep 20
  done
  LINK="${LINK#https://}"; LINK="${LINK#www.}"; LINK="${LINK%/}"
  [ -z "$LINK" ] && echo "::warning::No se encontró el post publicado: la historia saldrá sin enlace"
fi
node render-teaser.mjs "$COVER" "$LABEL" teaser.png "$LINK" "$KIND" || exit 1
NAME="aviso-${KIND}-${GITHUB_RUN_ID}.png"
git config --global user.name "reel-bot"; git config --global user.email "reel-bot@users.noreply.github.com"
REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
rm -rf site2 && git clone --depth 1 --branch gh-pages "$REMOTE" site2
which ffmpeg >/dev/null 2>&1 || { sudo apt-get update -qq && sudo apt-get install -y -qq ffmpeg; }
ffmpeg -y -loop 1 -framerate 30 -t 15 -i teaser.png -stream_loop -1 -t 15 -i assets/music.mp3 -c:v libx264 -preset veryfast -tune stillimage -pix_fmt yuv420p -r 30 -af "volume=0.55,afade=t=in:d=0.5,afade=t=out:st=13.5:d=1.5" -c:a aac -ar 44100 -ac 2 -b:a 128k -shortest -movflags +faststart teaser.mp4 > ffmpeg.log 2>&1 || { echo "::warning::ffmpeg falló: $(tail -c 500 ffmpeg.log | tr '\n' ' ')"; rm -f teaser.mp4; }
mkdir -p site2/historias && cp teaser.png "site2/historias/$NAME" && { [ -f teaser.mp4 ] && cp teaser.mp4 "site2/historias/${NAME%.png}.mp4" || true; } && touch site2/.nojekyll
ls -1t site2/historias/* | tail -n +61 | xargs -r rm -f
( cd site2 && git add -A && git commit -q -m "Historia de aviso $NAME" && for i in 1 2 3 4 5; do git push origin gh-pages && break || { git pull -q --rebase origin gh-pages; sleep 3; }; done )
curl -sS -X POST -H "Authorization: Bearer ${GITHUB_TOKEN}" -H "Accept: application/vnd.github+json" "https://api.github.com/repos/${GITHUB_REPOSITORY}/pages/builds" >/dev/null || true
OWNER="${GITHUB_REPOSITORY%%/*}"; RNAME="${GITHUB_REPOSITORY##*/}"
URL="https://${OWNER}.github.io/${RNAME}/historias/$NAME"
for i in $(seq 1 120); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -I "$URL" || true); echo "intento $i: HTTP $CODE"
  [ "$CODE" = "200" ] && break; [ "$i" = "120" ] && { echo "::error::La imagen no respondió a tiempo"; exit 1; }; sleep 15
done
VIDEO_URL=""
if [ -f teaser.mp4 ]; then
  for i in $(seq 1 120); do
    CODE=$(curl -s -o /dev/null -w '%{http_code}' -I "${URL%.png}.mp4" || true); echo "vídeo intento $i: HTTP $CODE"
    [ "$CODE" = "200" ] && { VIDEO_URL="${URL%.png}.mp4"; break; }; sleep 15
  done
fi
if [ "$DRY" = "true" ]; then echo "::notice::Prueba: historia generada con enlace «${LINK}», no publicada"; exit 0; fi
[ -z "$IG_TOKEN" ] && { echo "::error::Falta IG_ACCESS_TOKEN"; exit 1; }
export IMAGE_URL="$URL" VIDEO_URL IG_TOKEN
bash tools/ig-story.sh
