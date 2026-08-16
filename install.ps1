# Profile Pilot for Antigravity Installer for Windows (PowerShell)
$ErrorActionPreference = "Stop"

$PluginDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$TargetVersion = "1.0.0"
$TargetName = "antigravity-profile-pilot-$TargetVersion"
$VsixFile = Join-Path $PluginDir "antigravity-profile-pilot-$TargetVersion.vsix"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Installing Profile Pilot for Antigravity (Windows)" -ForegroundColor Cyan
Write-Host "Version: $TargetVersion" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

# Check if VSIX exists
if (-not (Test-Path $VsixFile)) {
    Write-Host "Building VSIX package..." -ForegroundColor Yellow
    npm run package
}

# 1. Native CLI installation if Antigravity IDE is present
$AntigravityExe = "$env:LOCALAPPDATA\Programs\Antigravity IDE\bin\antigravity-ide.cmd"
if (-not (Test-Path $AntigravityExe)) {
    $AntigravityExe = "C:\Program Files\Antigravity IDE\bin\antigravity-ide.cmd"
}

if (Test-Path $AntigravityExe) {
    Write-Host "Installing via Antigravity IDE CLI..." -ForegroundColor Green
    & "$AntigravityExe" --install-extension "$VsixFile" --force
}

# 2. Extension directories installation
$ExtDirs = @(
    "$env:USERPROFILE\.antigravity-ide\extensions\local.$TargetName",
    "$env:USERPROFILE\.antigravity\extensions\$TargetName",
    "$env:USERPROFILE\.vscode\extensions\$TargetName"
)

foreach ($dest in $ExtDirs) {
    $parent = Split-Path -Parent $dest
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    
    # Clean previous versions
    Get-ChildItem -Path $parent -Filter "antigravity-*" | ForEach-Object {
        Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
    }
    Get-ChildItem -Path $parent -Filter "local.antigravity-*" | ForEach-Object {
        Remove-Item -Recurse -Force $_.FullName -ErrorAction SilentlyContinue
    }

    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -Path "$PluginDir\package.json" -Destination "$dest\" -Force
    Copy-Item -Path "$PluginDir\extension.js" -Destination "$dest\" -Force
    Copy-Item -Path "$PluginDir\README.md" -Destination "$dest\" -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "$PluginDir\LICENSE" -Destination "$dest\" -Force -ErrorAction SilentlyContinue
    if (Test-Path "$PluginDir\resources") {
        Copy-Item -Path "$PluginDir\resources" -Destination "$dest\" -Recurse -Force
    }
    Write-Host "✓ Installed to $dest" -ForegroundColor Green
}

Write-Host "`nInstallation complete!" -ForegroundColor Cyan
Write-Host "Please restart Antigravity IDE or press Ctrl+Shift+P -> 'Developer: Reload Window' to activate." -ForegroundColor Yellow
