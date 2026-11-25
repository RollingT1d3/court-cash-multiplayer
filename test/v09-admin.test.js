import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAdminAPI } from '../admin-v09.js';

process.env.COURT_CASH_ADMIN_CODE = '8371';

async function call(api, route, method = 'GET', data, token, ip = '203.0.113.10') {
  const req = Readable.from([Buffer.from(data === undefined ? '' : JSON.stringify(data))]);
  req.method = method;
  req.socket = { remoteAddress: ip };
  req.headers = token ? { authorization: 'Bearer ' + token } : {};
  const res = {
    status: 0, value: '',
    writeHead(code) { this.status = code; },
    end(text) { this.value = text; }
  };
  const handled = await api(req, res, new URL(route, 'http://localhost'));
  assert.equal(handled, true);
  return { status: res.status, body: JSON.parse(res.value) };
}

test('v0.9 admin unlock, OVR sorting, crop editing, persistence and backup restore', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'court-cash-v09-'));
  try {
    const players = [
      { id: 'low', name: 'Low Scorer', overall: 75, positions: ['PG'], heightInches: 72, image: '/images/low.png' },
      { id: 'star', name: 'Top Scorer', overall: 96, positions: ['C'], heightInches: 84, image: '/images/top.png' }
    ];
    let broadcasts = 0;
    const api = createAdminAPI({ root: dir, players, onUpdate: () => { broadcasts++; } });
    assert.equal((await call(api, '/api/admin/players')).status, 401);
    assert.equal((await call(api, '/api/admin/login', 'POST', { pin: '1111' })).status, 401);
    const login = await call(api, '/api/admin/login', 'POST', { pin: '8371' });
    assert.equal(login.status, 200);
    const token = login.body.token;
    assert.ok(token.length >= 40);
    const list = await call(api, '/api/admin/players', 'GET', undefined, token);
    assert.deepEqual(list.body.players.map(p => p.id), ['star', 'low']);
    const crop = { centerX: 0.53, top: 0.04, width: 0.38 };
    const saved = await call(api, '/api/admin/portrait', 'POST', { id: 'star', crop }, token);
    assert.equal(saved.status, 200);
    assert.deepEqual(players[1].courtPortrait.crop, crop);
    assert.equal(broadcasts, 1);
    const contents = JSON.parse(readFileSync(path.join(dir, 'data/court-portrait-overrides.json'), 'utf8'));
    assert.deepEqual(contents.overrides.star, crop);
    const exported = await call(api, '/api/admin/export', 'GET', undefined, token);
    assert.deepEqual(exported.body, contents);
    assert.equal((await call(api, '/api/admin/portrait', 'POST', { id: 'low', crop: { ...crop, width: -1 } }, token)).status, 400);
    assert.equal(broadcasts, 1);
    const secondPlayers = players.map(p => ({ ...p, courtPortrait: null }));
    const second = createAdminAPI({ root: dir, players: secondPlayers });
    assert.deepEqual(secondPlayers[1].courtPortrait.crop, crop);
    const token2 = (await call(second, '/api/admin/login', 'POST', { pin: '8371' })).body.token;
    assert.equal((await call(second, '/api/admin/portrait', 'POST', { id: 'star', crop: null }, token2)).status, 200);
    assert.equal(secondPlayers[1].courtPortrait, undefined);
    assert.deepEqual(JSON.parse(readFileSync(path.join(dir, 'data/court-portrait-overrides.json'), 'utf8')).overrides, {});
    assert.equal((await call(second, '/api/admin/import', 'POST', exported.body, token2)).status, 200);
    assert.deepEqual(secondPlayers[1].courtPortrait.crop, crop);
    assert.equal((await call(second, '/api/admin/logout', 'POST', {}, token2)).status, 200);
    assert.equal((await call(second, '/api/admin/players', 'GET', undefined, token2)).status, 401);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('v0.9 throttles incorrect admin code attempts', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'court-cash-v09-throttle-'));
  try {
    const api = createAdminAPI({ root: dir, players: [] });
    for (let i = 0; i < 5; i++) {
      assert.equal((await call(api, '/api/admin/login', 'POST', { pin: '0000' })).status, 401);
    }
    assert.equal((await call(api, '/api/admin/login', 'POST', { pin: '8371' })).status, 429);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('baked-in headshot defaults remain after admin reset, without altering player artwork or weights', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'court-cash-default-crops-'));
  try {
    const players = JSON.parse(readFileSync(new URL('../data/players.json', import.meta.url), 'utf8'));
    assert.equal(players.length, 200);
    assert.equal(players.filter(p => p.courtPortrait?.crop).length, 111);
    const p = players.find(p => p.id === 'p019');
    const base = structuredClone(p.courtPortrait);
    assert.deepEqual(base.crop, { centerX: 0.57, top: 0, width: 0.5236 });
    const art = p.image, weight = p.weight;
    const api = createAdminAPI({ root: dir, players });
    const token = (await call(api, '/api/admin/login', 'POST', {pin: '8371'})).body.token;
    const edit = {centerX: .3, top: .1, width: .4};
    assert.equal((await call(api, '/api/admin/portrait', 'POST', {id:p.id,crop:edit},token)).status,200);
    assert.deepEqual(p.courtPortrait.crop,edit);
    const list = await call(api, '/api/admin/players', 'GET', undefined, token);
    assert.deepEqual(list.body.players.find(x=>x.id===p.id).defaultCourtPortrait,base);
    assert.equal((await call(api, '/api/admin/portrait', 'POST', {id:p.id,crop:null},token)).status,200);
    assert.deepEqual(p.courtPortrait,base);
    assert.equal(p.image,art);assert.equal(p.weight,weight);
  } finally {rmSync(dir,{recursive:true,force:true});}
});
