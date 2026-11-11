# Install Vifug from the terminal (Windows, PowerShell).
#
#   irm https://raw.githubusercontent.com/abahvictor360-sketch/vifug-lyrics/main/install.ps1 | iex
#
# Downloads the newest release from GitHub and runs its installer.
# Run it again to update. Set $env:VIFUG_SILENT = "1" first to install
# without the installer's windows.
$ErrorActionPreference = "Stop"
$url = "https://github.com/abahvictor360-sketch/vifug-lyrics/releases/latest/download/VifugLyrics-Windows-Setup.exe"
$setup = Join-Path $env:TEMP "VifugLyrics-Windows-Setup.exe"

Write-Host "==> Downloading Vifug for Windows..."
$ProgressPreference = "SilentlyContinue"   # the progress bar makes the download many times slower
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-WebRequest -Uri $url -OutFile $setup -UseBasicParsing

Write-Host "==> Running the installer..."
$installArgs = @()
if ($env:VIFUG_SILENT -eq "1") { $installArgs += "/S" }
if ($installArgs.Count -gt 0) {
  Start-Process -FilePath $setup -ArgumentList $installArgs -Wait
} else {
  Start-Process -FilePath $setup -Wait
}
Remove-Item $setup -ErrorAction SilentlyContinue
Write-Host "==> Done. Vifug is in the Start menu."
