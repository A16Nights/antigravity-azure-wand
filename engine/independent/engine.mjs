import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SIDECAR = path.join(__dirname, "sidecar.ps1");
const DEFAULT_ASSETS = path.join(__dirname, "assets", "cursors");

export const CURSOR_STATES = Object.freeze([
  { id: "pointer", name: "指针", desc: "默认 / 移动 / 普通点击" },
  { id: "link", name: "链接", desc: "点到可点的按钮或链接" },
  { id: "text", name: "文本", desc: "输入文字 / 按键" },
  { id: "vert", name: "上下", desc: "上下滚动 / 竖向拖拽" },
  { id: "horz", name: "左右", desc: "左右滚动 / 横向拖拽" },
  { id: "move", name: "移动", desc: "拖动元素或窗口" },
  { id: "dgn1", name: "斜向 1", desc: "斜向拖拽（正斜率）" },
  { id: "dgn2", name: "斜向 2", desc: "斜向拖拽（负斜率）" },
  { id: "cross", name: "十字", desc: "精确坐标定位" },
  { id: "unavailiable", name: "禁止", desc: "暂停 / 主人接管" },
  { id: "help", name: "帮助", desc: "未命中 / 需要确认" },
  { id: "work", name: "工作", desc: "执行中（预留）" },
  { id: "busy", name: "忙碌", desc: "等待中（预留）" },
  { id: "handwriting", name: "手写", desc: "手写绘制（预留）" },
  { id: "alternate", name: "备用", desc: "兜底状态" }
]);

export const CURSOR_STATE_IDS = Object.freeze(CURSOR_STATES.map((s) => s.id));

function clampSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 64;
  return Math.max(24, Math.min(192, Math.round(n)));
}

function clampStyle(value) {
  const s = String(value || "").trim().toLowerCase();
  return CURSOR_STATE_IDS.includes(s) ? s : "pointer";
}

function resolvePowerShell() {
  const explicit = process.env.AZURE_WAND_POWERSHELL || process.env.WINDOWS_CU_POWERSHELL;
  if (explicit) return explicit;
  const system = path.join(
    process.env.SystemRoot || "C:\\Windows",
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe"
  );
  return existsSync(system) ? system : "powershell.exe";
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class IndependentInputEngine {
  constructor({
    log = () => {},
    cursorMode = "companion",
    cursorHoldMs = 2600,
    cursorSize = 64,
    cursorState = "pointer",
    assetDir = DEFAULT_ASSETS,
    stateOverrides = {}
  } = {}) {
    this.log = log;
    this.cursorMode = ["clean", "avoidance"].includes(cursorMode) ? cursorMode : "companion";
    this.cursorHoldMs = Number(cursorHoldMs) > 0 ? Number(cursorHoldMs) : 2600;
    this.cursorSize = clampSize(cursorSize);
    this.cursorState = clampStyle(cursorState);
    this.assetDir = assetDir && existsSync(assetDir) ? assetDir : DEFAULT_ASSETS;
    this.stateOverrides = stateOverrides && typeof stateOverrides === "object" ? { ...stateOverrides } : {};
    this.proc = null;
    this.ready = false;
    this.starting = null;
    this.seq = 0;
    this.pending = new Map();
    this.buf = "";
    this.stderr = "";
    this.stopping = false;
  }

  async setCursorMode(mode, holdMs) {
    if (["clean", "companion", "avoidance"].includes(mode)) this.cursorMode = mode;
    if (Number(holdMs) > 0) this.cursorHoldMs = Math.max(400, Math.min(15000, Math.round(Number(holdMs))));
    if (this.ready && this.proc && this.proc.exitCode === null) {
      return this.request("setCursorMode", { mode: this.cursorMode, holdMs: this.cursorHoldMs });
    }
    return { ok: true, cursorMode: this.cursorMode, cursorHoldMs: this.cursorHoldMs, pending: true };
  }

  async setCursorSize(size) {
    this.cursorSize = clampSize(size);
    if (this.ready && this.proc && this.proc.exitCode === null) {
      return this.request("setCursorSize", { size: this.cursorSize });
    }
    return { ok: true, cursorSize: this.cursorSize, pending: true };
  }

  async setCursorState(state) {
    this.cursorState = clampStyle(state);
    if (this.ready && this.proc && this.proc.exitCode === null) {
      return this.request("setCursorStyle", { style: this.cursorState });
    }
    return { ok: true, cursorState: this.cursorState, pending: true };
  }

  async setAssetDir(dir, stateOverrides = null) {
    const resolved = dir && existsSync(dir) ? dir : DEFAULT_ASSETS;
    this.assetDir = resolved;
    if (stateOverrides && typeof stateOverrides === "object") {
      this.stateOverrides = { ...stateOverrides };
    }
    if (this.ready && this.proc && this.proc.exitCode === null) {
      return this.request("setAssetDir", { dir: resolved, overrides: this.stateOverrides });
    }
    return { ok: true, dir: resolved, pending: true };
  }

  async ensure() {
    if (this.ready && this.proc && this.proc.exitCode === null) return;
    if (this.starting) return this.starting;
    this.starting = this.start().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  async start() {
    this.stopping = false;
    this.stopProcess();
    this.ready = false;
    this.buf = "";
    this.stderr = "";

    const ps = resolvePowerShell();
    const proc = spawn(
      ps,
      ["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-File", SIDECAR],
      {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          AZURE_WAND_CURSOR_MODE: this.cursorMode,
          AZURE_WAND_CURSOR_HOLD_MS: String(this.cursorHoldMs),
          AZURE_WAND_CURSOR_SIZE: String(this.cursorSize),
          AZURE_WAND_CURSOR_STYLE: this.cursorState,
          AZURE_WAND_CURSOR_DIR: this.assetDir,
          AZURE_WAND_CURSOR_OVERRIDES: JSON.stringify(this.stateOverrides || {})
        }
      }
    );
    this.proc = proc;

    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk) => this.onData(chunk));
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk).slice(-8000);
      this.log(`[independent-sidecar] ${chunk.trim()}`);
    });
    proc.on("error", (err) => this.failAll(new Error(`独立输入引擎启动失败: ${err.message}`)));
    proc.on("exit", (code, signal) => {
      this.ready = false;
      this.proc = null;
      const detail = this.stderr ? `\n${this.stderr.slice(-1200)}` : "";
      this.failAll(new Error(`独立输入引擎退出 (code=${code} signal=${signal})${detail}`));
    });

    const started = Date.now();
    while (true) {
      if (this.ready) return;
      if (!this.proc || this.proc.exitCode !== null) {
        throw new Error(`独立输入引擎未能启动: ${this.stderr.slice(-1500) || "进程已退出"}`);
      }
      if (Date.now() - started > 30000) {
        this.stopProcess();
        throw new Error(`独立输入引擎启动超时: ${this.stderr.slice(-1500) || "未收到 ready"}`);
      }
      await sleep(80);
    }
  }

  onData(chunk) {
    this.buf += chunk;
    let index;
    while ((index = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, index).trim();
      this.buf = this.buf.slice(index + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.event === "ready") {
        this.ready = true;
        continue;
      }
      const pending = this.pending.get(msg.id);
      if (!pending) continue;
      this.pending.delete(msg.id);
      clearTimeout(pending.timer);
      if (msg.ok) {
        const state = msg.result?.cursorState;
        if (typeof state === "string" && state) this.cursorState = state;
        pending.resolve(msg.result);
      } else {
        pending.reject(new Error(msg.error || "独立输入引擎返回错误"));
      }
    }
  }

  failAll(err) {
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pending.clear();
  }

  async request(cmd, args = {}, timeoutMs = 30000) {
    await this.ensure();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`独立输入引擎超时: ${cmd}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.proc.stdin.write(`${JSON.stringify({ id, cmd, ...args })}\n`);
      } catch (err) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  stopProcess() {
    const proc = this.proc;
    this.proc = null;
    this.ready = false;
    if (!proc) return;
    try { proc.kill(); } catch {}
  }

  async shutdown() {
    this.stopping = true;
    if (this.ready && this.proc && this.proc.exitCode === null) {
      try {
        await this.request("shutdown", {}, 3000);
      } catch {}
    }
    this.stopProcess();
  }
}
