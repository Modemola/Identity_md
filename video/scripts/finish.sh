#!/usr/bin/env bash
# Mux the rendered picture with the mastered mix, and cut the ~25 MB share copy.
#
#   FFMPEG=/path/to/ffmpeg scripts/finish.sh
#   NAME=kept-explainer PICTURE=explainer-picture.mp4 MIX=explainer-mix.wav scripts/finish.sh
#
# needs a full ffmpeg build (libx264, aac, hqdn3d).
set -euo pipefail
cd "$(dirname "$0")/.."
FF="${FFMPEG:-ffmpeg}"
OUT=out
NAME="${NAME:-kept-film}"
PICTURE="${PICTURE:-picture.mp4}"
MIX="${MIX:-mix.wav}"

# Remotion writes full-range BT.601; every player expects limited-range BT.709.
COLOR="scale=in_color_matrix=bt601:in_range=full:out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p"
TAGS="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"

if [ -z "${SKIP_MASTER:-}" ]; then
# Master: 1080p30, near-transparent, AAC 320k.
"$FF" -y -hide_banner -loglevel error -i "$OUT/$PICTURE" -i "$OUT/$MIX" \
  -map 0:v -map 1:a -vf "$COLOR" -c:v libx264 -preset slow -crf 17 -tune animation $TAGS \
  -c:a aac -b:a 320k -ar 48000 -shortest -movflags +faststart \
  "$OUT/$NAME-1080p.mp4"
fi

# Share copy for X: two-pass to ~25 MB. The scanlines are noise the encoder would spend the
# whole budget on, so it is smoothed away first; everything else survives.
DUR=$( ("$FF" -hide_banner -i "$OUT/$PICTURE" 2>&1 || true) | sed -n 's/.*Duration: \([0-9:.]*\).*/\1/p' | awk -F: '{print $1*3600+$2*60+$3}')
TARGET_MB=${TARGET_MB:-24.6}
AUDIO_K=128
VIDEO_K=$(awk -v d="$DUR" -v mb="$TARGET_MB" -v a="$AUDIO_K" 'BEGIN{printf "%d", (mb*8*1024*1024/d)/1000 - a - 8}')
echo "share: ${DUR}s at ${VIDEO_K}k video + ${AUDIO_K}k audio"
VF="fps=30,hqdn3d=2.2:1.6:5:4,$COLOR"
X264="-c:v libx264 -preset veryslow -tune animation -b:v ${VIDEO_K}k -maxrate $((VIDEO_K * 3))k -bufsize $((VIDEO_K * 4))k -g 120 -bf 4 $TAGS"
cd "$OUT"
"$FF" -y -hide_banner -loglevel error -i "$PICTURE" -vf "$VF" $X264 -pass 1 -passlogfile share -an -f mp4 /dev/null
"$FF" -y -hide_banner -loglevel error -i "$PICTURE" -i "$MIX" -map 0:v -map 1:a -vf "$VF" $X264 -pass 2 -passlogfile share \
  -c:a aac -b:a ${AUDIO_K}k -ar 48000 -shortest -movflags +faststart "$NAME-share.mp4"
rm -f share-0.log share-0.log.mbtree
ls -la "$NAME-1080p.mp4" "$NAME-share.mp4"
