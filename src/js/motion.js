(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const enabled = () => !reduced.matches && !document.body.matches('.no-motion, .in-game-mode');
  function animate(node, frames, ms = 190) {
    if (!enabled() || !node) return null;
    const css = getComputedStyle(document.documentElement);
    const duration = ms * (Number(css.getPropertyValue('--speed')) || 1) * (Number(css.getPropertyValue('--animation-duration')) || 1);
    return node.animate(frames, { duration, easing: css.getPropertyValue('--animation-easing').trim() || 'cubic-bezier(.2,.75,.25,1)' });
  }

  const folding = new WeakMap();
  function disclose(node, open) {
    const previous = folding.get(node);
    const from = node.hidden ? 0 : node.getBoundingClientRect().height;
    previous?.cancel();
    node.inert = !open;
    node.hidden = false;
    const height = node.getBoundingClientRect().height;
    const effect = animate(node, [
      { height: from + 'px', opacity: from && height ? Math.min(1, from / height) : 0, overflow: 'clip' },
      { height: (open ? height : 0) + 'px', opacity: open ? 1 : 0, overflow: 'clip' }
    ], 210);
    if (!effect) { node.hidden = !open; return; }
    folding.set(node, effect);
    effect.onfinish = () => { if (folding.get(node) === effect) { node.hidden = !open; folding.delete(node); } };
    return effect;
  }

  function dismiss(node) {
    if (!node || node.inert) return;
    node.inert = true;
    const effect = animate(node, [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 -4px' }], 125);
    if (effect) effect.finished.then(() => node.remove(), () => node.remove());
    else node.remove();
  }

  function selectorFor(node) {
    if (node.id) return '#' + CSS.escape(node.id);
    const attrs = [...node.attributes].filter(a => a.name.startsWith('data-') && !a.name.startsWith('data-i18n') && !a.name.startsWith('data-preview'));
    if (!attrs.length) return null;
    return node.tagName + attrs.map(a => '[' + CSS.escape(a.name) + (a.value ? '=' + CSS.escape(a.value) : '') + ']').join('');
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('button:not(:disabled),a[href],summary,label,[role="button"],[role="switch"],[role="option"],[data-game],[data-friend-id],input:not(:disabled),select');
    if (!button || !enabled()) return;
    const selector = selectorFor(button);
    const area = button.closest('nav, #page-content, .sidebar, .workspace-toolbar, .tray-shell');
    const action = button.dataset.action || '';
    const sectionSelector = '.detail-section, .home-widget, .game-card, .game-page-description';
    const section = button.closest(sectionSelector);
    const before = section?.getBoundingClientRect().height;
    requestAnimationFrame(() => {
      const node = button.isConnected ? button : selector && (area?.isConnected ? area : document).querySelector(selector);
      if (!node || !node.getClientRects().length) return;
      animate(node, [{ scale: node.clientWidth > 250 ? '.992' : '.965' }, { scale: '1' }], 165);
      if (event.detail === 0 && !button.isConnected && document.activeElement === document.body) node.focus({ preventScroll: true });
      const next = node.closest(sectionSelector);
      if (before && next && (button.hasAttribute('data-widget-collapse') || /description|badges/.test(action))) {
        const to = next.getBoundingClientRect().height;
        if (Math.abs(before - to) > 2) animate(next, [{ height: before+'px', overflow:'clip' },{ height: to+'px', overflow:'clip' }], 220);
      }
      if (action.startsWith('gallery-')) animate(next?.querySelector('.detail-gallery-slide'), [
        { opacity: .3, translate: (action === 'gallery-prev' ? '-8px' : '8px')+' 0' }, { opacity: 1, translate: '0 0' }
      ], 220);
    });
  }, true);

  document.addEventListener('keydown', event => {
    if (!enabled() || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const scope = event.target.closest?.('#command-palette, .vortex-dropdown, [role="combobox"], .game-search');
    if (!scope) return;
    requestAnimationFrame(() => {
      const selected = scope.querySelector('[aria-selected="true"],.palette-item.active')
        || document.getElementById(event.target.getAttribute('aria-activedescendant'));
      animate(selected, [{ opacity: .7, translate: '0 2px' }, { opacity: 1, translate: '0 0' }], 120);
    });
  });

  window.vortexMotion = { animate, disclose, dismiss };
})();
