import { describe, expect, it } from 'vitest';
import {
  createBoard,
  createOrganization,
  createTask,
  newAgent,
  register,
} from './helpers.js';

async function boardFixture() {
  const agent = newAgent();
  await register(agent, 'Rahul Sharma', 'rahul@abctech.dev');
  const org = await createOrganization(agent, 'ABC Technologies');
  const tenantId = org.tenants[0]!.id;
  const board = await createBoard(agent, tenantId, 'Platform Roadmap');
  return { agent, tenantId, board, todo: board.columns[0]!, progress: board.columns[1]! };
}

describe('tasks, ordering and concurrency', () => {
  it('appends tasks with increasing positions and returns them in order', async () => {
    const { agent, tenantId, board, todo } = await boardFixture();
    const first = await createTask(agent, tenantId, board.id, todo.id, 'First');
    const second = await createTask(agent, tenantId, board.id, todo.id, 'Second');

    expect(first.position).toBeLessThan(second.position);
    expect(first.version).toBe(1);

    const res = await agent.get(`/api/boards/${board.id}`).set('X-Tenant-Id', tenantId);
    expect(res.status).toBe(200);
    const titles = (res.body.data.tasks as { title: string }[])
      .filter((task) => task.title === 'First' || task.title === 'Second')
      .map((task) => task.title);
    expect(titles).toEqual(['First', 'Second']);
  });

  it('moves tasks between columns and keeps fractional order', async () => {
    const { agent, tenantId, board, todo, progress } = await boardFixture();
    const t1 = await createTask(agent, tenantId, board.id, todo.id, 'One');
    const t2 = await createTask(agent, tenantId, board.id, todo.id, 'Two');
    const t3 = await createTask(agent, tenantId, board.id, todo.id, 'Three');

    const move = async (id: string, columnId: string, index: number, version: number) => {
      const res = await agent
        .patch(`/api/tasks/${id}/move`)
        .set('X-Tenant-Id', tenantId)
        .send({ columnId, index, version });
      expect(res.status).toBe(200);
      return res.body.data as { id: string; columnId: string; position: number; version: number };
    };

    const movedT3 = await move(t3.id, progress.id, 0, t3.version);
    expect(movedT3.columnId).toBe(progress.id);
    expect(movedT3.version).toBe(2);

    await move(t1.id, progress.id, 1, t1.version);
    const movedT2 = await move(t2.id, progress.id, 1, t2.version);

    const boardRes = await agent.get(`/api/boards/${board.id}`).set('X-Tenant-Id', tenantId);
    const inProgress = (boardRes.body.data.tasks as { id: string; columnId: string; position: number }[])
      .filter((task) => task.columnId === progress.id)
      .sort((a, b) => a.position - b.position)
      .map((task) => task.id);

    expect(inProgress).toEqual([t3.id, t2.id, t1.id]);
    expect(movedT2.position).toBeGreaterThan(movedT3.position);
  });

  it('rejects stale updates with 409 and the current server task', async () => {
    const { agent, tenantId, board, todo } = await boardFixture();
    const task = await createTask(agent, tenantId, board.id, todo.id, 'Ship audit log');

    const updated = await agent
      .patch(`/api/tasks/${task.id}`)
      .set('X-Tenant-Id', tenantId)
      .send({ title: 'Ship audit log v2', version: task.version });
    expect(updated.status).toBe(200);
    expect(updated.body.data.version).toBe(2);

    const stale = await agent
      .patch(`/api/tasks/${task.id}`)
      .set('X-Tenant-Id', tenantId)
      .send({ title: 'Stale write', version: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('VERSION_CONFLICT');
    expect(stale.body.error.details.currentTask.id).toBe(task.id);
    expect(stale.body.error.details.currentTask.version).toBe(2);
  });

  it('rejects a stale move as well', async () => {
    const { agent, tenantId, board, todo, progress } = await boardFixture();
    const task = await createTask(agent, tenantId, board.id, todo.id, 'Move me');

    const first = await agent
      .patch(`/api/tasks/${task.id}/move`)
      .set('X-Tenant-Id', tenantId)
      .send({ columnId: progress.id, index: 0, version: task.version });
    expect(first.status).toBe(200);

    const stale = await agent
      .patch(`/api/tasks/${task.id}/move`)
      .set('X-Tenant-Id', tenantId)
      .send({ columnId: todo.id, index: 0, version: task.version });
    expect(stale.status).toBe(409);
    expect(stale.body.error.details.currentTask.columnId).toBe(progress.id);
  });

  it('validates the column, board and assignee belong to the tenant', async () => {
    const { agent, tenantId, board, todo } = await boardFixture();

    const otherAgent = newAgent();
    const outsider = await register(otherAgent, 'Meera Joshi', 'meera@xyzsolutions.dev');
    const otherOrg = await createOrganization(otherAgent, 'XYZ Solutions');
    const otherBoard = await createBoard(otherAgent, otherOrg.tenants[0]!.id, 'Other board');

    const wrongColumn = await agent
      .post('/api/tasks')
      .set('X-Tenant-Id', tenantId)
      .send({ boardId: board.id, columnId: otherBoard.columns[0]!.id, title: 'Wrong column' });
    expect(wrongColumn.status).toBe(400);

    const wrongAssignee = await agent
      .post('/api/tasks')
      .set('X-Tenant-Id', tenantId)
      .send({ boardId: board.id, columnId: todo.id, title: 'Wrong assignee', assignedTo: outsider.id });
    expect(wrongAssignee.status).toBe(400);
    expect(wrongAssignee.body.error.message).toContain('not a member');
  });

  it('filters overdue tasks and supports search', async () => {
    const { agent, tenantId, board, todo } = await boardFixture();
    await createTask(agent, tenantId, board.id, todo.id, 'Late audit', {
      dueDate: '2020-01-01T00:00:00.000Z',
      priority: 'URGENT',
    });
    await createTask(agent, tenantId, board.id, todo.id, 'Future work', {
      dueDate: '2999-01-01T00:00:00.000Z',
    });

    const overdue = await agent.get('/api/tasks?overdue=true').set('X-Tenant-Id', tenantId);
    expect(overdue.status).toBe(200);
    expect((overdue.body.data as { title: string }[]).map((task) => task.title)).toEqual(['Late audit']);

    const search = await agent.get('/api/tasks?search=future').set('X-Tenant-Id', tenantId);
    expect((search.body.data as { title: string }[]).map((task) => task.title)).toEqual(['Future work']);
  });

  it('deletes a task and removes it from the board', async () => {
    const { agent, tenantId, board, todo } = await boardFixture();
    const task = await createTask(agent, tenantId, board.id, todo.id, 'Temporary');

    const deleted = await agent.delete(`/api/tasks/${task.id}`).set('X-Tenant-Id', tenantId);
    expect(deleted.status).toBe(204);

    const missing = await agent.get(`/api/tasks/${task.id}`).set('X-Tenant-Id', tenantId);
    expect(missing.status).toBe(404);
  });
});
