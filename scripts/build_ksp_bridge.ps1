param(
    [string]$KspRoot = "$env:USERPROFILE\OneDrive\Desktop\Kerbal\Kerbal Space Program Sol RSS 1.12.4"
)

$ErrorActionPreference = "Stop"

$managed = Join-Path $KspRoot "KSP_x64_Data\Managed"
$krpcDir = Join-Path $KspRoot "GameData\kRPC"
$krpc = Join-Path $krpcDir "KRPC.dll"
$krpcCore = Join-Path $krpcDir "KRPC.Core.dll"
$mechjeb = Join-Path $KspRoot "GameData\MechJeb2\Plugins\MechJeb2.dll"
$csc = "${env:WINDIR}\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$src = Join-Path $PSScriptRoot "..\ksp_mods\KPRS.AutopilotBridge\KprsAutopilotBridge.cs"
$outDir = Join-Path $PSScriptRoot "..\ksp_mods\KPRS.AutopilotBridge\bin"
$outDll = Join-Path $outDir "KPRS.AutopilotBridge.dll"
$installDir = Join-Path $KspRoot "GameData\kRPC"

foreach ($path in @($managed, $krpc, $mechjeb, $csc, $src)) {
    if (-not (Test-Path $path)) {
        throw "Required path not found: $path"
    }
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$refs = @(
    (Join-Path $managed "Assembly-CSharp.dll"),
    (Join-Path $managed "UnityEngine.dll"),
    (Join-Path $managed "UnityEngine.CoreModule.dll"),
    $krpc,
    $krpcCore,
    $mechjeb
) | Where-Object { Test-Path $_ }

& $csc /nologo /target:library /out:$outDll `
    $(foreach ($ref in $refs) { "/reference:$ref" }) `
    $src
if ($LASTEXITCODE -ne 0) {
    throw "KPRS.AutopilotBridge compile failed"
}

Copy-Item -Force $outDll (Join-Path $installDir "KPRS.AutopilotBridge.dll")
Write-Host "Built and installed KPRS.AutopilotBridge.dll to $installDir"
