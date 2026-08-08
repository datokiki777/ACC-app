# ACC Android Trusted Web Activity

This committed Bubblewrap project packages the independent ACC PWA at
<https://acc.dbuilder.eu/> as Android package `eu.dbuilder.acc`.

## Toolchain and configuration

- Bubblewrap CLI is pinned to `1.25.0` in `package-lock.json`.
- `twa-manifest.json` is the non-secret source of truth.
- The launch URL and verified scope are `https://acc.dbuilder.eu/`.
- Display mode is `standalone`; orientation is `portrait`.
- Native splash, status bar, and navigation bar use ACC navy `#081220`.
- Existing 1024px regular and 512px maskable ACC icons generate launcher, adaptive, task-switcher,
  and splash resources.
- The release key path points outside Git to `ACC-ANDROID-SIGNING/acc-release.keystore`.

Install and verify the local build tool:

```powershell
npm ci
npm run doctor
```

Build passwords are never stored in Git. Set them only in the current shell:

```powershell
$releasePassword = Read-Host 'ACC release-key password'
$env:BUBBLEWRAP_KEYSTORE_PASSWORD = $releasePassword
$env:BUBBLEWRAP_KEY_PASSWORD = $releasePassword
npm run build
Remove-Item Env:BUBBLEWRAP_KEYSTORE_PASSWORD
Remove-Item Env:BUBBLEWRAP_KEY_PASSWORD
```

The release script runs Bubblewrap's unsigned build, then signs with `apksigner`/`jarsigner` using
`env:` password sources so passwords do not appear in process arguments or failure logs. Outputs are
`app-release-signed.apk` and `app-release-bundle.aab`; both are ignored by Git.

## Digital Asset Links

The deployable source is `../public/.well-known/assetlinks.json`. Production verification requires:

- relation `delegate_permission/common.handle_all_urls`;
- namespace `android_app`;
- package `eu.dbuilder.acc`;
- the SHA-256 fingerprint of the permanent release certificate;
- HTTP 200 at <https://acc.dbuilder.eu/.well-known/assetlinks.json> without a redirect.

Verification failure intentionally falls back to a Custom Tab, so any visible browser toolbar on a
release-device test is a release blocker. Details and recovery commands live only in the secret local
`ACC-TWA-RECOVERY.md` beside the keystore.

## Updating

Use `npm run update -- --appVersionName=<new-version>` to increment `versionCode` and update generated
files. Use `--skipVersionUpgrade` only when regenerating the same unreleased version. Normal web
deployments do not require rebuilding this package.
