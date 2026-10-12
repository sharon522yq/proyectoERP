param([ValidateSet('Local','Production')][string]$Target = 'Local')
$ErrorActionPreference = 'Stop'
$firstAccessWorkspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$firstAccessKeys = @('MONGODB_URI','NODE_ENV','BOOTSTRAP_TARGET','BOOTSTRAP_API_URL','BOOTSTRAP_EMAIL','BOOTSTRAP_NAME','BOOTSTRAP_PASSWORD','BOOTSTRAP_COMPANY_NAME','BOOTSTRAP_ACCESS_REASON','BOOTSTRAP_ACCESS_EXPIRES','INTERNAL_ACCESS_ENABLED')
$firstAccessPrevious = @{}
foreach ($firstAccessKey in $firstAccessKeys) { $firstAccessPrevious[$firstAccessKey] = [Environment]::GetEnvironmentVariable($firstAccessKey, 'Process') }
function Read-FirstAccessSecret([string]$Prompt) {
  $firstAccessSecure = Read-Host $Prompt -AsSecureString
  $firstAccessPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($firstAccessSecure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($firstAccessPointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($firstAccessPointer); $firstAccessSecure.Dispose() }
}
try {
  if ($Target -eq 'Local') {
    $env:NODE_ENV = 'development'; $env:BOOTSTRAP_TARGET = 'development'
    $env:MONGODB_URI = 'mongodb://127.0.0.1:27127/erp_first_access?replicaSet=firstAccess'
    $env:BOOTSTRAP_API_URL = 'http://127.0.0.1:8086/api/v1'
    $env:BOOTSTRAP_ACCESS_REASON = 'Acceso local de visualización autorizado por el propietario'
  } else {
    $env:NODE_ENV = 'production'; $env:BOOTSTRAP_TARGET = 'production'
    $env:MONGODB_URI = Read-FirstAccessSecret 'URI privada MongoDB del backend Render (entrada oculta)'
    $env:BOOTSTRAP_API_URL = Read-Host 'URL exacta API del backend actualizado (terminada en /api/v1)'
    $env:INTERNAL_ACCESS_ENABLED = 'true'
    $env:BOOTSTRAP_ACCESS_REASON = Read-Host 'Motivo documentado del acceso interno'
  }
  $env:BOOTSTRAP_EMAIL = Read-Host 'Tu correo'
  $env:BOOTSTRAP_NAME = Read-Host 'Tu nombre'
  $env:BOOTSTRAP_COMPANY_NAME = Read-Host 'Tu empresa'
  $env:BOOTSTRAP_PASSWORD = Read-FirstAccessSecret 'Contraseña propia: mínimo 8 caracteres, máximo 72 bytes UTF-8 (entrada oculta)'
  $firstAccessConfirmation = Read-FirstAccessSecret 'Confirma contraseña (entrada oculta)'
  if ($env:BOOTSTRAP_PASSWORD -cne $firstAccessConfirmation) { throw 'Las contraseñas no coinciden' }
  $firstAccessConfirmation = $null
  $env:BOOTSTRAP_ACCESS_EXPIRES = [DateTime]::UtcNow.AddDays(30).ToString('o')
  Push-Location -LiteralPath $firstAccessWorkspace
  try { & node 'backend/scripts/initialize-first-access.js'; if ($LASTEXITCODE -ne 0) { throw 'Inicialización rechazada. Consulta el código mostrado; no repitas con datos diferentes.' } }
  finally { Pop-Location }
} finally {
  foreach ($firstAccessKey in $firstAccessKeys) { [Environment]::SetEnvironmentVariable($firstAccessKey, $firstAccessPrevious[$firstAccessKey], 'Process') }
  $firstAccessPrevious.Clear(); $firstAccessConfirmation = $null
}
