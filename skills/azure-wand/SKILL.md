---
name: azure-wand
description: 苍蓝魔杖（Azure Wand）— Windows 桌面与网页低打扰可视化操控插件：提供 26 项 Windows UIA / OCR / 后台网页 CDP 工具 + 独立输入 15 状态动态 AI 光标（strict 不动真实鼠标、不抢焦点），支持 4 套苍蓝玻璃思考浮窗、自定义鼠标标签、Esc / Ctrl+Alt+Q 急停与高度可定制的苍蓝侧栏控制台。当用户需要查看或操控 Windows 桌面软件、识别屏幕文字、后台操作网页、调教独立 AI 光标或打开苍蓝魔杖控制面板时使用。
---

# 苍蓝魔杖（Azure Wand）

## 核心通道选择指南

1. **完全不抢鼠标与焦点 + 独立 15 状态 AI 光标（`independent_input`）**：
   - 先调 `independent_input({ action: "status" })` 确认未暂停（`Ctrl+Alt+Q` 全局急停），再 `windows` 获取目标 `hwnd`，随后用 `click` / `type` / `key` / `scroll` / `drag` 向该 `hwnd` 投递 UIA / 窗口消息。
   - 严格禁止动用真实鼠标与抢焦点；AI 光标在屏幕置顶穿透显示并按操作在 15 个状态间自动切换。
2. **26 项综合桌面与网页操控工具（`windows_computer_use_*`）**：
   - 网页任务优先走内置后台 CDP 通道；桌面任务优先走 `snapshot` / `find` / `invoke` / `set_value`；需要坐标点击自绘界面时由低打扰模式短暂借用并展示苍蓝边缘光晕、自定义鼠标标签与苍蓝玻璃思考浮窗，按 `Esc` 立即停止。
3. **打开控制面板**：
   - 引导用户点击 `[苍蓝魔杖](sidecar://azure-wand/wand/)` 或调用 `open_azure_wand_ui`，可在侧栏配置独立 AI 光标（总开关、陪伴/整洁模式、大小、光标主题包、15 状态实时点击预览）、浮窗 4 套玻璃主题、自定义鼠标标签、26 项工具开关与白名单。
