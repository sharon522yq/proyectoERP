param([string]$DatabaseEnvFile)
$ErrorActionPreference = 'Stop'
$renderPreviousKey = [Environment]::GetEnvironmentVariable('RENDER_API_KEY', 'Process')
$renderPreviousFile = [Environment]::GetEnvironmentVariable('LOCAL_DATABASE_ENV_FILE', 'Process')
$renderSecret = Read-Host 'API key de Render, solo auditoría (entrada oculta)' -AsSecureString
$renderPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($renderSecret)
try {
  $env:RENDER_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($renderPointer)
  $env:LOCAL_DATABASE_ENV_FILE = $DatabaseEnvFile
  & node (Join-Path $PSScriptRoot 'audit-render.js')
  if ($LASTEXITCODE -ne 0) { throw 'Auditoría Render rechazada; no compartas la clave' }
} finally {
  [Environment]::SetEnvironmentVariable('RENDER_API_KEY', $renderPreviousKey, 'Process')
  [Environment]::SetEnvironmentVariable('LOCAL_DATABASE_ENV_FILE', $renderPreviousFile, 'Process')
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($renderPointer)
  $renderSecret.Dispose()
}
