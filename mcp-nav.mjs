#!/usr/bin/env node
import readline from "node:readline";
import {
  getSidebarToolDefinition,
  getSidebarResourceDefinition,
  getSidebarResourceUri,
  handleSidebarToolCall,
  buildSidebarResourceReadResult
} from "./lib/sidebar-nav.mjs";

const PLUGIN_ID = "azure-wand";
const PROTOCOL_VERSION = "2024-11-05";

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handleMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  const { id, method, params } = msg;
  if (id === undefined || id === null) return;
  try {
    switch (method) {
      case "initialize":
        send({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: params?.protocolVersion || PROTOCOL_VERSION,
            capabilities: { tools: {}, resources: {} },
            serverInfo: { name: "azure-wand-nav", version: "1.0.0" }
          }
        });
        return;
      case "ping":
        send({ jsonrpc: "2.0", id, result: {} });
        return;
      case "tools/list": {
        const tool = getSidebarToolDefinition(PLUGIN_ID);
        send({ jsonrpc: "2.0", id, result: { tools: tool ? [tool] : [] } });
        return;
      }
      case "resources/list": {
        const res = getSidebarResourceDefinition(PLUGIN_ID);
        send({ jsonrpc: "2.0", id, result: { resources: res ? [res] : [] } });
        return;
      }
      case "resources/read": {
        const uri = params?.uri;
        if (uri === getSidebarResourceUri(PLUGIN_ID)) {
          send({ jsonrpc: "2.0", id, result: buildSidebarResourceReadResult(PLUGIN_ID) });
          return;
        }
        throw new Error(`Unknown resource URI: ${uri}`);
      }
      case "tools/call": {
        const tool = getSidebarToolDefinition(PLUGIN_ID);
        if (params?.name === "open_azure_wand_ui" || (tool && params?.name === tool.name)) {
          send({ jsonrpc: "2.0", id, result: handleSidebarToolCall(PLUGIN_ID) });
          return;
        }
        throw new Error(`Unknown tool: ${params?.name}`);
      }
      default:
        send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
  } catch (err) {
    send({ jsonrpc: "2.0", id, error: { code: -32000, message: err?.message || String(err) } });
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    handleMessage(JSON.parse(trimmed));
  } catch {}
});
