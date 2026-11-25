import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { WandStore } from "../../lib/wand-store.mjs";
import { checkGithubUpdate } from "../../lib/update-checker.mjs";
import {
  isLeftSidebarEnabled,
  setLeftSidebarEnabled,
  listOwnedPluginsNavState,
  registerSidecarRuntime,
  refreshAntigravityMcpServers,
  injectSidebarToggleWidget
} from "../../lib/sidebar-nav.mjs";
import { handleAzureThemeHttp } from "../../lib/azure-theme.mjs";
import { injectAzureUiKit } from "../../lib/azure-ui-kit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = path.resolve(__dirname, "..", "..");
const HTML_PATH = path.join(__dirname, "index.html");
const PLUGIN_ID = "azure-wand";
const store = new WandStore();
store.ensureInitialized();

const PORT = parseInt(
  process.env.ANTIGRAVITY_SIDECAR_WEB_PORT || process.env.PORT || "18799",
  10
);
const TOKEN = (
  process.env.ANTIGRAVITY_SIDECAR_UI_TOKEN ||
  process.env.ANTIGRAVITY_SIDECAR_AUTH_TOKEN ||
  process.env.ANTIGRAVITY_SIDECAR_WEB_TOKEN ||
  ""
).trim();

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function isAllowedLocalOrigin(req) {
  const origin = String(req.headers?.origin || "").trim();
  if (!origin || origin === "null") return true;
  try {
    const u = new URL(origin);
    const h = u.hostname.toLowerCase();
    return h === "127.0.0.1" || h === "localhost" || h === "::1" || h === "[::1]";
  } catch {
    return false;
  }
}

function safeTokenEqual(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function readBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    req.on("data", (c) => {
      if (settled) return;
      const buf = Buffer.isBuffer(c) ? c : Buffer.from(String(c), "utf8");
      total += buf.length;
      if (total > maxBytes) {
        settled = true;
        req.destroy();
        const err = new Error("Body too large");
        err.statusCode = 413;
        reject(err);
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        const err = new Error("Invalid JSON");
        err.statusCode = 400;
        reject(err);
      }
    });
    req.on("error", (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    });
  });
}

function checkAuth(req, url) {
  if (!isAllowedLocalOrigin(req)) return false;
  if (!TOKEN) return true;
  const hdr = req.headers["x-codeium-sidecar-token"] || req.headers["x-sidecar-token"];
  const q = url.searchParams.get("token");
  return safeTokenEqual(hdr, TOKEN) || safeTokenEqual(q, TOKEN);
}

let actualPort = PORT;
function getWebUrl() {
  return TOKEN
    ? `http://127.0.0.1:${actualPort}/?token=${encodeURIComponent(TOKEN)}`
    : `http://127.0.0.1:${actualPort}/`;
}

function buildState() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, "plugin.json"), "utf8"));
  return {
    version: pkg.version || "1.0.0",
    config: store.readConfig(),
    meta: store.getMeta(),
    platform: process.platform,
    webUrl: getWebUrl()
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${actualPort}`);
  const pathname = url.pathname;

  if (pathname === "/healthz") {
    sendJson(res, 200, { ok: true, service: "azure-wand-console" });
    return;
  }

  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    const html = fs.readFileSync(HTML_PATH, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(injectAzureUiKit(injectSidebarToggleWidget(html, PLUGIN_ID), PLUGIN_ID));
    return;
  }

  if (pathname.startsWith("/api/")) {
    if (!checkAuth(req, url)) {
      sendJson(res, 401, { ok: false, error: "Unauthorized" });
      return;
    }
    try {
      if (req.method === "GET" && pathname === "/api/check-update") {
        const force = url.searchParams.get("force") === "1";
        const info = await checkGithubUpdate({ pluginRoot: PLUGIN_ROOT, repo: "A16Nights/antigravity-azure-wand", force });
        sendJson(res, 200, info);
        return;
      }
      if (await handleAzureThemeHttp(req, res)) return;

      if (req.method === "GET" && pathname === "/api/sidebar-nav") {
        sendJson(res, 200, {
          ok: true,
          pluginId: PLUGIN_ID,
          showInLeftSidebar: isLeftSidebarEnabled(PLUGIN_ID),
          plugins: listOwnedPluginsNavState()
        });
        return;
      }
      if (req.method === "POST" && pathname === "/api/sidebar-nav") {
        const body = await readBody(req);
        const targetId = String(body.pluginId || PLUGIN_ID).trim();
        const nextVal = Boolean(body.showInLeftSidebar);
        const saved = setLeftSidebarEnabled(targetId, nextVal);
        let refreshed = false;
        try { refreshed = Boolean(await refreshAntigravityMcpServers()); } catch {}
        sendJson(res, 200, {
          ok: true,
          pluginId: targetId,
          showInLeftSidebar: nextVal,
          refreshed,
          config: saved,
          plugins: listOwnedPluginsNavState()
        });
        return;
      }

      if (req.method === "GET" && pathname === "/api/state") {
        sendJson(res, 200, { ok: true, ...buildState() });
        return;
      }
      if (req.method === "POST" && pathname === "/api/config") {
        const body = await readBody(req);
        const config = store.updateConfig(body);
        sendJson(res, 200, { ok: true, config });
        return;
      }
      if (req.method === "POST" && pathname === "/api/preset") {
        const body = await readBody(req);
        const config = store.applyPreset(String(body.presetId || ""));
        sendJson(res, 200, { ok: true, config });
        return;
      }
      if (req.method === "POST" && pathname === "/api/reset") {
        const config = store.resetConfig();
        sendJson(res, 200, { ok: true, config });
        return;
      }
      if (req.method === "POST" && pathname === "/api/preview") {
        const body = await readBody(req);
        const kind = body.kind === "progress" ? "progress" : "indicator";
        const result = await store.triggerVisualPreview(kind);
        sendJson(res, 200, result);
        return;
      }
      if (req.method === "POST" && pathname === "/api/selftest") {
        const report = await store.runSelfTest();
        sendJson(res, 200, { ok: true, report });
        return;
      }
      if (req.method === "GET" && pathname === "/api/windows") {
        const result = await store.listDesktopWindows();
        sendJson(res, 200, result);
        return;
      }
      if (req.method === "GET" && pathname.startsWith("/api/cursor-preview/")) {
        const stateId = decodeURIComponent(pathname.slice("/api/cursor-preview/".length)).replace(/[^a-z0-9_-]/gi, "");
        const filePath = store.resolveCursorPreviewPath(stateId);
        if (!filePath || !fs.existsSync(filePath)) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, {
          "Content-Type": "image/png",
          "Cache-Control": "no-store"
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
      if (req.method === "POST" && pathname === "/api/independent/test") {
        const body = await readBody(req);
        const result = await store.previewIndependentCursor({
          state: String(body.state || "pointer"),
          x: body.x,
          y: body.y
        });
        sendJson(res, 200, result);
        return;
      }
      if (req.method === "POST" && pathname === "/api/independent/hide") {
        const result = await store.hideIndependentCursor();
        sendJson(res, 200, result);
        return;
      }
      if (req.method === "GET" && pathname === "/api/independent/status") {
        const result = await store.getIndependentStatus();
        sendJson(res, 200, result);
        return;
      }

      sendJson(res, 404, { ok: false, error: "Not found" });
    } catch (err) {
      const status = Number(err?.statusCode) || 400;
      sendJson(res, status, { ok: false, error: err?.message || String(err) });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

function startServer(port) {
  server.listen(port, "127.0.0.1", () => {
    const addr = server.address();
    actualPort = typeof addr === "object" && addr ? addr.port : port;
    registerSidecarRuntime(PLUGIN_ID, { port: actualPort, url: getWebUrl() });
    console.log(`[azure-wand] console listening on http://127.0.0.1:${actualPort}`);
  });
}

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    startServer(0);
    return;
  }
  console.error("[azure-wand] server error:", err);
  process.exit(1);
});

startServer(PORT);
