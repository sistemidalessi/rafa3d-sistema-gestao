# =====================================================================
# Vigia do agente: confere se ele esta rodando e religa sozinho se nao
# estiver. Existe porque em 28/08/2026 o agente ficou mais de 2 horas
# parado no meio do dia sem ninguem perceber, ate um pedido de colinha
# nao sair da fila -- ninguem soube dizer o motivo dele ter parado, so
# que parou.
#
# Nao roda sozinho: precisa da Tarefa Agendada instalada por
# instalar-vigia.ps1, que chama este arquivo a cada 5 minutos. So
# RELIGA se estiver parado -- nao mexe em nada se ja estiver rodando, e
# nao baixa codigo novo (isso e trabalho do atualizar-agente.ps1).
#
# Sem acentos, mesmo motivo do conferir-maquina.ps1: PowerShell antigo
# le mal texto acentuado sem BOM.
# =====================================================================

$pasta = Split-Path -Parent $MyInvocation.MyCommand.Path

$rodando = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*agent.js*" }

if (-not $rodando) {
  Start-Process wscript.exe -ArgumentList "start-hidden.vbs" -WorkingDirectory $pasta
  # Rastro em log proprio (nao no agent.log, que e do agente em si) --
  # da pra ver depois quantas vezes o vigia precisou agir, e quando.
  $linha = (Get-Date -Format "yyyy-MM-dd HH:mm:ss") + " - agente estava parado, religuei"
  Add-Content -Path (Join-Path $pasta "vigia.log") -Value $linha
}
