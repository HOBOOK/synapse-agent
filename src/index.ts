import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { createInterface } from "readline";
import { config } from "dotenv";
import { getAnthropicTools, getOpenAITools } from "./tools.js";
import { executeTool } from "./executor.js";
import { getLastScreenshot } from "./desktop.js";

config();

// ─── 프로바이더 자동 선택 ───
type Provider = "openai" | "anthropic";

function detectProvider(): Provider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  console.error("오류: OPENAI_API_KEY 또는 ANTHROPIC_API_KEY를 .env에 설정하세요.");
  process.exit(1);
}

const provider = detectProvider();
const openai = provider === "openai" ? new OpenAI() : null;
const anthropic = provider === "anthropic" ? new Anthropic() : null;

const SYSTEM_PROMPT = `당신은 사용자의 로컬 Windows PC를 자율적으로 제어하는 AI 에이전트입니다.
한국어로 대화합니다.

핵심 원칙:
- 모르는 것은 직접 찾아라. 추측하지 말고 탐색하라.
- 막히면 다른 방법을 시도하라. 하나가 실패하면 대안을 스스로 생각하라.
- 매 행동 후 결과를 확인하라. screenshot을 찍어 확인하고, 명령 출력을 읽어라.
- 작업이 끝날 때까지 스스로 계속 진행하라. 사용자에게 되묻지 말고 완료하라.

환경: Windows, cmd.exe 셸. GUI 프로그램 실행 시 start "" "경로" 사용.

자율 탐색 능력:
- 프로그램 찾기: 시작 메뉴, Program Files, where, dir, 레지스트리 등을 활용하여 스스로 찾아라.
- 웹 탐색: 필요한 정보가 있으면 web_search나 browser로 스스로 찾아라.
- 파일 탐색: 구조를 모르면 list_directory로 탐색하고, 내용을 모르면 read_file로 읽어라.

앱 제어 전략:

1. 창 찾기: list_windows로 열린 창 목록 확인 → focus_window("검색어")로 원하는 창 활성화
2. UI 요소 파악: ui_get_tree로 활성 창의 버튼, 입력창, 메뉴를 탐색 (스크린샷보다 정확)
3. 조작: ui_click/ui_type으로 이름 기반 조작. 못 찾으면 max_depth를 4~6으로 늘려라.
4. 폴백: ui_get_tree로 요소를 못 찾을 때만 desktop_screenshot + mouse_click 좌표 방식 사용.

VS Code / Electron 앱 전략 (중요):
- Electron 앱은 UI Automation 트리가 제한적이다. 스크린샷 + 좌표 기반으로 조작하라.
- 텍스트 입력은 반드시 clipboard_type 또는 clipboard_type_enter를 사용하라 (keyboard_type은 한글이 깨짐).

VS Code에서 플러그인 패널(Claude Code, Copilot 등)에 입력하는 방법:
절대로 에디터 영역을 클릭하지 마라. 반드시 아래 절차를 따라라:
1. focus_window로 해당 VS Code 창을 활성화
2. 방법 A (추천 - Command Palette):
   - keyboard_press("ctrl+shift+p")로 명령 팔레트를 연다
   - clipboard_type_enter("Claude Code: Open") 등으로 해당 플러그인 패널을 연다
3. 방법 B (스크린샷 기반):
   - desktop_screenshot으로 화면 캡처
   - 스크린샷에서 플러그인 패널의 채팅 입력창을 찾아라. 보통 사이드바 또는 하단 패널에 있다.
   - 입력창은 "Type a message", "Send a message", "메시지 입력" 등의 placeholder가 있는 텍스트 필드다.
   - 에디터 영역(코드가 보이는 곳)과 혼동하지 마라. 플러그인 채팅 입력창은 플러그인 패널 내 하단에 위치한다.
   - mouse_click으로 정확히 그 입력창을 클릭한 뒤 clipboard_type_enter로 입력
4. 입력 후 desktop_screenshot으로 올바른 곳에 입력되었는지 반드시 확인하라.
   잘못된 곳에 입력되었다면 keyboard_press("ctrl+z")로 취소하고 다시 시도하라.

VS Code 주요 단축키:
- Ctrl+Shift+P: 명령 팔레트 (가장 중요 - 모든 기능 접근 가능)
- Ctrl+\`: 터미널 토글
- Ctrl+1: 에디터 포커스
- Ctrl+B: 사이드바 토글

스크린샷에서 영역 구분법:
- 에디터: 코드가 보이는 메인 영역 (절대 여기에 채팅 메시지를 입력하지 마라)
- 사이드바: 왼쪽 또는 오른쪽의 좁은 패널 (파일탐색기, 확장 등)
- 하단 패널: 터미널, 출력, 문제 등
- 플러그인 패널: Claude Code 등의 채팅 UI가 표시되는 영역 (사이드바 또는 별도 탭)`;

// ─── 스피너 ───
const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let spinnerTimer: ReturnType<typeof setInterval> | null = null;
let spinnerStart = 0;

function startSpinner(label: string) {
  spinnerStart = Date.now();
  let i = 0;
  process.stdout.write(`\x1b[33m  ${spinnerFrames[0]} ${label}...\x1b[0m`);
  spinnerTimer = setInterval(() => {
    i = (i + 1) % spinnerFrames.length;
    const elapsed = ((Date.now() - spinnerStart) / 1000).toFixed(0);
    process.stdout.write(`\r\x1b[33m  ${spinnerFrames[i]} ${label}... (${elapsed}초)\x1b[0m`);
  }, 100);
}

function stopSpinner() {
  if (spinnerTimer) {
    clearInterval(spinnerTimer);
    spinnerTimer = null;
    const elapsed = ((Date.now() - spinnerStart) / 1000).toFixed(1);
    process.stdout.write(`\r\x1b[90m  ✓ 응답 수신 (${elapsed}초)\x1b[0m\n`);
  }
}

// ─── 공통 유틸 ───
let stepCount = 0;

function printToolUse(name: string, input: Record<string, string>) {
  stepCount++;
  const summary =
    name === "run_command" ? input.command :
    name === "write_file" || name === "read_file" ? input.path :
    name === "list_directory" ? (input.path || ".") :
    name === "web_search" ? input.query :
    name === "web_fetch" ? input.url :
    name === "mouse_click" ? `(${input.x}, ${input.y})` :
    name === "keyboard_type" ? input.text :
    name === "desktop_screenshot" ? `모니터 ${input.monitor ?? "주"}` :
    name === "browser_navigate" ? input.url :
    JSON.stringify(input).slice(0, 80);
  console.log(`\x1b[36m  [${stepCount}단계] ${name}: ${summary}\x1b[0m`);
}

async function executeAndPrint(name: string, input: Record<string, string>): Promise<string> {
  printToolUse(name, input);
  const result = await executeTool(name, input);
  const preview = result.length > 200 ? result.slice(0, 200) + "..." : result;
  console.log(`\x1b[90m  ${preview.replace(/\n/g, "\n  ")}\x1b[0m`);
  return result;
}

// ─── OpenAI 에이전트 (비전 지원) ───
const openaiHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

function buildToolResultContent(result: string, screenshotBase64: string | null): string | OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  if (!screenshotBase64) return result;
  return [
    { type: "text", text: result },
    {
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${screenshotBase64}`,
        detail: "high",
      },
    },
  ];
}

async function runOpenAI(userMessage: string) {
  stepCount = 0;
  openaiHistory.push({ role: "user", content: userMessage });

  startSpinner("AI 생각 중");
  let response = await openai!.chat.completions.create({
    model: "gpt-5.4",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...openaiHistory],
    tools: getOpenAITools(),
    max_completion_tokens: 4096,
  });
  stopSpinner();

  let message = response.choices[0].message;

  while (message.tool_calls && message.tool_calls.length > 0) {
    if (message.content) console.log(`\n\x1b[33m  💭 ${message.content}\x1b[0m`);
    openaiHistory.push(message);

    for (const toolCall of message.tool_calls) {
      if (toolCall.type !== "function") continue;
      const fn = toolCall.function;
      const input = JSON.parse(fn.arguments);
      const result = await executeAndPrint(fn.name, input);

      const isScreenshot = fn.name === "desktop_screenshot" || fn.name === "browser_screenshot";
      const screenshotData = isScreenshot ? getLastScreenshot() : null;

      openaiHistory.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: buildToolResultContent(result, screenshotData) as any,
      });
    }

    startSpinner(`AI 다음 행동 결정 중 (${stepCount}단계 완료)`);
    response = await openai!.chat.completions.create({
      model: "gpt-5.4",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...openaiHistory],
      tools: getOpenAITools(),
      max_completion_tokens: 4096,
    });
    stopSpinner();
    message = response.choices[0].message;
  }

  if (message.content) console.log(`\n${message.content}`);
  openaiHistory.push(message);
  console.log(`\x1b[90m  --- 총 ${stepCount}단계 완료 ---\x1b[0m`);
}

// ─── Anthropic 에이전트 (비전 지원) ───
const anthropicHistory: Anthropic.MessageParam[] = [];

async function runAnthropic(userMessage: string) {
  stepCount = 0;
  anthropicHistory.push({ role: "user", content: userMessage });

  startSpinner("AI 생각 중");
  let response = await anthropic!.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8096,
    system: SYSTEM_PROMPT,
    tools: getAnthropicTools(),
    messages: anthropicHistory,
  });
  stopSpinner();

  while (response.stop_reason === "tool_use") {
    const content = response.content;
    anthropicHistory.push({ role: "assistant", content });

    for (const block of content) {
      if (block.type === "text" && block.text) console.log(`\n\x1b[33m  💭 ${block.text}\x1b[0m`);
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of content) {
      if (block.type === "tool_use") {
        const input = block.input as Record<string, string>;
        const result = await executeAndPrint(block.name, input);

        const isScreenshot = block.name === "desktop_screenshot" || block.name === "browser_screenshot";
        const screenshotData = isScreenshot ? getLastScreenshot() : null;

        if (screenshotData) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: [
              { type: "text", text: result },
              { type: "image", source: { type: "base64", media_type: "image/png", data: screenshotData } },
            ],
          });
        } else {
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }
    }

    anthropicHistory.push({ role: "user", content: toolResults });

    startSpinner(`AI 다음 행동 결정 중 (${stepCount}단계 완료)`);
    response = await anthropic!.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8096,
      system: SYSTEM_PROMPT,
      tools: getAnthropicTools(),
      messages: anthropicHistory,
    });
    stopSpinner();
  }

  const finalContent = response.content;
  anthropicHistory.push({ role: "assistant", content: finalContent });
  for (const block of finalContent) {
    if (block.type === "text") console.log(`\n${block.text}`);
  }
  console.log(`\x1b[90m  --- 총 ${stepCount}단계 완료 ---\x1b[0m`);
}

// ─── 메인 루프 (작업 중 명령 전달 지원) ───
const rl = createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q: string): Promise<string> => new Promise((r) => rl.question(q, r));

let isRunning = false;
let aborted = false;
const pendingMessages: string[] = [];

// 작업 중 입력을 큐에 저장
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  if (isRunning) {
    if (trimmed === "stop") {
      aborted = true;
      console.log(`\n\x1b[31m  ⏹ 중단 요청됨 — 현재 단계 완료 후 중단합니다.\x1b[0m`);
    } else {
      pendingMessages.push(trimmed);
      console.log(`\x1b[90m  📋 대기열에 추가: "${trimmed}" (현재 작업 완료 후 실행)\x1b[0m`);
    }
  }
});

// abort 체크를 위한 래퍼
function checkAbort() {
  if (aborted) {
    aborted = false;
    throw new Error("사용자에 의해 중단됨");
  }
}

// runOpenAI / runAnthropic 에 abort 체크 삽입
const originalRunOpenAI = runOpenAI;
const wrappedRunOpenAI = async (msg: string) => {
  aborted = false;
  isRunning = true;
  try {
    // 기존 로직을 그대로 사용하되, abort를 전역으로 체크
    await originalRunOpenAI(msg);
  } finally {
    isRunning = false;
  }
};

const originalRunAnthropic = runAnthropic;
const wrappedRunAnthropic = async (msg: string) => {
  aborted = false;
  isRunning = true;
  try {
    await originalRunAnthropic(msg);
  } finally {
    isRunning = false;
  }
};

async function main() {
  console.log("===========================================");
  console.log("  로컬 AI 에이전트 (UI Automation + 비전)");
  console.log(`  프로바이더: ${provider.toUpperCase()}`);
  console.log("  파일, 셸, 웹, 화면제어 — 무엇이든 시키세요.");
  console.log("  종료: exit | 초기화: clear | 중단: stop");
  console.log("  작업 중에도 메시지 입력 가능 (대기열)");
  console.log("===========================================\n");

  while (true) {
    const input = await prompt("\x1b[32m> \x1b[0m");
    const trimmed = input.trim();

    if (!trimmed) continue;
    if (trimmed === "exit") { rl.close(); process.exit(0); }
    if (trimmed === "clear") {
      openaiHistory.length = 0;
      anthropicHistory.length = 0;
      stepCount = 0;
      pendingMessages.length = 0;
      console.log("대화 초기화 완료.\n");
      continue;
    }

    // 현재 메시지 실행
    try {
      if (provider === "openai") await wrappedRunOpenAI(trimmed);
      else await wrappedRunAnthropic(trimmed);
    } catch (err: any) {
      console.error(`\x1b[31m오류: ${err.message}\x1b[0m`);
    }
    console.log();

    // 대기열에 있는 메시지 순차 실행
    while (pendingMessages.length > 0) {
      const next = pendingMessages.shift()!;
      console.log(`\x1b[90m  📋 대기열 실행: "${next}"\x1b[0m`);
      try {
        if (provider === "openai") await wrappedRunOpenAI(next);
        else await wrappedRunAnthropic(next);
      } catch (err: any) {
        console.error(`\x1b[31m오류: ${err.message}\x1b[0m`);
      }
      console.log();
    }
  }
}

main();
