---
name: azure-wand
description: 苍蓝魔杖（Azure Wand）— Windows 桌面与网页低打扰可视化操控插件：提供 26 项 Windows UIA / OCR / 后台网页 CDP / 批量编排工具，支持独立鼠标指示标签、屏幕边缘光晕、可穿透思考浮窗、Esc 急停与高度可定制的苍蓝侧栏控制台。当用户需要查看或操控 Windows 桌面软件、识别屏幕文字、后台操作网页或打开苍蓝魔杖控制面板时使用。
---

# 苍蓝魔杖（Azure Wand）

## 核心工具与入口

- **控制面板**：调用 `open_azure_wand_ui` 或引导点击左侧栏/右侧栏的「苍蓝魔杖」面板，可可视化调节：
  - 一键场景预设（静默陪伴 / 极速前台托管 / 只读观测哨兵 / 精简 12 工具）
  - 独立鼠标标签、屏幕边缘光晕横幅文案、停靠位置、隐藏延时与自定义急停快捷键
  - 思考与操作浮窗的不透明度、宽高、位置、鼠标穿透锁定
  - 后台网页通道（CDP 虚拟蓝箭头）、工具箱 26 项逐个开关、安全启动程序白名单与实时自检
- **桌面操控 MCP（`azure-wand`）**：内置 26 项 Windows 操控工具（`list_windows`、`snapshot`、`find`、`ocr`、`screenshot`、`click`、`type_text`、`invoke`、`set_value`、`batch`、`wait_for` 等）。

## 推荐操作循环

1. **先观察**：优先调用 `list_windows`、`snapshot`、`find` 或 `ocr` 摸清界面，不盲点坐标。
2. **低打扰执行**：优先使用 `invoke` / `set_value` / 后台元素 `click` 或网页通道（零抢鼠标）；多步确定动作合并进 `batch`。
3. **验证与尊重急停**：执行后用 `wait_for` 或 `snapshot` 核实结果；若返回 `COMPUTER_USE_STOPPED_BY_USER`（用户按下 `Esc`），立即停手并汇报，不要自动重试。
