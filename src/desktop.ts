import { mouse, keyboard, Point, Button, Key } from "@nut-tree-fork/nut-js";
// @ts-ignore
import screenshot from "screenshot-desktop";
import { writeFileSync } from "fs";
import { execSync } from "child_process";

// 마지막 스크린샷 base64를 저장 (LLM에 전달용)
let lastScreenshotBase64: string | null = null;

export function getLastScreenshot(): string | null {
  return lastScreenshotBase64;
}

export function setLastScreenshot(base64: string) {
  lastScreenshotBase64 = base64;
}

// 모니터 정보 가져오기 (PowerShell)
function getMonitorInfo(): string {
  try {
    const cmd = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::AllScreens | ForEach-Object { $_.DeviceName + ' Bounds=' + $_.Bounds.ToString() + ' Primary=' + $_.Primary }"`;
    const output = execSync(cmd, { encoding: "utf-8", timeout: 5000, shell: "cmd.exe" });
    return output.trim();
  } catch {
    return "모니터 정보 조회 실패";
  }
}

// 모니터 목록 가져오기
async function listDisplays(): Promise<any[]> {
  try {
    return await screenshot.listDisplays();
  } catch {
    return [];
  }
}

export async function getScreenInfo(): Promise<string> {
  try {
    const monitors = getMonitorInfo();
    const displays = await listDisplays();
    const mousePos = await mouse.getPosition();
    const displayList = displays.map((d: any, i: number) => `  디스플레이 ${i}: id=${d.id}, name=${d.name || "N/A"}`).join("\n");
    return `모니터 정보:\n${monitors}\n\n사용 가능한 디스플레이:\n${displayList}\n\n현재 마우스 위치: (${mousePos.x}, ${mousePos.y})`;
  } catch (e: any) {
    return `화면 정보 조회 오류: ${e.message}`;
  }
}

export async function mouseClick(x: number, y: number, button: string = "left"): Promise<string> {
  try {
    await mouse.setPosition(new Point(x, y));
    const btn = button === "right" ? Button.RIGHT : Button.LEFT;
    await mouse.click(btn);
    const pos = await mouse.getPosition();
    return `마우스 클릭: (${x}, ${y}) [${button}] → 실제 위치: (${pos.x}, ${pos.y})`;
  } catch (e: any) {
    return `마우스 클릭 오류: ${e.message}`;
  }
}

export async function mouseDoubleClick(x: number, y: number): Promise<string> {
  try {
    await mouse.setPosition(new Point(x, y));
    await mouse.doubleClick(Button.LEFT);
    return `더블클릭: (${x}, ${y})`;
  } catch (e: any) {
    return `더블클릭 오류: ${e.message}`;
  }
}

export async function keyboardType(text: string): Promise<string> {
  try {
    await keyboard.type(text);
    return `키보드 입력: "${text}"`;
  } catch (e: any) {
    return `키보드 입력 오류: ${e.message}`;
  }
}

export async function keyboardPress(keys: string): Promise<string> {
  try {
    const keyMap: Record<string, Key> = {
      ctrl: Key.LeftControl, alt: Key.LeftAlt, shift: Key.LeftShift,
      enter: Key.Enter, tab: Key.Tab, escape: Key.Escape, esc: Key.Escape,
      backspace: Key.Backspace, delete: Key.Delete, space: Key.Space,
      up: Key.Up, down: Key.Down, left: Key.Left, right: Key.Right,
      home: Key.Home, end: Key.End, pageup: Key.PageUp, pagedown: Key.PageDown,
      f1: Key.F1, f2: Key.F2, f3: Key.F3, f4: Key.F4, f5: Key.F5,
      a: Key.A, b: Key.B, c: Key.C, d: Key.D, e: Key.E, f: Key.F,
      g: Key.G, h: Key.H, i: Key.I, j: Key.J, k: Key.K, l: Key.L,
      m: Key.M, n: Key.N, o: Key.O, p: Key.P, q: Key.Q, r: Key.R,
      s: Key.S, t: Key.T, u: Key.U, v: Key.V, w: Key.W, x: Key.X,
      y: Key.Y, z: Key.Z,
    };
    const parts = keys.toLowerCase().split("+").map(k => k.trim());
    const resolved = parts.map(k => keyMap[k]).filter(Boolean);
    if (resolved.length === 0) return `알 수 없는 키: ${keys}`;
    await keyboard.pressKey(...resolved);
    await keyboard.releaseKey(...resolved);
    return `키 입력: ${keys}`;
  } catch (e: any) {
    return `키 입력 오류: ${e.message}`;
  }
}

export async function takeScreenshot(monitor?: string): Promise<string> {
  try {
    const displays = await listDisplays();
    let img: Buffer;

    if (monitor && displays.length > 0) {
      // 특정 모니터 캡처
      const idx = parseInt(monitor, 10);
      const displayId = (!isNaN(idx) && displays[idx]) ? displays[idx].id : displays[0].id;
      img = await screenshot({ format: "png", screen: displayId }) as Buffer;
    } else if (displays.length > 1) {
      // 듀얼 모니터: 주 모니터만 캡처 (첫 번째)
      img = await screenshot({ format: "png", screen: displays[0].id }) as Buffer;
    } else {
      img = await screenshot({ format: "png" }) as Buffer;
    }

    writeFileSync("desktop_screenshot.png", img);
    lastScreenshotBase64 = img.toString("base64");

    // 모니터 정보와 마우스 위치를 함께 반환
    const mousePos = await mouse.getPosition();
    const monitorInfo = getMonitorInfo();
    const displayInfo = displays.map((d: any, i: number) => `디스플레이${i}: id=${d.id}`).join(", ");

    return `[스크린샷 캡처 완료 - 이미지가 LLM에 전달됩니다]
모니터: ${monitorInfo}
디스플레이 목록: ${displayInfo}
캡처 대상: ${monitor ?? "주 모니터"}
현재 마우스 위치: (${mousePos.x}, ${mousePos.y})
좌표 안내: 이미지의 좌측 상단이 해당 모니터의 (0,0)입니다. 주 모니터의 좌표계를 기준으로 mouse_click 좌표를 지정하세요.`;
  } catch (e: any) {
    lastScreenshotBase64 = null;
    return `스크린샷 오류: ${e.message}`;
  }
}
