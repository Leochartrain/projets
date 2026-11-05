# Compile Fonte.apk a la racine du projet. Avec -Install, l'installe sur le telephone branche.
param([switch]$Install)
$ErrorActionPreference = 'Stop'

$projet = Split-Path $PSScriptRoot -Parent
$outils = 'D:\claude\outils'
$jdk = Get-ChildItem (Join-Path $outils 'jdk21') -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $jdk -or -not (Test-Path (Join-Path $outils 'android-sdk\platforms\android-36'))) {
  throw 'Outils absents : lance d''abord scripts\installer-outils.ps1'
}
$env:JAVA_HOME = $jdk.FullName
$env:ANDROID_HOME = Join-Path $outils 'android-sdk'
$env:GRADLE_USER_HOME = Join-Path $outils 'gradle'

Set-Location $projet
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Echec de la compilation web.' }
& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Echec de la synchronisation Capacitor.' }

Set-Location (Join-Path $projet 'android')
& .\gradlew.bat assembleDebug --no-daemon
if ($LASTEXITCODE -ne 0) { throw 'Echec de la compilation Android.' }

$apk = Join-Path $projet 'Fonte.apk'
Copy-Item 'app\build\outputs\apk\debug\app-debug.apk' $apk -Force
Write-Host "APK : $apk ($([math]::Round((Get-Item $apk).Length / 1MB, 1)) Mo)"

if ($Install) {
  & (Join-Path $outils 'platform-tools\adb.exe') install -r $apk
  if ($LASTEXITCODE -ne 0) { throw "Echec de l'installation sur le telephone." }
}
