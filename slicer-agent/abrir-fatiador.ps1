param(
  [Parameter(Mandatory=$true)][string]$ExePath,
  [Parameter(Mandatory=$true)][string]$FilePath
)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class RafaWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@

$proc = Start-Process -FilePath $ExePath -ArgumentList "`"$FilePath`"" -PassThru

$deadline = (Get-Date).AddSeconds(25)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 400
  try { $proc.Refresh() } catch { break }
  if ($proc.HasExited) { break }
  if ($proc.MainWindowHandle -ne [IntPtr]::Zero) { break }
}

if (-not $proc.HasExited -and $proc.MainWindowHandle -ne [IntPtr]::Zero) {
  # Alt "fantasma" satisfaz a checagem do Windows que bloqueia processo em
  # segundo plano de roubar o foco -- sem isso a janela abre atras de tudo.
  [RafaWin]::keybd_event(0x12, 0, 0, [UIntPtr]::Zero)
  [RafaWin]::keybd_event(0x12, 0, 2, [UIntPtr]::Zero)
  [RafaWin]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
  [RafaWin]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
  Write-Output "OK: janela trazida para frente"
} else {
  Write-Output "AVISO: programa abriu mas nao consegui achar a janela principal a tempo (pode aparecer sozinho em alguns segundos)"
}
