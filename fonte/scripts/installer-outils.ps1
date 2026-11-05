# Installe ce qu'il faut pour compiler l'APK, sans rien changer au systeme :
# JDK 21 (Eclipse Temurin) et Android SDK, dans D:\claude\outils.
# A lancer soi-meme : les licences Android s'affichent et doivent etre acceptees (y).
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$outils = 'D:\claude\outils'
$jdkRoot = Join-Path $outils 'jdk21'
$sdk = Join-Path $outils 'android-sdk'

if (-not (Get-ChildItem $jdkRoot -Directory -ErrorAction SilentlyContinue)) {
  Write-Host 'Telechargement du JDK 21 (Adoptium)...'
  New-Item -ItemType Directory -Force $jdkRoot | Out-Null
  $zip = Join-Path $outils 'jdk21.zip'
  Invoke-WebRequest 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile $zip
  Expand-Archive $zip $jdkRoot
  Remove-Item $zip
}
$env:JAVA_HOME = (Get-ChildItem $jdkRoot -Directory | Select-Object -First 1).FullName
Write-Host "JDK : $env:JAVA_HOME"

$manager = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path $manager)) {
  Write-Host 'Telechargement des outils Android (Google)...'
  $index = (Invoke-WebRequest 'https://dl.google.com/android/repository/repository2-3.xml' -UseBasicParsing).Content
  $name = [regex]::Matches($index, 'commandlinetools-win-\d+_latest\.zip') |
    ForEach-Object { $_.Value } |
    Sort-Object { [int]($_ -replace '\D', '') } |
    Select-Object -Last 1
  $tools = Join-Path $sdk 'cmdline-tools'
  New-Item -ItemType Directory -Force $tools | Out-Null
  $zip = Join-Path $outils 'cmdline-tools.zip'
  Invoke-WebRequest "https://dl.google.com/android/repository/$name" -OutFile $zip
  Expand-Archive $zip $tools
  Rename-Item (Join-Path $tools 'cmdline-tools') 'latest'
  Remove-Item $zip
}

Write-Host ''
Write-Host 'Licences Android : lis-les et reponds y pour accepter.'
& $manager "--sdk_root=$sdk" --licenses
if ($LASTEXITCODE -ne 0) { throw 'Licences non acceptees.' }

Write-Host 'Installation de la plateforme Android 36...'
& $manager "--sdk_root=$sdk" 'platforms;android-36' 'build-tools;36.0.0'
if ($LASTEXITCODE -ne 0) { throw "Echec de l'installation du SDK." }

Write-Host ''
Write-Host 'Outils installes. Reviens dans Claude et dis : "c''est installe".'
