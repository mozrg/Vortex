let vortexDropdownIndex = 0;

function renderVortexDropdown({ label, prefix = '', options, value, className = '', input = '', kind = '' }) {
  const id = 'vortex-options-' + ++vortexDropdownIndex;
  const selected = options.find(option => option.value === value) || options[0];
  const glyph = option => option.glyph ? icon(option.glyph, 14) : '';
  return `<div class="vortex-dropdown ${className}" data-vortex-dropdown="${kind}">
    ${input}
    <button class="vortex-dropdown-trigger control-button" type="button" aria-haspopup="listbox" aria-controls="${id}" aria-expanded="false"
      aria-label="${escapeHtml(label)}" aria-describedby="${id}-value">
      ${prefix ? `<span class="vortex-dropdown-prefix">${escapeHtml(prefix)}</span>` : ''}
      <span class="vortex-dropdown-value" id="${id}-value">${glyph(selected)}<span>${escapeHtml(selected.text)}</span></span>${icon('chevronDown', 13)}
    </button>
    <div class="vortex-dropdown-panel" id="${id}" role="listbox" aria-label="${escapeHtml(label)}" popover="manual" hidden>
      ${options.map(option => `<button class="vortex-dropdown-option" type="button" role="option" tabindex="-1"
        data-vortex-option="${escapeHtml(option.value)}" aria-selected="${option.value === selected.value}"
        ${option.disabled ? 'disabled' : ''} ${option.action || ''}>
        ${glyph(option)}<span>${escapeHtml(option.text)}</span><i class="vortex-dropdown-check" aria-hidden="true">${icon('check', 13)}</i>
      </button>`).join('')}
    </div></div>`;
}

function renderVortexPopup({ label, trigger, panel, className = '', triggerClass = '' }) {
  const id = 'vortex-options-' + ++vortexDropdownIndex;
  return `<div class="vortex-dropdown ${className}" data-vortex-dropdown>
    <button type="button" data-vortex-trigger class="${triggerClass}" aria-label="${escapeHtml(label)}"
      data-tooltip="${escapeHtml(label)}" aria-controls="${id}" aria-expanded="false">${trigger}</button>
    <div class="vortex-dropdown-panel" id="${id}" role="group" aria-label="${escapeHtml(label)}" tabindex="-1" popover="manual" hidden>${panel}</div>
  </div>`;
}

(() => {
  const GAP = 7;
  const EDGE = 8;
  const supportsPopover = typeof HTMLElement.prototype.showPopover === 'function';
  const tipTarget = '[data-tooltip], button[aria-label], a[aria-label], summary[aria-label], [data-window-drag]';
  const triggerSelector = '.vortex-dropdown-trigger, [data-vortex-trigger]';
  let tip, pendingTip, activeTip, tipTimer, leaveTimer, tipOpenedByKeyboard = false;
  let menu, menuClosing, typeahead = '', lastType = 0;

  function setPopup(node, open) {
    if (!node?.isConnected) return;
    if (!supportsPopover) {
      node.removeAttribute('popover');
      node.hidden = !open;
      return;
    }
    node.hidden = false;
    if (open && !node.matches(':popover-open')) node.showPopover();
    if (!open && node.matches(':popover-open')) node.hidePopover();
  }

  function placePopup(node, anchor, dropdown = false) {
    const rect = anchor.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - GAP - EDGE;
    const above = rect.top - GAP - EDGE;
    if (dropdown) {
      node.style.minWidth = Math.min(window.innerWidth - 2 * EDGE, rect.width) + 'px';
      node.style.maxHeight = Math.min(320, Math.max(60, above, below)) + 'px';
    }
    const { width, height } = node.getBoundingClientRect();
    const flip = below < height && above > below;
    const x = dropdown ? rect.left : rect.left + (rect.width - width) / 2;
    const y = flip ? rect.top - height - GAP : rect.bottom + GAP;
    node.dataset.side = flip ? 'above' : 'below';
    node.style.left = Math.max(EDGE, Math.min(window.innerWidth - width - EDGE, x)) + 'px';
    node.style.top = Math.max(EDGE, Math.min(window.innerHeight - height - EDGE, y)) + 'px';
  }

  function tooltipFor(node) {
    const target = node?.closest?.(tipTarget);
    if (!target || target.closest('[data-preview], .vortex-dropdown-panel')) return null;
    if (target.matches('[data-no-tooltip], .friends-drawer-backdrop, .quick-game-modal-backdrop')) return null;
    if (target.hasAttribute('data-tooltip')) return target;
    const name = target.getAttribute('aria-label');
    const visible = target.textContent.trim();
    return name && (!visible || visible === '•••' || target.matches('[data-window-drag]')) ? target : null;
  }

  function closeTooltip(immediate = false) {
    clearTimeout(tipTimer);
    clearTimeout(leaveTimer);
    pendingTip = null;
    if (!activeTip) return;
    if (tip.id && activeTip.hasAttribute('aria-describedby')) {
      const refs = activeTip.getAttribute('aria-describedby').split(/\s+/).filter(id => id !== tip.id);
      if (refs.length) activeTip.setAttribute('aria-describedby', refs.join(' '));
      else activeTip.removeAttribute('aria-describedby');
    }
    activeTip = null;
    tipOpenedByKeyboard = false;
    tip.inert = true;
    setPopup(tip, false);
    if (immediate) tip.getAnimations().forEach(effect => effect.finish());
  }

  function showTooltip(target, byKeyboard = false) {
    const text = (target.dataset.tooltip ?? target.getAttribute('aria-label'))?.trim();
    if (!text || !target.isConnected || !target.getClientRects().length || document.body.matches('.no-tooltips, .library-drag-active')) return;
    if (!byKeyboard && !target.matches(':hover')) return;
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'vortex-tooltip';
      tip.className = 'vortex-tooltip';
      tip.role = 'tooltip';
      tip.setAttribute('popover', 'manual');
      tip.hidden = true;
      document.body.append(tip);
    }
    activeTip = target;
    tipOpenedByKeyboard = byKeyboard;
    tip.inert = false;
    tip.textContent = text;
    if (target.matches(':focus-visible') && text !== target.getAttribute('aria-label')) {
      const refs = target.getAttribute('aria-describedby');
      target.setAttribute('aria-describedby', refs ? refs + ' ' + tip.id : tip.id);
    }
    setPopup(tip, true);
    placePopup(tip, target);
  }

  function queueTooltip(target, delay, byKeyboard = false) {
    clearTimeout(leaveTimer);
    if (activeTip === target || pendingTip === target) return;
    closeTooltip();
    if (!target || document.body.matches('.no-tooltips, .library-drag-active')) return;
    pendingTip = target;
    tipTimer = setTimeout(() => { pendingTip = null; showTooltip(target, byKeyboard); }, delay);
  }

  function dropdownOptions(panel) {
    return [...panel.querySelectorAll('button:not(:disabled)')];
  }

  function closeMenu(returnFocus = false) {
    if (!menu || menuClosing) return;
    menuClosing = true;
    const { trigger, panel } = menu;
    menu = null;
    typeahead = '';
    trigger.setAttribute('aria-expanded', 'false');
    panel.inert = true;
    setPopup(panel, false);
    if (returnFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
    menuClosing = false;
  }

  function openMenu(trigger, last = false) {
    closeMenu();
    closeTooltip(true);
    const root = trigger.closest('[data-vortex-dropdown]');
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));
    if (!panel) return;
    menu = { trigger, root, panel };
    panel.inert = false;
    trigger.setAttribute('aria-expanded', 'true');
    setPopup(panel, true);
    placePopup(panel, trigger, true);
    const options = dropdownOptions(panel);
    const focus = options.find(option => option.getAttribute('aria-selected') === 'true') || options.at(last ? -1 : 0);
    (focus || panel).focus({ preventScroll: true });
    focus?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }

  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch' || menu) return;
    queueTooltip(tooltipFor(event.target), 420, false);
  });
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    if (activeTip && !tipOpenedByKeyboard && (!activeTip.isConnected || !activeTip.matches(':hover'))) {
      closeTooltip();
    }
    if (pendingTip && (!pendingTip.isConnected || !pendingTip.matches(':hover'))) {
      clearTimeout(tipTimer);
      pendingTip = null;
    }
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    const target = tooltipFor(event.target);
    if (target?.contains(event.relatedTarget)) return;
    if (!target && !activeTip && !pendingTip) return;
    if (tipOpenedByKeyboard && activeTip?.matches(':focus-visible')) return;
    if (activeTip?.contains(event.relatedTarget)) return;
    clearTimeout(tipTimer);
    pendingTip = null;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(closeTooltip, 80);
  });
  document.documentElement.addEventListener('pointerleave', () => closeTooltip());
  document.addEventListener('focusin', event => {
    if (menu) {
      if (!menu.root.contains(event.target)) closeMenu();
      return;
    }
    const target = event.target.matches?.(':focus-visible') && tooltipFor(event.target);
    if (target) queueTooltip(target, 240, true);
    else if (activeTip && !activeTip.contains(event.target)) closeTooltip();
  });
  document.addEventListener('focusout', event => {
    const target = tooltipFor(event.target);
    if (target === activeTip || target === pendingTip) closeTooltip();
  });
  document.addEventListener('pointerdown', event => {
    if (!tip?.contains(event.target)) closeTooltip();
    if (menu && !menu.root.contains(event.target)) closeMenu();
  }, true);

  document.addEventListener('click', event => {
    const trigger = event.target.closest?.(triggerSelector);
    if (trigger) {
      if (menu?.trigger === trigger) closeMenu(true);
      else openMenu(trigger);
      return;
    }
    const option = event.target.closest?.('[data-vortex-option]');
    if (!menu?.panel.contains(option) || option.disabled) {
      if (menu?.panel.contains(event.target) && event.target.closest('button:not(:disabled)')) closeMenu(true);
      if (menu && !menu.root.contains(event.target)) closeMenu();
      return;
    }
    const { root, panel } = menu;
    const value = option.dataset.vortexOption;
    const field = root.querySelector('[data-vortex-field]');
    root.querySelector('.vortex-dropdown-value').replaceChildren(
      ...[...option.childNodes].filter(node => node.nodeType === Node.ELEMENT_NODE && !node.matches('i')).map(node => node.cloneNode(true))
    );
    panel.querySelector('[aria-selected="true"]')?.setAttribute('aria-selected', 'false');
    option.setAttribute('aria-selected', 'true');
    closeMenu(true);
    if (field && field.value !== value) {
      field.value = value;
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeTooltip();
    const trigger = event.target.closest?.(triggerSelector);
    if (!menu) {
      if (!trigger || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      openMenu(trigger, event.key === 'ArrowUp');
      return;
    }
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      event.stopImmediatePropagation();
      closeMenu(true);
      return;
    }
    if (!menu.root.contains(event.target)) return;
    const options = dropdownOptions(menu.panel);
    let index = options.indexOf(document.activeElement);
    const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (step) index = Math.max(0, Math.min(options.length - 1, index + step));
    else if (event.key === 'Home' || event.key === 'End') index = event.key === 'Home' ? 0 : options.length - 1;
    else if (event.key.length === 1 && event.key.trim() && !event.altKey && !event.ctrlKey && !event.metaKey) {
      if (performance.now() - lastType > 550) typeahead = '';
      typeahead += event.key.toLocaleLowerCase();
      lastType = performance.now();
      index = options.findIndex(option => option.textContent.trim().toLocaleLowerCase().startsWith(typeahead));
    } else return;
    event.preventDefault();
    event.stopPropagation();
    options[index]?.focus({ preventScroll: true });
    options[index]?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, true);

  const FOCUSABLE_SELECTOR = 'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

  function activeModalDialog() {
    const dialogs = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].filter((el) => {
      if (!el.isConnected || el.hidden || el.closest('[hidden]')) return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    });
    return dialogs.length ? dialogs[dialogs.length - 1] : null;
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || menu) return;
    const dialog = activeModalDialog();
    if (!dialog) return;
    const focusables = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) =>
      !el.hidden && !el.closest('[hidden]') && (el.offsetWidth > 0 || el.offsetHeight > 0)
    );
    if (!focusables.length) {
      event.preventDefault();
      dialog.focus?.();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, true);

  document.addEventListener('scroll', event => {
    if (!tip?.contains(event.target)) closeTooltip();
    if (menu && !menu.panel.contains(event.target)) placePopup(menu.panel, menu.trigger, true);
  }, true);
  window.addEventListener('resize', () => { closeTooltip(); closeMenu(); });
  window.addEventListener('blur', () => { closeTooltip(true); closeMenu(); });

  window.vortexOverlays = {
    closeTooltip,
    closeMenu,
    activeModalDialog,
    enableTooltips(enabled) {
      document.body.classList.toggle('no-tooltips', !enabled);
      if (!enabled) closeTooltip(true);
    }
  };
})();
