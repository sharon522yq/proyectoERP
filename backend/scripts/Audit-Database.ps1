$ErrorActionPreference = 'Stop'
$auditPreviousUri = [Environment]::GetEnvironmentVariable('MONGODB_URI', 'Process')
$auditSecret = Read-Host 'URI exacta del backend Render, con nombre de base (entrada oculta)' -AsSecureString
$auditPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($auditSecret)
try {
  $env:MONGODB_URI = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($auditPointer)
  & node (Join-Path $PSScriptRoot 'audit-database.js')
  if ($LASTEXITCODE -ne 0) { throw 'Auditoría rechazada; no compartas la URI ni credenciales' }
} finally {
  [Environment]::SetEnvironmentVariable('MONGODB_URI', $auditPreviousUri, 'Process')
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($auditPointer)
  $auditSecret.Dispose()
}
