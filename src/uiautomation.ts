import { execSync } from "child_process";

// PowerShell을 통해 Windows UI Automation API 호출

function runPS(script: string, timeout = 15000): string {
  try {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    const output = execSync(
      `powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`,
      { encoding: "utf-8", timeout, maxBuffer: 5 * 1024 * 1024 }
    );
    return output.trim();
  } catch (e: any) {
    return `오류: ${e.message}\n${e.stderr?.toString() || ""}`;
  }
}

// 열려있는 모든 창 목록 가져오기
export async function listWindows(): Promise<string> {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public class WinEnum {
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    public static List<string> windows = new List<string>();
    public static bool EnumCallback(IntPtr hWnd, IntPtr lParam) {
        if (!IsWindowVisible(hWnd)) return true;
        int len = GetWindowTextLength(hWnd);
        if (len == 0) return true;
        StringBuilder sb = new StringBuilder(len + 1);
        GetWindowText(hWnd, sb, sb.Capacity);
        uint pid;
        GetWindowThreadProcessId(hWnd, out pid);
        windows.Add(hWnd.ToString() + "|" + pid + "|" + sb.ToString());
        return true;
    }
    public static void Run() {
        windows.Clear();
        EnumWindows(new EnumWindowsProc(EnumCallback), IntPtr.Zero);
    }
}
"@
[WinEnum]::Run()
foreach ($w in [WinEnum]::windows) {
    $parts = $w -split "\\|", 3
    $hwnd = $parts[0]
    $pid = $parts[1]
    $title = $parts[2]
    try {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        $pname = if ($proc) { $proc.ProcessName } else { "?" }
    } catch { $pname = "?" }
    Write-Output "hwnd=$hwnd pid=$pid process=$pname title=$title"
}
`;
  return runPS(script, 10000);
}

// 타이틀로 창을 찾아서 포커스 (부분 일치)
export async function focusWindow(search: string): Promise<string> {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinFocus {
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    public static IntPtr found = IntPtr.Zero;
    public static string foundTitle = "";
    public static string search = "";
    public static bool EnumCallback(IntPtr hWnd, IntPtr lParam) {
        if (!IsWindowVisible(hWnd)) return true;
        int len = GetWindowTextLength(hWnd);
        if (len == 0) return true;
        StringBuilder sb = new StringBuilder(len + 1);
        GetWindowText(hWnd, sb, sb.Capacity);
        string title = sb.ToString();
        if (title.IndexOf(search, StringComparison.OrdinalIgnoreCase) >= 0) {
            found = hWnd;
            foundTitle = title;
            return false;
        }
        return true;
    }
    public static bool Focus(string s) {
        search = s;
        found = IntPtr.Zero;
        EnumWindows(new EnumWindowsProc(EnumCallback), IntPtr.Zero);
        if (found != IntPtr.Zero) {
            ShowWindow(found, 9); // SW_RESTORE
            SetForegroundWindow(found);
            return true;
        }
        return false;
    }
}
"@
$search = "${search.replace(/"/g, '""')}"
$result = [WinFocus]::Focus($search)
if ($result) {
    Write-Output "창 활성화 완료: $([WinFocus]::foundTitle)"
} else {
    Write-Output "창을 찾을 수 없음: $search"
}
`;
  return runPS(script);
}

// 클립보드를 통한 텍스트 입력 (한글/특수문자 안전)
export async function clipboardType(text: string): Promise<string> {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Clipboard]::SetText("${text.replace(/"/g, '""').replace(/\\/g, '\\\\')}")
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Milliseconds 100
Write-Output "클립보드 입력 완료: '${text.replace(/"/g, '""').slice(0, 50)}'${ text.length > 50 ? '...' : '' }"
`;
  return runPS(script);
}

// 클립보드 입력 + Enter
export async function clipboardTypeAndEnter(text: string): Promise<string> {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Clipboard]::SetText("${text.replace(/"/g, '""').replace(/\\/g, '\\\\')}")
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Write-Output "클립보드 입력 + Enter 완료: '${text.replace(/"/g, '""').slice(0, 50)}'${ text.length > 50 ? '...' : '' }"
`;
  return runPS(script);
}

// 현재 포커스된 창의 UI 요소 트리를 가져옴
export async function getUITree(maxDepth: number = 3): Promise<string> {
  const script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$auto = [System.Windows.Automation.AutomationElement]

function Get-UITree {
    param($element, $depth, $maxDepth, $prefix)
    if ($depth -gt $maxDepth) { return }

    $name = $element.Current.Name
    $type = $element.Current.ControlType.ProgrammaticName -replace "ControlType\\\\.", ""
    $automationId = $element.Current.AutomationId
    $className = $element.Current.ClassName
    $rect = $element.Current.BoundingRectangle
    $enabled = $element.Current.IsEnabled
    $hasKB = $element.Current.IsKeyboardFocusable

    if ($rect -and !$rect.IsEmpty) {
        $x = [int]($rect.X + $rect.Width / 2)
        $y = [int]($rect.Y + $rect.Height / 2)
        $w = [int]$rect.Width
        $h = [int]$rect.Height
        $info = "$prefix[$type] name='$name' id='$automationId' class='$className' center=($x,$y) size=($w x $h) enabled=$enabled focusable=$hasKB"
        Write-Output $info
    }

    $children = $element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($child in $children) {
        Get-UITree -element $child -depth ($depth + 1) -maxDepth $maxDepth -prefix "$prefix  "
    }
}

$focused = $auto::FocusedElement
$root = $null

$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$current = $focused
while ($current -ne $null) {
    $parent = $walker.GetParent($current)
    if ($parent -eq $auto::RootElement -or $parent -eq $null) {
        $root = $current
        break
    }
    $current = $parent
}

if ($root -eq $null) { $root = $focused }

$windowName = $root.Current.Name
Write-Output "=== 활성 창: $windowName ==="
Write-Output "=== 포커스: $($focused.Current.Name) ($($focused.Current.ControlType.ProgrammaticName)) ==="
Write-Output ""
Get-UITree -element $root -depth 0 -maxDepth ${maxDepth} -prefix ""
`;
  return runPS(script, 20000);
}

// 이름 또는 자동화ID로 요소를 찾아서 클릭
export async function clickUIElement(search: string, elementType?: string): Promise<string> {
  const typeFilter = elementType
    ? `$element.Current.ControlType.ProgrammaticName -like "*${elementType}*"`
    : "$true";

  const script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$auto = [System.Windows.Automation.AutomationElement]
$search = "${search.replace(/"/g, '`"')}"

$focused = $auto::FocusedElement
$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$current = $focused
$root = $null
while ($current -ne $null) {
    $parent = $walker.GetParent($current)
    if ($parent -eq $auto::RootElement -or $parent -eq $null) {
        $root = $current
        break
    }
    $current = $parent
}
if ($root -eq $null) { $root = $focused }

function Find-Element {
    param($element, $depth)
    if ($depth -gt 8) { return $null }

    $name = $element.Current.Name
    $automationId = $element.Current.AutomationId
    $match = ($name -like "*$search*") -or ($automationId -like "*$search*")
    $typeOk = ${typeFilter}

    if ($match -and $typeOk) { return $element }

    $children = $element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($child in $children) {
        $found = Find-Element -element $child -depth ($depth + 1)
        if ($found) { return $found }
    }
    return $null
}

$target = Find-Element -element $root -depth 0

if ($target -eq $null) {
    Write-Output "요소를 찾을 수 없음: $search"
    exit
}

$rect = $target.Current.BoundingRectangle
$x = [int]($rect.X + $rect.Width / 2)
$y = [int]($rect.Y + $rect.Height / 2)

try {
    $invokePattern = $target.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invokePattern.Invoke()
    Write-Output "클릭 완료 (Invoke): '$($target.Current.Name)' at ($x, $y)"
    exit
} catch {}

[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($x, $y)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseClick {
    [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
}
"@
[MouseClick]::mouse_event(0x0002, 0, 0, 0, 0)
[MouseClick]::mouse_event(0x0004, 0, 0, 0, 0)
Write-Output "클릭 완료 (Mouse): '$($target.Current.Name)' type=$($target.Current.ControlType.ProgrammaticName) at ($x, $y)"
`;
  return runPS(script);
}

// 이름 또는 자동화ID로 입력 필드를 찾아서 텍스트 입력
export async function typeInUIElement(search: string, text: string): Promise<string> {
  const script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$auto = [System.Windows.Automation.AutomationElement]
$search = "${search.replace(/"/g, '`"')}"
$text = "${text.replace(/"/g, '`"')}"

$focused = $auto::FocusedElement
$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$current = $focused
$root = $null
while ($current -ne $null) {
    $parent = $walker.GetParent($current)
    if ($parent -eq $auto::RootElement -or $parent -eq $null) {
        $root = $current
        break
    }
    $current = $parent
}
if ($root -eq $null) { $root = $focused }

function Find-Element {
    param($element, $depth)
    if ($depth -gt 8) { return $null }

    $name = $element.Current.Name
    $automationId = $element.Current.AutomationId
    $match = ($name -like "*$search*") -or ($automationId -like "*$search*")

    if ($match) { return $element }

    $children = $element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($child in $children) {
        $found = Find-Element -element $child -depth ($depth + 1)
        if ($found) { return $found }
    }
    return $null
}

$target = Find-Element -element $root -depth 0

if ($target -eq $null) {
    Write-Output "입력 필드를 찾을 수 없음: $search"
    exit
}

# ValuePattern
try {
    $valuePattern = $target.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $valuePattern.SetValue($text)
    Write-Output "입력 완료 (Value): '$text' → '$($target.Current.Name)'"
    exit
} catch {}

# 포커스 → 클립보드 붙여넣기 (한글 안전)
try {
    $target.SetFocus()
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.Clipboard]::SetText($text)
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 100
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 100
    Write-Output "입력 완료 (Clipboard): '$text' → '$($target.Current.Name)'"
} catch {
    Write-Output "입력 실패: $_"
}
`;
  return runPS(script);
}

// 활성 창 정보 가져오기
export async function getActiveWindow(): Promise<string> {
  const script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$auto = [System.Windows.Automation.AutomationElement]
$focused = $auto::FocusedElement
$walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
$current = $focused
$root = $null
while ($current -ne $null) {
    $parent = $walker.GetParent($current)
    if ($parent -eq $auto::RootElement -or $parent -eq $null) {
        $root = $current
        break
    }
    $current = $parent
}
if ($root -eq $null) { $root = $focused }

$rect = $root.Current.BoundingRectangle
Write-Output "창 이름: $($root.Current.Name)"
Write-Output "클래스: $($root.Current.ClassName)"
Write-Output "위치: X=$([int]$rect.X) Y=$([int]$rect.Y) W=$([int]$rect.Width) H=$([int]$rect.Height)"
Write-Output "프로세스: $($root.Current.ProcessId)"
Write-Output "포커스된 요소: $($focused.Current.Name) ($($focused.Current.ControlType.ProgrammaticName))"
`;
  return runPS(script);
}
