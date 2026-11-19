#!/usr/bin/env bash
# Prepend the Vifug logo intro to a video. Works with or without an audio track.
# Usage: add_intro.sh IN.mp4 OUT.mp4 INTRO.mp4
#
# Many recordings open on a blank white page for a moment while the app loads.
# Straight after the logo that reads as a white flash, so the white lead-in is
# trimmed first - but only if no narration has started inside it.
set -euo pipefail
IN="$1"; OUT="$2"; INTRO="$3"
IDUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$INTRO")
HAS_A=$(ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "$IN" | wc -l)

# seconds of bright (white page) video at the start, 25 fps, looking at the first 6 s
LEAD=$(ffmpeg -v error -i "$IN" -t 6 -vf "fps=25,scale=64:36,format=gray" -f rawvideo - 2>/dev/null | python3 -c "
import sys
d=sys.stdin.buffer.read(); n=64*36
lum=[sum(d[i:i+n])/n for i in range(0,len(d)-n+1,n)]
k=next((i for i,x in enumerate(lum) if x<150), 0)
print('%.2f' % (k/25))")
if [ "$HAS_A" -gt 0 ] && [ "$LEAD" != "0.00" ]; then
  # first moment of sound (silence_end of the opening silence); 0 if it opens with sound
  ONSET=$(ffmpeg -v info -t 8 -i "$IN" -vn -af silencedetect=noise=-45dB:d=0.1 -f null - 2>&1 | python3 -c "
import sys,re
t=sys.stdin.read(); m=re.search(r'silence_start: (-?[0-9.]+)',t); e=re.search(r'silence_end: ([0-9.]+)',t)
print(e.group(1) if (m and float(m.group(1))<=0.05 and e) else '0')")
  if python3 -c "import sys; sys.exit(0 if float('$ONSET') >= float('$LEAD') else 1)"; then :; else
    echo "note: narration starts at ${ONSET}s, inside the ${LEAD}s white lead-in; not trimming" >&2; LEAD=0.00
  fi
fi
echo "trim ${LEAD}s of white lead-in" >&2

if [ "$HAS_A" -gt 0 ]; then
  ffmpeg -v error -y -i "$INTRO" -ss "$LEAD" -i "$IN" -f lavfi -t "$IDUR" -i anullsrc=r=48000:cl=mono \
    -filter_complex "[0:v]fps=25,format=yuv420p,setsar=1[iv];[1:v]fps=25,format=yuv420p,setsar=1[mv];[iv][mv]concat=n=2:v=1:a=0[v];[2:a]aformat=sample_rates=48000:channel_layouts=mono[ia];[1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=mono[ma];[ia][ma]concat=n=2:v=0:a=1[a]" \
    -map "[v]" -map "[a]" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -c:a aac -ar 48000 -b:a 96k -movflags +faststart "$OUT"
else
  ffmpeg -v error -y -i "$INTRO" -ss "$LEAD" -i "$IN" \
    -filter_complex "[0:v]fps=25,format=yuv420p,setsar=1[iv];[1:v]fps=25,format=yuv420p,setsar=1[mv];[iv][mv]concat=n=2:v=1:a=0[v]" \
    -map "[v]" -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -movflags +faststart "$OUT"
fi
