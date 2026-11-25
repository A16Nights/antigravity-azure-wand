# 苍蓝魔杖（azure-wand）使用约定

- 当用户要求查看、点击、输入或监测本地 Windows 桌面应用程序，或需要打开桌面操控控制台时，优先使用 `azure-wand` 提供的桌面操控 MCP 工具或引导打开 `[苍蓝魔杖](sidecar://azure-wand/wand/)` 面板。
- 操控桌面时遵循**低打扰优先**：
  - 希望完全不动真实鼠标、不抢键盘焦点且展示 15 状态动态 AI 光标时，优先使用 `independent_input` 工具（基于目标窗口 `hwnd` 的 UIA / 窗口消息，按 `Ctrl+Alt+Q` 可随时暂停）；
  - 使用 26 项综合桌面/网页工具时，优先通过 UI Automation（`invoke`、`set_value`、`snapshot` + 元素操作）或浏览器通道完成，需要连续执行确定动作时合并为 `batch`。
- 一旦用户按下 `Esc` / 自定义急停快捷键触发 `COMPUTER_USE_STOPPED_BY_USER` 或按下 `Ctrl+Alt+Q` 暂停独立输入，立即停止本轮桌面操作并如实回报，绝不擅自重试。
- 涉及发送消息、提交表单、付款、删除文件等不可逆外部操作前，必须先向用户确认。
