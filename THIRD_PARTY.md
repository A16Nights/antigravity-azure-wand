# Third-Party Notices & Attributions

## dsh-computer-use-win (MIT License)

The standalone Windows UI Automation, OCR, browser CDP, and visual takeover overlay runtime under `engine/` is adapted from **dsh-computer-use-win** (`v0.6.3`), licensed under the MIT License:

- Upstream Repository: https://github.com/Yu-tao-Li/dsh-computer-use-win
- Copyright (c) 2026 Yu-tao-Li
- Copyright (c) 2026 cgissing
- Full upstream license and third-party notices are preserved intact in `engine/LICENSE` and `engine/THIRD_PARTY.md`.

### Modifications in Azure Wand (`antigravity-azure-wand`)
- Removed DSH-host-only adapter/UI files and wrapped the standalone MCP server via `mcp-launcher.mjs` for native Google Antigravity plugin integration.
- Updated default visual overlay branding strings in `engine/mcp/overlay-strings.mjs` to Azure Wand / 苍蓝魔杖.
- Added an independent Antigravity Sidecar console (`sidecars/wand/`), unified configuration store (`lib/wand-store.mjs`), and left-sidebar MCP App navigation (`mcp-nav.mjs`).
