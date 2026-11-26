import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

async function freePort() {
  return await new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.on('error', reject);
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
}

test('v0.9.1: automatic $1 opener, pass and timeout awards, alternating opening order and raises',
  { timeout: 20000 }, async () => {
    const port = await freePort();
    const child = spawn(process.execPath, ['server.js'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(port), COIN_MS: '35', SPIN_MS: '35', TICK_MS: '10', AUCTION_MS: '800' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', data => { stderr += data; });
    const root = 'http://127.0.0.1:' + port;
    async function post(route, payload) {
      const response = await fetch(root + route, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || response.status);
      return data;
    }
    const state = async who => (await fetch(root + '/api/state?code=' + who.code + '&token=' + who.token)).json();
    const action = (who, type, extra = {}) => post('/api/action', { code: who.code, token: who.token, type, ...extra });
    async function until(check, time = 4000) {
      const start = Date.now();
      while (Date.now() - start < time) {
        const value = await check();
        if (value) return value;
        await delay(12);
      }
      throw Error('Timed out waiting for auction state: ' + stderr);
    }
    try {
      const health = await until(async () => {
        try { const r = await fetch(root + '/health'); return r.ok ? await r.json() : null; }
        catch { return null; }
      });
      assert.equal(health.version, '1.1.0');
      const first = await post('/api/create', { name: 'Opening Team', format: 1 });
      const second = await post('/api/join', { code: first.code, name: 'Response Team' });
      const users = [first, second];

      // Auction #1: the winner of the coin flip already has a $1 offer in place.
      let snapshot = await until(async () => { const s = await state(first); return s.phase === 'auction' ? s : null; });
      const opening = snapshot.auction.opening;
      assert.equal(opening, snapshot.coinWinner);
      assert.equal(snapshot.auction.mode, 'normal');
      assert.equal(snapshot.auction.highBidder, opening);
      assert.equal(snapshot.auction.turn, 1 - opening);
      assert.equal(snapshot.auction.bid, 100);
      assert.deepEqual(snapshot.teams.map(t => t.budget), [5000, 5000],
        'Opening $1 is committed but not yet charged');
      await assert.rejects(() => action(users[opening], 'pass'), /Not your turn/);
      await assert.rejects(() => action(users[1 - opening], 'bid', { cents: 100 }), /valid \$0\.50 increment/);
      await assert.rejects(() => action(users[1 - opening], 'bid', { cents: 125 }), /valid \$0\.50 increment/);
      await action(users[1 - opening], 'pass');
      snapshot = await state(first);
      assert.equal(snapshot.phase, 'placement');
      assert.equal(snapshot.pending.winner, opening);
      assert.equal(snapshot.teams[opening].budget, 4900, 'Original opening bidder wins for exactly $1');
      assert.equal(snapshot.teams[1 - opening].budget, 5000);

      // Auction #2: the designated opener swaps; a timeout awards their $1 bid.
      await action(users[opening], 'next');
      snapshot = await until(async () => { const s = await state(first); return s.phase === 'auction' ? s : null; });
      const secondOpening = snapshot.auction.opening;
      assert.equal(secondOpening, 1 - opening);
      assert.equal(snapshot.auction.highBidder, secondOpening);
      assert.equal(snapshot.auction.turn, opening);
      assert.equal(snapshot.auction.bid, 100);
      snapshot = await until(async () => { const s = await state(first); return s.phase === 'placement' ? s : null; }, 2500);
      assert.equal(snapshot.pending.winner, secondOpening, 'Unanswered $1 bid wins after 30-second default / test clock');
      assert.equal(snapshot.teams[secondOpening].budget, 4900);
      assert.equal(snapshot.spinIndex, 2);

      // Auction #3: opposing team raises from $1 to $1.50, then opener may counter.
      await action(users[secondOpening], 'next');
      snapshot = await until(async () => { const s = await state(first); return s.phase === 'auction' ? s : null; });
      const thirdOpening = snapshot.auction.opening;
      assert.equal(thirdOpening, opening);
      assert.equal(snapshot.auction.bid, 100);
      await action(users[1 - thirdOpening], 'bid', { cents: 150 });
      snapshot = await state(first);
      assert.equal(snapshot.auction.highBidder, 1 - thirdOpening);
      assert.equal(snapshot.auction.turn, thirdOpening);
      assert.equal(snapshot.auction.bid, 150);
      await action(users[thirdOpening], 'bid', { cents: 200 });
      snapshot = await state(first);
      assert.equal(snapshot.auction.highBidder, thirdOpening);
      assert.equal(snapshot.auction.turn, 1 - thirdOpening);
      assert.equal(snapshot.auction.bid, 200);
      await action(users[1 - thirdOpening], 'pass');
      snapshot = await state(first);
      assert.equal(snapshot.pending.winner, thirdOpening);
      assert.equal(snapshot.teams[thirdOpening].budget, 4700);
      assert.equal(snapshot.teams[1 - thirdOpening].budget, 4900);
      assert.equal(snapshot.spinIndex, 3);
    } finally {
      child.kill();
    }
  });
