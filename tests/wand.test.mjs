import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WandStore, WAND_PRESETS, READONLY_TOOL_NAMES } from "../lib/wand-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");

test("WandStore config persistence, presets, sanitization, and env builder", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "azure-wand-store-"));
  try {
    const store = new WandStore(tmpDir);
    const init = store.ensureInitialized();
    assert.equal(fs.existsSync(store.configPath), true);
    assert.equal(init.desktopTarget, "quiet");
    assert.equal(init.cursorIndicatorEnabled, true);

    const updated = store.updateConfig({
      indicatorText: "苍蓝魔杖测试文案",
      progressOverlayOpacity: 85,
      allowedLaunchPrograms: ["notepad.exe", "MuMuPlayer.exe", "notepad.exe"],
      batchBudgetMs: 45000
    });
    assert.equal(updated.indicatorText, "苍蓝魔杖测试文案");
    assert.equal(updated.progressOverlayOpacity, 85);
    assert.deepEqual(updated.allowedLaunchPrograms, ["notepad.exe", "MuMuPlayer.exe"]);

    const env = store.buildEngineEnv(updated);
    assert.equal(env.WCU_CONFIG_FILE, store.configPath);
    assert.equal(env.WCU_ALLOWED_LAUNCH_PROGRAMS, "notepad.exe;MuMuPlayer.exe");
    assert.equal(env.WCU_BATCH_BUDGET_MS, "45000");

    const ro = store.applyPreset("readonly_guard");
    assert.equal(ro.toolPreset, "custom");
    assert.deepEqual([...ro.enabledTools].sort(), [...READONLY_TOOL_NAMES].sort());
    assert.ok(WAND_PRESETS.length >= 4);

    const reset = store.resetConfig();
    assert.equal(reset.toolPreset, "full");
    assert.equal(reset.indicatorText, "苍蓝魔杖正在控制电脑");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("MCP nav server exposes open_azure_wand_ui and sidebar resource", () => {
  const input = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } }),
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    JSON.stringify({ jsonrpc: "2.0", id: 3, method: "resources/list", params: {} })
  ].join("\n") + "\n";

  const out = spawnSync(process.execPath, [path.join(ROOT_DIR, "mcp-nav.mjs")], {
    input,
    encoding: "utf8",
    timeout: 10000
  });
  assert.equal(out.status, 0, out.stderr);
  const msgs = out.stdout.trim().split(/\r?\n/).map((l) => JSON.parse(l));
  assert.equal(msgs[0].result.serverInfo.name, "azure-wand-nav");
  assert.ok(msgs[1].result.tools.some((t) => t.name === "open_azure_wand_ui"));
  assert.ok(msgs[2].result.resources.length >= 1);
});

test("MCP launcher boots engine server and advertises Windows computer-use tools", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "azure-wand-mcp-"));
  const child = spawn(process.execPath, [path.join(ROOT_DIR, "mcp-launcher.mjs")], {
    cwd: ROOT_DIR,
    env: { ...process.env, AZURE_WAND_DATA_DIR: tmpDir },
    stdio: ["pipe", "pipe", "pipe"]
  });

  try {
    const responses = [];
    const done = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("MCP launcher timed out")), 12000);
      let buf = "";
      child.stdout.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        const lines = buf.split(/\r?\n/);
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          responses.push(JSON.parse(line));
          if (responses.length >= 2) {
            clearTimeout(timer);
            resolve();
          }
        }
      });
      child.on("error", (err) => { clearTimeout(timer); reject(err); });
    });

    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } } }) + "\n");
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }) + "\n");
    await done;

    assert.equal(responses[0].id, 1);
    const tools = responses[1].result.tools;
    assert.ok(Array.isArray(tools) && tools.length >= 20, `expected >=20 tools, got ${tools?.length}`);
    assert.ok(tools.some((t) => t.name.includes("click")));
    assert.ok(tools.some((t) => t.name.includes("screenshot")));
  } finally {
    try { child.kill(); } catch {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("Sidecar HTTP server enforces auth token and serves state/config endpoints", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "azure-wand-sidecar-"));
  const token = "wand-test-secret-token";
  const child = spawn(process.execPath, [path.join(ROOT_DIR, "sidecars", "wand", "server.mjs")], {
    cwd: path.join(ROOT_DIR, "sidecars", "wand"),
    env: {
      ...process.env,
      AZURE_WAND_DATA_DIR: tmpDir,
      ANTIGRAVITY_SIDECAR_WEB_PORT: "0",
      ANTIGRAVITY_SIDECAR_UI_TOKEN: token
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Sidecar startup timed out")), 10000);
      let out = "";
      child.stdout.on("data", (d) => {
        out += d.toString("utf8");
        const m = out.match(/127\.0\.0\.1:(\d+)/);
        if (m) {
          clearTimeout(timer);
          resolve(Number(m[1]));
        }
      });
      child.stderr.on("data", (d) => { out += d.toString("utf8"); });
      child.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Sidecar exited ${code}: ${out}`)); });
    });

    const base = `http://127.0.0.1:${port}`;
    const health = await fetch(`${base}/healthz`).then((r) => r.json());
    assert.equal(health.ok, true);

    const unauth = await fetch(`${base}/api/state`);
    assert.equal(unauth.status, 401);

    const htmlRes = await fetch(`${base}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.ok(html.includes("苍蓝魔杖"));

    const stateRes = await fetch(`${base}/api/state`, { headers: { "x-sidecar-token": token } });
    assert.equal(stateRes.status, 200);
    const stateJson = await stateRes.json();
    assert.equal(stateJson.ok, true);
    assert.equal(stateJson.meta.toolCounts.all, 26);

    const saveRes = await fetch(`${base}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sidecar-token": token },
      body: JSON.stringify({ indicatorText: "端到端验证通过", progressOverlayOpacity: 80 })
    }).then((r) => r.json());
    assert.equal(saveRes.ok, true);
    assert.equal(saveRes.config.indicatorText, "端到端验证通过");
    assert.equal(saveRes.config.progressOverlayOpacity, 80);
  } finally {
    try { child.kill(); } catch {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
