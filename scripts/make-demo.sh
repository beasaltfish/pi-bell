#!/usr/bin/env bash
# Rebuild demo.gif / demo.mp4 from a screen recording.
#   ./scripts/make-demo.sh ~/Downloads/pi-bell.mp4
# Expects a 3840x2160 recording with the terminal window on the right half and the
# notification banner in the top-right corner. Adjust the crop and the timeline below
# if the layout or the timing differs.
set -euo pipefail
IN="${1:?usage: make-demo.sh <recording.mp4>}"
OUT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

# Framing over the 3840x2160 source: wide enough for the banner at the top and the
# input line at the bottom, so the camera can reach both without leaving the frame.
BASE="crop=2556:1790:1282:120"

# Master clip: drop the model-picker detour and the idle gaps, so camera time matches
# narration time. Segments are start:end in source seconds.
ffmpeg -v error -y -i "$IN" -filter_complex "\
[0:v]$BASE,split=3[a][b][c];\
[a]trim=1.10:3.40,setpts=PTS-STARTPTS[s1];\
[b]trim=4.20:5.40,setpts=PTS-STARTPTS[s2];\
[c]trim=7.05:12.55,setpts=PTS-STARTPTS[s3];\
[s1][s2][s3]concat=n=3:v=1:a=0,fps=30,format=yuv420p[v]" \
  -map "[v]" -an -c:v libx264 -crf 14 -pix_fmt yuv420p master.mp4

# Camera path: push in on the prompt while "hey" is typed, pull back, push in on the
# banner when the notification lands, pull back. Coordinates are master-frame pixels.
python3 - <<'PY'
Z1, Z2 = 2.80, 2.32          # zoom factors
FX, FY = 1278, 895           # wide framing center
T1X, T1Y = 340, 1600         # prompt / input line
T2X, T2Y = 2126, 87          # notification banner
a, b, c, d, e, f, g, h = 3.45, 3.75, 4.55, 4.95, 5.45, 5.90, 7.70, 8.15
T = "(on/30)"
def piece(v0, v1, v2):
    return (f"if(lt({T},{a}),{v0},"
            f"if(lt({T},{b}),{v0}+({v1}-{v0})*({T}-{a})/{b-a:.2f},"
            f"if(lt({T},{c}),{v1},"
            f"if(lt({T},{d}),{v1}+({v0}-{v1})*({T}-{c})/{d-c:.2f},"
            f"if(lt({T},{e}),{v0},"
            f"if(lt({T},{f}),{v0}+({v2}-{v0})*({T}-{e})/{f-e:.2f},"
            f"if(lt({T},{g}),{v2},"
            f"if(lt({T},{h}),{v2}+({v0}-{v2})*({T}-{g})/{h-g:.2f},{v0}))))))))")
z = piece("1.0", str(Z1), str(Z2))
cx = piece(str(FX), str(T1X), str(T2X))
cy = piece(str(FY), str(T1Y), str(T2Y))
x = f"max(0,min({cx}-(2556/zoom)/2,2556-2556/zoom))"
y = f"max(0,min({cy}-(1790/zoom)/2,1790-1790/zoom))"
open("cam.txt", "w").write(
  "[0:v]drawbox=x=0:y=1638:w=2556:h=56:color=0x2F81F7@0.30:t=fill:enable='between(t,3.72,4.60)',"
  f"zoompan=z='{z}':x='{x}':y='{y}':d=1:s=800x560:fps=30,format=yuv420p[v]")
PY

ffmpeg -v error -y -i master.mp4 -filter_complex_script cam.txt -map "[v]" -an \
  -c:v libx264 -crf 15 -pix_fmt yuv420p "$OUT/demo.mp4"
ffmpeg -v error -y -i "$OUT/demo.mp4" \
  -vf "fps=12,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4" \
  "$OUT/demo.gif"
ls -la "$OUT/demo.gif" "$OUT/demo.mp4"
