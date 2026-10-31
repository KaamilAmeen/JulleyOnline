import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createOrganization,
  createTask,
  newAgent,
  register,
} from './helpers.js';

async function fixture() {
  const agent = newAgent();
  await register(agent, 'Rahul Sharma', 'rahul@abctech.dev');
  const org = await createOrganization(agent, 'ABC Technologies');
  const tenantId = org.tenants[0]!.id;
  const board = await createBoard(agent, tenantId, 'Platform Roadmap');
  return { agent, tenantId, board, todo: board.columns[0]!, progress: board.columns[1]! };
}

describe('activity log', () => {
  it('records create, move, update and delete events', async () => {
    const { agent, tenantId, board, todo, progress } = await fixture();
    const task = await createTask(agent, tenantId, board.id, todo.id, 'Ship audit log');

    await agent
      .patch(`/api/tasks/${task.id}/move`)
      .set('X-Tenant-Id', tenantId)
      .send({ columnId: progress.id, index: 0, version: task.version });

    await agent
      .patch(`/api/tasks/${task.id}`)
      .set('X-Tenant-Id', tenantId)
      .send({ title: 'Ship audit log v2', version: task.version + 1 });

    await agent.delete(`/api/tasks/${task.id}`).set('X-Tenant-Id', tenantId);

    const feed = await agent.get('/api/activity?limit=100').set('X-Tenant-Id', tenantId);
    expect(feed.status).toBe(200);
    const actions = (feed.body.data as { action: string; entityId: string }[])
      .filter((entry) => entry.entityId === task.id)
      .map((entry) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(['CREATED', 'MOVED', 'UPDATED', 'DELETED']));

    const filtered = await agent
      .get(`/api/activity?entityType=task&entityId=${task.id}`)
      .set('X-Tenant-Id', tenantId);
    expect(filtered.status).toBe(200);
    expect((filtered.body.data as unknown[]).length).toBe(4);
  });

  it('filters by board and exposes per-task history', async () => {
    const { agent, tenantId, board, todo } = await fixture();
    const task = await createTask(agent, tenantId, board.id, todo.id, 'History task');

    const byBoard = await agent
      .get(`/api/activity?boardId=${board.id}`)
      .set('X-Tenant-Id', tenantId);
    expect(byBoard.status).toBe(200);
    const ids = (byBoard.body.data as { entityId: string }[]).map((entry) => entry.entityId);
    expect(ids).toContain(task.id);

    const perTask = await agent
      .get(`/api/tasks/${task.id}/activity`)
      .set('X-Tenant-Id', tenantId);
    expect(perTask.status).toBe(200);
    expect(perTask.body.data[0].action).toBe('CREATED');
  });

  it('does not expose another tenant activity feed', async () => {
    const { agent, tenantId } = await fixture();

    const outsider = newAgent();
    await register(outsider, 'Meera Joshi', 'meera@xyzsolutions.dev');
    await createOrganization(outsider, 'XYZ Solutions');

    const res = await outsider.get('/api/activity').set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(403);
  });
});
