# Synapse Agent

로컬 Windows PC를 자율적으로 제어하는 AI 에이전트. 파일 조작, 셸 명령, 웹 검색, 브라우저 자동화, 데스크탑 마우스/키보드 제어, Windows UI Automation까지 지원합니다.

## 주요 기능

- **듀얼 프로바이더** - OpenAI(GPT-5.4) 또는 Anthropic(Claude) API 키에 따라 자동 전환
- **비전 지원** - 스크린샷을 LLM에 전달하여 화면을 보고 UI 요소를 인식
- **자율 추론** - 모르는 프로그램도 스스로 찾고, 막히면 대안을 시도
- **한글 안전 입력** - 클립보드 기반 붙여넣기로 한글/특수문자 정확 입력

## 도구 목록 (27개)

| 카테고리 | 도구 | 설명 |
|---------|------|------|
| **파일** | `read_file` | 파일 읽기 |
| | `write_file` | 파일 생성/쓰기 |
| | `list_directory` | 디렉토리 목록 |
| **셸** | `run_command` | cmd.exe 명령 실행 |
| **웹** | `web_search` | DuckDuckGo 검색 |
| | `web_fetch` | URL 텍스트 추출 |
| **브라우저** | `browser_navigate` | URL 이동 (Chrome 표시) |
| | `browser_click` | CSS 선택자 클릭 |
| | `browser_type` | 입력 필드 텍스트 입력 |
| | `browser_press_key` | 키 입력 (Enter, Tab 등) |
| | `browser_screenshot` | 브라우저 화면 캡처 |
| | `browser_get_text` | 페이지 텍스트 추출 |
| | `browser_scroll` | 상하좌우 스크롤 |
| | `browser_scroll_to` | 요소까지 스크롤 |
| | `browser_close` | 브라우저 닫기 |
| **데스크탑** | `mouse_click` | 좌표 클릭 |
| | `mouse_double_click` | 좌표 더블클릭 |
| | `keyboard_type` | 텍스트 타이핑 |
| | `keyboard_press` | 단축키 (ctrl+c 등) |
| | `desktop_screenshot` | 화면 캡처 (모니터 선택) |
| | `get_screen_info` | 모니터 정보 조회 |
| **UI Automation** | `ui_get_tree` | 활성 창 UI 요소 트리 |
| | `ui_click` | 이름/ID로 요소 클릭 |
| | `ui_type` | 이름/ID로 텍스트 입력 |
| | `ui_get_active_window` | 활성 창 정보 |
| **창 관리** | `list_windows` | 열린 창 목록 |
| | `focus_window` | 타이틀로 창 활성화 |
| **클립보드** | `clipboard_type` | 클립보드 붙여넣기 |
| | `clipboard_type_enter` | 붙여넣기 + Enter |

## 설치 및 실행

```bash
# 의존성 설치
npm install

# Playwright 브라우저 설치
npx playwright install chromium

# .env 파일 생성
cp .env.example .env
# OPENAI_API_KEY 또는 ANTHROPIC_API_KEY 입력

# 실행
npm run dev
```

## 사용 예시

```
> 현재 폴더에 어떤 파일이 있어?
> 네이버에서 오늘 날씨 검색해줘
> VAZIL Works 앱 실행해서 채팅창에 안녕하세요 입력해줘
> VSCode에서 synapse-ai 프로젝트의 Claude Code에 빌드오류검증테스트 입력해줘
> 크롬 열어서 GitHub 로그인 페이지로 이동해줘
```

## 명령어

| 명령 | 설명 |
|------|------|
| `exit` | 에이전트 종료 |
| `clear` | 대화 기록 초기화 |
| `stop` | 진행 중인 작업 중단 |
| 작업 중 텍스트 입력 | 대기열에 추가, 현재 작업 완료 후 실행 |

## 구조

```
src/
├── index.ts          # 에이전트 루프, 시스템 프롬프트, 스피너
├── tools.ts          # 도구 정의 (OpenAI/Anthropic 형식 변환)
├── executor.ts       # 도구 실행 라우터
├── browser.ts        # Playwright 브라우저 자동화
├── desktop.ts        # nut.js 마우스/키보드 + 스크린샷
└── uiautomation.ts   # Windows UI Automation + 창 관리 + 클립보드
```

## 요구사항

- Node.js 18+
- Windows 10/11
- OpenAI API 키 또는 Anthropic API 키
