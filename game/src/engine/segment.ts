// Seven-segment LED renderer (original look of the robots' number screens), drawn into canvases.

//   aaa
//  f   b
//   ggg
//  e   c
//   ddd
const DIGITS: { [k: string]: string } = {
  '0': 'abcdef', '1': 'bc', '2': 'abged', '3': 'abgcd', '4': 'fgbc', '5': 'afgcd',
  '6': 'afgedc', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', '−': 'g', ' ': '',
};

function seg(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, t: number, horizontal: boolean) {
  const h = t / 2;
  ctx.beginPath();
  if (horizontal) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + h, y - h);
    ctx.lineTo(x + len - h, y - h);
    ctx.lineTo(x + len, y);
    ctx.lineTo(x + len - h, y + h);
    ctx.lineTo(x + h, y + h);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + h, y + h);
    ctx.lineTo(x + h, y + len - h);
    ctx.lineTo(x, y + len);
    ctx.lineTo(x - h, y + len - h);
    ctx.lineTo(x - h, y + h);
  }
  ctx.closePath();
  ctx.fill();
}

function drawDigit(ctx: CanvasRenderingContext2D, ch: string, x: number, y: number, w: number, hgt: number,
  t: number, on: string, off: string) {
  const lit = DIGITS[ch] !== undefined ? DIGITS[ch] : '';
  const g = t * 0.18;
  const half = hgt / 2;
  const S: { [k: string]: [number, number, number, boolean] } = {
    a: [x + g, y, w - 2 * g, true],
    g: [x + g, y + half, w - 2 * g, true],
    d: [x + g, y + hgt, w - 2 * g, true],
    f: [x, y + g, half - 2 * g, false],
    b: [x + w, y + g, half - 2 * g, false],
    e: [x, y + half + g, half - 2 * g, false],
    c: [x + w, y + half + g, half - 2 * g, false],
  };
  const keys = 'abcdefg';
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const s = S[k];
    const isOn = lit.indexOf(k) >= 0;
    ctx.fillStyle = isOn ? on : off;
    ctx.shadowBlur = isOn ? t * 1.6 : 0;
    seg(ctx, s[0], s[1], s[2], t, s[3]);
  }
}

function drawSymbol(ctx: CanvasRenderingContext2D, ch: string, cx: number, cy: number, size: number, t: number, on: string) {
  ctx.fillStyle = on;
  ctx.strokeStyle = on;
  ctx.shadowBlur = t * 1.6;
  ctx.lineWidth = t;
  ctx.lineCap = 'round';
  const s = size * 0.42;
  ctx.beginPath();
  if (ch === '+') {
    ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.moveTo(cx, cy - s); ctx.lineTo(cx, cy + s);
    ctx.stroke();
  } else if (ch === '×') {
    const d = s * 0.75;
    ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d);
    ctx.stroke();
  } else if (ch === '÷') {
    ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.65, t * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.65, t * 0.7, 0, Math.PI * 2); ctx.fill();
  } else if (ch === '=') {
    ctx.moveTo(cx - s, cy - s * 0.35); ctx.lineTo(cx + s, cy - s * 0.35);
    ctx.moveTo(cx - s, cy + s * 0.35); ctx.lineTo(cx + s, cy + s * 0.35);
    ctx.stroke();
  } else if (ch === '?') {
    ctx.arc(cx, cy - s * 0.45, s * 0.55, Math.PI * 1.05, Math.PI * 2.35);
    ctx.lineTo(cx, cy + s * 0.25);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.85, t * 0.7, 0, Math.PI * 2); ctx.fill();
  }
}

export interface LedStyle {
  on: string;
  off: string;
  glow: string;
  bg: string;
  border?: string;
}

export const LED_RED: LedStyle = { on: '#ff5a3c', off: 'rgba(255,60,40,0.07)', glow: '#ff2a10', bg: '#0b0405', border: '#2a0e0e' };
export const LED_GREEN: LedStyle = { on: '#6dffb0', off: 'rgba(80,255,160,0.06)', glow: '#20ff90', bg: '#030b07', border: '#0e2a1c' };
export const LED_CYAN: LedStyle = { on: '#7ff3ff', off: 'rgba(80,230,255,0.06)', glow: '#20d8ff', bg: '#03090b', border: '#0e222a' };
export const LED_DIM: LedStyle = { on: '#3a1512', off: 'rgba(255,60,40,0.03)', glow: '#000', bg: '#060304', border: '#1a0a0a' };

/** Draws `text` (digits and + − × ÷ = ?) centred in the canvas. */
export function drawLed(canvas: HTMLCanvasElement, text: string, style: LedStyle, pad = 0.14) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = style.bg;
  ctx.fillRect(0, 0, W, H);
  if (style.border) {
    ctx.strokeStyle = style.border;
    ctx.lineWidth = Math.max(2, H * 0.04);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  }
  // scanlines for the screen feel
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  const chars = text.split('');
  const hgt = H * (1 - pad * 2);
  let dw = hgt * 0.52;
  let gap = hgt * 0.16;
  const symW = hgt * 0.62;
  const widthOf = (dwv: number, gapv: number) => {
    let total = 0;
    for (let i = 0; i < chars.length; i++) total += (DIGITS[chars[i]] !== undefined && chars[i] !== ' ' ? dwv : chars[i] === ' ' ? gapv : symW) + gapv;
    return total - gapv;
  };
  let total = widthOf(dw, gap);
  const maxW = W * 0.9;
  let scale = 1;
  if (total > maxW) {
    scale = maxW / total;
    dw *= scale;
    gap *= scale;
    total = maxW;
  }
  const t = Math.max(2, hgt * 0.11 * Math.min(1, scale * 1.1));
  const dh = hgt * Math.min(1, 0.6 + scale * 0.4);
  let x = (W - total) / 2;
  const y = (H - dh) / 2;
  ctx.shadowColor = style.glow;
  ctx.lineJoin = 'round';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === ' ') { x += gap * 2; continue; }
    if (DIGITS[ch] !== undefined) {
      drawDigit(ctx, ch, x, y, dw, dh, t, style.on, style.off);
      x += dw + gap;
    } else {
      const sw = symW * scale;
      drawSymbol(ctx, ch, x + sw / 2, H / 2, dh * 0.8, t, style.on);
      x += sw + gap;
    }
  }
  ctx.shadowBlur = 0;
}
