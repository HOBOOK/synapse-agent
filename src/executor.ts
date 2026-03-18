import { execSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from "fs";
import { dirname } from "path";
import { browserNavigate, browserClick, browserType, browserScreenshot, browserGetText, browserPressKey, browserScroll, browserScrollTo, browserClose } from "./browser.js";
import { mouseClick, mouseDoubleClick, keyboardType, keyboardPress, takeScreenshot, getScreenInfo } from "./desktop.js";
import { getUITree, clickUIElement, typeInUIElement, getActiveWindow, listWindows, focusWindow, clipboardType, clipboardTypeAndEnter } from "./uiautomation.js";

// 각 도구의 실제 실행 로직
export async function executeTool(
  name: string,
  input: Record<string, string>
): Promise<string> {
  switch (name) {
    case "read_file":
      return readFile(input.path);
    case "write_file":
      return writeFile(input.path, input.content);
    case "list_directory":
      return listDirectory(input.path || ".");
    case "run_command":
      return runCommand(input.command, input.cwd);
    case "web_search":
      return webSearch(input.query);
    case "web_fetch":
      return webFetch(input.url);
    // 브라우저 자동화
    case "browser_navigate":
      return browserNavigate(input.url);
    case "browser_click":
      return browserClick(input.selector);
    case "browser_type":
      return browserType(input.selector, input.text);
    case "browser_screenshot":
      return browserScreenshot();
    case "browser_get_text":
      return browserGetText();
    case "browser_press_key":
      return browserPressKey(input.key);
    case "browser_scroll":
      return browserScroll(input.direction, Number(input.amount) || 500);
    case "browser_scroll_to":
      return browserScrollTo(input.selector);
    case "browser_close":
      return browserClose();
    // 데스크탑 제어
    case "mouse_click":
      return mouseClick(Number(input.x), Number(input.y), input.button);
    case "mouse_double_click":
      return mouseDoubleClick(Number(input.x), Number(input.y));
    case "keyboard_type":
      return keyboardType(input.text);
    case "keyboard_press":
      return keyboardPress(input.keys);
    case "desktop_screenshot":
      return takeScreenshot(input.monitor);
    case "get_screen_info":
      return getScreenInfo();
    // UI Automation
    case "ui_get_tree":
      return getUITree(Number(input.max_depth) || 3);
    case "ui_click":
      return clickUIElement(input.search, input.element_type);
    case "ui_type":
      return typeInUIElement(input.search, input.text);
    case "ui_get_active_window":
      return getActiveWindow();
    case "list_windows":
      return listWindows();
    case "focus_window":
      return focusWindow(input.search);
    case "clipboard_type":
      return clipboardType(input.text);
    case "clipboard_type_enter":
      return clipboardTypeAndEnter(input.text);
    default:
      return `알 수 없는 도구: ${name}`;
  }
}

function readFile(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch (e: any) {
    return `오류: ${e.message}`;
  }
}

function writeFile(path: string, content: string): string {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf-8");
    return `파일 저장 완료: ${path}`;
  } catch (e: any) {
    return `오류: ${e.message}`;
  }
}

function listDirectory(path: string): string {
  try {
    const entries = readdirSync(path);
    const detailed = entries.map((entry) => {
      try {
        const stat = statSync(`${path}/${entry}`);
        const type = stat.isDirectory() ? "[DIR]" : "[FILE]";
        const size = stat.isFile()
          ? ` (${(stat.size / 1024).toFixed(1)}KB)`
          : "";
        return `${type} ${entry}${size}`;
      } catch {
        return `[?] ${entry}`;
      }
    });
    return detailed.join("\n") || "(빈 디렉토리)";
  } catch (e: any) {
    return `오류: ${e.message}`;
  }
}

function runCommand(command: string, cwd?: string): string {
  try {
    const output = execSync(command, {
      cwd: cwd || process.cwd(),
      encoding: "utf-8",
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
      shell: "cmd.exe",
    });
    return output || "(명령 완료, 출력 없음)";
  } catch (e: any) {
    if (e.killed) return "명령이 타임아웃되었습니다. GUI 프로그램은 start 명령을 사용하세요.";
    const stderr = e.stderr?.toString() || "";
    const stdout = e.stdout?.toString() || "";
    return `종료코드 ${e.status}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`;
  }
}

async function webSearch(query: string): Promise<string> {
  // DuckDuckGo Lite 를 이용한 간단한 웹 검색
  try {
    const params = new URLSearchParams({ q: query, kl: "kr-kr" });
    const res = await fetch(`https://lite.duckduckgo.com/lite/?${params}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    const html = await res.text();
    // 검색 결과에서 텍스트 추출 (간단한 파싱)
    const results = html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);
    return results || "검색 결과 없음";
  } catch (e: any) {
    return `검색 오류: ${e.message}`;
  }
}

async function webFetch(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    const html = await res.text();
    // HTML 태그 제거하여 텍스트만 추출
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 5000) || "(내용 없음)";
  } catch (e: any) {
    return `페이지 가져오기 오류: ${e.message}`;
  }
}
