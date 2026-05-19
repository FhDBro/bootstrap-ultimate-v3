(function () {
  'use strict';
  if (window.__fwrtGlobalFixes) return;
  window.__fwrtGlobalFixes = true;

  function qsa(sel, root) {
    root = root || document;
    var nodes = [];

    if (root.nodeType === 1 && root.matches && root.matches(sel))
      nodes.push(root);

    if (root.querySelectorAll)
      nodes = nodes.concat(Array.prototype.slice.call(root.querySelectorAll(sel)));

    return nodes;
  }

  var gridGlowInitPromise = null;
  var storageBackend = null;

  function storageAvailable(area) {
    if (!area) return false;
    try {
      var key = '__fwrt-grid-glow-probe__';
      area.setItem(key, '1');
      area.removeItem(key);
      return true;
    }
    catch (e) {
      return false;
    }
  }

  function getStorage() {
    if (storageBackend !== null) return storageBackend;
    try {
      if (storageAvailable(window.localStorage)) {
        storageBackend = window.localStorage;
        return storageBackend;
      }
    }
    catch (e) {}

    try {
      if (storageAvailable(window.sessionStorage)) {
        storageBackend = window.sessionStorage;
        return storageBackend;
      }
    }
    catch (e) {}

    storageBackend = false;
    return null;
  }

  function storageGet(key) {
    var area = getStorage();
    if (!area) return null;
    try {
      return area.getItem(key);
    }
    catch (e) {
      return null;
    }
  }

  function storageSet(key, value) {
    var area = getStorage();
    if (!area) return false;
    try {
      area.setItem(key, String(value));
      return true;
    }
    catch (e) {
      return false;
    }
  }

  function authSessionKey() {
    var cookie = document.cookie || '';
    var match = cookie.match(/(?:^|;\s*)(sysauth_https|sysauth)=([^;]+)/);
    return match ? (match[1] + ':' + match[2]) : 'anon';
  }

  function gridGlowKey(name) {
    return 'fwrt-grid-glow:' + authSessionKey() + ':' + name;
  }

  function normalizeConnectedDeviceCount(value) {
    var count = parseInt(value, 10);
    if (!isFinite(count) || count < 0) count = 0;
    return count;
  }

  function gridGlowStrength(count) {
    var strength = 0.12 + (normalizeConnectedDeviceCount(count) * 0.012);
    if (strength < 0.12) strength = 0.12;
    if (strength > 0.34) strength = 0.34;
    return strength;
  }

  function connectedDevicesCount() {
    if (!window.L || typeof L.require !== 'function')
      return Promise.resolve(0);

    return L.require('rpc').then(function (rpc) {
      if (!rpc || typeof rpc.declare !== 'function')
        return 0;

      var callHostHints = rpc.declare({ object: 'luci-rpc', method: 'getHostHints', expect: { '': {} } });

      return callHostHints().then(function (hosts) {
        if (!hosts || typeof hosts !== 'object')
          return 0;

        return Object.keys(hosts).length;
      }).catch(function () {
        return 0;
      });
    }).catch(function () {
      return 0;
    });
  }

  function scheduleGridGlowReveal(body) {
    if (!window.requestAnimationFrame) {
      body.classList.add('fwrt-grid-glow-ready');
      return;
    }

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (document.body === body)
          body.classList.add('fwrt-grid-glow-ready');
      });
    });
  }

  function applyGridGlow(count, instant) {
    if (!document.body) return;

    var body = document.body;
    var strength = gridGlowStrength(count);
    var opacity = 0.11 + (strength * 0.42);
    var blur = 0.45 + (strength * 1.0);
    if (opacity > 0.28) opacity = 0.28;
    if (blur > 0.90) blur = 0.90;

    body.style.setProperty('--fwrt-grid-glow-strength', strength.toFixed(3));
    body.style.setProperty('--fwrt-grid-glow-opacity', opacity.toFixed(3));
    body.style.setProperty('--fwrt-grid-glow-blur', blur.toFixed(2) + 'px');

    if (instant)
      body.classList.add('fwrt-grid-glow-ready');
    else
      scheduleGridGlowReveal(body);
  }

  function initGridGlow() {
    if (gridGlowInitPromise)
      return gridGlowInitPromise;

    if (!document.body)
      return Promise.resolve(0);

    var page = document.body.getAttribute('data-page') || '';
    if (!page || page === 'login' || document.body.classList.contains('login'))
      return Promise.resolve(0);

    var countKey = gridGlowKey('count');
    var seenKey = gridGlowKey('seen');
    var cachedCount = storageGet(countKey);
    var seen = storageGet(seenKey) === '1';

    if (cachedCount !== null) {
      var rememberedCount = normalizeConnectedDeviceCount(cachedCount);
      applyGridGlow(rememberedCount, seen);
      if (!seen)
        storageSet(seenKey, '1');
      gridGlowInitPromise = Promise.resolve(rememberedCount);
      return gridGlowInitPromise;
    }

    gridGlowInitPromise = connectedDevicesCount().then(function (count) {
      var normalized = normalizeConnectedDeviceCount(count);
      storageSet(countKey, String(normalized));
      storageSet(seenKey, '1');
      applyGridGlow(normalized, false);
      return normalized;
    }).catch(function () {
      storageSet(countKey, '0');
      storageSet(seenKey, '1');
      applyGridGlow(0, false);
      return 0;
    });

    return gridGlowInitPromise;
  }

  function compactProgressTitle(title) {
    var value = String(title || '').split('/')[0].trim();
    if (!value) return '';
    value = value.replace(/\s+/g, ' ');
    return value;
  }

  function addProgressNumbers(root) {
    qsa('.cbi-progressbar[title], .progress[title]', root).forEach(function (bar) {
      var text = compactProgressTitle(bar.getAttribute('title'));
      if (!text) return;
      bar.classList.add('fwrt-title-numbered');
      var span = bar.querySelector('.fwrt-progress-title');
      if (!span) {
        span = document.createElement('span');
        span.className = 'fwrt-progress-title';
        bar.appendChild(span);
      }
      if (span.textContent !== text) span.textContent = text;
    });
  }

  function descriptionContainer(desc) {
    return desc.closest('.cbi-value') || desc.closest('.cbi-section') || desc.closest('.cbi-tabcontainer') || desc.closest('.tr') || desc.closest('tr') || desc.parentElement;
  }

  function buttonTarget(container, desc) {
    return (container && (container.querySelector('.cbi-value-title') || container.querySelector('legend') || container.querySelector('h3') || container.querySelector('h2') || container.querySelector('label') || container.querySelector('.td:first-child') || container.firstElementChild)) || desc.parentElement;
  }

  function addHelpButtons(root) {
    var selector = [
      '.cbi-value-description:not(.fwrt-help-managed)',
      '.cbi-section-descr:not(.fwrt-help-managed)',
      '.cbi-section-table-descr:not(.fwrt-help-managed)',
      '.cbi-tab-descr:not(.fwrt-help-managed)',
      '.description:not(.fwrt-help-managed)',
      '.help-block:not(.fwrt-help-managed)',
      '.help-inline:not(.fwrt-help-managed)',
      '.cbi-map-descr:not(.fwrt-help-managed)'
    ].join(',');

    qsa(selector, root).forEach(function (desc) {
      var text = (desc.textContent || '').trim();
      if (!text) return;
      if (desc.closest('.alert-message, .alert, .notice, .zonebadge, .ifacebadge, .ifacebox, .modal.login')) return;

      var container = descriptionContainer(desc);
      if (!container) return;
      desc.classList.add('fwrt-help-managed');

      if (!desc.id) desc.id = 'fwrt-help-' + Math.random().toString(36).slice(2, 10);
      if (container.querySelector('.fwrt-help-btn[data-fwrt-help-for="' + desc.id + '"]')) return;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fwrt-help-btn';
      btn.textContent = '?';
      btn.setAttribute('aria-label', 'Show help');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', desc.id);
      btn.setAttribute('data-fwrt-help-for', desc.id);
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var open = !container.classList.contains('fwrt-help-open');
        container.classList.toggle('fwrt-help-open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', open ? 'Hide help' : 'Show help');
      });

      var target = buttonTarget(container, desc);
      if (target) target.appendChild(btn);
    });
  }

  function isNetworkInterfacesPage() {
    var page = document.body ? document.body.getAttribute('data-page') : '';
    return /^admin-network-(network|interface)/.test(page || '');
  }

  function collapseEmptyNetworkBlocks(root) {
    if (!isNetworkInterfacesPage()) return;

    var selector = [
      '.cbi-map-descr',
      '.cbi-section-descr',
      '.cbi-section-table-descr',
      '.cbi-tab-descr',
      '.cbi-value-description',
      '.description',
      '.help-block',
      '.help-inline',
      '.cbi-value'
    ].join(',');

    qsa(selector, root).forEach(function (el) {
      if (el.closest('#modal_overlay, .modal, .alert-message, .cbi-page-actions, .actions')) return;
      if (el.classList.contains('fwrt-help-managed')) return;

      var text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
      var useful = el.querySelector('input, select, textarea, button, a, img, svg, canvas, table, .table, .tr, .td, .th, .cbi-button, .ifacebox, .ifacebadge, .cbi-dropdown, [data-tab-active="true"]');
      el.classList.toggle('fwrt-empty-structural', !text && !useful);
    });

    qsa('.cbi-section, .cbi-tblsection', root).forEach(function (section) {
      if (section.closest('#modal_overlay, .modal, .alert-message, .cbi-page-actions, .actions')) return;

      var text = (section.textContent || '').replace(/\u00a0/g, ' ').trim();
      var useful = section.querySelector('input, select, textarea, button, a, img, svg, canvas, table, .table, .tr, .td, .th, .cbi-button, .ifacebox, .ifacebadge, .cbi-dropdown, [data-tab-active="true"]');
      var hasVisibleBox = false;

      Array.prototype.slice.call(section.children || []).some(function (child) {
        if (child.classList && child.classList.contains('fwrt-empty-structural')) return false;
        var style = window.getComputedStyle(child);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        hasVisibleBox = child.offsetWidth > 0 || child.offsetHeight > 0;
        return hasVisibleBox;
      });

      section.classList.toggle('fwrt-empty-structural', !text && !useful && !hasVisibleBox);
    });
  }

  var lockedScrollY = 0;

  function modalIsOpen() {
    var overlay = document.getElementById('modal_overlay');
    if (!overlay) return false;
    var style = window.getComputedStyle(overlay);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    return !!overlay.querySelector('.modal, .modal-dialog, .cbi-modal, .uci-dialog');
  }

  function setModalScrollLock(lock) {
    if (!document.body || !document.documentElement) return;
    if (lock && !document.body.classList.contains('fwrt-modal-open')) {
      lockedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      document.documentElement.classList.add('fwrt-modal-open');
      document.body.classList.add('fwrt-modal-open');
      document.body.style.top = '-' + lockedScrollY + 'px';
    }
    else if (!lock && document.body.classList.contains('fwrt-modal-open')) {
      document.documentElement.classList.remove('fwrt-modal-open');
      document.body.classList.remove('fwrt-modal-open');
      document.body.style.top = '';
      window.scrollTo(0, lockedScrollY);
    }
  }

  function tagWirelessBadges(root) {
    if (!document.body || document.body.getAttribute('data-page') !== 'admin-network-wireless')
      return;

    qsa('[data-name="_badge"] .ifacebadge, #wifi_assoclist_table .ifacebadge', root).forEach(function (badge) {
      var text = (badge.textContent || '').trim().toLowerCase();
      var img = badge.querySelector('img');
      var src = img ? (img.getAttribute('src') || '').toLowerCase() : '';
      var isClient = !!badge.closest('#wifi_assoclist_table, .assoclist');
      var isRadio = /(^|\s)radio[0-9]+(\s|$)/.test(text) || /radio[0-9]+/.test(src);
      var isWireless = isClient || isRadio || /wifi|wireless|signal/.test(src + ' ' + text);

      badge.classList.toggle('fwrt-radio-badge', isRadio && !isClient);
      badge.classList.toggle('fwrt-wireless-client-badge', isClient);
      badge.classList.toggle('fwrt-wireless-neon-badge', isWireless);

      if (img && isWireless)
        img.removeAttribute('aria-hidden');
    });
  }

  function tagProcessRows(root) {
    if (!document.body || document.body.getAttribute('data-page') !== 'admin-status-processes')
      return;

    root = document;
    qsa('table.table tr.tr:not(.table-titles), .table .tr:not(.table-titles)', root).forEach(function (row) {
      var cells = Array.prototype.slice.call(row.children || []);
      if (cells.length < 6) return;

      var cpu = parseFloat((cells[3].textContent || '').replace('%', '').trim());
      var mem = parseFloat((cells[4].textContent || '').replace('%', '').trim());
      var cpuActive = isFinite(cpu) && cpu > 0;
      var memActive = isFinite(mem) && mem > 0;

      row.classList.toggle('fwrt-cpu-active-row', cpuActive);
      row.classList.toggle('fwrt-mem-active-row', memActive);
      row.setAttribute('data-fwrt-cpu', isFinite(cpu) ? String(cpu) : '0');
      row.setAttribute('data-fwrt-mem', isFinite(mem) ? String(mem) : '0');
      cells[3].classList.add('fwrt-process-cpu-cell');
      cells[4].classList.add('fwrt-process-mem-cell');
      cells[5].classList.add('fwrt-process-actions-cell');

      var actions = cells[5].querySelector('div');
      if (actions)
        actions.classList.add('fwrt-process-actions');
    });
  }

  function normalizeActionDropdowns(root) {
    qsa('.cbi-page-actions .cbi-dropdown.cbi-button, .actions .cbi-dropdown.cbi-button', root).forEach(function (drop) {
      var preview = Array.prototype.slice.call(drop.children || []).filter(function (child) {
        return child.tagName === 'UL' && !child.classList.contains('dropdown') && !child.classList.contains('preview');
      })[0];
      if (!preview) return;

      var previewText = (preview.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      var isSaveApply = drop.classList.contains('cbi-button-apply') ||
        (previewText.indexOf('save') !== -1 && previewText.indexOf('apply') !== -1);

      if (!isSaveApply) return;

      var items = Array.prototype.slice.call(preview.children || []).filter(function (child) {
        return child.tagName === 'LI';
      });
      if (!items.length) return;

      var main = items.filter(function (item) {
        return item.hasAttribute('display') || item.hasAttribute('selected');
      })[0] || null;

      items.forEach(function (item) {
        var text = (item.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        var isUnchecked = text.indexOf('unchecked') !== -1;
        item.classList.remove('fwrt-action-preview-main');
        item.classList.remove('fwrt-action-preview-extra');

        if (isUnchecked || item.getAttribute('aria-hidden') === 'true')
          item.classList.add('fwrt-action-preview-extra');
        else if (!main)
          main = item;
      });

      main = main || items[0];
      drop.classList.add('fwrt-save-apply-combo');
      preview.classList.add('fwrt-save-apply-preview');
      main.classList.remove('fwrt-action-preview-extra');
      main.classList.add('fwrt-action-preview-main');
    });
  }

  function run(root) {
    qsa(".port-status-device, .port-status-link, .ifacebadge", root).forEach(function (el) { var text = (el.textContent || "").toLowerCase(); var hasDisabled = !!el.querySelector('img[src*="_disabled"]'); var inactive = hasDisabled || /no link|not connected|disabled|down/.test(text); el.classList.toggle("fwrt-active-port", !inactive); el.classList.toggle("fwrt-inactive-port", inactive); });
    qsa("label", root).forEach(function (label) { if (label.querySelector("select.mode, select.band, select.channel, select.htmode")) label.classList.add("fwrt-frequency-control"); });
    tagPortBoxes(root);
    tagWirelessBadges(root);
    tagProcessRows(root);
    normalizeActionDropdowns(root);
    addProgressNumbers(root);
    addHelpButtons(root);
    collapseEmptyNetworkBlocks(root);
    setModalScrollLock(modalIsOpen());
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function tagPortBoxes(root) {
    qsa('.ifacebox', root).forEach(function (box) {
      var text = (box.textContent || '').toLowerCase();
      var activeIcon = !!box.querySelector('img[src*="port_up.svg"], img[src*="pse_up.svg"]');
      var inactiveIcon = !!box.querySelector('img[src*="port_down.svg"], img[src*="pse_down.svg"], img[src*="_disabled"]');
      var inactive = inactiveIcon || /no link|not connected|disabled|down/.test(text);
      box.classList.toggle('fwrt-active-port', activeIcon && !inactive);
      box.classList.toggle('fwrt-inactive-port', inactive);
    });
  }

  var runScheduled = false;
  var pendingRoots = [];

  function queueRoot(root) {
    if (!root) return;
    if (root.nodeType === 3) root = root.parentElement;

    if (!root || !root.nodeType) return;
    if (root === document || root.nodeType === 9 || pendingRoots.length > 24) {
      pendingRoots = [document];
      return;
    }

    if (root.nodeType === 1 && pendingRoots.indexOf(root) === -1)
      pendingRoots.push(root);
  }

  function flushRun() {
    runScheduled = false;
    var roots = pendingRoots.length ? pendingRoots.splice(0) : [document];

    if (roots.indexOf(document) !== -1)
      run(document);
    else
      roots.forEach(run);
  }

  function scheduleRun(root) {
    queueRoot(root || document);
    if (runScheduled) return;
    runScheduled = true;
    window.requestAnimationFrame(function () {
      flushRun();
    });
  }

  function scheduleFromMutations(records) {
    records.forEach(function (record) {
      if (record.addedNodes && record.addedNodes.length) {
        Array.prototype.forEach.call(record.addedNodes, queueRoot);
      }
      else {
        queueRoot(record.target);
      }
    });

    if (!runScheduled) {
      runScheduled = true;
      window.requestAnimationFrame(flushRun);
    }
  }

  ready(function () {
    initGridGlow();
    run(document);
    setTimeout(function () { scheduleRun(document); }, 350);
    setTimeout(function () { scheduleRun(document); }, 1200);
    if ('MutationObserver' in window && document.body) {
      new MutationObserver(scheduleFromMutations).observe(document.body, { childList: true, subtree: true });
    }
    document.addEventListener('keydown', function () {
      setTimeout(function () { setModalScrollLock(modalIsOpen()); }, 0);
    }, true);
    document.addEventListener('click', function () {
      setTimeout(function () { setModalScrollLock(modalIsOpen()); }, 0);
    }, true);
  });
}());
