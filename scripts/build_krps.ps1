param(
    [string]$KspRoot = "$env:USERPROFILE\OneDrive\Desktop\Kerbal\Kerbal Space Program Sol RSS 1.12.4"
)

$ErrorActionPreference = "Stop"

$managed = Join-Path $KspRoot "KSP_x64_Data\Managed"
$csc = "${env:WINDIR}\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$srcDir = Join-Path $PSScriptRoot "..\ksp_mods\KRPS"
$outDir = Join-Path $srcDir "bin"
$outDll = Join-Path $outDir "KRPS.dll"
$installDir = Join-Path $KspRoot "GameData\KRPS"

$srcFiles = @(
    (Join-Path $srcDir "KrpsTelemetryAddon.cs"),
    (Join-Path $srcDir "KrpsKrpcMath.cs"),
    (Join-Path $srcDir "KrpsVesselSampler.cs")
)

foreach ($path in @($managed, $csc) + $srcFiles) {
    if (-not (Test-Path $path)) {
        throw "Required path not found: $path"
    }
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$refs = @(
    (Join-Path $managed "Assembly-CSharp.dll"),
    (Join-Path $managed "UnityEngine.dll"),
    (Join-Path $managed "UnityEngine.CoreModule.dll")
) | Where-Object { Test-Path $_ }

& $csc /nologo /target:library /out:$outDll `
    $(foreach ($ref in $refs) { "/reference:$ref" }) `
    $srcFiles
if ($LASTEXITCODE -ne 0) {
    throw "KRPS compile failed"
}

Copy-Item -Force $outDll (Join-Path $installDir "KRPS.dll")
Write-Host "Built and installed KRPS.dll to $installDir"
