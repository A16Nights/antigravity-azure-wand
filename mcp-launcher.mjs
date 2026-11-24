#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WandStore } from "./lib/wand-store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(__dirname, "engine", "mcp", "server.mjs");

const store = new WandStore();
const cfg = store.ensureInitialized();
const envPatch = store.buildEngineEnv(cfg);
for (const [k, v] of Object.entries(envPatch)) {
  if (v === undefined || v === null) continue;
  process.env[k] = String(v);
}

process.argv[1] = serverEntry;
await import("./engine/mcp/server.mjs");
