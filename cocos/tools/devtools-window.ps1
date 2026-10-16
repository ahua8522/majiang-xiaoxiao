param([string]$Title = 'majiang-xiaoxiao', [string]$ProcName = '微信开发者工具', [string]$Out = 'E:\Documents\weixin-project\majiang-xiaoxiao\cocos\temp\devwin.png')
# 抓微信开发者工具窗口内容（PrintWindow：即使被别的窗口遮挡也能抓到自身渲染内容）
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
$proc = Get-Process | Where-Object { $_.MainWindowTitle -ne '' -and $_.MainWindowTitle -like "*$Title*" -and $_.ProcessName -like "*$ProcName*" } | Select-Object -First 1
if (-not $proc) { Write-Output "window not found for title *$Title*"; exit 1 }
$h = $proc.MainWindowHandle
Write-Output ("pid={0} hwnd={1} title='{2}'" -f $proc.Id, $h, $proc.MainWindowTitle)
[Win32]::ShowWindow($h, 9) | Out-Null
[Win32]::SetForegroundWindow($h) | Out-Null
Start-Sleep -Milliseconds 900
$r = New-Object Win32+RECT
[Win32]::GetWindowRect($h, [ref]$r) | Out-Null
$w = $r.Right - $r.Left; $ht = $r.Bottom - $r.Top
$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $g.GetHdc()
$ok = [Win32]::PrintWindow($h, $hdc, 2)
$g.ReleaseHdc($hdc)
$g.Dispose()
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output ("size={0}x{1} printwindow={2} saved={3}" -f $w, $ht, $ok, $Out)
