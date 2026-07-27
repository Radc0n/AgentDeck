param(
  [string]$InstallerPath = ""
)

if ([string]::IsNullOrWhiteSpace($InstallerPath)) {
  $projectRoot = Split-Path -Parent $PSScriptRoot
  $packageJson = Get-Content -LiteralPath (Join-Path $projectRoot "package.json") -Raw |
    ConvertFrom-Json
  $InstallerPath = Join-Path $projectRoot "dist\AgentDeck-Setup-$($packageJson.version).exe"
}

$resolvedPath = Resolve-Path -LiteralPath $InstallerPath -ErrorAction Stop
$signature = Get-AuthenticodeSignature -LiteralPath $resolvedPath.Path

if ($signature.Status -ne [System.Management.Automation.SignatureStatus]::Valid) {
  Write-Error "Geçerli Windows imzası bulunamadı: $($signature.Status)"
  exit 1
}

Write-Output "İmza geçerli."
Write-Output "Dosya: $($resolvedPath.Path)"
Write-Output "Yayıncı: $($signature.SignerCertificate.Subject)"
Write-Output "Parmak izi: $($signature.SignerCertificate.Thumbprint)"
