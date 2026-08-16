#!/bin/bash
set -e

# Profile Pilot Release & Tagging Automation Script
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

CURRENT_VER=$(node -p "require('./package.json').version")
INPUT_ARG="$1"

if [ -z "$INPUT_ARG" ]; then
  echo "Current version: $CURRENT_VER"
  read -p "Enter bump type (patch/minor/major) or specific version (e.g. 1.0.1): " INPUT_ARG
fi

if [ "$INPUT_ARG" = "patch" ] || [ "$INPUT_ARG" = "minor" ] || [ "$INPUT_ARG" = "major" ]; then
  NEW_VER=$(npx -y semver "$CURRENT_VER" -i "$INPUT_ARG")
else
  NEW_VER="${INPUT_ARG#v}"
fi

if [ -z "$NEW_VER" ]; then
  echo "Error: Version cannot be empty."
  exit 1
fi

TAG_NAME="v$NEW_VER"

echo "===================================================="
echo "Automating Release: $TAG_NAME (from $CURRENT_VER)"
echo "===================================================="

# 1. Update package.json
node -e "
const fs = require('fs');
const p = require('./package.json');
p.version = '$NEW_VER';
fs.writeFileSync('./package.json', JSON.stringify(p, null, 2) + '\n');
"
echo "✓ Updated package.json to $NEW_VER"

# 2. Update install.sh
sed -i '' "s/TARGET_NAME=\"antigravity-profile-pilot-[0-9.]*\"/TARGET_NAME=\"antigravity-profile-pilot-$NEW_VER\"/g" install.sh
echo "✓ Updated install.sh to $NEW_VER"

# 3. Update install.ps1
sed -i '' "s/\$TargetVersion = \"[0-9.]*\"/\$TargetVersion = \"$NEW_VER\"/g" install.ps1
echo "✓ Updated install.ps1 to $NEW_VER"

# 4. Clean old vsix and package new
rm -f antigravity-profile-pilot-*.vsix 2>/dev/null || true
npm run package

# 5. Git Commit & Tag
git add package.json install.sh install.ps1
if [ -f "package-lock.json" ]; then
  git add package-lock.json
fi

if ! git diff-index --quiet HEAD --; then
  git commit -m "chore(release): $TAG_NAME"
fi

if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  git tag -d "$TAG_NAME" >/dev/null 2>&1 || true
fi

git tag -a "$TAG_NAME" -m "Release $TAG_NAME - Profile Pilot for Antigravity"
echo "✓ Created git tag: $TAG_NAME"

# 6. Push to remote
echo "Pushing $TAG_NAME and main to GitHub..."
git push origin main --tags

echo ""
echo "===================================================="
echo "🎉 Release $TAG_NAME published successfully to GitHub!"
echo "GitHub Actions is now generating release notes and attaching the VSIX package."
echo "View release at: https://github.com/ibuli/antigravity-profile-pilot/releases/tag/$TAG_NAME"
echo "===================================================="
