#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { WandStore } from "./lib/wand-store.mjs";
import { IndependentInputEngine, CURSOR_STATE_IDS } from "./engine/independent/engine.mjs";

const store = new WandStore();
store.ensureInitialized();

let engine = null;
let lastSyncKey = "";

function getEngine(cfg) {
  const assetDir = store.resolveCursorAssetsDir(cfg);
  const syncKey = JSON.stringify([
    cfg.independentCursorMode,
    cfg.independentCursorHoldMs,
    cfg.independentCursorSize,
    assetDir
  ]);
  if (!engine) {
    engine = new IndependentInputEngine({
      cursorMode: cfg.independentCursorMode,
      cursorHoldMs: cfg.independentCursorHoldMs,
      cursorSize: cfg.independentCursorSize,
      assetDir
    });
    lastSyncKey = syncKey;
    return { engine, needSync: false, assetDir };
  }
  const needSync = syncKey !== lastSyncKey;
  lastSyncKey = syncKey;
  return { engine, needSync, assetDir };
}

async function syncEngineConfig(inst, cfg, assetDir) {
  await inst.setCursorMode(cfg.independentCursorMode, cfg.independentCursorHoldMs);
  await inst.setCursorSize(cfg.independentCursorSize);
  await inst.setAssetDir(assetDir);
}

const TOOL_DEF = {
  name: "independent_input",
  description:
    "苍蓝魔杖 · 独立输入与 15 状态 AI 光标：默认严格通过目标窗口 hwnd 的 UIA / 窗口消息操作，绝不移动用户的真实鼠标、绝不抢键盘焦点，同时在屏幕上展示独立的动态 AI 光标（支持陪伴/整洁模式与 15 状态自动切换）。\n" +
    "用法顺序：\n" +
    "1. 先 action:'status' 检查是否暂停（Ctrl+Alt+Q 随时暂停/恢复），若 paused 则停手等用户说继续再 resume。\n" +
    "2. 先 action:'windows' 获取目标窗口 hwnd，必要时 action:'capture' 截图看坐标。\n" +
    "3. 执行 click / type / key / scroll / drag 时必须传入目标窗口 hwnd，strict 禁止动用真实鼠标与抢焦点。\n" +
    "4. 可用 action:'move' / 'overlay' 控制 AI 光标位置、显示模式（companion/clean）和大小（24-192px）。\n" +
    "受苍蓝魔杖侧栏「独立输入 · AI 光标」总开关控制：总开关关闭时拒绝执行任何操作。",
  inputSchema: {
    type: "object",
    required: ["action"],
    properties: {
      action: {
        type: "string",
        enum: ["status", "windows", "capture", "click", "type", "key", "scroll", "drag", "move", "pause", "resume", "overlay"],
        description: "要执行的独立输入动作"
      },
      hwnd: { type: "integer", description: "目标顶层窗口句柄（click/type/key/scroll/drag 必填，先通过 windows 获取）" },
      x: { type: "number", description: "屏幕 X 坐标" },
      y: { type: "number", description: "屏幕 Y 坐标" },
      fromX: { type: "number", description: "拖拽起点 X" },
      fromY: { type: "number", description: "拖拽起点 Y" },
      toX: { type: "number", description: "拖拽终点 X" },
      toY: { type: "number", description: "拖拽终点 Y" },
      button: { type: "string", enum: ["left", "right", "middle"], description: "点击按键" },
      double: { type: "boolean", description: "是否双击" },
      text: { type: "string", description: "要输入的文本（action:'type'）" },
      replace: { type: "boolean", description: "是否覆盖原内容（action:'type'）" },
      keys: { type: "string", description: "按键或组合键（action:'key'，例如 ctrl+c、enter）" },
      delta: { type: "integer", description: "滚动增量（正数向上，负数向下）" },
      horizontal: { type: "boolean", description: "是否横向滚动" },
      mode: { type: "string", enum: ["auto", "uia", "message"], description: "投递通道（默认 auto：UIA 优先，回退窗口消息；strict 禁用物理鼠标）" },
      show: { type: "boolean", description: "action:'overlay' 时显示或隐藏 AI 光标" },
      cursorMode: { type: "string", enum: ["companion", "clean"], description: "AI 光标模式：companion 陪伴常显 / clean 整洁自动收起" },
      cursorHoldMs: { type: "integer", minimum: 400, maximum: 15000, description: "clean 模式下动作后停留毫秒" },
      cursorSize: { type: "integer", minimum: 24, maximum: 192, description: "AI 光标大小（24-192px）" },
      cursorState: { type: "string", enum: [...CURSOR_STATE_IDS], description: "可选测试用光标状态（正常会自动切换）" },
      scope: { type: "string", enum: ["foreground", "full", "rect"], description: "截图范围（action:'capture'）" },
      rect: {
        type: "object",
        properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } }
      }
    }
  }
};

function formatResult(action, r) {
  if (!r || typeof r !== "object") return `已完成 ${action}`;
  if (r.paused) return `⚠ 独立输入已暂停（${r.reason || "用户接管"}），动作未执行。请等待用户确认继续后调用 action:"resume"。`;
  if (r.ok === false) {
    return [`未完成 (${r.reason || "未知原因"})`, r.note || "", "已严格禁止真实鼠标与抢焦点。"].filter(Boolean).join("\n");
  }
  if (action === "status") {
    const mode = r.cursorMode === "clean"
      ? `整洁模式 (${r.cursorHoldMs || 2600}ms 收起, ${r.cursorSize || 64}px, 状态:${r.cursorState || "pointer"})`
      : `陪伴模式 (常显, ${r.cursorSize || 64}px, 状态:${r.cursorState || "pointer"})`;
    return [
      `独立输入状态: ${r.paused ? "已暂停" : "运行中"} (热键: ${r.hotkey || "Ctrl+Alt+Q"})`,
      `AI 光标: ${r.overlay ? "显示中" : "已隐藏"} · ${mode}`,
      `真实光标: ${r.cursor ? `(${r.cursor.x}, ${r.cursor.y})` : "未知"}`,
      `前台窗口: ${r.foreground?.title || r.foreground?.className || "未知"}`
    ].join("\n");
  }
  if (action === "windows") {
    const list = Array.isArray(r.windows) ? r.windows : [];
    if (!list.length) return "未发现可见顶层窗口。";
    return list
      .slice(0, 30)
      .map((w) => `hwnd ${w.hwnd} · ${w.title} · ${w.rect ? `${w.rect.x},${w.rect.y} ${w.rect.w}x${w.rect.h}` : "?"} · ${w.process || ""}${w.foreground ? " ★前台" : ""}`)
      .join("\n");
  }
  return JSON.stringify(r, null, 2);
}

async function handleToolCall(args = {}) {
  const cfg = store.readConfig();
  const action = String(args.action || "").trim();
  if (!cfg.independentInputEnabled && action !== "status") {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: "独立输入总开关当前已关闭。请在「苍蓝魔杖 → 独立输入 · AI 光标」面板中开启总开关后再执行操作。"
        }
      ]
    };
  }
  if (process.platform !== "win32") {
    return { isError: true, content: [{ type: "text", text: "独立输入仅支持 Windows 平台。" }] };
  }

  const { engine: inst, needSync, assetDir } = getEngine(cfg);
  if (needSync && inst.ready) {
    await syncEngineConfig(inst, cfg, assetDir);
  }

  const reqMode = ["auto", "uia", "message"].includes(args.mode) ? args.mode : "auto";
  const requireHwnd = () => {
    const h = Number(args.hwnd);
    if (!Number.isFinite(h) || h <= 0) {
      throw new Error("为严格保护真实鼠标与键盘焦点，click/type/key/scroll/drag 必须指定目标窗口 hwnd（请先调用 action:'windows' 获取）。");
    }
    return Math.round(h);
  };

  let res;
  if (action === "status") {
    res = await inst.request("status");
  } else if (action === "windows") {
    res = await inst.request("windows");
  } else if (action === "pause") {
    res = await inst.request("pause", { reason: "agent" });
  } else if (action === "resume") {
    res = await inst.request("resume");
  } else if (action === "move") {
    res = await inst.request("move", { x: Math.round(Number(args.x || 0)), y: Math.round(Number(args.y || 0)) });
  } else if (action === "overlay") {
    if (args.cursorMode || args.cursorHoldMs) {
      await inst.setCursorMode(args.cursorMode || cfg.independentCursorMode, args.cursorHoldMs || cfg.independentCursorHoldMs);
    }
    if (args.cursorSize) {
      await inst.setCursorSize(args.cursorSize);
    }
    if (args.cursorState) {
      await inst.setCursorState(args.cursorState);
    }
    res = await inst.request("overlay", {
      show: args.show !== false,
      x: Number.isFinite(Number(args.x)) ? Math.round(Number(args.x)) : undefined,
      y: Number.isFinite(Number(args.y)) ? Math.round(Number(args.y)) : undefined
    });
  } else if (action === "capture") {
    const shotsDir = path.join(store.dataDir, "shots");
    fs.mkdirSync(shotsDir, { recursive: true });
    const file = path.join(shotsDir, `shot-${Date.now()}.png`);
    res = await inst.request("capture", {
      path: file,
      scope: args.scope || "foreground",
      hwnd: Number.isFinite(Number(args.hwnd)) ? Math.round(Number(args.hwnd)) : undefined,
      rect: args.rect || undefined
    });
    const content = [{ type: "text", text: `截图已保存: ${file}` }];
    if (fs.existsSync(file)) {
      content.push({ type: "image", data: fs.readFileSync(file).toString("base64"), mimeType: "image/png" });
    }
    return { content };
  } else if (action === "click") {
    res = await inst.request("click", {
      hwnd: requireHwnd(),
      x: Math.round(Number(args.x || 0)),
      y: Math.round(Number(args.y || 0)),
      button: args.button || "left",
      double: Boolean(args.double),
      mode: reqMode
    });
  } else if (action === "type") {
    res = await inst.request("type", {
      hwnd: requireHwnd(),
      x: Number.isFinite(Number(args.x)) ? Math.round(Number(args.x)) : undefined,
      y: Number.isFinite(Number(args.y)) ? Math.round(Number(args.y)) : undefined,
      text: String(args.text || ""),
      replace: Boolean(args.replace),
      mode: reqMode
    });
  } else if (action === "key") {
    res = await inst.request("key", {
      hwnd: requireHwnd(),
      keys: String(args.keys || ""),
      mode: reqMode
    });
  } else if (action === "scroll") {
    res = await inst.request("scroll", {
      hwnd: requireHwnd(),
      x: Math.round(Number(args.x || 0)),
      y: Math.round(Number(args.y || 0)),
      delta: Number.isFinite(Number(args.delta)) ? Math.round(Number(args.delta)) : -3,
      horizontal: Boolean(args.horizontal),
      mode: reqMode
    });
  } else if (action === "drag") {
    res = await inst.request("drag", {
      hwnd: requireHwnd(),
      fromX: Math.round(Number(args.fromX ?? args.x ?? 0)),
      fromY: Math.round(Number(args.fromY ?? args.y ?? 0)),
      toX: Math.round(Number(args.toX || 0)),
      toY: Math.round(Number(args.toY || 0)),
      mode: reqMode
    });
  } else {
    throw new Error(`未知 action: ${action}`);
  }

  return { content: [{ type: "text", text: formatResult(action, res) }] };
}

// Lightweight JSON-RPC 2.0 stdio MCP server
let buf = "";
function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", async (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let req;
    try {
      req = JSON.parse(line);
    } catch {
      continue;
    }
    const { id, method, params } = req;
    try {
      if (method === "initialize") {
        send({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: params?.protocolVersion || "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "azure-wand-independent", version: "1.1.0" }
          }
        });
      } else if (method === "notifications/initialized") {
        // no-op
      } else if (method === "tools/list") {
        send({ jsonrpc: "2.0", id, result: { tools: [TOOL_DEF] } });
      } else if (method === "tools/call") {
        if (params?.name !== "independent_input") {
          send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${params?.name}` } });
        } else {
          const result = await handleToolCall(params?.arguments || {});
          send({ jsonrpc: "2.0", id, result });
        }
      } else if (id !== undefined) {
        send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } });
      }
    } catch (err) {
      if (id !== undefined) {
        send({
          jsonrpc: "2.0",
          id,
          result: { isError: true, content: [{ type: "text", text: `独立输入执行出错: ${err.message}` }] }
        });
      }
    }
  }
});

process.on("SIGINT", async () => {
  if (engine) await engine.shutdown().catch(() => {});
  process.exit(0);
});
process.on("SIGTERM", async () => {
  if (engine) await engine.shutdown().catch(() => {});
  process.exit(0);
});
