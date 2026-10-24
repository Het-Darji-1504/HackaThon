const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const Database = require('better-sqlite3');

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('API health, catalogue, auth, privacy, role access, and booking permissions', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'work-satthi-test-'));
  const port = await freePort();
  const env = { ...process.env, PORT: String(port), JWT_SECRET: 'test-secret-only-abcdefghijklmnopqrstuvwxyz-123456', DATABASE_PATH: path.join(dir, 'test.sqlite') };
  const child = spawn(process.execPath, ['server.js'], { cwd: __dirname + '/..', env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => {
    child.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  let lastError;
  for (let i = 0; i < 60; i += 1) {
    if (child.exitCode !== null) throw new Error('API exited before startup');
    try { await fetch(`http://127.0.0.1:${port}/api/health`); lastError = null; break; }
    catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  if (lastError) throw lastError;
  const base = `http://127.0.0.1:${port}`;
  const call = (route, options = {}) => fetch(base + route, { ...options, headers: { 'content-type': 'application/json', ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...options.headers }, body: options.body && JSON.stringify(options.body) });
  const health = await call('/api/health'); assert.equal(health.status, 200); assert.equal((await health.json()).status, 'ok');
  const catalogue = await call('/api/services'); assert.equal((await catalogue.json()).count, 6);
  const badJson = await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' }); assert.equal(badJson.status, 400);
  const customerBody = { name: 'Test Customer', email: 'customer@example.test', password: 'strong-pass-123', role: 'customer', phone: '1234567890' };
  const invalidEmail = await call('/api/auth/register', { method: 'POST', body: { ...customerBody, email: 'bad' } }); assert.equal(invalidEmail.status, 400);
  const weakPassword = await call('/api/auth/register', { method: 'POST', body: { ...customerBody, email: 'weak@example.test', password: 'short' } }); assert.equal(weakPassword.status, 400);
  const created = await call('/api/auth/register', { method: 'POST', body: customerBody }); assert.equal(created.status, 201); const customer = await created.json();
  const duplicate = await call('/api/auth/register', { method: 'POST', body: customerBody }); assert.equal(duplicate.status, 409);
  const loginBad = await call('/api/auth/login', { method: 'POST', body: { email: customerBody.email, password: 'wrong-pass-123' } }); assert.equal(loginBad.status, 401);
  const login = await call('/api/auth/login', { method: 'POST', body: { email: customerBody.email, password: customerBody.password } }); assert.equal(login.status, 200);
  const db = new Database(env.DATABASE_PATH, { readonly: true });
  const stored = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(customerBody.email); assert.notEqual(stored.password_hash, customerBody.password); assert.match(stored.password_hash, /^\$2/); db.close();
  const workerBody = { name: 'Test Worker', email: 'worker@example.test', password: 'strong-pass-123', role: 'worker', phone: '1234567890', area: 'Ahmedabad', service: 'plumbing', rate: '300', bio: 'Licensed local plumbing professional', experience: 'experienced', availability: 'weekdays' };
  const workerResponse = await call('/api/auth/register', { method: 'POST', body: workerBody }); assert.equal(workerResponse.status, 201); const worker = await workerResponse.json();
  const search = await call('/api/workers'); const listed = (await search.json()).workers[0]; assert.equal(listed.email, undefined); assert.equal(listed.phone, undefined); assert.equal(listed.experience, 'experienced');
  const forbiddenBooking = await call('/api/bookings', { method: 'POST', token: worker.token, body: { serviceId: 'plumbing' } }); assert.equal(forbiddenBooking.status, 403);
  const validBooking = await call('/api/bookings', { method: 'POST', token: customer.token, body: { serviceId: 'plumbing', location: 'Ahmedabad', preferredDate: '2099-01-10', preferredTime: '10:00' } }); assert.equal(validBooking.status, 201);
  const history = await call('/api/bookings/mine', { token: customer.token }); assert.equal((await history.json()).bookings.length, 1);
  const workerHistory = await call('/api/bookings/mine', { token: worker.token }); assert.equal(workerHistory.status, 403);
  const badToken = await call('/api/auth/me', { token: 'invalid' }); assert.equal(badToken.status, 401);
  const cancelled = await call('/api/bookings/1', { method: 'DELETE', token: customer.token }); assert.equal(cancelled.status, 200);
  const secondCancel = await call('/api/bookings/1', { method: 'DELETE', token: customer.token }); assert.equal(secondCancel.status, 409);
});
