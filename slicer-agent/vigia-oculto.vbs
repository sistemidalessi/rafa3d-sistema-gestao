' Roda o vigia (manter-vivo.ps1) SEM piscar janela nenhuma.
'
' Por que existe: a Tarefa Agendada chamava o powershell.exe direto com
' -WindowStyle Hidden, e essa opcao nao resolve -- o PowerShell cria a
' janela do console e SO DEPOIS esconde. Na pratica, uma janela preta
' piscava na tela a cada 5 minutos, o dia inteiro. Quem opera esta
' maquina tem 10 anos, e uma janela que abre sozinha de tempos em
' tempos assusta e parece defeito.
'
' O shell.Run com estilo 0 nunca chega a desenhar a janela -- e o mesmo
' jeito que o start-hidden.vbs ja usava pra subir o agente.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & scriptDir & "\manter-vivo.ps1"""
shell.Run cmd, 0, False
