import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

// V0.9: server-authoritative admin access and per-player on-court portrait settings.
// Authenticated appearance and wheel probability editors; player attributes remain unchanged.
export function createAdminAPI({ root, players, wheelStore = null, onUpdate = () => {}, publishedCropIds = [] }) {
  const settingsFile = process.env.COURT_CASH_PORTRAITS_FILE ||
    path.join(root, 'data', 'court-portrait-overrides.json');
  const defaults = new Map(players.map(p => [p.id, p.courtPortrait ? structuredClone(p.courtPortrait) : null]));
  const byId = new Map(players.map(p => [p.id, p]));
  // Only explicitly published crop updates supersede older saves for those IDs.
  const cropBaselines = Object.fromEntries(publishedCropIds.filter(id => defaults.has(id)).map(id => [id, JSON.stringify(defaults.get(id)?.crop || null)]));
  const sessions = new Map();
  const attempts = new Map();
  let overrides = {};

  function validCrop(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid crop settings.');
    const crop = {};
    for (const key of ['centerX', 'top', 'width']) {
      const n = value[key];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1) throw Error('Crop values must be between 0 and 1.');
      crop[key] = Math.round(n * 10000) / 10000;
    }
    if (crop.width < 0.08) throw Error('Zoom is too high.');
    return crop;
  }
  function validateOverrides(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw Error('Invalid settings backup.');
    const next = Object.create(null);
    for (const [id, crop] of Object.entries(obj)) {
      if (!byId.has(id)) continue; // Safely ignore players not yet imported.
      next[id] = validCrop(crop);
    }
    return next;
  }
  function apply() {
    for (const player of players) {
      const base = defaults.get(player.id);
      if (overrides[player.id]) player.courtPortrait = { ...(base || {}), crop: overrides[player.id] };
      else if (base) player.courtPortrait = structuredClone(base);
      else delete player.courtPortrait;
    }
  }
  try {
    const stored = JSON.parse(readFileSync(settingsFile, 'utf8'));
    overrides = validateOverrides(stored.overrides || stored);
    for (const [id, baseline] of Object.entries(cropBaselines)) {
      if (stored.cropBaselines?.[id] !== baseline) delete overrides[id];
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Admin portrait settings not loaded:', error.message);
  }
  apply();

  function persist(next) {
    const validated = validateOverrides(next);
    mkdirSync(path.dirname(settingsFile), { recursive: true });
    const tmp = settingsFile + '.tmp';
    writeFileSync(tmp, JSON.stringify({ version: 1, overrides: validated, ...(Object.keys(cropBaselines).length ? { cropBaselines } : {}) }, null, 2) + '\n', { mode: 0o600 });
    renameSync(tmp, settingsFile);
    overrides = validated;
    apply();
    onUpdate();
  }
  function send(res, status, value) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(JSON.stringify(value));
  }
  async function readBody(req) {
    const chunks = [];
    let size = 0;
    for await (const part of req) {
      size += part.length;
      if (size > 100000) throw Error('Request too large.');
      chunks.push(part);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  }
  function verifyPin(candidate) {
    const expected = String(process.env.COURT_CASH_ADMIN_CODE || '8371');
    const hash = value => createHash('sha256').update(value).digest();
    return timingSafeEqual(hash(String(candidate || '')), hash(expected));
  }
  function getSession(req) {
    const authorization = String(req.headers.authorization || '');
    if (!authorization.startsWith('Bearer ')) return null;
    const key = authorization.slice(7);
    const until = sessions.get(key);
    if (!until || until < Date.now()) {
      sessions.delete(key);
      return null;
    }
    return key;
  }
  function tryLogin(req, res, pin) {
    const key = String(req.socket.remoteAddress || 'unknown');
    const time = Date.now();
    const prior = attempts.get(key);
    const track = prior && prior.until > time ? prior : { failures: 0, until: time + 15 * 60 * 1000 };
    if (track.failures >= 5) return send(res, 429, { error: 'Too many attempts. Please try again in 15 minutes.' });
    if (!verifyPin(pin)) {
      track.failures += 1;
      attempts.set(key, track);
      return send(res, 401, { error: 'Incorrect admin code.' });
    }
    attempts.delete(key);
    const token = randomBytes(32).toString('hex');
    sessions.set(token, time + 2 * 60 * 60 * 1000);
    return send(res, 200, { token, expiresInMinutes: 120 });
  }

  return async function adminAPI(req, res, url) {
    if (!url.pathname.startsWith('/api/admin/')) return false;
    try {
      if (req.method === 'POST' && url.pathname === '/api/admin/login') {
        const data = await readBody(req);
        tryLogin(req, res, data.pin);
        return true;
      }
      const session = getSession(req);
      if (!session) {
        send(res, 401, { error: 'Admin session expired. Unlock the panel again.' });
        return true;
      }
      if (req.method === 'POST' && url.pathname === '/api/admin/logout') {
        sessions.delete(session);
        send(res, 200, { ok: true });
        return true;
      }
      if (req.method === 'GET' && url.pathname === '/api/admin/players') {
        const list = players.map(p => ({
          id: p.id, name: p.name, overall: p.overall, positions: p.positions,
          heightInches: p.heightInches, image: p.image,
          courtPortrait: p.courtPortrait || null, defaultCourtPortrait: defaults.get(p.id) || null
        }));
        list.sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name));
        send(res, 200, { players: list });
        return true;
      }
      if (wheelStore && req.method === 'GET' && url.pathname === '/api/admin/wheel') {
        send(res,200,{...wheelStore.backup(),original:wheelStore.original()});return true;
      }
      if (wheelStore && req.method === 'GET' && url.pathname === '/api/admin/wheel/export') {
        send(res,200,wheelStore.backup());return true;
      }
      if (wheelStore && req.method === 'POST' && url.pathname === '/api/admin/wheel') {
        const data=await readBody(req);
        send(res,200,{ok:true,...wheelStore.save(data)});return true;
      }
      if (req.method === 'GET' && url.pathname === '/api/admin/export') {
        send(res, 200, { version: 1, overrides });
        return true;
      }
      if (req.method === 'POST' && url.pathname === '/api/admin/portrait') {
        const data = await readBody(req);
        if (typeof data.id !== 'string' || !byId.has(data.id)) throw Error('Player not found.');
        const next = { ...overrides };
        if (data.crop === null) delete next[data.id];
        else next[data.id] = validCrop(data.crop);
        persist(next);
        send(res, 200, { ok: true, courtPortrait: byId.get(data.id).courtPortrait || null });
        return true;
      }
      if (req.method === 'POST' && url.pathname === '/api/admin/import') {
        const data = await readBody(req);
        if (data.version !== 1) throw Error('Unsupported settings backup version.');
        persist(data.overrides);
        send(res, 200, { ok: true });
        return true;
      }
      send(res, 405, { error: 'Admin endpoint not found.' });
    } catch (error) {
      send(res, 400, { error: error.message || 'Admin request failed.' });
    }
    return true;
  };
}
