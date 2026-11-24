/* Court Cash v0.9 - main-menu-only admin portrait editor. No roster import. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const screen = $('admin-screen');
  const openButton = $('admin-open');
  if (!screen || !openButton || !window.CourtHeadshots) return;

  let authToken = sessionStorage.getItem('court-cash-admin-token') || '';
  let roster = [], selected = null, crop = null, resetPending = false;
  const imageCache = new Map();
  const clamp = n => Math.max(0, Math.min(1, n));
  const formatHeight = inches => Math.floor(inches / 12) + "'" + inches % 12 + '"';
  const defaultCrop = p => ({ ...window.CourtHeadshots.DEFAULT_CROP, width: p?.courtPortrait?.image ? 1 : window.CourtHeadshots.DEFAULT_CROP.width });
  const mainMenuVisible = () => !$('welcome').classList.contains('hide');

  function message(text, type = '') {
    const el = $('admin-message');
    el.textContent = text || '';
    el.className = 'admin-message' + (type ? ' ' + type : '');
  }
  async function request(path, method = 'GET', data) {
    const headers = {};
    if (authToken) headers.Authorization = 'Bearer ' + authToken;
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch('/api/admin/' + path, {
      method, headers, cache: 'no-store',
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    let result;
    try { result = await response.json(); } catch { throw Error('Unable to connect to the admin service.'); }
    if (!response.ok) {
      if (response.status === 401 && path !== 'login') {
        authToken = '';
        sessionStorage.removeItem('court-cash-admin-token');
        showLogin();
      }
      throw Error(result.error || 'Admin request failed.');
    }
    return result;
  }
  function showLogin() {
    $('admin-auth').hidden = false;
    $('admin-workspace').hidden = true;
    $('admin-pin').value = '';
  }
  function showWorkspace() {
    $('admin-auth').hidden = true;
    $('admin-workspace').hidden = false;
  }
  function close() {
    screen.hidden = true;
    document.body.classList.remove('admin-open');
    message('');
    openButton.focus();
  }
  async function open() {
    if (!mainMenuVisible()) return;
    screen.hidden = false;
    document.body.classList.add('admin-open');
    if (authToken) {
      try { await loadRoster(); return; }
      catch (error) { message(error.message, 'error'); }
    }
    showLogin();
    $('admin-pin').focus();
  }
  openButton.addEventListener('click', open);
  $('admin-close').addEventListener('click', close);
  screen.addEventListener('pointerdown', event => {
    if (event.target === screen) close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !screen.hidden) close();
  });
  $('admin-login-form').addEventListener('submit', async event => {
    event.preventDefault();
    const submit = $('admin-unlock');
    submit.disabled = true;
    message('');
    try {
      const result = await request('login', 'POST', { pin: $('admin-pin').value });
      authToken = result.token;
      sessionStorage.setItem('court-cash-admin-token', authToken);
      await loadRoster();
    } catch (error) {
      message(error.message, 'error');
    } finally {
      submit.disabled = false;
    }
  });

  async function loadRoster() {
    const data = await request('players');
    roster = data.players || [];
    showWorkspace();
    $('admin-count').textContent = roster.length + ' players • highest OVR first';
    if (!roster.some(p => p.id === selected?.id)) selected = null;
    drawList();
    if (selected) selectPlayer(selected.id);
    else if (roster[0]) selectPlayer(roster[0].id);
    else $('admin-editor-empty').hidden = false;
    message('Showing the current live roster. Custom players will appear after import.');
  }

  function photo(src, onReady) {
    if (!src) return null;
    let img = imageCache.get(src);
    if (imageCache.has(src)) return img;
    img = new Image();
    imageCache.set(src, img);
    img.onload = () => {
      document.querySelectorAll('canvas[data-admin-court-id]').forEach(canvas => {
        const player = roster.find(p => p.id === canvas.dataset.adminCourtId);
        if (player) paint(canvas, player, selected?.id === player.id ? crop : null);
      });
      if (onReady) onReady();
    };
    img.onerror = () => { imageCache.set(src, null); if (onReady) onReady(); };
    img.src = src;
    return img;
  }

  function paint(canvas, p, overrideCrop) {
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#263b57';
    ctx.fillRect(0, 0, size, size);
    const src = window.CourtHeadshots.imageSource(p);
    const img = photo(src);
    const candidate = overrideCrop ? {
      ...p, courtPortrait: { ...(p.courtPortrait || {}), crop: overrideCrop }
    } : p;
    let drawn = false;
    if (img && img.complete && img.naturalWidth > 0) {
      drawn = window.CourtHeadshots.draw(ctx, img, candidate, size / 2, size / 2, size);
    }
    if (!drawn) {
      const initials = p.name.trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('');
      ctx.font = '800 ' + Math.round(size * .28) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f0f6ff';
      ctx.fillText(initials, size / 2, size / 2);
    }
    ctx.restore();
  }

  function drawList() {
    const target = $('admin-player-list');
    const term = $('admin-search').value.trim().toLowerCase();
    target.replaceChildren();
    const visible = roster.filter(p => p.name.toLowerCase().includes(term));
    $('admin-visible').textContent = visible.length + ' shown';
    for (const p of visible) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-player-row' + (selected?.id === p.id ? ' selected' : '');
      const original = document.createElement('span');
      original.className = 'admin-original-thumb';
      if (p.image) {
        const img = document.createElement('img');
        img.src = p.image;
        img.alt = '';
        img.loading = 'lazy';
        original.append(img);
      } else {
        original.textContent = p.name[0];
      }
      const label = document.createElement('span');
      label.className = 'admin-row-label';
      const name = document.createElement('strong');
      name.textContent = p.name;
      const detail = document.createElement('small');
      detail.textContent = p.overall + ' OVR · ' + p.positions.join('/');
      label.append(name, detail);
      const circle = document.createElement('canvas');
      circle.width = 44;
      circle.height = 44;
      circle.className = 'admin-row-court';
      circle.dataset.adminCourtId = p.id;
      circle.setAttribute('aria-label', 'Current court appearance');
      button.append(original, label, circle);
      button.addEventListener('click', () => selectPlayer(p.id));
      target.append(button);
      paint(circle, p, selected?.id === p.id ? crop : null);
    }
  }
  $('admin-search').addEventListener('input', drawList);

  function values() {
    $('admin-zoom').value = String(Math.round(100 / crop.width));
    $('admin-x').value = String(Math.round(crop.centerX * 100));
    $('admin-y').value = String(Math.round(crop.top * 100));
    $('admin-zoom-value').textContent = $('admin-zoom').value + '%';
    $('admin-x-value').textContent = $('admin-x').value + '%';
    $('admin-y-value').textContent = $('admin-y').value + '%';
  }
  function refresh() {
    if (!selected) return;
    values();
    paint($('admin-court-preview'), selected, crop);
    document.querySelectorAll('canvas[data-admin-court-id]').forEach(canvas => {
      if (canvas.dataset.adminCourtId === selected.id) paint(canvas, selected, crop);
    });
    $('admin-save').disabled = false;
  }
  function selectPlayer(id) {
    selected = roster.find(p => p.id === id) || null;
    if (!selected) return;
    crop = { ...defaultCrop(selected), ...(selected.courtPortrait?.crop || {}) };
    resetPending = false;
    $('admin-editor-empty').hidden = true;
    $('admin-editor-content').hidden = false;
    $('admin-player-name').textContent = selected.name;
    $('admin-player-details').textContent =
      selected.overall + ' OVR · ' + selected.positions.join('/') + ' · ' + formatHeight(selected.heightInches);
    const image = $('admin-original');
    if (selected.image) {
      image.src = selected.image;
      image.hidden = false;
      $('admin-no-original').hidden = true;
    } else {
      image.removeAttribute('src');
      image.hidden = true;
      $('admin-no-original').hidden = false;
    }
    $('admin-save').disabled = true;
    values();
    paint($('admin-court-preview'), selected, crop);
    drawList();
  }

  $('admin-zoom').addEventListener('input', () => {
    if (!crop) return;
    crop.width = 100 / Number($('admin-zoom').value);
    resetPending = false;
    refresh();
  });
  $('admin-x').addEventListener('input', () => {
    if (!crop) return;
    crop.centerX = Number($('admin-x').value) / 100;
    resetPending = false;
    refresh();
  });
  $('admin-y').addEventListener('input', () => {
    if (!crop) return;
    crop.top = Number($('admin-y').value) / 100;
    resetPending = false;
    refresh();
  });

  // Drag the exact same-size 44px court circle to reposition the source image.
  const preview = $('admin-court-preview');
  let drag = null;
  preview.addEventListener('pointerdown', event => {
    if (!selected || !crop) return;
    drag = { x: event.clientX, y: event.clientY };
    preview.setPointerCapture(event.pointerId);
  });
  preview.addEventListener('pointermove', event => {
    if (!drag || !selected || !crop) return;
    const rect = preview.getBoundingClientRect();
    const dx = (event.clientX - drag.x) / rect.width;
    const dy = (event.clientY - drag.y) / rect.height;
    const src = window.CourtHeadshots.imageSource(selected);
    const image = photo(src);
    const verticalFraction = image?.naturalWidth && image?.naturalHeight ?
      (crop.width * image.naturalWidth / image.naturalHeight) : crop.width;
    crop.centerX = clamp(crop.centerX - dx * crop.width);
    crop.top = clamp(crop.top - dy * verticalFraction);
    drag = { x: event.clientX, y: event.clientY };
    resetPending = false;
    refresh();
  });
  preview.addEventListener('pointerup', () => { drag = null; });
  preview.addEventListener('pointercancel', () => { drag = null; });
  preview.addEventListener('lostpointercapture', () => { drag = null; });

  $('admin-reset').addEventListener('click', () => {
    if (!selected) return;
    crop = { ...defaultCrop(selected) };
    resetPending = true;
    refresh();
    message('Default crop previewed. Press Save to apply it.');
  });
  $('admin-save').addEventListener('click', async () => {
    if (!selected || !crop) return;
    const id = selected.id;
    const button = $('admin-save');
    button.disabled = true;
    try {
      const result = await request('portrait', 'POST', { id, crop: resetPending ? null : crop });
      const p = roster.find(item => item.id === id);
      p.courtPortrait = result.courtPortrait;
      selectPlayer(id);
      message('Saved! This court appearance is now used in games.', 'success');
    } catch (error) {
      button.disabled = false;
      message(error.message, 'error');
    }
  });
  $('admin-export').addEventListener('click', async () => {
    try {
      const data = await request('export');
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'court-cash-court-portraits-backup.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      message('Downloaded a backup of all saved court-crop settings.', 'success');
    } catch (error) { message(error.message, 'error'); }
  });
  $('admin-import').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Replace all saved court crop settings with this backup?')) return;
      await request('import', 'POST', data);
      imageCache.clear();
      await loadRoster();
      message('Crop settings restored from backup.', 'success');
    } catch (error) { message(error.message, 'error'); }
    finally { event.target.value = ''; }
  });
  $('admin-signout').addEventListener('click', async () => {
    try { await request('logout', 'POST'); } catch {}
    authToken = '';
    sessionStorage.removeItem('court-cash-admin-token');
    showLogin();
    message('Signed out.');
  });
})();
