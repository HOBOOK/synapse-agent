import { chromium, type Browser, type Page } from "playwright";
import { writeFileSync } from "fs";

let browser: Browser | null = null;
let page: Page | null = null;

async function ensureBrowser(): Promise<Page> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: false, channel: "chrome" });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();
  }
  if (!page || page.isClosed()) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await ctx.newPage();
  }
  return page;
}

export async function browserNavigate(url: string): Promise<string> {
  try {
    const p = await ensureBrowser();
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    const title = await p.title();
    return `페이지 로드 완료: "${title}" (${p.url()})`;
  } catch (e: any) {
    return `탐색 오류: ${e.message}`;
  }
}

export async function browserClick(selector: string): Promise<string> {
  try {
    const p = await ensureBrowser();
    await p.click(selector, { timeout: 5000 });
    await p.waitForTimeout(500);
    return `클릭 완료: ${selector} → 현재 URL: ${p.url()}`;
  } catch (e: any) {
    return `클릭 오류: ${e.message}`;
  }
}

export async function browserType(selector: string, text: string): Promise<string> {
  try {
    const p = await ensureBrowser();
    await p.fill(selector, text, { timeout: 5000 });
    return `입력 완료: "${text}" → ${selector}`;
  } catch (e: any) {
    return `입력 오류: ${e.message}`;
  }
}

export async function browserScreenshot(): Promise<string> {
  try {
    const p = await ensureBrowser();
    const buffer = await p.screenshot({ fullPage: false });
    writeFileSync("screenshot.png", buffer);
    // desktop.ts의 lastScreenshot에 저장하여 LLM에 전달
    const { setLastScreenshot } = await import("./desktop.js");
    setLastScreenshot(buffer.toString("base64"));
    return `[브라우저 스크린샷 캡처 완료 - 이미지가 LLM에 전달됩니다] (${p.url()})`;
  } catch (e: any) {
    return `스크린샷 오류: ${e.message}`;
  }
}

export async function browserGetText(): Promise<string> {
  try {
    const p = await ensureBrowser();
    const text = await p.innerText("body");
    return text.replace(/\s+/g, " ").trim().slice(0, 5000) || "(내용 없음)";
  } catch (e: any) {
    return `텍스트 추출 오류: ${e.message}`;
  }
}

export async function browserPressKey(key: string): Promise<string> {
  try {
    const p = await ensureBrowser();
    await p.keyboard.press(key);
    await p.waitForTimeout(500);
    return `키 입력 완료: ${key} → 현재 URL: ${p.url()}`;
  } catch (e: any) {
    return `키 입력 오류: ${e.message}`;
  }
}

export async function browserScroll(direction: string = "down", amount: number = 500): Promise<string> {
  try {
    const p = await ensureBrowser();
    const dy = direction === "up" ? -amount : direction === "down" ? amount : 0;
    const dx = direction === "left" ? -amount : direction === "right" ? amount : 0;
    await p.evaluate(([x, y]) => window.scrollBy(x, y), [dx, dy]);
    const pos = await p.evaluate(() => ({ x: window.scrollX, y: window.scrollY, maxY: document.body.scrollHeight - window.innerHeight }));
    return `스크롤 ${direction} ${amount}px 완료 → 현재 위치: ${Math.round(pos.y)}/${Math.round(pos.maxY)}px`;
  } catch (e: any) {
    return `스크롤 오류: ${e.message}`;
  }
}

export async function browserScrollTo(selector: string): Promise<string> {
  try {
    const p = await ensureBrowser();
    await p.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, selector);
    return `요소로 스크롤 완료: ${selector}`;
  } catch (e: any) {
    return `스크롤 오류: ${e.message}`;
  }
}

export async function browserClose(): Promise<string> {
  try {
    if (browser) { await browser.close(); browser = null; page = null; }
    return "브라우저 종료 완료";
  } catch (e: any) {
    return `종료 오류: ${e.message}`;
  }
}
