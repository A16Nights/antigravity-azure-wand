import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { CURSOR_STATE_IDS } from "../engine/independent/engine.mjs";

// Mapping table from standard Windows cursor filenames / INF keys -> Azure Wand 15 states
const STATE_PATTERNS = [
  { state: "pointer", re: /^(normal|arrow|pointer|default|select|01[-_\s]|normal[\s_-]*select|标准|正常|常规|箭头|指针)/i },
  { state: "link", re: /^(link|hand|finger|url|15[-_\s]|link[\s_-]*select|链接|手|超链接)/i },
  { state: "text", re: /^(text|ibeam|beam|caret|05[-_\s]|text[\s_-]*select|文本|输入|工字)/i },
  { state: "work", re: /^(work|working|appstarting|background|bg|03[-_\s]|working[\s_-]*in|后台|工作)/i },
  { state: "busy", re: /^(busy|wait|hourglass|loading|04[-_\s]|繁忙|忙碌|等待)/i },
  { state: "help", re: /^(help|question|02[-_\s]|帮助|问号)/i },
  { state: "unavailiable", re: /^(unavail|unavailable|unavailiable|no|error|forbid|deny|ban|block|07[-_\s]|禁止|不可用|禁用|错误)/i },
  { state: "cross", re: /^(cross|crosshair|precision|prec|06[-_\s]|十字|精确|精准)/i },
  { state: "handwriting", re: /^(handwriting|nwpen|pen|write|draw|13[-_\s]|手写|笔)/i },
  { state: "vert", re: /^(vert|vertical|ns|sizens|size_ns|updown|08[-_\s]|上下|垂直)/i },
  { state: "horz", re: /^(horz|horizontal|ew|we|sizewe|size_we|leftright|09[-_\s]|左右|水平)/i },
  { state: "dgn1", re: /^(dgn1|nwse|sizenwse|size_nwse|diag1|diagonal1|10[-_\s]|斜向1|左上右下|对角1)/i },
  { state: "dgn2", re: /^(dgn2|nesw|sizenesw|size_nesw|diag2|diagonal2|11[-_\s]|斜向2|右上左下|对角2)/i },
  { state: "move", re: /^(move|sizeall|size_all|all|drag|12[-_\s]|移动|全向)/i },
  { state: "alternate", re: /^(alternate|alt|uparrow|up|candidate|14[-_\s]|备用|候选|向上)/i }
];

const INF_KEY_TO_STATE = {
  pointer: "pointer",
  arrow: "pointer",
  help: "help",
  work: "work",
  working: "work",
  appstarting: "work",
  busy: "busy",
  wait: "busy",
  cross: "cross",
  precision: "cross",
  text: "text",
  ibeam: "text",
  hand: "handwriting",
  handwriting: "handwriting",
  nwpen: "handwriting",
  unavailiable: "unavailiable",
  unavailable: "unavailiable",
  no: "unavailiable",
  vert: "vert",
  sizens: "vert",
  horz: "horz",
  sizewe: "horz",
  dgn1: "dgn1",
  sizenwse: "dgn1",
  dgn2: "dgn2",
  sizenesw: "dgn2",
  move: "move",
  sizeall: "move",
  alternate: "alternate",
  uparrow: "alternate",
  link: "link",
  linkselect: "link"
};

function sanitizePackId(name) {
  const slug = String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return slug || `pack-${Date.now()}`;
}

function classifyCursorFileName(fileName) {
  const base = path.basename(fileName, path.extname(fileName)).trim();
  for (const { state, re } of STATE_PATTERNS) {
    if (re.test(base)) return state;
  }
  const low = base.toLowerCase();
  if (low.includes("normal") || low.includes("arrow")) return "pointer";
  if (low.includes("link") || low.includes("hand")) return "link";
  if (low.includes("text") || low.includes("beam")) return "text";
  if (low.includes("appstart") || low.includes("work") || low.includes("background")) return "work";
  if (low.includes("busy") || low.includes("wait")) return "busy";
  if (low.includes("help")) return "help";
  if (low.includes("unavail") || low.includes("error") || low === "no") return "unavailiable";
  if (low.includes("cross") || low.includes("prec")) return "cross";
  if (low.includes("pen") || low.includes("write")) return "handwriting";
  if (low.includes("nwse") || low.includes("dgn1")) return "dgn1";
  if (low.includes("nesw") || low.includes("dgn2")) return "dgn2";
  if (low.includes("sizens") || low.includes("vert") || low === "ns") return "vert";
  if (low.includes("sizewe") || low.includes("horz") || low === "ew" || low === "we") return "horz";
  if (low.includes("sizeall") || low.includes("move")) return "move";
  if (low.includes("uparrow") || low.includes("alt")) return "alternate";
  return null;
}

function parseInfMappings(infFiles) {
  const mapped = {};
  for (const infPath of infFiles) {
    let raw = "";
    try {
      const buf = fs.readFileSync(infPath);
      if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
        raw = buf.subarray(2).toString("utf16le");
      } else {
        raw = buf.toString("utf8");
      }
    } catch {
      continue;
    }
    const dir = path.dirname(infPath);
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*"?([^"\r\n;]+\.(?:cur|ani))"?/i);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const file = m[2].trim();
      const st = INF_KEY_TO_STATE[key];
      if (!st) continue;
      const abs = path.join(dir, file);
      if (fs.existsSync(abs) && !mapped[st]) {
        mapped[st] = abs;
      }
    }
  }
  return mapped;
}

// Pure JS decoder for a single ICO/CUR buffer -> { width, height, hotX, hotY, png?: Buffer, rgba?: Buffer }
export function decodeCurBuffer(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 22) {
    throw new Error("Invalid CUR/ICO buffer");
  }
  const type = buf.readUInt16LE(2);
  const count = buf.readUInt16LE(4);
  if ((type !== 1 && type !== 2) || count < 1) {
    throw new Error(`Unsupported ICO/CUR header type=${type} count=${count}`);
  }

  // Pick the highest-resolution entry
  let best = null;
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16;
    if (off + 16 > buf.length) break;
    const w = buf[off] || 256;
    const h = buf[off + 1] || 256;
    const hotX = buf.readUInt16LE(off + 4);
    const hotY = buf.readUInt16LE(off + 6);
    const bytesInRes = buf.readUInt32LE(off + 8);
    const imgOffset = buf.readUInt32LE(off + 12);
    if (imgOffset + bytesInRes > buf.length) continue;
    const score = w * h;
    if (!best || score > best.score) {
      best = { w, h, hotX: type === 2 ? hotX : 0, hotY: type === 2 ? hotY : 0, bytesInRes, imgOffset, score };
    }
  }
  if (!best) throw new Error("No valid image entry in CUR/ICO");

  const img = buf.subarray(best.imgOffset, best.imgOffset + best.bytesInRes);
  // PNG-encoded icon/cursor entry
  if (img.length >= 8 && img[0] === 0x89 && img[1] === 0x50 && img[2] === 0x4e && img[3] === 0x47) {
    const w = img.readUInt32BE(16);
    const h = img.readUInt32BE(20);
    return { width: w, height: h, hotX: best.hotX, hotY: best.hotY, png: Buffer.from(img) };
  }

  // BITMAPINFOHEADER DIB
  const headerSize = img.readUInt32LE(0);
  const width = img.readInt32LE(4);
  const totalHeight = img.readInt32LE(8);
  const topDown = totalHeight < 0;
  const height = Math.abs(totalHeight) / 2;
  const bpp = img.readUInt16LE(14);
  const clrUsed = img.readUInt32LE(32);

  if (width <= 0 || height <= 0 || width > 1024 || height > 1024) {
    throw new Error(`Invalid DIB dimensions ${width}x${height}`);
  }

  const paletteColors = bpp <= 8 ? (clrUsed || (1 << bpp)) : 0;
  const paletteOff = headerSize;
  const xorOff = paletteOff + paletteColors * 4;
  const xorRowBytes = Math.floor((width * bpp + 31) / 32) * 4;
  const andRowBytes = Math.floor((width + 31) / 32) * 4;
  const andOff = xorOff + xorRowBytes * height;

  const rgba = Buffer.alloc(width * height * 4);
  let hasNonZeroAlpha = false;

  for (let y = 0; y < height; y++) {
    const srcY = topDown ? y : height - 1 - y;
    const rowPtr = xorOff + srcY * xorRowBytes;
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 255;
      if (bpp === 32) {
        const p = rowPtr + x * 4;
        b = img[p] || 0;
        g = img[p + 1] || 0;
        r = img[p + 2] || 0;
        a = img[p + 3] || 0;
        if (a !== 0) hasNonZeroAlpha = true;
      } else if (bpp === 24) {
        const p = rowPtr + x * 3;
        b = img[p] || 0;
        g = img[p + 1] || 0;
        r = img[p + 2] || 0;
      } else if (bpp === 8) {
        const idx = img[rowPtr + x] || 0;
        const p = paletteOff + idx * 4;
        b = img[p] || 0;
        g = img[p + 1] || 0;
        r = img[p + 2] || 0;
      } else if (bpp === 4) {
        const byte = img[rowPtr + (x >> 1)] || 0;
        const idx = (x & 1) === 0 ? (byte >> 4) : (byte & 0x0f);
        const p = paletteOff + idx * 4;
        b = img[p] || 0;
        g = img[p + 1] || 0;
        r = img[p + 2] || 0;
      } else if (bpp === 1) {
        const byte = img[rowPtr + (x >> 3)] || 0;
        const idx = (byte >> (7 - (x & 7))) & 1;
        const p = paletteOff + idx * 4;
        b = img[p] || 0;
        g = img[p + 1] || 0;
        r = img[p + 2] || 0;
      }
      const dst = (y * width + x) * 4;
      rgba[dst] = r;
      rgba[dst + 1] = g;
      rgba[dst + 2] = b;
      rgba[dst + 3] = a;
    }
  }

  // Apply AND mask when bpp < 32 or 32bpp image has all-zero alpha channel
  if ((bpp < 32 || !hasNonZeroAlpha) && andOff + andRowBytes * height <= img.length) {
    for (let y = 0; y < height; y++) {
      const srcY = topDown ? y : height - 1 - y;
      const maskRow = andOff + srcY * andRowBytes;
      for (let x = 0; x < width; x++) {
        const bit = ((img[maskRow + (x >> 3)] || 0) >> (7 - (x & 7))) & 1;
        const dst = (y * width + x) * 4;
        rgba[dst + 3] = bit ? 0 : 255;
      }
    }
  }

  return { width, height, hotX: best.hotX, hotY: best.hotY, rgba };
}

// Pure JS decoder for RIFF ACON (.ani) -> { frames: DecodedCur[], intervalMs }
export function decodeAniBuffer(buf) {
  if (buf.length < 12 || buf.subarray(0, 4).toString("ascii") !== "RIFF" || buf.subarray(8, 12).toString("ascii") !== "ACON") {
    // Some .ani files are actually plain .cur files renamed
    return { frames: [decodeCurBuffer(buf)], intervalMs: 60 };
  }
  let off = 12;
  let dispRate = 4; // jiffies (1/60s)
  const rawFrames = [];
  let seq = null;
  let rates = null;

  while (off + 8 <= buf.length) {
    const id = buf.subarray(off, off + 4).toString("ascii");
    const sz = buf.readUInt32LE(off + 4);
    const dataStart = off + 8;
    const dataEnd = Math.min(buf.length, dataStart + sz);

    if (id === "anih" && sz >= 36) {
      dispRate = buf.readUInt32LE(dataStart + 28) || 4;
    } else if (id === "seq " && sz >= 4) {
      seq = [];
      for (let p = dataStart; p + 4 <= dataEnd; p += 4) {
        seq.push(buf.readUInt32LE(p));
      }
    } else if (id === "rate" && sz >= 4) {
      rates = [];
      for (let p = dataStart; p + 4 <= dataEnd; p += 4) {
        rates.push(buf.readUInt32LE(p));
      }
    } else if (id === "LIST" && dataStart + 4 <= dataEnd && buf.subarray(dataStart, dataStart + 4).toString("ascii") === "fram") {
      let p = dataStart + 4;
      while (p + 8 <= dataEnd) {
        const cid = buf.subarray(p, p + 4).toString("ascii");
        const csz = buf.readUInt32LE(p + 4);
        const cStart = p + 8;
        const cEnd = Math.min(dataEnd, cStart + csz);
        if (cid === "icon" && csz >= 22) {
          try {
            rawFrames.push(decodeCurBuffer(buf.subarray(cStart, cEnd)));
          } catch {}
        }
        p += 8 + csz + (csz & 1);
      }
    }
    off += 8 + sz + (sz & 1);
  }

  if (!rawFrames.length) throw new Error("ANI file contains no decodable frames");

  let ordered = rawFrames;
  if (seq && seq.length > 0) {
    const mapped = seq.map((idx) => rawFrames[idx]).filter(Boolean);
    if (mapped.length > 0) ordered = mapped;
  }
  // Cap extreme frame counts to 32 frames to keep sprites compact
  if (ordered.length > 32) ordered = ordered.slice(0, 32);

  const avgJiffies = rates && rates.length
    ? rates.reduce((a, b) => a + b, 0) / rates.length
    : dispRate;
  const intervalMs = Math.max(25, Math.min(400, Math.round((avgJiffies || 4) * (1000 / 60))));

  return { frames: ordered, intervalMs };
}

export function decodeCursorFile(filePath) {
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".ani") return decodeAniBuffer(buf);
  if (ext === ".cur" || ext === ".ico") return { frames: [decodeCurBuffer(buf)], intervalMs: 60 };
  throw new Error(`Unsupported cursor file: ${filePath}`);
}

function runDotNetSpriteBuilder(jobs, outDir) {
  const specPath = path.join(outDir, "_build_spec.json");
  fs.writeFileSync(specPath, JSON.stringify({ jobs }, null, 2), "utf8");
  const psPath = path.join(outDir, "_build_sprites.ps1");
  const psScript = `
param([string]$SpecPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$spec = [IO.File]::ReadAllText($SpecPath, [Text.Encoding]::UTF8) | ConvertFrom-Json

function Load-FrameBitmap($frameObj) {
  if ($frameObj.pngPath) {
    $bytes = [IO.File]::ReadAllBytes([string]$frameObj.pngPath)
    $ms = New-Object IO.MemoryStream(,$bytes)
    $img = [System.Drawing.Image]::FromStream($ms)
    $bmp = New-Object System.Drawing.Bitmap($img)
    $img.Dispose(); $ms.Dispose()
    return $bmp
  }
  $w = [int]$frameObj.width
  $h = [int]$frameObj.height
  $rgba = [IO.File]::ReadAllBytes([string]$frameObj.rgbaPath)
  $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = [Math]::Abs($data.Stride)
  $bgra = New-Object byte[] ($stride * $h)
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $si = ($y * $w + $x) * 4
      $di = $y * $stride + $x * 4
      $bgra[$di]     = $rgba[$si + 2]
      $bgra[$di + 1] = $rgba[$si + 1]
      $bgra[$di + 2] = $rgba[$si]
      $bgra[$di + 3] = $rgba[$si + 3]
    }
  }
  [Runtime.InteropServices.Marshal]::Copy($bgra, 0, $data.Scan0, $bgra.Length)
  $bmp.UnlockBits($data)
  return $bmp
}

foreach ($job in $spec.jobs) {
  $cell = [int]$job.cellSize
  $cols = 8
  $count = [Math]::Max(1, $job.frames.Count)
  $rows = [int][Math]::Ceiling($count / [double]$cols)
  $sheet = New-Object System.Drawing.Bitmap(($cols * $cell), ($rows * $cell), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gs = [System.Drawing.Graphics]::FromImage($sheet)
  $gs.Clear([System.Drawing.Color]::Transparent)
  $gs.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gs.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $gs.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $overlayBmp = $null
  if ($job.overlayFrame) {
    $overlayBmp = Load-FrameBitmap $job.overlayFrame
  }

  for ($i = 0; $i -lt $count; $i++) {
    $f = $job.frames[$i]
    $src = Load-FrameBitmap $f
    $col = $i % $cols
    $row = [int][Math]::Floor($i / $cols)
    $dx = $col * $cell
    $dy = $row * $cell

    if ($job.compositeMode -eq 'character_with_pointer') {
      # Draw character sprite scaled nicely in bottom-right, and classic pointer icon at top-left (0,0)
      $pad = [int][Math]::Round($cell * 0.14)
      $charSize = $cell - $pad
      $gs.DrawImage($src, $dx + $pad, $dy + $pad, $charSize, $charSize)
      if ($null -ne $overlayBmp) {
        $pSize = [int][Math]::Round($cell * 0.42)
        $gs.DrawImage($overlayBmp, $dx, $dy, $pSize, $pSize)
      }
    } else {
      $gs.DrawImage($src, $dx, $dy, $cell, $cell)
    }

    if ($i -eq 0 -and $job.previewPath) {
      $prev = New-Object System.Drawing.Bitmap(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $gp = [System.Drawing.Graphics]::FromImage($prev)
      $gp.Clear([System.Drawing.Color]::Transparent)
      $gp.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $gp.DrawImage($sheet, (New-Object System.Drawing.Rectangle(0, 0, 64, 64)), (New-Object System.Drawing.Rectangle($dx, $dy, $cell, $cell)), [System.Drawing.GraphicsUnit]::Pixel)
      $gp.Dispose()
      $prev.Save([string]$job.previewPath, [System.Drawing.Imaging.ImageFormat]::Png)
      $prev.Dispose()
    }
    $src.Dispose()
  }

  if ($null -ne $overlayBmp) { $overlayBmp.Dispose() }
  $gs.Dispose()
  $sheet.Save([string]$job.sheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $sheet.Dispose()
}
`;
  fs.writeFileSync(psPath, psScript, "utf8");
  try {
    execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", psPath, "-SpecPath", specPath], {
      windowsHide: true,
      timeout: 60000
    });
  } finally {
    try { fs.unlinkSync(specPath); } catch {}
    try { fs.unlinkSync(psPath); } catch {}
  }
}

function walkFiles(dir, maxDepth = 4, depth = 0, out = []) {
  if (depth > maxDepth || !fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(p, maxDepth, depth + 1, out);
    else out.push(p);
  }
  return out;
}

function findAnimationCursorRoot(rootDir) {
  const direct = path.join(rootDir, "AnimationCursor", "Animations");
  if (fs.existsSync(direct)) return { root: rootDir, animDir: direct };
  for (const e of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const nested = path.join(rootDir, e.name, "AnimationCursor", "Animations");
    if (fs.existsSync(nested)) return { root: path.join(rootDir, e.name), animDir: nested };
  }
  return null;
}

/**
 * Import an external cursor pack (folder, .zip/.rar archive, AnimationCursor bundle, or single .cur/.ani)
 * into `cursorPacksDir/<packId>/`.
 */
export function importCursorPack({
  sourcePath,
  packName,
  packId,
  desc,
  cursorPacksDir,
  cellSize = 128
}) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new Error(`找不到导入路径: ${sourcePath}`);
  }
  fs.mkdirSync(cursorPacksDir, { recursive: true });

  const workTmp = fs.mkdtempSync(path.join(os.tmpdir(), "azure-wand-import-"));
  const rawTmp = path.join(workTmp, "raw");
  const extractTmp = path.join(workTmp, "extracted");
  fs.mkdirSync(rawTmp, { recursive: true });
  fs.mkdirSync(extractTmp, { recursive: true });

  try {
    let scanRoot = sourcePath;
    const stat = fs.statSync(sourcePath);
    const ext = path.extname(sourcePath).toLowerCase();

    if (stat.isFile()) {
      if ([".zip", ".rar", ".7z", ".tar"].includes(ext)) {
        execFileSync("tar.exe", ["-xf", sourcePath, "-C", extractTmp], { windowsHide: true, timeout: 45000 });
        scanRoot = extractTmp;
      } else if ([".cur", ".ani", ".ico", ".png"].includes(ext)) {
        fs.copyFileSync(sourcePath, path.join(extractTmp, path.basename(sourcePath)));
        scanRoot = extractTmp;
      } else {
        throw new Error(`不支持的文件格式: ${ext}（支持文件夹、.zip/.rar、.cur/.ani/.png）`);
      }
    }

    const baseLabel = packName || path.basename(sourcePath, ext);
    const id = sanitizePackId(packId || baseLabel);
    const destRoot = path.join(cursorPacksDir, id);
    const cursorsOut = path.join(destRoot, "cursors");
    const previewsOut = path.join(destRoot, "previews");
    fs.mkdirSync(cursorsOut, { recursive: true });
    fs.mkdirSync(previewsOut, { recursive: true });

    const allFiles = walkFiles(scanRoot, 4);
    const infFiles = allFiles.filter((f) => /\.inf$/i.test(f));
    const curAniFiles = allFiles.filter((f) => /\.(cur|ani|ico)$/i.test(f));

    // Check if it is already a ready-made 15-state PNG sprite directory
    const pngStateMap = {};
    for (const f of allFiles) {
      if (!/\.png$/i.test(f)) continue;
      const base = path.basename(f, ".png").toLowerCase();
      if (CURSOR_STATE_IDS.includes(base) && !pngStateMap[base]) {
        pngStateMap[base] = f;
      }
    }

    const animCursor = findAnimationCursorRoot(scanRoot);
    const jobs = [];
    const metaStates = {};
    let frameFileSeq = 0;

    const materializeDecoded = (decoded) => {
      if (decoded.png) {
        const p = path.join(rawTmp, `f-${++frameFileSeq}.png`);
        fs.writeFileSync(p, decoded.png);
        return { pngPath: p, width: decoded.width, height: decoded.height };
      }
      const p = path.join(rawTmp, `f-${++frameFileSeq}.rgba`);
      fs.writeFileSync(p, decoded.rgba);
      return { rgbaPath: p, width: decoded.width, height: decoded.height };
    };

    if (animCursor) {
      // Special high-res AnimationCursor pack (PNG frame sequence + pointer overlay)
      const rootCurMap = { ...parseInfMappings(infFiles) };
      for (const f of curAniFiles) {
        const st = classifyCursorFileName(f);
        if (st && !rootCurMap[st]) rootCurMap[st] = f;
      }
      const listPngFrames = (folderName) => {
        const dir = path.join(animCursor.animDir, folderName);
        if (!fs.existsSync(dir)) return [];
        return fs.readdirSync(dir)
          .filter((n) => /\.png$/i.test(n))
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
          .map((n) => ({ pngPath: path.join(dir, n) }));
      };

      const animFolderByState = {
        pointer: { folder: "Normal", interval: 60 },
        link: { folder: "Link", interval: 60 },
        text: { folder: "Text", interval: 50 },
        work: { folder: "Background", interval: 60 },
        busy: { folder: "Busy", interval: 45 },
        vert: { folder: "Resize", interval: 50 },
        horz: { folder: "Resize", interval: 50 },
        dgn1: { folder: "Resize", interval: 50 },
        dgn2: { folder: "Resize", interval: 50 },
        move: { folder: "Resize", interval: 50 },
        cross: { folder: "Others", interval: 55 },
        help: { folder: "Others", interval: 55 },
        unavailiable: { folder: "Others", interval: 55 },
        handwriting: { folder: "Others", interval: 55 },
        alternate: { folder: "Normal", interval: 60 }
      };

      const defaultFrames = listPngFrames("Normal");
      for (const st of CURSOR_STATE_IDS) {
        const cfg = animFolderByState[st] || { folder: "Normal", interval: 60 };
        let frames = listPngFrames(cfg.folder);
        if (!frames.length) frames = defaultFrames;
        if (frames.length > 24) frames = frames.slice(0, 24);

        let overlayFrame = null;
        const overlaySrc = rootCurMap[st] || rootCurMap.pointer;
        if (overlaySrc && fs.existsSync(overlaySrc)) {
          try {
            const dec = decodeCursorFile(overlaySrc);
            if (dec.frames[0]) overlayFrame = materializeDecoded(dec.frames[0]);
          } catch {}
        }

        jobs.push({
          state: st,
          cellSize,
          compositeMode: "character_with_pointer",
          frames,
          overlayFrame,
          sheetPath: path.join(cursorsOut, `${st}.png`),
          previewPath: path.join(previewsOut, `${st}.png`)
        });
        metaStates[st] = {
          frames: frames.length,
          intervalMs: cfg.interval,
          cellSize
        };
      }
    } else if (curAniFiles.length > 0) {
      // Standard Windows .cur / .ani cursor set
      const stateFiles = { ...parseInfMappings(infFiles) };
      for (const f of curAniFiles) {
        const st = classifyCursorFileName(f);
        if (st && !stateFiles[st]) stateFiles[st] = f;
      }
      // If user imported a single unnamed .cur/.ani, bind it to pointer
      if (Object.keys(stateFiles).length === 0 && curAniFiles.length > 0) {
        stateFiles.pointer = curAniFiles[0];
      }

      const fallbackFile = stateFiles.pointer || Object.values(stateFiles)[0];
      for (const st of CURSOR_STATE_IDS) {
        const srcFile = stateFiles[st] || fallbackFile;
        if (!srcFile) continue;
        const decoded = decodeCursorFile(srcFile);
        const frameSpecs = decoded.frames.map(materializeDecoded);
        jobs.push({
          state: st,
          cellSize,
          compositeMode: "direct",
          frames: frameSpecs,
          sheetPath: path.join(cursorsOut, `${st}.png`),
          previewPath: path.join(previewsOut, `${st}.png`)
        });
        metaStates[st] = {
          frames: frameSpecs.length,
          intervalMs: decoded.intervalMs,
          cellSize,
          hotX: decoded.frames[0]?.hotX || 0,
          hotY: decoded.frames[0]?.hotY || 0,
          matched: Boolean(stateFiles[st])
        };
      }
    } else if (Object.keys(pngStateMap).length > 0) {
      // Direct PNG pack (copy or resize into 15-state layout)
      const fallbackPng = pngStateMap.pointer || Object.values(pngStateMap)[0];
      for (const st of CURSOR_STATE_IDS) {
        const srcPng = pngStateMap[st] || fallbackPng;
        fs.copyFileSync(srcPng, path.join(cursorsOut, `${st}.png`));
        jobs.push({
          state: st,
          cellSize: 64,
          compositeMode: "direct",
          frames: [{ pngPath: srcPng }],
          sheetPath: path.join(rawTmp, `skip-${st}.png`),
          previewPath: path.join(previewsOut, `${st}.png`)
        });
        metaStates[st] = { frames: 1, intervalMs: 60, cellSize: 64 };
      }
    } else {
      throw new Error("未在目标路径中找到可识别的 .cur / .ani / .png 光标文件");
    }

    if (jobs.length > 0) {
      runDotNetSpriteBuilder(jobs, workTmp);
    }

    const matchedCount = Object.values(metaStates).filter((s) => s.matched !== false).length;
    const packMeta = {
      id,
      name: String(baseLabel).trim(),
      desc: desc || `外部导入光标套装（${matchedCount} 项状态 · ${animCursor ? "高清角色逐帧动画" : "Windows 指针转换"}）`,
      importedAt: new Date().toISOString(),
      sourceKind: animCursor ? "animation-cursor" : curAniFiles.length ? "win-cur-ani" : "png",
      cellSize
    };
    fs.writeFileSync(path.join(destRoot, "pack.json"), JSON.stringify(packMeta, null, 2) + "\n", "utf8");
    fs.writeFileSync(path.join(cursorsOut, "meta.json"), JSON.stringify({ cellSize, states: metaStates }, null, 2) + "\n", "utf8");

    return { ok: true, pack: packMeta, statesCount: Object.keys(metaStates).length, destRoot };
  } finally {
    try { fs.rmSync(workTmp, { recursive: true, force: true }); } catch {}
  }
}
