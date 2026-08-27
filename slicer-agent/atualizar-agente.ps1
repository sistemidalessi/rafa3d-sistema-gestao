# =====================================================================
# Traz o codigo novo e reinicia o agente, nesta maquina.
#
#     powershell -ExecutionPolicy Bypass -File slicer-agent\atualizar-agente.ps1
#
# Existe porque "mexeu no agent.js, reinicie o agente" ja enganou tres
# vezes: o agente le o codigo UMA vez, ao iniciar. Depois de um git pull
# ele continua rodando a versao velha, sem avisar nada -- e o sintoma e
# um defeito ja consertado voltando do tumulo.
#
# Sem acentos, mesmo motivo do conferir-maquina.ps1: PowerShell antigo
# le mal texto acentuado sem BOM, e isto precisa rodar em qualquer
# maquina.
# =====================================================================

$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$raiz  = Split-Path -Parent $pasta

function Passo($msg) { Write-Host ""; Write-Host "-- $msg" -ForegroundColor Cyan }
function Ok($msg)    { Write-Host "  [ok]   $msg" -ForegroundColor Green }
function Erro($msg)  { Write-Host "  [erro] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "Atualizando o agente nesta maquina" -ForegroundColor Cyan

# --- 1. codigo novo ---------------------------------------------------
Passo "Trazendo o codigo novo do GitHub"
Push-Location $raiz
$antes = (git rev-parse HEAD 2>$null)
git pull
$depois = (git rev-parse HEAD 2>$null)
Pop-Location

if (-not $antes) {
  Erro "Isto nao parece um clone do repositorio -- git nao respondeu."
  Write-Host ""
  exit 1
}
if ($antes -eq $depois) { Ok "Ja estava atualizado" }
else {
  Ok "Codigo atualizado"
  Push-Location $raiz
  git log --oneline "$antes..$depois" | ForEach-Object { Write-Host "         $_" -ForegroundColor DarkGray }
  Pop-Location
}

# --- 2. dependencias --------------------------------------------------
# Roda sempre que o package.json mudou. O npm.cmd e de proposito: o npm
# comum e um script .ps1, e o Windows bloqueia script de fabrica.
$mexeuNoPackage = $false
if ($antes -ne $depois) {
  Push-Location $raiz
  $mudou = git diff --name-only "$antes..$depois"
  Pop-Location
  if ($mudou -match "slicer-agent/package") { $mexeuNoPackage = $true }
}
if ($mexeuNoPackage -or -not (Test-Path (Join-Path $pasta "node_modules"))) {
  Passo "Instalando dependencias (o package.json mudou)"
  Push-Location $pasta
  npm.cmd install
  Pop-Location
  Ok "Dependencias em dia"
}

# --- 3. parar o que estiver rodando -----------------------------------
Passo "Parando o agente antigo"
$velhos = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*agent.js*" }
if ($velhos) {
  # @() em volta de proposito: um processo so nao e array, e sem isso o
  # .Count vem vazio e a mensagem sai "Parado ( processo(s))".
  $quantos = @($velhos).Count
  $velhos | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Start-Sleep -Seconds 2
  Ok "Parado ($quantos processo(s))"
} else { Ok "Nao havia nenhum rodando" }

# --- 4. subir de novo -------------------------------------------------
Passo "Subindo o agente com o codigo novo"
Start-Process wscript.exe -ArgumentList "start-hidden.vbs" -WorkingDirectory $pasta
Start-Sleep -Seconds 6

$novo = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*agent.js*" }

Write-Host ""
if ($novo) {
  Write-Host "Pronto -- o agente esta de pe com o codigo novo." -ForegroundColor Green
} else {
  Erro "O agente NAO subiu."
  Write-Host "  Rode assim pra ver o erro na tela (o start-hidden esconde ele):"
  Write-Host "      cd slicer-agent"
  Write-Host "      node agent.js"
}
Write-Host ""
