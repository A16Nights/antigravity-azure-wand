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
- **License**: MIT License (source code only)
- **Cursor Artwork Notice**:
  - No third-party cursor artwork from upstream is bundled in this repository.
  - All 15-state animated cursor sprites and preview thumbnails under `engine/independent/assets/` (`Azure Starlight`) are 100% original procedural artwork created for Azure Wand and licensed under MIT.
  - Users may optionally place their own third-party cursor packs locally in `~/.gemini/azure-wand/cursor-packs/<pack-name>/` for personal use.
