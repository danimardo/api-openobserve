# arrancar.ps1 — Arranca el gateway en modo desarrollo en el puerto 3366.
# Libera el puerto antes de arrancar usando dos métodos: Get-NetTCPConnection
# (sin filtro de estado para capturar IPv4 e IPv6) y netstat como fallback.

$puerto = 3366

function Liberar-Puerto {
  param([int]$Port)

  $pidsMuertos = @()

  # Método 1: Get-NetTCPConnection sin filtrar por estado (captura IPv4 e IPv6)
  $conexiones = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
  if ($conexiones) {
    $pidsEncontrados = $conexiones |
      Select-Object -ExpandProperty OwningProcess -Unique |
      Where-Object { $_ -ne 0 }

    foreach ($pid_ in $pidsEncontrados) {
      $proc = Get-Process -Id $pid_ -ErrorAction SilentlyContinue
      $nombre = if ($proc) { $proc.ProcessName } else { 'desconocido' }
      Write-Host "  [método 1] Matando proceso '$nombre' (PID $pid_)..."
      Stop-Process -Id $pid_ -Force -ErrorAction SilentlyContinue
      $pidsMuertos += $pid_
    }
  }

  # Método 2: netstat como fallback (captura lo que Get-NetTCPConnection pueda omitir)
  $lineas = netstat -ano 2>$null | Select-String "\:$Port\s"
  if ($lineas) {
    foreach ($linea in $lineas) {
      # Formato: "  TCP  0.0.0.0:3366  0.0.0.0:0  LISTENING  1234"
      $partes = ($linea.Line).Trim() -split '\s+'
      $pid_ = $partes[-1]
      if ($pid_ -match '^\d+$' -and [int]$pid_ -ne 0 -and $pid_ -notin $pidsMuertos) {
        $proc = Get-Process -Id ([int]$pid_) -ErrorAction SilentlyContinue
        $nombre = if ($proc) { $proc.ProcessName } else { 'desconocido' }
        Write-Host "  [método 2] Matando proceso '$nombre' (PID $pid_)..."
        Stop-Process -Id ([int]$pid_) -Force -ErrorAction SilentlyContinue
        $pidsMuertos += $pid_
      }
    }
  }

  return $pidsMuertos.Count
}

Write-Host "Verificando puerto $puerto..."

$matados = Liberar-Puerto -Port $puerto

if ($matados -gt 0) {
  Write-Host "Puerto $puerto liberado ($matados proceso(s) eliminado(s))."
  Start-Sleep -Seconds 1
} else {
  Write-Host "Puerto $puerto libre."
}

$env:PORT = "$puerto"
Write-Host "Arrancando Log Gateway API en http://localhost:$puerto ..."
npm run start:dev
