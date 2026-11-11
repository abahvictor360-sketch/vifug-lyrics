#!/usr/bin/env bash
# Install Vifug from the terminal (macOS and Linux).
#
#   curl -fsSL https://raw.githubusercontent.com/abahvictor360-sketch/vifug-lyrics/main/install.sh | bash
#
# Downloads the newest release from GitHub. Run it again to update.
# Windows uses install.ps1 instead.
set -euo pipefail

BASE="https://github.com/abahvictor360-sketch/vifug-lyrics/releases/latest/download"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

say() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || die "curl is required"

case "$(uname -s)" in
  Darwin)
    DMG="$TMP/Vifug.dmg"
    MNT="$TMP/mnt"
    say "Downloading Vifug for macOS..."
    curl -fL --progress-bar -o "$DMG" "$BASE/VifugLyrics-Mac-Installer.dmg"
    say "Installing to /Applications..."
    mkdir -p "$MNT"
    hdiutil attach "$DMG" -nobrowse -quiet -mountpoint "$MNT"
    APP="$(find "$MNT" -maxdepth 1 -name '*.app' | head -n 1)"
    if [ -z "$APP" ]; then hdiutil detach "$MNT" -quiet || true; die "no app found in the disk image"; fi
    DEST="/Applications/$(basename "$APP")"
    if [ -w /Applications ]; then
      rm -rf "$DEST"; cp -R "$APP" /Applications/
    else
      sudo rm -rf "$DEST"; sudo cp -R "$APP" /Applications/
    fi
    hdiutil detach "$MNT" -quiet || true
    # The app is not notarised; clear the quarantine flag so it opens.
    xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true
    say "Installed: $DEST"
    say "Open it from Applications, or run: open -a \"$(basename "$APP" .app)\""
    ;;
  Linux)
    [ "$(uname -m)" = "x86_64" ] || die "the Linux build is x86_64 only (this machine is $(uname -m))"
    BIN="${VIFUG_BIN_DIR:-$HOME/.local/bin}"
    APPS="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
    mkdir -p "$BIN" "$APPS"
    say "Downloading Vifug for Linux..."
    curl -fL --progress-bar -o "$TMP/vifug" "$BASE/VifugLyrics-Linux.AppImage"
    chmod +x "$TMP/vifug"
    mv "$TMP/vifug" "$BIN/vifug"
    cat > "$APPS/vifug.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Vifug
Comment=Lyrics, Bible and presentations for live services
Exec=$BIN/vifug
Terminal=false
Categories=AudioVideo;Presentation;
DESKTOP
    say "Installed: $BIN/vifug"
    case ":$PATH:" in
      *":$BIN:"*) say "Run it with: vifug" ;;
      *) say "Run it with: $BIN/vifug   (add $BIN to your PATH to just type 'vifug')" ;;
    esac
    say "If it will not start, install FUSE (Ubuntu: sudo apt install libfuse2)."
    ;;
  *)
    die "unsupported system: $(uname -s). On Windows use install.ps1."
    ;;
esac
