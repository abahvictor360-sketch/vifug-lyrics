#!/usr/bin/env bash
# Prepend the Vifug logo intro to a video. Works with or without an audio track.
# Usage: add_intro.sh IN.mp4 OUT.mp4 INTRO.mp4
set -euo pipefail
IN="$1"; OUT="$2"; INTRO="$3"
IDUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INTRO")
HAS_A=$(ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "$IN" | wc -l)
if [ "$HAS_A" -gt 0 ]; then
  ffmpeg -v error -y -i "$INTRO" -i "$IN" -f lavfi -t "$IDUR" -i anullsrc=r=48000:cl=mono \
    -filter_complex "[0:v]fps=25,format=yuv420p,setsar=1[iv];[1:v]fps=25,format=yuv420p,setsar=1[mv];[iv][mv]concat=n=2:v=1:a=0[v];[2:a][1:a]concat=n=2:v=0:a=1[a]" \
    -map "[v]" -map "[a]" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a aac -ar 48000 -b:a 96k -movflags +faststart "$OUT"
else
  ffmpeg -v error -y -i "$INTRO" -i "$IN" \
    -filter_complex "[0:v]fps=25,format=yuv420p,setsar=1[iv];[1:v]fps=25,format=yuv420p,setsar=1[mv];[iv][mv]concat=n=2:v=1:a=0[v]" \
    -map "[v]" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -movflags +faststart "$OUT"
fi
