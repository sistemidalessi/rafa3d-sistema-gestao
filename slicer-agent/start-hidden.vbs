' Inicia o agente de fatiamento sem abrir janela nenhuma (nem cmd, nem
' Node). A saída (o que o agente vai "printando") fica salva em
' agent.log, dentro desta mesma pasta, para conferir depois se algo
' deu errado.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
cmd = "cmd /c cd /d """ & scriptDir & """ && node agent.js >> agent.log 2>&1"
shell.Run cmd, 0, False
