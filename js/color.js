function hexToRgb(hex) {
  const normalized = /^#[0-9a-f]{6}$/i.test(String(hex)) ? String(hex) : '#000000';
  return [1, 3, 5].map((index) => parseInt(normalized.slice(index, index + 2), 16));
}

function rgbToHsl(hex) {
  let [red, green, blue] = hexToRgb(hex).map((channel) => channel / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue /= 6;
  }
  return { hue: Math.round(hue * 360), saturation: Math.round(saturation * 100), lightness: Math.round(lightness * 100) };
}

function hslToHex(hue, saturation, lightness) {
  const h = ((Number(hue) % 360) + 360) % 360 / 360;
  const s = Math.max(0, Math.min(100, Number(saturation))) / 100;
  const l = Math.max(0, Math.min(100, Number(lightness))) / 100;
  const channel = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return `#${[channel(0), channel(8), channel(4)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance(hex) {
  const channels = hexToRgb(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function mixHex(first, second, amount) {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  return `#${a.map((value, index) => Math.round(value * (1 - amount) + b[index] * amount).toString(16).padStart(2, '0')).join('')}`;
}

window.__vortexColor = { hexToRgb, rgbToHsl, hslToHex, relativeLuminance, mixHex };
