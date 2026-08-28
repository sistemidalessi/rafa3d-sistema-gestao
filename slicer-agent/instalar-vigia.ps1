# =====================================================================
# Registra uma Tarefa Agendada do Windows que roda o manter-vivo.ps1 a
# cada 5 minutos, pra sempre -- se o agente cair no meio do dia por
# qualquer motivo (janela fechada sem querer, trava, o que for), o
# proprio Windows religa sozinho em ate 5 minutos, sem precisar ninguem
# notar. Nao precisa de gatilho separado "ao ligar o computador": um
# agendamento de MINUTE do Windows ja continua sozinho depois de
# qualquer reinicio, e pega o primeiro tick assim que alguem loga.
#
# Roda uma vez so, nesta ordem depois de clonar o repositorio:
#     powershell -ExecutionPolicy Bypass -File slicer-agent\instalar-vigia.ps1
#
# Seguro de rodar de novo -- se a tarefa ja existe, so atualiza (/F).
#
# schtasks.exe, e nao o modulo ScheduledTasks (Register-ScheduledTask):
# o modulo devolveu "Acesso negado" mesmo sem precisar de admin de
# verdade (testado em 28/08/2026) -- o schtasks.exe classico funciona
# direto com o usuario comum.
#
# Sem acentos, mesmo motivo do conferir-maquina.ps1.
# =====================================================================

$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $pasta "manter-vivo.ps1"
$nomeTarefa = "Rafa3D - Vigia do Agente"

Write-Host ""
Write-Host "Instalando o vigia do agente nesta maquina" -ForegroundColor Cyan

$comando = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $script + '"'

& schtasks.exe /Create /TN $nomeTarefa /TR $comando /SC MINUTE /MO 5 /F | Out-Null

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "Pronto -- o vigia esta instalado." -ForegroundColor Green
  Write-Host "Ele confere a cada 5 minutos se o agente esta rodando, e religa sozinho se nao estiver."
  Write-Host "Pra ver ou desligar: abra 'Agendador de Tarefas' do Windows e procure '$nomeTarefa'."
} else {
  Write-Host ""
  Write-Host "Nao consegui instalar (codigo $LASTEXITCODE)." -ForegroundColor Red
  Write-Host "Tente abrir o PowerShell 'Como administrador' e rodar de novo."
}
Write-Host ""
