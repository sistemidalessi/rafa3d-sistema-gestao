# =====================================================================
# Confere se ESTA maquina esta pronta pra rodar o agente, e diz o que
# falta fazer. Rode depois de clonar o repositorio num computador novo:
#
#     powershell -ExecutionPolicy Bypass -File slicer-agent\conferir-maquina.ps1
#
# Escrito em PowerShell de proposito, e nao em Node: numa maquina nova o
# Node pode ser justamente o que falta, e um verificador que nao roda
# sem o que ele veio verificar nao serve pra nada.
#
# Sem acentos no arquivo pelo mesmo motivo do .env.example: PowerShell
# antigo le mal texto acentuado sem BOM, e este script precisa funcionar
# em qualquer maquina.
# =====================================================================

$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$faltando = @()

function Ok($msg)    { Write-Host "  [ok]    $msg" -ForegroundColor Green }
function Falta($msg) { Write-Host "  [falta] $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "Conferindo esta maquina para o agente do Rafa 3D" -ForegroundColor Cyan
Write-Host ""

# --- Node -------------------------------------------------------------
$node = $null
if (Get-Command node -ErrorAction SilentlyContinue) {
  $node = (Get-Command node).Source
} elseif (Test-Path "$env:ProgramFiles\nodejs\node.exe") {
  # Recem instalado: existe no disco mas ainda nao entrou no PATH desta
  # sessao. O start-hidden.vbs ja sabe lidar com isso.
  $node = "$env:ProgramFiles\nodejs\node.exe"
}
if ($node) { Ok "Node instalado ($node)" }
else {
  Falta "Node nao instalado"
  $faltando += "winget install OpenJS.NodeJS.LTS"
}

# --- dependencias do agente -------------------------------------------
if (Test-Path (Join-Path $pasta "node_modules")) { Ok "Dependencias do agente instaladas" }
else {
  Falta "Faltam as dependencias do agente (node_modules)"
  $faltando += "cd slicer-agent"
  $faltando += "npm install"
}

# --- .env -------------------------------------------------------------
$env_ = Join-Path $pasta ".env"
if (Test-Path $env_) {
  $linhas = Get-Content $env_
  $vazias = @()
  foreach ($obrigatoria in @("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")) {
    $l = $linhas | Where-Object { $_ -match "^$obrigatoria=" }
    if (-not $l -or $l -match "^$obrigatoria=\s*$") { $vazias += $obrigatoria }
  }
  if ($vazias.Count -eq 0) { Ok ".env preenchido (chave do banco presente)" }
  else {
    Falta ".env existe, mas falta preencher: $($vazias -join ', ')"
    $faltando += "Abra slicer-agent\.env e preencha a service_role (Supabase - Project Settings - API)"
  }
  foreach ($opcional in @("ANTHROPIC_API_KEY", "MESHY_API_KEY")) {
    $l = $linhas | Where-Object { $_ -match "^$opcional=" }
    if (-not $l -or $l -match "^$opcional=\s*$") {
      Write-Host "  [aviso] $opcional vazia - o agente roda, mas essa funcao de IA fica desligada" -ForegroundColor DarkGray
    }
  }
} else {
  Falta ".env nao existe"
  $faltando += "copy slicer-agent\.env.example slicer-agent\.env"
  $faltando += "Depois abra o .env e preencha a service_role (Supabase - Project Settings - API)"
}

# --- Bambu Studio -----------------------------------------------------
if (Test-Path "$env:ProgramFiles\Bambu Studio\bambu-studio.exe") { Ok "Bambu Studio instalado" }
else {
  Write-Host "  [aviso] Bambu Studio nao encontrado - so precisa na maquina que abre o fatiador" -ForegroundColor DarkGray
}

# --- agente rodando agora? --------------------------------------------
$rodando = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*nodejs*" }
if ($rodando) { Ok "Agente rodando agora" }
else { Write-Host "  [aviso] Agente parado - de dois cliques em slicer-agent\start-hidden.vbs" -ForegroundColor DarkGray }

# --- resumo -----------------------------------------------------------
Write-Host ""
if ($faltando.Count -eq 0) {
  Write-Host "Esta maquina esta pronta." -ForegroundColor Green
  Write-Host "Para o agente subir junto com o Windows, coloque um atalho do"
  Write-Host "start-hidden.vbs em:  Win+R  ->  shell:startup"
} else {
  Write-Host "Faca isto, nesta ordem:" -ForegroundColor Yellow
  Write-Host ""
  $faltando | ForEach-Object { Write-Host "    $_" }
  Write-Host ""
  Write-Host "Depois rode este verificador de novo."
}
Write-Host ""
