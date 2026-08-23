' Inicia o agente de fatiamento sem abrir janela nenhuma (nem cmd, nem
' Node). A saida (o que o agente vai "printando") fica salva em
' agent.log, dentro desta mesma pasta, para conferir depois se algo
' deu errado.
'
' O caminho completo do Node vem junto de proposito: logo depois de
' instalar o Node, as janelas e sessoes que ja estavam abertas nao
' enxergam ele no PATH, e o atalho falhava com "node nao e reconhecido"
' sem explicar nada. Assim funciona antes mesmo de reiniciar o Windows.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

nodePadrao = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If fso.FileExists(nodePadrao) Then
  nodeCmd = """" & nodePadrao & """"
Else
  nodeCmd = "node"   ' confia no PATH; se nao achar, o motivo fica no agent.log
End If

cmd = "cmd /c cd /d """ & scriptDir & """ && " & nodeCmd & " agent.js >> agent.log 2>&1"
shell.Run cmd, 0, False
