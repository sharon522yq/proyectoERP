param()
$ErrorActionPreference = 'Stop'
function Read-OwnerSecret([string]$Prompt) {
  $ownerSecure = Read-Host $Prompt -AsSecureString
  $ownerPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ownerSecure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ownerPointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ownerPointer); $ownerSecure.Dispose() }
}
$ownerKeys = @('MONGODB_URI','INITIAL_SETUP_TOKEN','SETUP_NAME','SETUP_EMAIL','SETUP_COMPANY_NAME','SETUP_PASSWORD')
$ownerPrevious = @{}
foreach ($ownerKey in $ownerKeys) { $ownerPrevious[$ownerKey] = [Environment]::GetEnvironmentVariable($ownerKey, 'Process') }
try {
  $env:MONGODB_URI = Read-OwnerSecret 'URI del destino autorizado (entrada oculta)'
  $env:INITIAL_SETUP_TOKEN = Read-OwnerSecret 'Secreto privado de inicialización, mínimo 32 caracteres'
  $env:SETUP_NAME = Read-Host 'Nombre'
  $env:SETUP_EMAIL = Read-Host 'Correo'
  $env:SETUP_COMPANY_NAME = Read-Host 'Empresa'
  $env:SETUP_PASSWORD = Read-OwnerSecret 'Contraseña propia, mínimo 8 caracteres y máximo 72 bytes'
  $ownerConfirmation = Read-OwnerSecret 'Confirma contraseña'
  if ($env:SETUP_PASSWORD -cne $ownerConfirmation) { throw 'Las contraseñas no coinciden' }
  & node (Join-Path $PSScriptRoot 'initialize-owner.js')
  if ($LASTEXITCODE -ne 0) { throw 'Inicialización rechazada; consulta el código sin compartir secretos' }
} finally {
  foreach ($ownerKey in $ownerKeys) { [Environment]::SetEnvironmentVariable($ownerKey, $ownerPrevious[$ownerKey], 'Process') }
  $ownerConfirmation = $null; $ownerPrevious.Clear()
}
