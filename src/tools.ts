import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";

// 도구 목록 (공통 정의)
const tools = [
  {
    name: "read_file",
    description: "파일의 내용을 읽습니다.",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "읽을 파일의 절대 또는 상대 경로" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "파일에 내용을 씁니다. 파일이 없으면 생성하고, 있으면 덮어씁니다.",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "쓸 파일의 절대 또는 상대 경로" },
        content: { type: "string", description: "파일에 쓸 내용" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_directory",
    description: "디렉토리의 파일과 폴더 목록을 반환합니다.",
    parameters: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "목록을 볼 디렉토리 경로 (기본: 현재 디렉토리)" },
      },
      required: [],
    },
  },
  {
    name: "run_command",
    description: "셸 명령어를 실행합니다. 프로그램 설치, 빌드, git 등 모든 터미널 작업이 가능합니다.",
    parameters: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "실행할 셸 명령어" },
        cwd: { type: "string", description: "작업 디렉토리 (선택)" },
      },
      required: ["command"],
    },
  },
  {
    name: "web_search",
    description: "인터넷에서 정보를 검색합니다.",
    parameters: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "검색할 질문 또는 키워드" },
      },
      required: ["query"],
    },
  },
  {
    name: "web_fetch",
    description: "URL에서 웹페이지 내용을 가져옵니다.",
    parameters: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "가져올 웹페이지 URL" },
      },
      required: ["url"],
    },
  },
  // ─── 브라우저 자동화 ───
  {
    name: "browser_navigate",
    description: "브라우저를 열고 URL로 이동합니다. 실제 Chrome 브라우저가 화면에 표시됩니다.",
    parameters: {
      type: "object" as const,
      properties: {
        url: { type: "string", description: "이동할 URL" },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_click",
    description: "브라우저 페이지에서 CSS 선택자로 요소를 클릭합니다.",
    parameters: {
      type: "object" as const,
      properties: {
        selector: { type: "string", description: "클릭할 요소의 CSS 선택자 (예: button, #id, .class, a[href])" },
      },
      required: ["selector"],
    },
  },
  {
    name: "browser_type",
    description: "브라우저 페이지의 입력 필드에 텍스트를 입력합니다.",
    parameters: {
      type: "object" as const,
      properties: {
        selector: { type: "string", description: "입력할 요소의 CSS 선택자" },
        text: { type: "string", description: "입력할 텍스트" },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "browser_screenshot",
    description: "현재 브라우저 화면을 스크린샷으로 저장합니다.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "browser_get_text",
    description: "현재 브라우저 페이지의 텍스트 내용을 추출합니다.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "browser_press_key",
    description: "브라우저에서 키를 누릅니다. 검색창에서 Enter, 페이지에서 Escape 등. Playwright 키 이름 사용 (Enter, Tab, Escape, ArrowDown 등).",
    parameters: {
      type: "object" as const,
      properties: {
        key: { type: "string", description: "누를 키 (예: Enter, Tab, Escape, ArrowDown)" },
      },
      required: ["key"],
    },
  },
  {
    name: "browser_scroll",
    description: "브라우저 페이지를 스크롤합니다. 현재 스크롤 위치도 반환합니다.",
    parameters: {
      type: "object" as const,
      properties: {
        direction: { type: "string", description: "방향: up, down, left, right (기본: down)" },
        amount: { type: "number", description: "스크롤량 픽셀 (기본: 500). 한 페이지분은 약 800." },
      },
      required: [],
    },
  },
  {
    name: "browser_scroll_to",
    description: "CSS 선택자로 지정한 요소가 보이도록 스크롤합니다.",
    parameters: {
      type: "object" as const,
      properties: {
        selector: { type: "string", description: "스크롤할 대상 CSS 선택자" },
      },
      required: ["selector"],
    },
  },
  {
    name: "browser_close",
    description: "열려 있는 브라우저를 닫습니다.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ─── 데스크탑 제어 ───
  {
    name: "mouse_click",
    description: "화면의 지정된 좌표를 마우스로 클릭합니다.",
    parameters: {
      type: "object" as const,
      properties: {
        x: { type: "number", description: "X 좌표 (픽셀)" },
        y: { type: "number", description: "Y 좌표 (픽셀)" },
        button: { type: "string", description: "마우스 버튼: left 또는 right (기본: left)" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "mouse_double_click",
    description: "화면의 지정된 좌표를 더블클릭합니다.",
    parameters: {
      type: "object" as const,
      properties: {
        x: { type: "number", description: "X 좌표" },
        y: { type: "number", description: "Y 좌표" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "keyboard_type",
    description: "키보드로 텍스트를 타이핑합니다 (현재 포커스된 곳에 입력).",
    parameters: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "타이핑할 텍스트" },
      },
      required: ["text"],
    },
  },
  {
    name: "keyboard_press",
    description: "키보드 단축키를 누릅니다. 예: ctrl+c, alt+tab, enter, f5",
    parameters: {
      type: "object" as const,
      properties: {
        keys: { type: "string", description: "키 조합 (예: ctrl+c, alt+tab, enter)" },
      },
      required: ["keys"],
    },
  },
  {
    name: "desktop_screenshot",
    description: "데스크탑 화면을 스크린샷으로 캡처합니다. 듀얼 모니터인 경우 모니터 번호를 지정할 수 있습니다. 캡처된 이미지는 LLM에 전달되어 화면을 볼 수 있습니다. 모니터 좌표 정보도 함께 반환됩니다.",
    parameters: {
      type: "object" as const,
      properties: {
        monitor: { type: "string", description: "캡처할 모니터 번호 (0, 1, ...). 생략하면 주 모니터 캡처" },
      },
      required: [],
    },
  },
  {
    name: "get_screen_info",
    description: "모든 모니터의 해상도, 위치, 마우스 현재 좌표를 반환합니다.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ─── Windows UI Automation (네이티브 앱 제어 핵심) ───
  {
    name: "ui_get_tree",
    description: "현재 활성 창의 UI 요소 트리를 반환합니다. 버튼, 입력창, 메뉴 등 모든 UI 요소의 이름, 타입, 좌표, ID를 볼 수 있습니다. 네이티브 앱 조작 시 반드시 이것을 먼저 호출하세요. 스크린샷보다 정확합니다.",
    parameters: {
      type: "object" as const,
      properties: {
        max_depth: { type: "number", description: "탐색 깊이 (기본: 3, 최대: 6). 요소를 못 찾으면 깊이를 늘려보세요." },
      },
      required: [],
    },
  },
  {
    name: "ui_click",
    description: "UI 요소를 이름 또는 AutomationId로 찾아서 클릭합니다. ui_get_tree에서 확인한 name이나 id 값을 사용하세요.",
    parameters: {
      type: "object" as const,
      properties: {
        search: { type: "string", description: "찾을 요소의 이름 또는 AutomationId (부분 일치)" },
        element_type: { type: "string", description: "요소 타입 필터 (예: Button, Edit, MenuItem). 선택사항." },
      },
      required: ["search"],
    },
  },
  {
    name: "ui_type",
    description: "UI 입력 필드를 이름 또는 AutomationId로 찾아서 텍스트를 입력합니다.",
    parameters: {
      type: "object" as const,
      properties: {
        search: { type: "string", description: "찾을 입력 필드의 이름 또는 AutomationId (부분 일치)" },
        text: { type: "string", description: "입력할 텍스트" },
      },
      required: ["search", "text"],
    },
  },
  {
    name: "ui_get_active_window",
    description: "현재 활성 창의 이름, 클래스, 위치, 크기, 포커스된 요소 정보를 반환합니다.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  // ─── 창 관리 & 클립보드 입력 ───
  {
    name: "list_windows",
    description: "현재 열려있는 모든 창의 목록을 반환합니다 (hwnd, 프로세스명, 타이틀). 특정 앱을 찾을 때 사용하세요.",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "focus_window",
    description: "타이틀에 검색어가 포함된 창을 찾아서 포커스(활성화)합니다. VS Code, 메모장 등 특정 창을 전면으로 가져올 때 사용.",
    parameters: {
      type: "object" as const,
      properties: {
        search: { type: "string", description: "창 타이틀 검색어 (부분 일치). 예: 'synapse-ai', 'Chrome', '메모장'" },
      },
      required: ["search"],
    },
  },
  {
    name: "clipboard_type",
    description: "클립보드를 통해 현재 포커스된 곳에 텍스트를 붙여넣습니다. 한글, 특수문자, 긴 텍스트도 정확하게 입력됩니다. keyboard_type보다 안정적입니다.",
    parameters: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "입력할 텍스트" },
      },
      required: ["text"],
    },
  },
  {
    name: "clipboard_type_enter",
    description: "클립보드를 통해 텍스트를 붙여넣고 Enter를 누릅니다. 채팅창, 터미널, 명령 입력 등에서 사용.",
    parameters: {
      type: "object" as const,
      properties: {
        text: { type: "string", description: "입력 후 Enter할 텍스트" },
      },
      required: ["text"],
    },
  },
];

// Anthropic 형식
export function getAnthropicTools(): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

// OpenAI 형식
export function getOpenAITools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
