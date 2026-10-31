import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.js';
import { PASSWORD, cookieValue, newAgent, register } from './helpers.js';

describe('auth', () => {
  it('registers a user and sets both httpOnly session cookies', async () => {
    const agent = newAgent();
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Ayesha Khan', email: 'ayesha@example.com', password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('ayesha@example.com');
    expect(res.body.data.memberships).toEqual([]);

    const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
    expect(cookies.some((cookie) => cookie.startsWith('kanban_access=') && cookie.includes('HttpOnly'))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('kanban_refresh=') && cookie.includes('HttpOnly'))).toBe(true);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.name).toBe('Ayesha Khan');
  });

  it('rejects a duplicate email and weak passwords', async () => {
    await register(newAgent(), 'Ayesha Khan', 'ayesha@example.com');

    const duplicate = await newAgent()
      .post('/api/auth/register')
      .send({ name: 'Ayesha Again', email: 'ayesha@example.com', password: PASSWORD });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_TAKEN');

    const weak = await newAgent()
      .post('/api/auth/register')
      .send({ name: 'Weak', email: 'weak@example.com', password: 'short' });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns the same error for unknown email and wrong password', async () => {
    await register(newAgent(), 'Ayesha Khan', 'ayesha@example.com');

    const unknown = await newAgent().post('/api/auth/login').send({ email: 'nobody@example.com', password: PASSWORD });
    const wrong = await newAgent().post('/api/auth/login').send({ email: 'ayesha@example.com', password: 'WrongPass1' });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it('rotates refresh tokens and revokes every session when an old token is reused', async () => {
    const agent = newAgent();
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Ayesha Khan', email: 'ayesha@example.com', password: PASSWORD });

    const firstRefresh = cookieValue(res, 'kanban_refresh');
    expect(firstRefresh).toBeTruthy();

    const rotated = await agent.post('/api/auth/refresh');
    expect(rotated.status).toBe(200);
    const secondRefresh = cookieValue(rotated, 'kanban_refresh');
    expect(secondRefresh).toBeTruthy();
    expect(secondRefresh).not.toBe(firstRefresh);

    // Replaying the consumed token is treated as theft.
    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `kanban_refresh=${firstRefresh}`);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('UNAUTHORIZED');

    // The rotated token was revoked too, so the legitimate client must sign in again.
    const afterReplay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `kanban_refresh=${secondRefresh}`);
    expect(afterReplay.status).toBe(401);
  });

  it('logs out by revoking the refresh token and clearing cookies', async () => {
    const agent = newAgent();
    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Ayesha Khan', email: 'ayesha@example.com', password: PASSWORD });
    const refresh = cookieValue(res, 'kanban_refresh');

    const logout = await agent.post('/api/auth/logout');
    expect(logout.status).toBe(200);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);

    const replay = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `kanban_refresh=${refresh}`);
    expect(replay.status).toBe(401);
  });

  it('updates the caller profile only', async () => {
    const agent = newAgent();
    await register(agent, 'Ayesha Khan', 'ayesha@example.com');

    const res = await agent.patch('/api/auth/me').send({ name: 'Ayesha K.', avatarColor: '#10b981' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Ayesha K.');
    expect(res.body.data.avatarColor).toBe('#10b981');
  });
});
