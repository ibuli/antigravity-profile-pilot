#!/bin/bash
set -e

# Profile Pilot Release & Tagging Script
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

VERSION_ARG="$1"

if [ -z "$VERSION_ARG" ]; then
  CURRENT_VER=$(node -p "require('./package.json').version")
  echo "Current version: $CURRENT_VER"
  read -p "Enter new release version (e.g. 1.0.0, 1.0.1, 1.1.0): " NEW_VER
else
  NEW_VER="$VERSION_ARG"
fi

# Remove leading 'v' if provided
NEW_VER="${NEW_VER#v}"

if [ -z "$NEW_VER" ]; then
  echo "Error: Version cannot be empty."
  exit 1
fi

TAG_NAME="v$NEW_VER"

echo "===================================================="
echo "Preparing Release: $TAG_NAME"
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

# 5. Git commit & Tag
git add package.json install.sh install.ps1
if [ -f "package-lock.json" ]; then
  git add package-lock.json
fi

# Commit if there are changes
if ! git diff-index --quiet HEAD --; then
  git commit -m "chore(release): $TAG_NAME"
fi

# Check if tag exists
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
  echo "Tag $TAG_NAME already exists locally. Updating tag..."
  git tag -d "$TAG_NAME" >/dev/null 2>&1 || true
fi

git tag -a "$TAG_NAME" -m "Release $TAG_NAME - Profile Pilot for Antigravity"
echo "✓ Created git tag: $TAG_NAME"

echo ""
echo "===================================================="
echo "🎉 Release $TAG_NAME is ready!"
echo "===================================================="
echo "To publish this release to GitHub & trigger automated workflow, run:"
echo ""
echo "  git push origin main --tags"
echo ""
