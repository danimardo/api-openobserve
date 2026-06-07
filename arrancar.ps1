# arrancar.ps1 — Arranca el gateway en modo desarrollo en el puerto 3366.
# Libera el puerto antes de arrancar, con verificación en bucle hasta confirmarlo libre.

$puerto = 3366

# Devuelve array de PIDs únicos que están usando el puerto (ambos métodos, deduplicado).
function Get-PidsEnPuerto {
  param([int]$Port)
  $pids = [System.Collections.Generic.HashSet[int]]::new()

  # Método 1: netstat (más fiable en Windows entre usuarios y sesiones).
  # Sin 2>$null porque en PowerShell 5.1 puede suprimir stdout de comandos nativos.
  netstat -ano | ForEach-Object {
    if ($_ -match "\:$Port\s") {
      $partes = $_.Trim() -split '\s+'
      $p = $partes[-1]
      if ($p -match '^\d+$' -and [int]$p -gt 0) {
        [void]$pids.Add([int]$p)
      }
    }
  }

  # Método 2: Get-NetTCPConnection como complemento.
  Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.OwningProcess -gt 0 } |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { [void]$pids.Add([int]$_) }

  return @($pids)
}

# Mata todos los procesos que usan el puerto y espera hasta que esté libre.
# Retorna: número de procesos matados, o -1 si no se pudo liberar.
function Liberar-Puerto {
  param([int]$Port)

  $totalMatados = 0
  $maxRondas    = 8
  $ronda        = 0

  do {
    $pidsActuales = Get-PidsEnPuerto -Port $Port
    if ($pidsActuales.Count -eq 0) { break }

    foreach ($pid_ in $pidsActuales) {
      $proc   = Get-Process -Id $pid_ -ErrorAction SilentlyContinue
      $nombre = if ($proc) { $proc.ProcessName } else { 'desconocido' }

      # Buscar el PID padre via WMI para matar también el watcher de nest.
      # Sin esto, el watcher (proceso node padre) respawnea el hijo inmediatamente
      # y reclama el puerto antes de que SWC termine de compilar la nueva instancia.
      $cimProc   = Get-CimInstance Win32_Process -Filter "ProcessId = $pid_" -ErrorAction SilentlyContinue
      $parentPid = if ($cimProc) { [int]$cimProc.ParentProcessId } else { 0 }
      $parentCim = if ($parentPid -gt 4) {
        Get-CimInstance Win32_Process -Filter "ProcessId = $parentPid" -ErrorAction SilentlyContinue
      } else { $null }

      if ($parentCim -and $parentCim.Name -eq 'node.exe') {
        # El padre es el nest watcher — matar el árbol completo desde el padre.
        Write-Host "  Matando árbol de '$nombre' (PID $pid_, watcher $parentPid)..."
        $null = & taskkill /F /T /PID $parentPid
      } else {
        Write-Host "  Matando '$nombre' (PID $pid_)..."
        $null = & taskkill /F /T /PID $pid_
      }
      $totalMatados++
    }

    Start-Sleep -Milliseconds 400
    $ronda++

  } while ($ronda -lt $maxRondas)

  # Verificación final: confirmar que el puerto quedó libre.
  if ((Get-PidsEnPuerto -Port $Port).Count -gt 0) {
    return -1
  }
  return $totalMatados
}

Write-Host "Verificando puerto $puerto..."
$resultado = Liberar-Puerto -Port $puerto

if ($resultado -lt 0) {
  $restantes = Get-PidsEnPuerto -Port $puerto
  Write-Host "ERROR: no se pudo liberar el puerto $puerto (PIDs activos: $($restantes -join ', '))."
  Write-Host "Prueba a ejecutar PowerShell como Administrador."
  exit 1
} elseif ($resultado -gt 0) {
  Write-Host "Puerto $puerto liberado ($resultado proceso(s) eliminado(s))."
} else {
  Write-Host "Puerto $puerto libre."
}

$env:PORT = "$puerto"
Write-Host "Arrancando Log Gateway API en http://localhost:$puerto ..."
npm run start:dev
