param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $PSScriptRoot 'opencode-bridgespace-notify.js'
$targetDir = Join-Path $HOME '.config\opencode\plugins'
$target = Join-Path $targetDir 'bridgespace-notify.js'
$legacyDir = Join-Path $env:APPDATA 'opencode\plugins'
$legacy = Join-Path $legacyDir 'bridgespace-notify.js'

if (!(Test-Path -LiteralPath $source)) {
  throw "Plugin source not found: $source"
}

if ($DryRun) {
  Write-Host "Would create: $targetDir"
  Write-Host "Would install: $target"
  if (Test-Path -LiteralPath $legacy) {
    Write-Host "Legacy plugin currently exists: $legacy"
  }
  exit 0
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force

if (Test-Path -LiteralPath $legacy) {
  $backup = "$legacy.bak"
  Copy-Item -LiteralPath $legacy -Destination $backup -Force
  Write-Host "Legacy plugin left in place and backed up: $backup"
}

Write-Host "Installed opencode notification plugin: $target"
Write-Host "Restart opencode sessions for the plugin to load."
