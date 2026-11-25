import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_SETTINGS,
  TOOL_NAMES,
  LITE_TOOL_NAMES,
  normalizeSettings,
  repairStaleSettings,
  BROWSER_APPS
} from "../engine/mcp/settings.mjs";
import { TOOL_CATALOG } from "../engine/mcp/catalog.mjs";
import { TakeoverControl, previewProgress } from "../engine/mcp/takeover.mjs";
import { IndependentInputEngine, CURSOR_STATES, CURSOR_STATE_IDS } from "../engine/independent/engine.mjs";
import { importCursorPack } from "./cursor-importer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = path.resolve(__dirname, "..");
export const ENGINE_ROOT = path.join(PLUGIN_ROOT, "engine");
export const BUILTIN_CURSOR_ASSETS = path.join(ENGINE_ROOT, "independent", "assets");

export const DEFAULT_DATA_DIR =
  process.env.AZURE_WAND_DATA_DIR || path.join(os.homedir(), ".gemini", "azure-wand");

export const OVERLAY_THEMES = Object.freeze([
  { id: "azure", name: "苍蓝深海玻璃", badge: "推荐", accent: "#38bdf8", accent2: "#6366f1", bg: "#0e182c", desc: "深海苍蓝渐变底 + 顶部星光流光条 + 亮蓝步骤高亮" },
  { id: "abyss", name: "极夜星海", badge: "深邃", accent: "#818cf8", accent2: "#38bdf8", bg: "#0a0f1d", desc: "更低亮度极夜靛黑底，夜间写代码/挂游戏不晃眼" },
  { id: "lavender", name: "紫晶幻梦", badge: "镜华风", accent: "#c084fc", accent2: "#fbbf24", bg: "#18122c", desc: "紫→蓝→金渐变流光与星光圆点，灵动柔和" },
  { id: "frost", name: "浅雾琉璃", badge: "浅色", accent: "#0284c7", accent2: "#6366f1", bg: "#eaf3ff", desc: "明亮清透浅色琉璃卡片，适合白天与浅色桌面" }
]);

export const CURSOR_TAG_TEMPLATES = Object.freeze([
  "苍蓝魔杖",
  "星芒助手",
  "WAND",
  "Azure",
  "星芒"
]);

export const WAND_EXTRA_DEFAULTS = Object.freeze({
  imageMode: "default",
  allowedLaunchPrograms: [],
  allowLaunchArguments: false,
  batchBudgetMs: 30000,
  uiLocale: "zh",
  // Independent Input + 15-state AI Cursor
  independentInputEnabled: true,
  independentCursorMode: "companion",
  independentCursorHoldMs: 2600,
  independentCursorSize: 64,
  independentCursorPack: "builtin",
  independentCustomCursorDir: "",
  independentStatePacks: {}
});

export const TOOL_META = Object.freeze([
  { name: "health", group: "observe", label: "引擎健康自检", desc: "检查 PowerShell UIA、OCR、DPI 与桌面权限状态" },
  { name: "list_windows", group: "windows", label: "列出桌面窗口", desc: "枚举当前桌面和浏览器的所有可见窗口及句柄" },
  { name: "snapshot", group: "observe", label: "界面结构快照", desc: "以结构化方式读取窗口或网页的完整交互控件树" },
  { name: "accessibility_tree", group: "observe", label: "深层控件树", desc: "读取 UIA 底层辅助功能树（适合复杂原生软件）" },
  { name: "find", group: "observe", label: "定位按钮与文本", desc: "按文字、角色或属性精准查找目标控件（支持 OCR 回退）" },
  { name: "element_info", group: "observe", label: "查看控件详情", desc: "读取单个控件的位置、状态、值与支持的交互模式" },
  { name: "ocr", group: "observe", label: "屏幕文字识别", desc: "使用 Windows 原生 OCR 识别自绘界面、图片或游戏画面文字" },
  { name: "screenshot", group: "observe", label: "截取画面", desc: "截取指定窗口或全屏画面供视觉理解" },
  { name: "click", group: "input", label: "点击元素/坐标", desc: "优先后台 UIA 触发，必要时短暂借用鼠标并展示苍蓝标记" },
  { name: "double_click", group: "input", label: "双击", desc: "对指定控件或屏幕坐标执行双击操作" },
  { name: "move", group: "input", label: "移动指针", desc: "将指针移动至目标位置以触发悬停菜单或提示" },
  { name: "drag", group: "input", label: "拖拽", desc: "在两个坐标或控件之间执行拖拽操作" },
  { name: "scroll", group: "input", label: "滚轮滚动", desc: "在页面或列表控件中向上下左右滚动（优先后台）" },
  { name: "type_text", group: "input", label: "输入文字", desc: "向输入框填写文本（优先后台 ValuePattern，不占剪贴板）" },
  { name: "keypress", group: "input", label: "发送快捷键", desc: "发送组合键或功能键（如 Ctrl+S、Enter、Alt+F4）" },
  { name: "invoke", group: "windows", label: "后台触发控件", desc: "直接通过 UIA InvokePattern 触发按钮，完全不动鼠标" },
  { name: "set_value", group: "windows", label: "后台设值", desc: "直接向文本框/滑块写入数值，完全不抢焦点" },
  { name: "focus", group: "windows", label: "聚焦控件", desc: "将输入焦点切换至指定控件" },
  { name: "activate_window", group: "windows", label: "切到指定窗口", desc: "将指定窗口置前并激活" },
  { name: "move_window", group: "windows", label: "移动/调整窗口", desc: "调整窗口位置、大小、最大化或最小化" },
  { name: "close_window", group: "windows", label: "关闭窗口", desc: "安全请求关闭指定窗口" },
  { name: "launch_app", group: "windows", label: "启动程序", desc: "按白名单启动桌面应用程序" },
  { name: "wait", group: "other", label: "短暂等待", desc: "等待指定毫秒以配合加载动画" },
  { name: "wait_for", group: "other", label: "等待条件达成", desc: "轮询等待目标窗口、控件或文字出现后再继续" },
  { name: "batch", group: "other", label: "批量连贯动作", desc: "一次执行最多 20 步确定操作，遇异常弹窗自动停下" },
  { name: "tools", group: "other", label: "动态工具管理", desc: "懒加载模式下按需展开更多桌面操控工具" }
].map((item) => {
  const cat = TOOL_CATALOG.find((c) => c.name === item.name) || {};
  return Object.freeze({
    ...item,
    lite: Boolean(cat.lite),
    readOnly: Boolean(cat.readOnly),
    backgroundFirst: Boolean(cat.backgroundFirst),
    input: Boolean(cat.input)
  });
}));

export const READONLY_TOOL_NAMES = Object.freeze(
  TOOL_META.filter((t) => t.readOnly).map((t) => t.name)
);

export const WAND_PRESETS = Object.freeze([
  {
    id: "quiet_companion",
    name: "静默陪伴（推荐）",
    badge: "低打扰",
    desc: "优先后台 UIA + 独立 AI 光标 + 网页蓝箭头，不抢鼠标和焦点；必须借用鼠标时展示苍蓝玻璃浮窗与自定义鼠标标签，Esc 秒停。",
    patch: {
      desktopTarget: "quiet",
      browserFirst: true,
      browserVisible: true,
      indicatorEnabled: true,
      cursorIndicatorEnabled: true,
      progressOverlayEnabled: true,
      progressOverlayLocked: true,
      progressOverlayOpacity: 78,
      independentInputEnabled: true,
      independentCursorMode: "companion",
      toolPreset: "full",
      enabledTools: [...TOOL_NAMES]
    }
  },
  {
    id: "fast_focus",
    name: "极速前台托管",
    badge: "高效率",
    desc: "适合你暂离电脑或集中跑自动化流程：允许直接置前窗口操作、更短隐藏延时，配合 batch 批量连贯执行。",
    patch: {
      desktopTarget: "fast",
      browserFirst: true,
      browserVisible: true,
      indicatorEnabled: true,
      cursorIndicatorEnabled: true,
      indicatorIdleMs: 450,
      progressOverlayEnabled: true,
      progressOverlayOpacity: 72,
      toolPreset: "full",
      enabledTools: [...TOOL_NAMES]
    }
  },
  {
    id: "readonly_guard",
    name: "只读观测哨兵",
    badge: "零点击",
    desc: "仅启用截屏、OCR、窗口枚举、界面快照与条件等待，彻底禁用点击、输入与独立输入操作，适合纯监测与巡检。",
    patch: {
      desktopTarget: "quiet",
      indicatorEnabled: true,
      cursorIndicatorEnabled: false,
      progressOverlayEnabled: true,
      independentInputEnabled: false,
      toolPreset: "custom",
      enabledTools: [...READONLY_TOOL_NAMES]
    }
  },
  {
    id: "lite_clean",
    name: "精简省流 12 工具",
    badge: "省上下文",
    desc: "只向模型暴露最常用的 12 个核心操控工具，显著减少上下文占用，保留完整可视化提示与 Esc 急停。",
    patch: {
      desktopTarget: "quiet",
      browserFirst: true,
      indicatorEnabled: true,
      cursorIndicatorEnabled: true,
      progressOverlayEnabled: true,
      toolPreset: "lite",
      enabledTools: [...LITE_TOOL_NAMES]
    }
  }
]);

export const INDICATOR_TEMPLATES = Object.freeze([
  "苍蓝魔杖正在控制电脑",
  "✨ 苍蓝魔杖施法操控中 · 按 Esc 急停",
  "苍蓝魔杖正在帮你点击~ 按 Esc 随时停下",
  "Azure Wand is controlling your desktop"
]);

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeProgramList(raw) {
  const arr = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\r\n,;]+/)
      : [];
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    const s = String(item || "").trim();
    if (!s || s.length > 260) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= 64) break;
  }
  return out;
}

export class WandStore {
  constructor(dataDir = DEFAULT_DATA_DIR) {
    this.dataDir = dataDir;
    this.configPath = path.join(this.dataDir, "config.json");
    this.cursorPacksDir = path.join(this.dataDir, "cursor-packs");
    this._previewing = false;
    this._independentPreviewEngine = null;
  }

  listCursorPacks() {
    const packs = [
      {
        id: "builtin",
        name: "苍蓝星芒",
        desc: "苍蓝魔杖默认 15 状态 24 帧魔法星芒光标套装",
        builtin: true,
        cursorsDir: path.join(BUILTIN_CURSOR_ASSETS, "cursors"),
        previewsDir: path.join(BUILTIN_CURSOR_ASSETS, "previews")
      }
    ];
    try {
      if (fs.existsSync(this.cursorPacksDir)) {
        for (const entry of fs.readdirSync(this.cursorPacksDir, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const packRoot = path.join(this.cursorPacksDir, entry.name);
          const cursorsDir = fs.existsSync(path.join(packRoot, "cursors"))
            ? path.join(packRoot, "cursors")
            : packRoot;
          if (!fs.existsSync(path.join(cursorsDir, "pointer.png"))) continue;
          const previewsDir = fs.existsSync(path.join(packRoot, "previews"))
            ? path.join(packRoot, "previews")
            : cursorsDir;
          let meta = {};
          try {
            meta = JSON.parse(fs.readFileSync(path.join(packRoot, "pack.json"), "utf8"));
          } catch {}
          packs.push({
            id: entry.name,
            name: String(meta.name || entry.name),
            desc: String(meta.desc || "本地自定义 15 状态动态光标包"),
            builtin: false,
            cursorsDir,
            previewsDir
          });
        }
      }
    } catch {}
    return packs;
  }

  resolveCursorPack(cfg = this.readConfig()) {
    const packs = this.listCursorPacks();
    if (cfg.independentCursorPack === "custom" && cfg.independentCustomCursorDir) {
      const customRoot = path.resolve(cfg.independentCustomCursorDir);
      const cursorsDir = fs.existsSync(path.join(customRoot, "cursors"))
        ? path.join(customRoot, "cursors")
        : customRoot;
      if (fs.existsSync(path.join(cursorsDir, "pointer.png"))) {
        const previewsDir = fs.existsSync(path.join(customRoot, "previews"))
          ? path.join(customRoot, "previews")
          : cursorsDir;
        return { id: "custom", name: "自定义目录", cursorsDir, previewsDir };
      }
    }
    const found = packs.find((p) => p.id === cfg.independentCursorPack);
    return found || packs[0];
  }

  resolveCursorAssetsDir(cfg = this.readConfig()) {
    return this.resolveCursorPack(cfg).cursorsDir;
  }

  resolveStateOverridesMap(cfg = this.readConfig()) {
    const raw = cfg.independentStatePacks;
    if (!raw || typeof raw !== "object") return {};
    const packs = this.listCursorPacks();
    const out = {};
    for (const st of CURSOR_STATE_IDS) {
      const packId = raw[st];
      if (!packId || packId === cfg.independentCursorPack) continue;
      const pack = packs.find((p) => p.id === packId);
      if (!pack) continue;
      const p = path.join(pack.cursorsDir, `${st}.png`);
      if (fs.existsSync(p)) out[st] = p;
    }
    return out;
  }

  resolveCursorPreviewPath(stateId, cfg = this.readConfig(), explicitPackId = "") {
    const id = CURSOR_STATE_IDS.includes(stateId) ? stateId : "pointer";
    const packs = this.listCursorPacks();
    let pack = null;
    if (explicitPackId) {
      pack = packs.find((p) => p.id === explicitPackId) || null;
    } else if (cfg.independentStatePacks && cfg.independentStatePacks[id]) {
      pack = packs.find((p) => p.id === cfg.independentStatePacks[id]) || null;
    }
    if (!pack) pack = this.resolveCursorPack(cfg);
    const p1 = path.join(pack.previewsDir, `${id}.png`);
    if (fs.existsSync(p1)) return p1;
    const p2 = path.join(BUILTIN_CURSOR_ASSETS, "previews", `${id}.png`);
    return fs.existsSync(p2) ? p2 : null;
  }

  importExternalCursorPack({ sourcePath, packName, packId, desc, activate = true } = {}) {
    const res = importCursorPack({
      sourcePath,
      packName,
      packId,
      desc,
      cursorPacksDir: this.cursorPacksDir
    });
    let config = this.readConfig();
    if (activate && res?.pack?.id) {
      config = this.updateConfig({
        independentCursorPack: res.pack.id,
        independentStatePacks: {}
      });
    }
    return { ...res, config, packs: this.listCursorPacks() };
  }

  importUploadedCursorFiles({ files = [], packName = "", desc = "", activate = true } = {}) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error("未收到任何上传的光标文件");
    }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "azure-wand-upload-"));
    try {
      let archivePath = null;
      for (const f of files) {
        const safeName = path.basename(String(f?.name || "")).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
        if (!safeName || !f?.dataBase64) continue;
        const buf = Buffer.from(String(f.dataBase64), "base64");
        const dst = path.join(tmpDir, safeName);
        fs.writeFileSync(dst, buf);
        if (/\.(zip|rar|7z|tar)$/i.test(safeName)) archivePath = dst;
      }
      const sourcePath = files.length === 1 && archivePath ? archivePath : tmpDir;
      const inferredName = packName || (archivePath ? path.basename(archivePath, path.extname(archivePath)) : `导入光标-${new Date().toISOString().slice(5, 16).replace(/[:T]/g, "")}`);
      return this.importExternalCursorPack({ sourcePath, packName: inferredName, desc, activate });
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  deleteCursorPack(packId) {
    const id = String(packId || "").trim();
    if (!id || id === "builtin" || id === "custom" || id.includes("..") || id.includes("/") || id.includes("\\")) {
      throw new Error("内置光标包不可删除");
    }
    const target = path.join(this.cursorPacksDir, id);
    if (!fs.existsSync(target)) throw new Error(`未找到套装: ${id}`);
    fs.rmSync(target, { recursive: true, force: true });
    const cur = this.readConfig();
    const patch = {};
    if (cur.independentCursorPack === id) {
      const rest = this.listCursorPacks();
      patch.independentCursorPack = rest[0]?.id || "builtin";
    }
    if (cur.independentStatePacks && typeof cur.independentStatePacks === "object") {
      const cleaned = {};
      for (const [k, v] of Object.entries(cur.independentStatePacks)) {
        if (v !== id) cleaned[k] = v;
      }
      patch.independentStatePacks = cleaned;
    }
    const config = Object.keys(patch).length ? this.updateConfig(patch) : cur;
    return { ok: true, deleted: id, config, packs: this.listCursorPacks() };
  }

  getDefaults() {
    const packs = this.listCursorPacks();
    const defaultPack = packs.find((p) => !p.builtin)?.id || "builtin";
    return {
      ...DEFAULT_SETTINGS,
      toolPreset: "full",
      indicatorText: "苍蓝魔杖正在控制电脑",
      cursorTagText: "苍蓝魔杖",
      progressOverlayTheme: "azure",
      progressOverlayOpacity: 78,
      ...WAND_EXTRA_DEFAULTS,
      independentCursorPack: defaultPack,
      allowedLaunchPrograms: [...WAND_EXTRA_DEFAULTS.allowedLaunchPrograms],
      enabledTools: [...TOOL_NAMES]
    };
  }

  sanitizeConfig(raw = {}) {
    const merged = { ...this.getDefaults(), ...(raw && typeof raw === "object" ? raw : {}) };
    const extra = {
      imageMode: ["default", "compact", "full"].includes(merged.imageMode) ? merged.imageMode : "default",
      allowedLaunchPrograms: normalizeProgramList(merged.allowedLaunchPrograms),
      allowLaunchArguments: Boolean(merged.allowLaunchArguments),
      batchBudgetMs: clampInt(merged.batchBudgetMs, 5000, 120000, 30000),
      uiLocale: merged.uiLocale === "en" ? "en" : "zh",
      independentInputEnabled: merged.independentInputEnabled !== false,
      independentCursorMode: ["clean", "avoidance"].includes(merged.independentCursorMode) ? merged.independentCursorMode : "companion",
      independentCursorHoldMs: clampInt(merged.independentCursorHoldMs, 400, 15000, 2600),
      independentCursorSize: clampInt(merged.independentCursorSize, 24, 192, 64),
      independentCursorPack: String(merged.independentCursorPack || "builtin").trim().slice(0, 80) || "builtin",
      independentCustomCursorDir: String(merged.independentCustomCursorDir || "").trim().slice(0, 400),
      independentStatePacks: (() => {
        const out = {};
        if (merged.independentStatePacks && typeof merged.independentStatePacks === "object" && !Array.isArray(merged.independentStatePacks)) {
          for (const st of CURSOR_STATE_IDS) {
            const v = String(merged.independentStatePacks[st] || "").trim().slice(0, 80);
            if (v) out[st] = v;
          }
        }
        return out;
      })()
    };

    const coreInput = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (Object.hasOwn(merged, key)) coreInput[key] = merged[key];
    }
    if (typeof coreInput.cursorTagText === "string") {
      coreInput.cursorTagText = coreInput.cursorTagText.replace(/[\r\n\x00-\x1f]/g, "").trim().slice(0, 18) || "苍蓝魔杖";
    }
    const { value: repaired } = repairStaleSettings(coreInput);
    const core = normalizeSettings(repaired);
    if (core.toolPreset === "auto") core.toolPreset = "full";
    return { ...core, ...extra };
  }

  readConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const parsed = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
        return this.sanitizeConfig(parsed);
      }
    } catch {}
    return this.getDefaults();
  }

  ensureInitialized() {
    const cfg = this.readConfig();
    if (!fs.existsSync(this.configPath)) {
      this.writeConfig(cfg);
    }
    return cfg;
  }

  writeConfig(nextRaw) {
    const next = this.sanitizeConfig(nextRaw);
    fs.mkdirSync(this.dataDir, { recursive: true });
    const tmp = `${this.configPath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), "utf8");
    fs.renameSync(tmp, this.configPath);
    return next;
  }

  updateConfig(patch = {}) {
    const current = this.readConfig();
    const next = { ...current, ...(patch && typeof patch === "object" ? patch : {}) };
    if (patch.toolPreset === "full" && !Object.hasOwn(patch, "enabledTools")) {
      next.enabledTools = [...TOOL_NAMES];
    } else if (patch.toolPreset === "lite" && !Object.hasOwn(patch, "enabledTools")) {
      next.enabledTools = [...LITE_TOOL_NAMES];
    }
    const saved = this.writeConfig(next);
    // Live-sync preview independent cursor engine if running
    if (this._independentPreviewEngine?.ready) {
      const eng = this._independentPreviewEngine;
      const assetDir = this.resolveCursorAssetsDir(saved);
      const overrides = this.resolveStateOverridesMap(saved);
      Promise.resolve()
        .then(() => eng.setCursorMode(saved.independentCursorMode, saved.independentCursorHoldMs))
        .then(() => eng.setCursorSize(saved.independentCursorSize))
        .then(() => eng.setAssetDir(assetDir, overrides))
        .catch(() => {});
    }
    return saved;
  }

  applyPreset(presetId) {
    const preset = WAND_PRESETS.find((p) => p.id === presetId);
    if (!preset) throw new Error(`未知预设: ${presetId}`);
    return this.updateConfig(preset.patch);
  }

  resetConfig() {
    return this.writeConfig(this.getDefaults());
  }

  buildEngineEnv(cfg = this.readConfig()) {
    const toolMode = cfg.toolPreset === "lite" ? "lite" : cfg.toolPreset === "lazy" ? "lazy" : "full";
    const env = {
      WCU_CONFIG_FILE: this.configPath,
      WCU_SETTINGS_JSON: JSON.stringify(cfg),
      WCU_TOOL_MODE: toolMode,
      WCU_WORK_MODE: cfg.desktopTarget === "fast" || cfg.desktopTarget === "hyperv" ? "fast" : "quiet",
      WCU_BATCH_BUDGET_MS: String(cfg.batchBudgetMs || 30000)
    };
    if (cfg.toolPreset === "custom" && Array.isArray(cfg.enabledTools) && cfg.enabledTools.length > 0) {
      env.WCU_ENABLED_TOOLS = cfg.enabledTools.join(",");
    }
    if (cfg.imageMode && cfg.imageMode !== "default") {
      env.WCU_IMAGE_MODE = cfg.imageMode;
    }
    if (Array.isArray(cfg.allowedLaunchPrograms) && cfg.allowedLaunchPrograms.length > 0) {
      env.WCU_ALLOWED_LAUNCH_PROGRAMS = cfg.allowedLaunchPrograms.join(";");
    }
    if (cfg.allowLaunchArguments) {
      env.WCU_ALLOW_LAUNCH_ARGUMENTS = "1";
    }
    return env;
  }

  async runSelfTest() {
    const serverEntry = path.join(ENGINE_ROOT, "mcp", "server.mjs");
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [serverEntry, "--self-test"], {
        cwd: ENGINE_ROOT,
        env: { ...process.env, ...this.buildEngineEnv() },
        windowsHide: true
      });
      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        try { child.kill(); } catch {}
        resolve({ ok: false, error: "自检超时（15 秒）" });
      }, 15000);
      child.stdout.on("data", (d) => (out += d.toString("utf8")));
      child.stderr.on("data", (d) => (err += d.toString("utf8")));
      child.on("close", (code) => {
        clearTimeout(timer);
        try {
          const parsed = JSON.parse(out.trim());
          resolve({ exitCode: code, ...parsed });
        } catch {
          resolve({ ok: false, exitCode: code, error: err.trim() || out.trim() || "自检未返回有效 JSON" });
        }
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        resolve({ ok: false, error: e.message });
      });
    });
  }

  async listDesktopWindows() {
    if (process.platform !== "win32") return { ok: false, windows: [], error: "仅支持 Windows 桌面探测" };
    const psScript = `
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
      $list = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } |
        Select-Object -First 40 @{N='pid';E={$_.Id}}, @{N='process';E={$_.ProcessName}}, @{N='title';E={$_.MainWindowTitle}}, @{N='handle';E={[int64]$_.MainWindowHandle}}
      if (-not $list) { '[]' } else { @($list) | ConvertTo-Json -Compress }
    `;
    return new Promise((resolve) => {
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", psScript], {
        windowsHide: true
      });
      let out = "";
      let err = "";
      const timer = setTimeout(() => {
        try { child.kill(); } catch {}
        resolve({ ok: false, windows: [], error: "窗口探测超时" });
      }, 8000);
      child.stdout.on("data", (d) => (out += d.toString("utf8")));
      child.stderr.on("data", (d) => (err += d.toString("utf8")));
      child.on("close", () => {
        clearTimeout(timer);
        try {
          const raw = JSON.parse(out.trim() || "[]");
          const windows = Array.isArray(raw) ? raw : raw ? [raw] : [];
          resolve({ ok: true, windows });
        } catch {
          resolve({ ok: false, windows: [], error: err.trim() || "窗口列表解析失败" });
        }
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        resolve({ ok: false, windows: [], error: e.message });
      });
    });
  }

  async triggerVisualPreview(kind = "indicator") {
    const cur = this.readConfig();
    const tokenKey = kind === "progress" ? "progressPreviewToken" : "previewToken";
    const updated = this.updateConfig({ [tokenKey]: Number(cur[tokenKey] || 0) + 1 });

    if (process.platform === "win32" && !this._previewing) {
      this._previewing = true;
      const locale = updated.uiLocale || "zh";
      const tk = new TakeoverControl({ config: updated, locale });
      (async () => {
        try {
          if (kind === "progress") {
            await tk.command("progress", {
              enabled: true,
              preview: true,
              settings: updated,
              remoteIndicatorVisible: updated.remoteIndicatorVisible,
              progress: previewProgress(locale)
            });
            await new Promise((r) => setTimeout(r, 8000));
          } else {
            await tk.command("preview", updated);
            await new Promise((r) => setTimeout(r, 2600));
          }
        } catch {
          // Non-interactive desktop or helper unavailable
        } finally {
          try { await tk.close(); } catch {}
          this._previewing = false;
        }
      })();
    }

    return { ok: true, kind, token: updated[tokenKey], config: updated };
  }

  async _ensureIndependentPreviewEngine(cfg = this.readConfig()) {
    if (process.platform !== "win32") throw new Error("独立 AI 光标仅支持 Windows");
    const assetDir = this.resolveCursorAssetsDir(cfg);
    const overrides = this.resolveStateOverridesMap(cfg);
    if (!this._independentPreviewEngine) {
      this._independentPreviewEngine = new IndependentInputEngine({
        cursorMode: cfg.independentCursorMode,
        cursorHoldMs: cfg.independentCursorHoldMs,
        cursorSize: cfg.independentCursorSize,
        assetDir,
        stateOverrides: overrides
      });
    }
    const eng = this._independentPreviewEngine;
    await eng.ensure();
    await eng.setAssetDir(assetDir, overrides);
    await eng.setCursorMode(cfg.independentCursorMode, cfg.independentCursorHoldMs);
    await eng.setCursorSize(cfg.independentCursorSize);
    return eng;
  }

  async previewIndependentCursor({ state = "pointer", x, y } = {}) {
    const cfg = this.readConfig();
    const eng = await this._ensureIndependentPreviewEngine(cfg);
    const chosen = CURSOR_STATE_IDS.includes(state) ? state : "pointer";
    await eng.setCursorState(chosen);
    let tx = Number.isFinite(Number(x)) ? Math.round(Number(x)) : undefined;
    let ty = Number.isFinite(Number(y)) ? Math.round(Number(y)) : undefined;
    if (tx === undefined || ty === undefined) {
      try {
        const st = await eng.request("status");
        if (st?.cursor && Number.isFinite(st.cursor.x)) {
          tx = Math.max(40, st.cursor.x + 48);
          ty = Math.max(40, st.cursor.y + 24);
        }
      } catch {}
    }
    const result = await eng.request("overlay", { show: true, style: chosen, x: tx ?? 480, y: ty ?? 320 });
    return { ok: true, state: chosen, result };
  }

  async hideIndependentCursor() {
    if (!this._independentPreviewEngine?.ready) return { ok: true, visible: false };
    const result = await this._independentPreviewEngine.request("overlay", { show: false });
    return { ok: true, visible: false, result };
  }

  async getIndependentStatus() {
    if (!this._independentPreviewEngine?.ready) {
      return { ok: true, running: false, paused: false };
    }
    const status = await this._independentPreviewEngine.request("status");
    return { ok: true, running: true, status };
  }

  getMeta() {
    return {
      configPath: this.configPath,
      dataDir: this.dataDir,
      cursorPacksDir: this.cursorPacksDir,
      engineRoot: ENGINE_ROOT,
      browserApps: [...BROWSER_APPS],
      presets: WAND_PRESETS,
      tools: TOOL_META,
      indicatorTemplates: INDICATOR_TEMPLATES,
      cursorTagTemplates: CURSOR_TAG_TEMPLATES,
      overlayThemes: OVERLAY_THEMES,
      cursorStates: CURSOR_STATES,
      cursorPacks: this.listCursorPacks(),
      toolCounts: {
        all: TOOL_NAMES.length,
        lite: LITE_TOOL_NAMES.length,
        readonly: READONLY_TOOL_NAMES.length
      }
    };
  }
}
