# 苍蓝魔杖（azure-wand）使用约定

- 当用户要求查看、点击、输入或监测本地 Windows 桌面应用程序，或需要打开桌面操控控制台时，优先使用 `azure-wand` 提供的桌面操控 MCP 工具或引导打开 `[苍蓝魔杖](sidecar://azure-wand/wand/)` 面板。
- 操控桌面时遵循**低打扰优先**：能通过 UI Automation（`invoke`、`set_value`、`snapshot` + 元素操作）或浏览器通道完成的步骤不抢前台鼠标；需要连续执行确定动作时优先合并为 `batch`。
- 一旦用户按下 `Esc` 或自定义急停快捷键触发 `COMPUTER_USE_STOPPED_BY_USER`，立即停止本轮桌面操作并如实回报，绝不擅自重试。
- 涉及发送消息、提交表单、付款、删除文件等不可逆外部操作前，必须先向用户确认。
