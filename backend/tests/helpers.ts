import request from 'supertest';
import { app } from '../src/app.js';

export type Agent = ReturnType<typeof request.agent>;

export const PASSWORD = 'Password123!';

export function newAgent(): Agent {
  return request.agent(app);
}

export function cookieValue(res: request.Response, name: string): string | undefined {
  const header = res.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match?.split(';')[0]?.slice(name.length + 1);
}

export async function register(
  agent: Agent,
  name: string,
  email: string,
): Promise<{ id: string; name: string; email: string }> {
  const res = await agent.post('/api/auth/register').send({ name, email, password: PASSWORD });
  if (res.status !== 201) {
    throw new Error(`register failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data.user;
}

export async function login(agent: Agent, email: string, password = PASSWORD): Promise<request.Response> {
  return agent.post('/api/auth/login').send({ email, password });
}

export async function createOrganization(agent: Agent, name: string) {
  const res = await agent.post('/api/organizations').send({ name });
  if (res.status !== 201) {
    throw new Error(`create organization failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data as {
    id: string;
    name: string;
    tenants: { id: string; name: string }[];
  };
}

export async function createTenant(agent: Agent, organizationId: string, name: string) {
  const res = await agent.post(`/api/organizations/${organizationId}/tenants`).send({ name });
  if (res.status !== 201) {
    throw new Error(`create tenant failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data as { id: string; name: string };
}

export async function createBoard(agent: Agent, tenantId: string, name = 'Test Board') {
  const res = await agent
    .post('/api/boards')
    .set('X-Tenant-Id', tenantId)
    .send({ name, templateColumns: ['To Do', 'In Progress', 'Done'] });
  if (res.status !== 201) {
    throw new Error(`create board failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data as {
    id: string;
    columns: { id: string; name: string; position: number }[];
  };
}

export async function createTask(
  agent: Agent,
  tenantId: string,
  boardId: string,
  columnId: string,
  title: string,
  extra: Record<string, unknown> = {},
) {
  const res = await agent
    .post('/api/tasks')
    .set('X-Tenant-Id', tenantId)
    .send({ boardId, columnId, title, ...extra });
  if (res.status !== 201) {
    throw new Error(`create task failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data as {
    id: string;
    title: string;
    columnId: string;
    position: number;
    version: number;
    assignee: { id: string } | null;
  };
}

export async function addTenantMember(
  agent: Agent,
  tenantId: string,
  email: string,
  role: 'TENANT_ADMIN' | 'MEMBER',
) {
  const res = await agent
    .post(`/api/tenants/${tenantId}/members`)
    .set('X-Tenant-Id', tenantId)
    .send({ email, role });
  if (res.status !== 201) {
    throw new Error(`add member failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data as { id: string; role: string; user: { id: string } };
}
