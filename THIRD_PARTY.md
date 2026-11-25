# Third-Party Notices

## dsh-computer-use-win

- **Location**: `engine/` (excluding `engine/independent/`)
- **Upstream**: `Yu-tao-Li/dsh-computer-use-win` (v0.6.3)
- **License**: MIT License (see `engine/LICENSE` and `engine/THIRD_PARTY.md`)
- **Modifications in Azure Wand**:
  - Removed host-specific adapters (`dsh-plugin.mjs`, `client.js`, host restart/update-guard scripts).
  - Replaced overlay brand strings and preview texts with Azure Wand / 苍蓝魔杖 localization.
  - Redesigned native Windows overlay rendering (`windows-takeover.cs` + `wcu-takeover-netfx.dll`) with 4 customizable glass card themes (`azure`, `abyss`, `lavender`, `frost`) and customizable pointer tag text (`cursorTagText`).

## dsh-independent-input

- **Location**: `engine/independent/sidecar.ps1` (source code adapted)
- **Upstream**: `dsh-independent-input` (v0.2.0), Copyright (c) 2026 冬草里的鱼
- **License**: MIT License (source code)

## Bundled Cursor Packs & Artwork Credits

- **苍蓝星芒 (`builtin` · `engine/independent/assets/`)**:
  - Original 15-state animated procedural cursor artwork created for Azure Wand, licensed under MIT.
- **Gemini · 经典紫晶原版 & Plus 醒目符号版 (`gemini-original`, `gemini-plus` · `engine/independent/packs/`)**:
  - Source: [nibushiyigeren123-bot/gemini-cursors (v1.3.0)](https://github.com/nibushiyigeren123-bot/gemini-cursors/releases/tag/v1.3.0) (freely shared online).
- **夏日镜华 · 泳装动画套装 (`summer-kyoka` · `engine/independent/packs/`)**:
  - Source: Bilibili [BV1FPbVzFEC3](https://www.bilibili.com/video/BV1FPbVzFEC3/) (freely shared online).
- **DeepSeek · 鲸鱼娘 (`deepseek-whale` · `engine/independent/packs/`)**:
  - Source: [dsh-independent-input](https://github.com/Yu-tao-Li/dsh-independent-input) (publicly shared free cursor artwork).

All third-party freely shared cursor artwork remains the property of its respective original creators and is included strictly for non-commercial community experience. Users can also import their own custom cursor packs locally into `~/.gemini/azure-wand/cursor-packs/`.
