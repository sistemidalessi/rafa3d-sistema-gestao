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
  $faltando += "npm.cmd install"
  $faltando += "   O .cmd e de proposito: o npm normal e um script .ps1, e o"
  $faltando += "   Windows bloqueia script por padrao. O npm.cmd e identico e passa."
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
  # Cria o .env sozinho a partir do modelo. E copia de arquivo sem
  # segredo nenhum -- as chaves continuam em branco, esperando quem
  # sabe elas. Antes isso era um comando pra pessoa digitar, e digitar
  # comando e onde a preparacao de maquina nova costuma emperrar.
  $modelo = Join-Path $PSScriptRoot ".env.example"
  if (Test-Path $modelo) {
    Copy-Item $modelo $env_
    Write-Host "  [ok]    .env criado a partir do modelo (falta preencher as chaves)" -ForegroundColor Green
    $faltando += "Abra slicer-agent\.env e preencha:"
    $faltando += "   SUPABASE_SERVICE_ROLE_KEY  (Supabase - Project Settings - API - service_role)"
    $faltando += "   ANTHROPIC_API_KEY          (console.anthropic.com - crie uma chave POR maquina)"
    $faltando += "   HI3D_ACCESS_KEY / HI3D_SECRET_KEY  (platform.hi3d.ai - API Key)"
    $faltando += "As chaves so aparecem na hora de criar. Guarde no gerenciador de senhas."
  } else {
    Falta ".env nao existe e o modelo .env.example tambem nao"
    $faltando += "Baixe o repositorio de novo - faltou arquivo"
  }
}

# --- Bambu Studio -----------------------------------------------------
if (Test-Path "$env:ProgramFiles\Bambu Studio\bambu-studio.exe") { Ok "Bambu Studio instalado" }
else {
  Write-Host "  [aviso] Bambu Studio nao encontrado - so precisa na maquina que abre o fatiador" -ForegroundColor DarkGray
}

# --- pasta dos arquivos 3D --------------------------------------------
# Onde ficam os .3mf/.stl antes de subir pro sistema. Cria sozinha em
# vez de so avisar: e pasta vazia, nao tem risco, e sem um lugar padrao
# os arquivos se espalham por Downloads e ninguem acha depois.
$pastaPecas = Join-Path $env:USERPROFILE "Documents\Rafa 3D"
$subpastas = @("pecas-do-catalogo", "projetos-sob-medida")
$criou = $false
foreach ($sub in $subpastas) {
  $alvo = Join-Path $pastaPecas $sub
  if (-not (Test-Path $alvo)) { New-Item -ItemType Directory -Force -Path $alvo | Out-Null; $criou = $true }
}
if ($criou) { Ok "Pasta dos arquivos 3D criada em: $pastaPecas" }
else { Ok "Pasta dos arquivos 3D existe ($pastaPecas)" }

# --- agente rodando agora? --------------------------------------------
# Olha a LINHA DE COMANDO, nao so "existe algum node". Qualquer coisa
# em Node ligava o [ok] antes -- um servidor de teste, um script solto -
# e o verificador dizia que estava tudo certo com o agente parado. Esse
# e o pior falso positivo possivel aqui: a pessoa confia, clica num
# botao de fatiador e ele fica girando pra sempre sem erro nenhum.
$rodando = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*agent.js*" }
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
