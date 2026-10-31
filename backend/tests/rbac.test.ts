import { describe, expect, it } from 'vitest';
import {
  addTenantMember,
  createBoard,
  createOrganization,
  createTask,
  newAgent,
  register,
} from './helpers.js';

async function workspace() {
  const owner = newAgent();
  await register(owner, 'Rahul Sharma', 'rahul@abctech.dev');
  const org = await createOrganization(owner, 'ABC Technologies');
  const tenantId = org.tenants[0]!.id;
  const board = await createBoard(owner, tenantId, 'Platform Roadmap');

  const admin = newAgent();
  await register(admin, 'Priya Nair', 'priya@abctech.dev');
  await addTenantMember(owner, tenantId, 'priya@abctech.dev', 'TENANT_ADMIN');

  const member = newAgent();
  await register(member, 'Arjun Reddy', 'arjun@abctech.dev');
  await addTenantMember(owner, tenantId, 'arjun@abctech.dev', 'MEMBER');

  return { owner, admin, member, org, tenantId, board };
}

describe('role-based access control', () => {
  it('prevents members from managing boards and columns', async () => {
    const { member, tenantId, board } = await workspace();
    const todo = board.columns[0]!;

    const createBoard = await member
      .post('/api/boards')
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Member board' });
    expect(createBoard.status).toBe(403);

    const createColumn = await member
      .post(`/api/boards/${board.id}/columns`)
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Blocked' });
    expect(createColumn.status).toBe(403);

    const rename = await member
      .patch(`/api/columns/${todo.id}`)
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Renamed' });
    expect(rename.status).toBe(403);
  });

  it('lets members work with tasks but only delete their own', async () => {
    const { owner, member, tenantId, board } = await workspace();
    const todo = board.columns[0]!;

    const own = await createTask(member, tenantId, board.id, todo.id, 'Member task');
    const ownersTask = await createTask(owner, tenantId, board.id, todo.id, 'Owner task');

    const forbidden = await member.delete(`/api/tasks/${ownersTask.id}`).set('X-Tenant-Id', tenantId);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.message).toContain('only delete tasks they created');

    const allowed = await member.delete(`/api/tasks/${own.id}`).set('X-Tenant-Id', tenantId);
    expect(allowed.status).toBe(204);
  });

  it('lets tenant admins manage boards but not delete the branch', async () => {
    const { admin, tenantId } = await workspace();

    const board = await admin
      .post('/api/boards')
      .set('X-Tenant-Id', tenantId)
      .send({ name: 'Admin board', templateColumns: ['To Do', 'Done'] });
    expect(board.status).toBe(201);

    const deleteTenant = await admin.delete(`/api/tenants/${tenantId}`).set('X-Tenant-Id', tenantId);
    expect(deleteTenant.status).toBe(403);
  });

  it('restricts member management endpoints', async () => {
    const { member, tenantId } = await workspace();

    const members = await member.get(`/api/tenants/${tenantId}/members`).set('X-Tenant-Id', tenantId);
    expect(members.status).toBe(403);

    const people = await member.get(`/api/tenants/${tenantId}/people`).set('X-Tenant-Id', tenantId);
    expect(people.status).toBe(200);
    expect(people.body.data.length).toBeGreaterThanOrEqual(3);
  });

  it('protects the last organization admin', async () => {
    const { owner, org } = await workspace();
    const members = await owner.get(`/api/organizations/${org.id}/members`);
    expect(members.status).toBe(200);

    const ownerMembership = (members.body.data as { id: string; role: string; tenantId: string | null }[]).find(
      (membership) => membership.role === 'ORG_ADMIN' && membership.tenantId === null,
    );
    expect(ownerMembership).toBeTruthy();

    const demote = await owner
      .patch(`/api/organizations/${org.id}/members/${ownerMembership!.id}`)
      .send({ role: 'MEMBER' });
    expect(demote.status).toBe(409);
    expect(demote.body.error.code).toBe('LAST_ORG_ADMIN');
  });
});
