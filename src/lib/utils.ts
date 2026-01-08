import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { startOfDay, endOfDay } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Color utility functions
export function hslStringToHex(hslString: string): string {
  // Parse HSL string like "hsl(210, 40%, 50%)"
  const match = hslString.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return '#000000';

  const h = parseInt(match[1]) / 360;
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getContrastTextColor(hexColor: string): string {
  // Remove # if present
  const color = hexColor.replace('#', '');

  // Convert to RGB
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 2), 16);
  const b = parseInt(color.substring(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black or white based on luminance
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Convert hex color to OKLCH format for Tailwind CSS v4
export function hexToOklch(hex: string): string {
  // Remove # if present
  const color = hex.replace('#', '');

  // Convert to RGB
  const r = parseInt(color.substring(0, 2), 16) / 255;
  const g = parseInt(color.substring(2, 4), 16) / 255;
  const b = parseInt(color.substring(4, 6), 16) / 255;

  // Convert RGB to linear RGB
  const toLinear = (c: number) => {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };

  const rLinear = toLinear(r);
  const gLinear = toLinear(g);
  const bLinear = toLinear(b);

  // Convert to XYZ (D65 illuminant)
  const x = 0.4124564 * rLinear + 0.3575761 * gLinear + 0.1804375 * bLinear;
  const y = 0.2126729 * rLinear + 0.7151522 * gLinear + 0.0721750 * bLinear;
  const z = 0.0193339 * rLinear + 0.1191920 * gLinear + 0.9503041 * bLinear;

  // Convert XYZ to OKLab
  const l_ = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z);
  const m_ = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z);
  const s_ = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z);

  const l = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
  const b_lab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

  // Convert to OKLCH
  const lightness = l;
  const chroma = Math.sqrt(a * a + b_lab * b_lab);
  let hue = Math.atan2(b_lab, a) * 180 / Math.PI;
  if (hue < 0) hue += 360;

  // Format as OKLCH string with reasonable precision
  return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(3)})`;
}

// Convert OKLCH color to hex format
export function oklchToHex(oklch: string): string {
  // Parse OKLCH string like "oklch(0.628 0.258 29.234)"
  const match = oklch.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (!match) return '#000000';

  const lightness = parseFloat(match[1]);
  const chroma = parseFloat(match[2]);
  const hue = parseFloat(match[3]) * Math.PI / 180; // Convert to radians

  // Convert OKLCH to OKLab
  const a = chroma * Math.cos(hue);
  const b_lab = chroma * Math.sin(hue);

  // Convert OKLab to XYZ
  const l_ = lightness + 0.3963377774 * a + 0.2158037573 * b_lab;
  const m_ = lightness - 0.1055613458 * a - 0.0638541728 * b_lab;
  const s_ = lightness - 0.0894841775 * a - 1.2914855480 * b_lab;

  const l_cubed = l_ * l_ * l_;
  const m_cubed = m_ * m_ * m_;
  const s_cubed = s_ * s_ * s_;

  const x = 1.2270138511 * l_cubed - 0.5577999807 * m_cubed + 0.2812561490 * s_cubed;
  const y = -0.0405801784 * l_cubed + 1.1122568696 * m_cubed - 0.0716766787 * s_cubed;
  const z = -0.0763812845 * l_cubed - 0.4214819784 * m_cubed + 1.5861632204 * s_cubed;

  // Convert XYZ to linear RGB
  const rLinear = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const gLinear = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
  const bLinear = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;

  // Convert linear RGB to sRGB
  const toSRGB = (c: number) => {
    c = Math.max(0, Math.min(1, c)); // Clamp to [0, 1]
    return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };

  const r = Math.round(toSRGB(rLinear) * 255);
  const g = Math.round(toSRGB(gLinear) * 255);
  const b = Math.round(toSRGB(bLinear) * 255);

  // Convert to hex
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, c)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}


export const getOrderStatusVariant = (status: string) => {
  switch (status) {
    case 'completed':
      return 'default';
    case 'cancelled':
      return 'destructive';
    case 'pending':
      return 'outline';
    case 'refunded':
      return 'destructive';
    default:
      return 'secondary';
  }
};

export function isDateInRange(
  raw: unknown,
  range: { from?: Date; to?: Date } | undefined
): boolean {
  if (!range || !range.from) return true;
  let d: Date | null = null;
  if (raw instanceof Date) d = raw;
  else if (typeof raw === "string" || typeof raw === "number") {
    const parsed = new Date(raw);
    d = Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!d) return false;
  const start = startOfDay(new Date(range.from));
  const end = endOfDay(new Date(range.to ?? range.from));
  return d >= start && d <= end;
}
