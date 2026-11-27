export const WAND_ONBOARDING_GUIDE = {
  version: "1",
  icon: "🪄",
  title: "欢迎使用苍蓝魔杖——Windows 桌面与网页操控",
  subtitle: "1 分钟了解低打扰桌面操控、独立 AI 光标、皮肤混搭与安全急停（随时点顶栏「? 指南」重看）",
  steps: [
    {
      icon: "✦",
      navTitle: "概览与健康自检",
      title: "一眼掌握当前操控模式与桌面窗口状态",
      desc: "苍蓝魔杖让 AI 能够通过 Windows UIA / OCR 与后台浏览器操控桌面软件，先做一次自检确认环境就绪。",
      spotlight: {
        clickBefore: '.tab[data-tab="overview"]',
        selector: "#btn-selftest",
        buttonText: "定位一键自检",
        hint: "点「一键自检」快速核验本地桌面操控服务与窗口探测是否正常"
      },
      items: [
        {
          icon: "⚡",
          title: "快捷场景预设一键套用",
          text: "在「概览与快控」页可直接挑选常用预设（如低打扰伴随、极简静默等），不用逐项摸索参数。"
        },
        {
          icon: "🪟",
          title: "实时查看已打开窗口",
          text: "页面下方会列出当前可交互的 Windows 窗口列表，方便核对窗口句柄与标题。"
        }
      ],
      tip: "任何时候想立刻叫停 AI 的桌面操作，直接按 Esc 或 Ctrl+Alt+Q 就会瞬间急停。"
    },
    {
      icon: "🖱️",
      navTitle: "独立 AI 光标",
      title: "不抢真实鼠标、不抢焦点的独立 AI 光标",
      desc: "开启独立输入后，AI 会带着专属的 15 状态动态小光标自己在目标窗口里点按输入，你照常刷网页打字互不打架。",
      spotlight: {
        clickBefore: '.tab[data-tab="independent"]',
        selector: "#pack-gallery",
        buttonText: "定位光标套装画廊",
        hint: "这里可以挑选内置套装、混搭 15 种动作状态的单帧皮肤，或直接拖入外部 .cur/.ani 光标包"
      },
      items: [
        {
          icon: "🎭",
          title: "伴随 / 简洁 / 避让三种模式",
          text: "可按习惯选择动态光标停留时长、尺寸大小与避让行为，兼顾可视化反馈与低打扰。"
        },
        {
          icon: "📦",
          title: "套装画廊与一键导入",
          text: "支持直接拖拽文件夹、.zip、.cur 或 .ani 文件导入你喜欢的二次元/个性光标套装。"
        }
      ],
      tip: "按 Ctrl+Alt+Q 可随时暂停/恢复独立输入通道，安全感拉满。"
    },
    {
      icon: "🎨",
      navTitle: "浮窗与通道设置",
      title: "定制苍蓝玻璃思考浮窗、鼠标标签与浏览器通道",
      desc: "AI 在桌面干活时会用柔和浮窗实时汇报正在做什么，你也能在此切换 UIA 与后台浏览器 CDP 策略。",
      spotlight: {
        clickBefore: '.tab[data-tab="visual"]',
        selector: "#tab-visual",
        buttonText: "定位浮窗定制",
        hint: "可在「浮窗与标签定制」挑 4 套苍蓝玻璃浮窗风格并自定义光标旁的提示标签"
      },
      items: [
        {
          icon: "💬",
          title: "4 套苍蓝毛玻璃思考浮窗",
          text: "实时展示 AI 当前动作步骤与提示文字，可自定义标签名与显隐位置。"
        },
        {
          icon: "🌐",
          title: "桌面 UIA + 后台网页 CDP 双通道",
          text: "切到「桌面与浏览器」或「26 项工具箱」可按需查看和微调各工具能力开关。"
        }
      ],
      tip: "桌面操控遵循低打扰优先，能用 UI Automation 直接触发的控件不会硬模拟物理鼠标。"
    },
    {
      icon: "🛡️",
      navTitle: "安全与白名单",
      title: "设置急停热键、敏感应用拦截与操作白名单",
      desc: "把网银、密码管理器等敏感软件放进保护名单，并确认好你的顺手急停快捷键。",
      spotlight: {
        clickBefore: '.tab[data-tab="security"]',
        selector: "#tab-security",
        buttonText: "定位安全设置",
        hint: "在这里管理允许/禁止操控的应用白名单、黑名单与全局急停快捷键"
      },
      items: [
        {
          icon: "🛑",
          title: "全局急停零延迟响应",
          text: "触发急停后立即中断当前桌面指令并回报状态，绝不会擅自重试。"
        },
        {
          icon: "🔐",
          title: "高危操作默认二次确认",
          text: "涉及发消息、提交表单、付款、删文件等不可逆动作，AI 会先停下来向你确认。"
        }
      ],
      tip: "随时可点顶栏「? 指南」重看本教程；支持键盘 ← / → 翻页与 Esc 关闭。"
    }
  ]
};
