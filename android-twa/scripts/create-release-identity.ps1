[CmdletBinding()]
param(
  [switch]$RepairRecovery
)

$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$accRoot = Split-Path $projectRoot -Parent
$signingDirectory = Join-Path $accRoot 'ACC-ANDROID-SIGNING'
$keystorePath = Join-Path $signingDirectory 'acc-release.keystore'
$recoveryPath = Join-Path $signingDirectory 'ACC-TWA-RECOVERY.md'
$keyAlias = 'acc-release'
$keytool = 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot\bin\keytool.exe'

if (-not (Test-Path -LiteralPath $keytool)) {
  throw "JDK 17 keytool was not found at $keytool. Install Temurin JDK 17 first."
}

if ($RepairRecovery) {
  if (-not (Test-Path -LiteralPath $keystorePath) -or -not (Test-Path -LiteralPath $recoveryPath)) {
    throw 'Both permanent identity files must exist before repairing the recovery record.'
  }
  $existingRecovery = [System.IO.File]::ReadAllText($recoveryPath)
  $passwordMatch = [regex]::Match(
    $existingRecovery,
    'Keystore/key password:\s*`?([A-Za-z0-9_-]{20,})`?'
  )
  if (-not $passwordMatch.Success) { throw 'Could not recover the existing keystore password.' }
  $password = $passwordMatch.Groups[1].Value
} else {
  if ((Test-Path -LiteralPath $keystorePath) -or (Test-Path -LiteralPath $recoveryPath)) {
    throw 'Release identity files already exist. Refusing to overwrite or regenerate the permanent ACC signing identity.'
  }

  New-Item -ItemType Directory -Path $signingDirectory -Force | Out-Null
  $randomBytes = New-Object byte[] 32
  $random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $random.GetBytes($randomBytes)
  } finally {
    $random.Dispose()
  }
  $password = [Convert]::ToBase64String($randomBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$env:ACC_TWA_GENERATED_PASSWORD = $password

try {
  if (-not $RepairRecovery) {
    & $keytool -genkeypair `
      -alias $keyAlias `
      -keyalg RSA `
      -keysize 4096 `
      -sigalg SHA256withRSA `
      -validity 36500 `
      -dname 'CN=ACC, OU=Android, O=dbuilder.eu, C=DE' `
      -keystore $keystorePath `
      -storetype PKCS12 `
      '-storepass:env' ACC_TWA_GENERATED_PASSWORD `
      '-keypass:env' ACC_TWA_GENERATED_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw "keytool failed with exit code $LASTEXITCODE" }
  }

  $certificateDetails = & $keytool -list -v `
    -keystore $keystorePath `
    -alias $keyAlias `
    '-storepass:env' ACC_TWA_GENERATED_PASSWORD
  if ($LASTEXITCODE -ne 0) { throw "keytool inspection failed with exit code $LASTEXITCODE" }

  $certificateText = $certificateDetails -join "`n"
  $sha256Match = [regex]::Match($certificateText, 'SHA-?256:\s*([0-9A-F:]+)')
  $sha1Match = [regex]::Match($certificateText, 'SHA-?1:\s*([0-9A-F:]+)')
  if (-not $sha256Match.Success) { throw 'Could not extract the SHA-256 certificate fingerprint.' }
  if (-not $sha1Match.Success) { throw 'Could not extract the SHA-1 certificate fingerprint.' }

  $sha256 = $sha256Match.Groups[1].Value
  $sha1 = $sha1Match.Groups[1].Value

  $recovery = @'
# ACC Android TWA recovery record

> **SECRET:** keep this file with the keystore in a secure, backed-up location. It contains the
> release-key password. Never commit either file to GitHub or send them through chat/email.

- Android package: `eu.dbuilder.acc`
- Production URL: `https://acc.dbuilder.eu/`
- Keystore filename: `acc-release.keystore`
- Key alias: `{{KEY_ALIAS}}`
- Keystore/key password: `{{PASSWORD}}`
- SHA-256: `{{SHA256}}`
- SHA-1: `{{SHA1}}`
- Bubblewrap project: repository `android-twa/`
- Bubblewrap CLI: `@bubblewrap/cli@1.25.0`
- Asset Links source: repository `public/.well-known/assetlinks.json`
- Live Asset Links URL: `https://acc.dbuilder.eu/.well-known/assetlinks.json`

## Permanent signing rule

`acc-release.keystore`, alias `{{KEY_ALIAS}}`, and its password are the permanent ACC Android release
identity. Reuse this exact key for every direct APK and local AAB build. Never regenerate it after a
release is distributed. Losing it prevents compatible direct-sideload updates.

## Restore the expected layout

Place this folder beside the repository checkout:

```text
ACC/
|-- ACC-ANDROID-SIGNING/
|   |-- acc-release.keystore
|   `-- ACC-TWA-RECOVERY.md
`-- repository/
    `-- android-twa/
```

Preserve these two files plus the Git repository. Git preserves `twa-manifest.json`, the generated
Android project, icons/splash resources, the Bubblewrap lockfile, and public Digital Asset Links.
Local JDK/SDK installations are replaceable.

## Rebuild a signed APK and AAB

Open PowerShell in `repository/android-twa`, then run:

```powershell
npm ci
npm run doctor
$releasePassword = Read-Host 'ACC release-key password'
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = $releasePassword
$env:BUBBLEWRAP_KEY_PASSWORD = $releasePassword
npm run build
Remove-Item Env:BUBBLEWRAP_KEYSTORE_PASSWORD
Remove-Item Env:BUBBLEWRAP_KEY_PASSWORD
```

The same `npm run build` command runs Bubblewrap's unsigned build, then signs with
`apksigner`/`jarsigner` using `env:` password sources. It produces `app-release-signed.apk` for direct
installation and `app-release-bundle.aab` for a future Play Console upload. Do not replace the secure
wrapper with a command that puts the password directly in process arguments.

## Inspect the permanent certificate

From `repository/android-twa`:

```powershell
& 'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot\bin\keytool.exe' -list -v -keystore '..\..\ACC-ANDROID-SIGNING\acc-release.keystore' -alias '{{KEY_ALIAS}}'
```

Compare SHA-256 with this document and `assetlinks.json` before release.

## Install and diagnose a release APK

Enable Developer options and USB debugging, connect the phone, then run:

```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb devices -l
& $adb install -r '.\app-release-signed.apk'
& $adb logcat -c
& $adb logcat -v brief | Select-String 'TWAProviderPicker|OriginVerifier|DigitalAssetLinks'
```

The release must open without browser toolbar UI. Toolbar UI means verification failed; re-check the
installed APK certificate, package name, HTTPS origin, and live Asset Links file.

## Version updates

Every uploaded Android release needs a strictly higher `appVersionCode`. From `android-twa/`, this
increments the code and sets the requested user-facing version:

```powershell
npm run update -- --appVersionName=1.0.1
```

Review `twa-manifest.json` and `app/build.gradle`, rebuild, and verify the signed artifact certificate.
For configuration-only regeneration without a version bump, run `npm run update --
--skipVersionUpgrade`.

## Regeneration and Bubblewrap upgrades

If generated files are lost, restore committed `android-twa/` from Git. If fresh generation is
unavoidable, initialize from `https://acc.dbuilder.eu/manifest.webmanifest`, restore/review committed
`twa-manifest.json`, and run `bubblewrap update --skipVersionUpgrade`. Never create a new key.

To upgrade safely, change the exact Bubblewrap version in `android-twa/package.json`, run `npm
install`, inspect the lockfile and generated diff, run `npm run doctor`, then `npm run update --
--skipVersionUpgrade`. Rebuild and retest DAL, splash, icons, system bars, and offline behavior.

## Debug vs release and Google Play

Debug builds may use a debug certificate. Production Asset Links must retain the permanent release
fingerprint above. If a debug fingerprint is temporarily needed, add it as an intentional additional
fingerprint; never replace the release fingerprint.

If Play App Signing is enabled later, Google may sign distributed APKs with a different Play
app-signing certificate. Add the Play Console app-signing SHA-256 to
`public/.well-known/assetlinks.json` alongside—not instead of—the direct-release fingerprint.

## Web updates vs Android-package updates

Normal React/UI/business deployments flow through GitHub to `acc.dbuilder.eu`; the TWA loads them and
usually needs no APK rebuild. Rebuild APK/AAB for native/TWA changes such as package or manifest
metadata, permissions, signing, launcher/native splash assets, native dependencies, or a new Play
release version.
'@

  $recovery = $recovery.Replace('{{KEY_ALIAS}}', $keyAlias)
  $recovery = $recovery.Replace('{{PASSWORD}}', $password)
  $recovery = $recovery.Replace('{{SHA256}}', $sha256)
  $recovery = $recovery.Replace('{{SHA1}}', $sha1)
  [System.IO.File]::WriteAllText($recoveryPath, $recovery, [System.Text.UTF8Encoding]::new($false))

  $verb = if ($RepairRecovery) { 'Repaired' } else { 'Created' }
  Write-Host "$verb permanent ACC release identity record in $signingDirectory"
  Write-Host "SHA-256: $sha256"
} finally {
  Remove-Item Env:ACC_TWA_GENERATED_PASSWORD -ErrorAction SilentlyContinue
  $password = $null
}
