#!/usr/bin/env bash
set -e

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_NAME="antigravity-account-switcher-2.1.0"

echo "===================================================="
echo "Installing Antigravity Multi-Account Switcher (macOS)"
echo "===================================================="

INSTALLED=0

# Check ~/.antigravity/extensions
if [ -d "$HOME/.antigravity" ]; then
  mkdir -p "$HOME/.antigravity/extensions/$TARGET_NAME"
  cp -R "$PLUGIN_DIR/package.json" "$PLUGIN_DIR/extension.js" "$HOME/.antigravity/extensions/$TARGET_NAME/"
  echo "✓ Installed to ~/.antigravity/extensions/$TARGET_NAME"
  INSTALLED=1
fi

# Also install to ~/.vscode/extensions if it exists
if [ -d "$HOME/.vscode" ]; then
  mkdir -p "$HOME/.vscode/extensions/$TARGET_NAME"
  cp -R "$PLUGIN_DIR/package.json" "$PLUGIN_DIR/extension.js" "$HOME/.vscode/extensions/$TARGET_NAME/"
  echo "✓ Installed to ~/.vscode/extensions/$TARGET_NAME"
  INSTALLED=1
fi

# Fallback: create ~/.antigravity/extensions if neither existed
if [ $INSTALLED -eq 0 ]; then
  mkdir -p "$HOME/.antigravity/extensions/$TARGET_NAME"
  cp -R "$PLUGIN_DIR/package.json" "$PLUGIN_DIR/extension.js" "$HOME/.antigravity/extensions/$TARGET_NAME/"
  echo "✓ Created and installed to ~/.antigravity/extensions/$TARGET_NAME"
fi

echo ""
echo "Installation complete!"
echo "Please restart Antigravity IDE (or run 'Developer: Reload Window' in Antigravity) to activate."
