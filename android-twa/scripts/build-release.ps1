[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$keystorePath = [IO.Path]::GetFullPath((Join-Path $projectDirectory '..\..\ACC-ANDROID-SIGNING\acc-release.keystore'))
$unsignedApk = Join-Path $projectDirectory 'app-release-unsigned-aligned.apk'
$signedApk = Join-Path $projectDirectory 'app-release-signed.apk'
$unsignedBundle = Join-Path $projectDirectory 'app\build\outputs\bundle\release\app-release.aab'
$signedBundle = Join-Path $projectDirectory 'app-release-bundle.aab'
$keyAlias = 'acc-release'

if (-not $env:BUBBLEWRAP_KEYSTORE_PASSWORD -or -not $env:BUBBLEWRAP_KEY_PASSWORD) {
  throw 'Set BUBBLEWRAP_KEYSTORE_PASSWORD and BUBBLEWRAP_KEY_PASSWORD in this shell before building.'
}
if (-not (Test-Path -LiteralPath $keystorePath)) {
  throw "Permanent release keystore not found: $keystorePath"
}

$javaHome = if ($env:JAVA_HOME) {
  $env:JAVA_HOME
} else {
  'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot'
}
$java = Join-Path $javaHome 'bin\java.exe'
$jarsigner = Join-Path $javaHome 'bin\jarsigner.exe'
$keytool = Join-Path $javaHome 'bin\keytool.exe'
$apkSigner = Join-Path $env:USERPROFILE '.bubblewrap\android_sdk\build-tools\36.1.0\lib\apksigner.jar'

foreach ($tool in @($java, $jarsigner, $keytool, $apkSigner)) {
  if (-not (Test-Path -LiteralPath $tool)) { throw "Required Android signing tool not found: $tool" }
}

Push-Location $projectDirectory
try {
  & (Join-Path $projectDirectory 'node_modules\.bin\bubblewrap.cmd') build --skipSigning
  if ($LASTEXITCODE -ne 0) { throw "Bubblewrap unsigned build failed with exit code $LASTEXITCODE" }

  & $java -jar $apkSigner sign `
    --ks $keystorePath `
    --ks-key-alias $keyAlias `
    --ks-pass env:BUBBLEWRAP_KEYSTORE_PASSWORD `
    --key-pass env:BUBBLEWRAP_KEY_PASSWORD `
    --out $signedApk `
    $unsignedApk
  if ($LASTEXITCODE -ne 0) { throw "APK signing failed with exit code $LASTEXITCODE" }

  Copy-Item -LiteralPath $unsignedBundle -Destination $signedBundle -Force
  & $jarsigner `
    '-storepass:env' BUBBLEWRAP_KEYSTORE_PASSWORD `
    '-keypass:env' BUBBLEWRAP_KEY_PASSWORD `
    -keystore $keystorePath `
    -sigalg SHA256withRSA `
    -digestalg SHA-256 `
    $signedBundle `
    $keyAlias
  if ($LASTEXITCODE -ne 0) { throw "AAB signing failed with exit code $LASTEXITCODE" }

  & $java -jar $apkSigner verify --verbose --print-certs $signedApk
  if ($LASTEXITCODE -ne 0) { throw "Signed APK verification failed with exit code $LASTEXITCODE" }
  & $jarsigner -verify $signedBundle
  if ($LASTEXITCODE -ne 0) { throw "Signed AAB verification failed with exit code $LASTEXITCODE" }

  $manifest = Get-Content -Raw (Join-Path $projectDirectory 'twa-manifest.json') | ConvertFrom-Json
  $expectedFingerprint = ($manifest.fingerprints | Where-Object name -eq 'release').value
  foreach ($artifact in @($signedApk, $signedBundle)) {
    $certificateDetails = & $keytool -printcert -jarfile $artifact
    $fingerprintMatch = [regex]::Match(($certificateDetails -join "`n"), 'SHA-?256:\s*([0-9A-F:]+)')
    if (-not $fingerprintMatch.Success -or $fingerprintMatch.Groups[1].Value -ne $expectedFingerprint) {
      throw "Signed artifact certificate does not match twa-manifest.json: $artifact"
    }
  }

  Write-Host "Signed release APK: $signedApk"
  Write-Host "Signed release AAB: $signedBundle"
  Write-Host "Release SHA-256: $expectedFingerprint"
} finally {
  Pop-Location
}
