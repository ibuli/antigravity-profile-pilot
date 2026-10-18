#!/bin/bash
set -e

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_NAME="antigravity-profile-pilot-3.3.6"
OLD_NAMES=(
  "antigravity-account-switcher-2.1.0"
  "antigravity-account-switcher-2.2.0"
  "antigravity-account-switcher-2.3.0"
  "antigravity-account-switcher-2.4.0"
  "antigravity-account-switcher-2.5.0"
  "antigravity-account-switcher-2.6.0"
  "antigravity-account-switcher-2.7.0"
  "antigravity-account-switcher-2.8.0"
  "antigravity-account-switcher-2.9.0"
  "antigravity-account-switcher-2.10.0"
  "antigravity-account-switcher-3.0.0"
  "antigravity-profile-pilot-1.0.0"
  "antigravity-profile-pilot-1.1.0"
  "antigravity-profile-pilot-1.2.0"
  "antigravity-profile-pilot-3.0.0"
  "antigravity-profile-pilot-3.2.0"
  "antigravity-profile-pilot-3.2.1"
  "antigravity-profile-pilot-3.3.0"
  "antigravity-profile-pilot-3.3.1"
  "antigravity-profile-pilot-3.3.2"
  "antigravity-profile-pilot-3.3.3"
  "antigravity-profile-pilot-3.3.4"
  "antigravity-profile-pilot-3.3.5"
  "burhanbharmal.antigravity-profile-pilot-1.0.0"
  "burhanbharmal.antigravity-profile-pilot-1.1.0"
  "burhanbharmal.antigravity-profile-pilot-1.2.0"
  "burhanbharmal.antigravity-profile-pilot-3.0.0"
  "burhanbharmal.antigravity-profile-pilot-3.2.0"
  "burhanbharmal.antigravity-profile-pilot-3.2.1"
  "burhanbharmal.antigravity-profile-pilot-3.3.0"
  "burhanbharmal.antigravity-profile-pilot-3.3.1"
  "burhanbharmal.antigravity-profile-pilot-3.3.2"
  "burhanbharmal.antigravity-profile-pilot-3.3.3"
  "burhanbharmal.antigravity-profile-pilot-3.3.4"
  "burhanbharmal.antigravity-profile-pilot-3.3.5"
)

echo "===================================================="
echo "Installing Profile Pilot for Antigravity"
echo "===================================================="

# Clean up older installed versions
for old in "${OLD_NAMES[@]}"; do
  rm -rf "$HOME/.antigravity-ide/extensions/local.$old" 2>/dev/null || true
  rm -rf "$HOME/.antigravity-ide/extensions/$old" 2>/dev/null || true
  rm -rf "$HOME/.antigravity/extensions/$old" 2>/dev/null || true
  rm -rf "$HOME/.vscode/extensions/$old" 2>/dev/null || true
  rm -rf "$HOME/.vscode/extensions/local.$old" 2>/dev/null || true
done

# Destination 1: Antigravity IDE primary extensions directory
ANTIGRAVITY_IDE_DIR="$HOME/.antigravity-ide/extensions/local.$TARGET_NAME"
mkdir -p "$ANTIGRAVITY_IDE_DIR"
cp "$PLUGIN_DIR/package.json" "$ANTIGRAVITY_IDE_DIR/"
cp "$PLUGIN_DIR/extension.js" "$ANTIGRAVITY_IDE_DIR/"
cp "$PLUGIN_DIR/README.md" "$ANTIGRAVITY_IDE_DIR/" 2>/dev/null || true
cp "$PLUGIN_DIR/LICENSE" "$ANTIGRAVITY_IDE_DIR/" 2>/dev/null || true
if [ -d "$PLUGIN_DIR/resources" ]; then
  cp -r "$PLUGIN_DIR/resources" "$ANTIGRAVITY_IDE_DIR/"
fi
echo "✓ Installed to ~/.antigravity-ide/extensions/local.$TARGET_NAME"

# Destination 2: ~/.antigravity extensions directory
ANTIGRAVITY_DIR="$HOME/.antigravity/extensions/$TARGET_NAME"
mkdir -p "$ANTIGRAVITY_DIR"
cp "$PLUGIN_DIR/package.json" "$ANTIGRAVITY_DIR/"
cp "$PLUGIN_DIR/extension.js" "$ANTIGRAVITY_DIR/"
cp "$PLUGIN_DIR/README.md" "$ANTIGRAVITY_DIR/" 2>/dev/null || true
cp "$PLUGIN_DIR/LICENSE" "$ANTIGRAVITY_DIR/" 2>/dev/null || true
if [ -d "$PLUGIN_DIR/resources" ]; then
  cp -r "$PLUGIN_DIR/resources" "$ANTIGRAVITY_DIR/"
fi
echo "✓ Installed to ~/.antigravity/extensions/$TARGET_NAME"

# Direct CLI installation via VSIX if available
VSIX_FILE=$(/bin/ls -t "$PLUGIN_DIR"/antigravity-profile-pilot-*.vsix 2>/dev/null | head -n 1)
if [ -n "$VSIX_FILE" ] && [ -f "$VSIX_FILE" ]; then
  if [ -x "/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide" ]; then
    "/Applications/Antigravity IDE.app/Contents/Resources/app/bin/antigravity-ide" --install-extension "$VSIX_FILE" --force 2>/dev/null || true
  fi
  if command -v code >/dev/null 2>&1; then
    code --install-extension "$VSIX_FILE" --force 2>/dev/null || true
    echo "✓ Installed to VS Code via 'code --install-extension'"
  fi
fi

# Fallback copy for VS Code if code CLI not available
if ! command -v code >/dev/null 2>&1; then
  VSCODE_DIR="$HOME/.vscode/extensions/burhanbharmal.$TARGET_NAME"
  mkdir -p "$VSCODE_DIR"
  cp "$PLUGIN_DIR/package.json" "$VSCODE_DIR/"
  cp "$PLUGIN_DIR/extension.js" "$VSCODE_DIR/"
  cp "$PLUGIN_DIR/README.md" "$VSCODE_DIR/" 2>/dev/null || true
  cp "$PLUGIN_DIR/LICENSE" "$VSCODE_DIR/" 2>/dev/null || true
  if [ -d "$PLUGIN_DIR/resources" ]; then
    cp -r "$PLUGIN_DIR/resources" "$VSCODE_DIR/"
  fi
  echo "✓ Installed to ~/.vscode/extensions/burhanbharmal.$TARGET_NAME"
fi

echo ""
echo "Installation complete!"
echo "Please restart Antigravity IDE and VS Code (or run 'Developer: Reload Window') to activate."
