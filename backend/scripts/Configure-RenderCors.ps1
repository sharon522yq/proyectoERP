$ErrorActionPreference = 'Stop'
$renderPreviousKey = [Environment]::GetEnvironmentVariable('RENDER_API_KEY', 'Process')
$renderSecret = Read-Host 'API key de Render del propietario (entrada oculta)' -AsSecureString
$renderPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($renderSecret)
try {
  $env:RENDER_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($renderPointer)
  & node (Join-Path $PSScriptRoot 'configure-render-cors.js')
  if ($LASTEXITCODE -ne 0) { throw 'Configuración Render rechazada; no compartas la clave' }
} finally {
  [Environment]::SetEnvironmentVariable('RENDER_API_KEY', $renderPreviousKey, 'Process')
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($renderPointer)
  $renderSecret.Dispose()
}
