const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/><path d="M8 21v-6h8v6"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z"/>',
  heart: '<path d="M20.8 8.9c0 4.2-8.8 10.2-8.8 10.2S3.2 13.1 3.2 8.9a4.2 4.2 0 0 1 7.5-2.6L12 7.8l1.3-1.5a4.2 4.2 0 0 1 7.5 2.6Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  message: '<path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.1-3.2A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 11.5h.01m3.5 0h.01m3.5 0h.01"/>',
  sliders: '<path d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M2 14h4m4-6h4m4 8h4"/>',
  dots: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
  bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  play: '<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>',
  sparkle: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5m6 6-6-6 6-6"/>',
  star: '<path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.7l6.2-.9z"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1.4a2 2 0 0 0 1.5-3.3 1.6 1.6 0 0 1 1.2-2.7h1.2a3.7 3.7 0 0 0 3.7-3.7C21 6.6 17 3 12 3Z"/><path d="M7.5 11h.01M10 7.5h.01m4 0h.01M17 10h.01"/>',
  layout: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>',
  motion: '<path d="M5 12h2l3-7 4 14 3-7h2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5 8.7 8.7 0 1 0 20.5 14.2Z"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  upload: '<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  arrowUpRight: '<path d="M7 17 17 7M7 7h10v10"/>',
  wave: '<path d="M3 15c2.2 0 2.2-6 4.5-6s2.3 6 4.5 6 2.3-6 4.5-6 2.3 6 4.5 6"/><path d="M4 20h16"/>',
  handWave: '<path d="M7.8 12V5.8a1.7 1.7 0 0 1 3.4 0v4.1-6.1a1.7 1.7 0 0 1 3.4 0v6.1-4.5a1.7 1.7 0 0 1 3.4 0v6.3l.6-1.2a2 2 0 0 1 3.5 1.7l-2.5 5.2a6.3 6.3 0 0 1-5.7 3.6h-1.5a6 6 0 0 1-5.1-2.8l-2.4-3.7a2 2 0 0 1 3.4-2.1l1.5 2V12Z"/><path d="M3 8c1-1 1-2 0-3m3 2c1-1 1-2 0-3"/>',
  gamepad: '<path d="M6.5 11.5h11a4.5 4.5 0 0 1 4.3 5.9l-.5 1.5a2.4 2.4 0 0 1-3.8 1.1L14.8 17h-5.6l-2.7 3a2.4 2.4 0 0 1-3.8-1.1l-.5-1.5a4.5 4.5 0 0 1 4.3-5.9Z"/><path d="M8 8V4m-2 2h4m7 0h.01M19 8h.01"/>',
  sword: '<path d="m14 6 4-3 3 3-3 4m-2-2L8 16m-2 0-3 3 2 2 3-3m-4-2 4 4"/><path d="m15 5 4 4"/>',
  door: '<path d="M5 21V4l14-2v19M5 21h16M9 21V7l7-1v15"/><path d="M13 14h.01"/>',
  mountain: '<path d="m3 19 6-11 4 6 3-4 5 9H3Z"/><path d="m7 12 2 2 2-2m2 2 2 2 2-2"/>',
  crosshair: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  paw: '<path d="M12 13c-3.5 0-6.5 3-6.5 5.3 0 1.5 1 2.7 2.6 2.7 1.4 0 2.2-.8 3.9-.8s2.5.8 3.9.8c1.6 0 2.6-1.2 2.6-2.7C18.5 16 15.5 13 12 13Z"/><ellipse cx="5.5" cy="10" rx="2" ry="2.8" transform="rotate(-24 5.5 10)"/><ellipse cx="10" cy="6.5" rx="2" ry="2.8"/><ellipse cx="15.5" cy="6.5" rx="2" ry="2.8"/><ellipse cx="19" cy="10" rx="2" ry="2.8" transform="rotate(24 19 10)"/>',
  run: '<circle cx="15" cy="5" r="2"/><path d="m12 10 3-2 3 2 2 5m-8-5-2 4-4 2m6-6-1 5 4 2 2 5m-9-5 3 1-2 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 5v16m5-13h7m-7 4h7"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="10" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.2a4 4 0 0 1 0 7.6"/>',
  trophy: '<path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/>',
  thumb: '<path d="M7 10v11H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 21h10a2 2 0 0 0 2-1.6l2-8A2 2 0 0 0 19 9h-6l1-5-1-1-6 7"/>',
  flag: '<path d="M5 21V5m0 0c6-4 9 4 15 0v10c-6 4-9-4-15 0"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V4h9l8.6 6.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="8" r="1"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 4-2 4s2.7-.5 4-2c.8-.9.8-2.2-.1-3s-2.1-.9-3 .1Z"/><path d="m12 15-3-3a22 22 0 0 1 2-4c2.5-3.4 6-4.9 10-5-.1 4-1.6 7.5-5 10a22 22 0 0 1-4 2Z"/><path d="M9 12H5l-2 3m9 0v4l-3 2"/><circle cx="15.5" cy="8.5" r="1.5"/>',
  headphones: '<path d="M3 13v-2a9 9 0 0 1 18 0v2"/><path d="M5 13h2v7H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2Zm14 0h-2v7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2Z"/>',
  wand: '<path d="m15 4 5 5M4 20l11-11M5 6v4m-2-2h4m11 7v4m-2-2h4"/>',
  slidersHorizontal: '<path d="M4 7h9m4 0h3M4 17h3m4 0h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  windowMinimize: '<path d="M5 12h14"/>',
  windowMaximize: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
  windowRestore: '<rect x="8" y="5" width="11" height="11" rx="1.5"/><path d="M16 16v3H5V8h3"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  navUp: '<path d="M12 19V5m-7 7 7-7 7 7"/>',
  navDown: '<path d="M12 5v14m7-7-7 7-7-7"/>',
  grip: '<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>',
  tray: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 15h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
};

function icon(name, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.sparkle}</svg>`;
}

function mountIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((node) => {
    node.innerHTML = icon(node.dataset.icon, 17);
  });
}

// Classic-script mode: publish for app.js (file:// and Electron both work).
window.__vortexIcons = { icons, icon, mountIcons };
