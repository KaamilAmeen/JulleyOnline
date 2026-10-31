import { describe, expect, it } from 'vitest';
import {
  addTenantMember,
  createBoard,
  createOrganization,
  createTenant,
  newAgent,
  register,
} from './helpers.js';

describe('tenant isolation', () => {
  it('requires X-Tenant-Id and validates it against memberships', async () => {
    const owner = newAgent();
    await register(owner, 'Rahul Sharma', 'rahul@abctech.dev');
    const org = await createOrganization(owner, 'ABC Technologies');
    const tenantA = org.tenants[0]!.id;

    const outsider = newAgent();
    await register(outsider, 'Meera Joshi', 'meera@xyzsolutions.dev');
    const otherOrg = await createOrganization(outsider, 'XYZ Solutions');
    const tenantB = otherOrg.tenants[0]!.id;

    const noHeader = await owner.get('/api/boards');
    expect(noHeader.status).toBe(400);
    expect(noHeader.body.error.message).toContain('X-Tenant-Id');

    const forged = await outsider.get('/api/boards').set('X-Tenant-Id', tenantA);
    expect(forged.status).toBe(403);

    const unknown = await owner.get('/api/boards').set('X-Tenant-Id', '00000000-0000-4000-8000-000000000000');
    expect(unknown.status).toBe(404);

    const malformed = await owner.get('/api/boards').set('X-Tenant-Id', 'not-a-uuid');
    expect(malformed.status).toBe(400);

    // Each user still sees their own tenant.
    expect((await owner.get('/api/boards').set('X-Tenant-Id', tenantA)).status).toBe(200);
    expect((await outsider.get('/api/boards').set('X-Tenant-Id', tenantB)).status).toBe(200);
  });

  it('never returns a board from another tenant, even with a valid id', async () => {
    const ownerA = newAgent();
    await register(ownerA, 'Rahul Sharma', 'rahul@abctech.dev');
    const orgA = await createOrganization(ownerA, 'ABC Technologies');
    const tenantA = orgA.tenants[0]!.id;
    const boardA = await createBoard(ownerA, tenantA, 'Platform Roadmap');

    const ownerB = newAgent();
    await register(ownerB, 'Meera Joshi', 'meera@xyzsolutions.dev');
    const orgB = await createOrganization(ownerB, 'XYZ Solutions');
    const tenantB = orgB.tenants[0]!.id;

    const crossTenant = await ownerB.get(`/api/boards/${boardA.id}`).set('X-Tenant-Id', tenantB);
    expect(crossTenant.status).toBe(404);

    const crossOrg = await ownerA.get(`/api/boards/${boardA.id}`).set('X-Tenant-Id', tenantB);
    expect(crossOrg.status).toBe(403);
  });

  it('gives org admins every branch but limits members to their own', async () => {
    const owner = newAgent();
    await register(owner, 'Rahul Sharma', 'rahul@abctech.dev');
    const org = await createOrganization(owner, 'ABC Technologies');
    const hyderabad = org.tenants[0]!.id;
    const bangalore = (await createTenant(owner, org.id, 'Bangalore')).id;

    const member = newAgent();
    await register(member, 'Arjun Reddy', 'arjun@abctech.dev');
    await addTenantMember(owner, hyderabad, 'arjun@abctech.dev', 'MEMBER');

    // Org admin has implicit access to the new branch.
    expect((await owner.get('/api/boards').set('X-Tenant-Id', bangalore)).status).toBe(200);

    // The tenant member does not.
    expect((await member.get('/api/boards').set('X-Tenant-Id', bangalore)).status).toBe(403);
    expect((await member.get('/api/boards').set('X-Tenant-Id', hyderabad)).status).toBe(200);

    const tenants = await member.get('/api/tenants');
    expect(tenants.status).toBe(200);
    const names = (tenants.body.data as { name: string }[]).map((tenant) => tenant.name);
    // Every new organization starts with a "Head Office" tenant.
    expect(names).toContain('Head Office');
    expect(names).not.toContain('Bangalore');
  });

  it('blocks adding a user to a tenant from a different organization', async () => {
    const ownerA = newAgent();
    await register(ownerA, 'Rahul Sharma', 'rahul@abctech.dev');
    const orgA = await createOrganization(ownerA, 'ABC Technologies');
    const tenantA = orgA.tenants[0]!.id;

    const ownerB = newAgent();
    await register(ownerB, 'Meera Joshi', 'meera@xyzsolutions.dev');
    const orgB = await createOrganization(ownerB, 'XYZ Solutions');
    const tenantB = orgB.tenants[0]!.id;

    const res = await ownerA
      .post(`/api/organizations/${orgA.id}/members`)
      .send({ email: 'meera@xyzsolutions.dev', role: 'MEMBER', tenantId: tenantB });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(tenantA).toBeTruthy();
  });
});
