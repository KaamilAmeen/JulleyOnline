import 'dotenv/config';
import { PrismaClient, type Priority, type Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Password123!';
const DEFAULT_COLUMNS = ['To Do', 'In Progress', 'Testing', 'Done'];
const GAP = 1024;

interface SeedUser {
  name: string;
  email: string;
  color: string;
  memberships: { organization: string; tenant?: string; role: Role }[];
}

const users: SeedUser[] = [
  {
    name: 'Rahul Sharma',
    email: 'rahul@abctech.dev',
    color: '#6366f1',
    memberships: [{ organization: 'ABC Technologies', role: 'ORG_ADMIN' }],
  },
  {
    name: 'Priya Nair',
    email: 'priya@abctech.dev',
    color: '#ec4899',
    memberships: [{ organization: 'ABC Technologies', tenant: 'Hyderabad', role: 'TENANT_ADMIN' }],
  },
  {
    name: 'Arjun Reddy',
    email: 'arjun@abctech.dev',
    color: '#f59e0b',
    memberships: [{ organization: 'ABC Technologies', tenant: 'Hyderabad', role: 'MEMBER' }],
  },
  {
    name: 'Sneha Iyer',
    email: 'sneha@abctech.dev',
    color: '#10b981',
    memberships: [{ organization: 'ABC Technologies', tenant: 'Bangalore', role: 'TENANT_ADMIN' }],
  },
  {
    name: 'Aisha Khan',
    email: 'aisha@abctech.dev',
    color: '#06b6d4',
    memberships: [{ organization: 'ABC Technologies', tenant: 'Chennai', role: 'MEMBER' }],
  },
  {
    name: 'Meera Joshi',
    email: 'meera@xyzsolutions.dev',
    color: '#8b5cf6',
    memberships: [{ organization: 'XYZ Solutions', role: 'ORG_ADMIN' }],
  },
  {
    name: 'Kiran Patil',
    email: 'kiran@xyzsolutions.dev',
    color: '#ef4444',
    memberships: [{ organization: 'XYZ Solutions', tenant: 'Mumbai', role: 'MEMBER' }],
  },
];

const organizations = [
  {
    name: 'ABC Technologies',
    slug: 'abc-technologies',
    tenants: ['Hyderabad', 'Bangalore', 'Chennai'],
  },
  {
    name: 'XYZ Solutions',
    slug: 'xyz-solutions',
    tenants: ['Mumbai', 'Pune'],
  },
];

interface SeedTask {
  title: string;
  description: string;
  column: string;
  assignee: string;
  priority: Priority;
  dueInDays: number | null;
}

interface SeedBoard {
  tenant: string;
  organization: string;
  name: string;
  description: string;
  tasks: SeedTask[];
}

const boards: SeedBoard[] = [
  {
    tenant: 'Hyderabad',
    organization: 'ABC Technologies',
    name: 'Website Development',
    description: 'Marketing site and customer dashboard',
    tasks: [
      { title: 'Create Login Page', description: 'Responsive login screen with SSO placeholder.', column: 'To Do', assignee: 'rahul@abctech.dev', priority: 'HIGH', dueInDays: 3 },
      { title: 'Develop Registration API', description: 'Email + password registration with validation.', column: 'In Progress', assignee: 'arjun@abctech.dev', priority: 'HIGH', dueInDays: 2 },
      { title: 'Test Authentication', description: 'Cover login, refresh and lockout flows.', column: 'Testing', assignee: 'priya@abctech.dev', priority: 'URGENT', dueInDays: -1 },
      { title: 'Deploy Dashboard', description: 'Ship the analytics dashboard to staging.', column: 'Done', assignee: 'rahul@abctech.dev', priority: 'MEDIUM', dueInDays: -5 },
      { title: 'Fix API Validation', description: 'Reject malformed payloads with useful errors.', column: 'To Do', assignee: 'arjun@abctech.dev', priority: 'MEDIUM', dueInDays: 6 },
      { title: 'Design Landing Page', description: 'Hero, pricing and testimonial sections.', column: 'In Progress', assignee: 'priya@abctech.dev', priority: 'LOW', dueInDays: 10 },
      { title: 'Set Up CI Pipeline', description: 'Lint, typecheck and tests on every PR.', column: 'Testing', assignee: 'arjun@abctech.dev', priority: 'HIGH', dueInDays: 4 },
    ],
  },
  {
    tenant: 'Hyderabad',
    organization: 'ABC Technologies',
    name: 'Mobile Application Development',
    description: 'iOS + Android app for field teams',
    tasks: [
      { title: 'Define App Navigation', description: 'Bottom tabs and deep-link map.', column: 'To Do', assignee: 'priya@abctech.dev', priority: 'MEDIUM', dueInDays: 7 },
      { title: 'Build Push Notification Service', description: 'Fan-out worker with retry and dead-letter queue.', column: 'In Progress', assignee: 'arjun@abctech.dev', priority: 'HIGH', dueInDays: 5 },
      { title: 'Offline Mode Spike', description: 'Evaluate local cache and sync strategy.', column: 'Testing', assignee: 'rahul@abctech.dev', priority: 'LOW', dueInDays: 12 },
    ],
  },
  {
    tenant: 'Bangalore',
    organization: 'ABC Technologies',
    name: 'CRM Development',
    description: 'Sales pipeline for the Bangalore branch',
    tasks: [
      { title: 'Lead Import Wizard', description: 'CSV upload with column mapping.', column: 'To Do', assignee: 'sneha@abctech.dev', priority: 'HIGH', dueInDays: 4 },
      { title: 'Pipeline Analytics', description: 'Conversion funnel by owner and stage.', column: 'In Progress', assignee: 'sneha@abctech.dev', priority: 'MEDIUM', dueInDays: 8 },
      { title: 'Role Permissions Review', description: 'Confirm least-privilege defaults.', column: 'Done', assignee: 'sneha@abctech.dev', priority: 'MEDIUM', dueInDays: -2 },
    ],
  },
  {
    tenant: 'Bangalore',
    organization: 'ABC Technologies',
    name: 'AI Automation',
    description: 'Internal agentic tooling experiments',
    tasks: [
      { title: 'Evaluate Vector Database', description: 'Compare pgvector and a managed option.', column: 'To Do', assignee: 'sneha@abctech.dev', priority: 'LOW', dueInDays: 14 },
      { title: 'Prompt Evaluation Harness', description: 'Golden set + regression scoring.', column: 'In Progress', assignee: 'sneha@abctech.dev', priority: 'HIGH', dueInDays: 6 },
    ],
  },
  {
    tenant: 'Chennai',
    organization: 'ABC Technologies',
    name: 'Support Portal',
    description: 'Customer self-service and ticket intake',
    tasks: [
      { title: 'Ticket Triage Rules', description: 'Priority matrix for incoming tickets.', column: 'To Do', assignee: 'aisha@abctech.dev', priority: 'HIGH', dueInDays: 5 },
      { title: 'Knowledge Base Search', description: 'Full-text search with suggested articles.', column: 'In Progress', assignee: 'aisha@abctech.dev', priority: 'MEDIUM', dueInDays: 9 },
    ],
  },
  {
    tenant: 'Mumbai',
    organization: 'XYZ Solutions',
    name: 'Customer Support Platform',
    description: 'Multi-channel support workspace',
    tasks: [
      { title: 'Chatbot Handoff Flow', description: 'Escalate to a human with full context.', column: 'To Do', assignee: 'kiran@xyzsolutions.dev', priority: 'URGENT', dueInDays: 2 },
      { title: 'SLA Dashboard', description: 'Breach risk by queue and agent.', column: 'In Progress', assignee: 'kiran@xyzsolutions.dev', priority: 'HIGH', dueInDays: 7 },
      { title: 'Incident Postmortem Template', description: 'Blameless template with action items.', column: 'Done', assignee: 'kiran@xyzsolutions.dev', priority: 'LOW', dueInDays: -4 },
    ],
  },
  {
    tenant: 'Pune',
    organization: 'XYZ Solutions',
    name: 'Field Operations',
    description: 'On-site visit planning',
    tasks: [
      { title: 'Route Optimisation Draft', description: 'Cluster visits by zone and time window.', column: 'To Do', assignee: 'meera@xyzsolutions.dev', priority: 'MEDIUM', dueInDays: 11 },
      { title: 'Visit Checklist', description: 'Standard checklist for engineers.', column: 'In Progress', assignee: 'meera@xyzsolutions.dev', priority: 'LOW', dueInDays: 15 },
    ],
  },
];

function daysFromNow(days: number | null): Date | null {
  if (days === null) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log('Seeding demo data...');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const usersByEmail = new Map<string, { id: string; name: string }>();
  for (const seedUser of users) {
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      update: { name: seedUser.name, avatarColor: seedUser.color },
      create: {
        name: seedUser.name,
        email: seedUser.email,
        avatarColor: seedUser.color,
        passwordHash,
      },
      select: { id: true, name: true },
    });
    usersByEmail.set(seedUser.email, user);
  }

  const organizationsByName = new Map<string, { id: string; slug: string }>();
  for (const org of organizations) {
    const organization = await prisma.organization.upsert({
      where: { slug: org.slug },
      update: { name: org.name },
      create: { name: org.name, slug: org.slug },
      select: { id: true, slug: true },
    });
    organizationsByName.set(org.name, organization);
  }

  const tenantsByName = new Map<string, { id: string; organizationId: string }>();
  for (const org of organizations) {
    const organization = organizationsByName.get(org.name)!;
    for (const tenantName of org.tenants) {
      const slug = tenantName.toLowerCase();
      const tenant = await prisma.tenant.upsert({
        where: { organizationId_slug: { organizationId: organization.id, slug } },
        update: { name: tenantName },
        create: { organizationId: organization.id, name: tenantName, slug },
        select: { id: true, organizationId: true },
      });
      tenantsByName.set(tenantName, tenant);
    }
  }

  for (const seedUser of users) {
    const user = usersByEmail.get(seedUser.email)!;
    for (const membership of seedUser.memberships) {
      const organization = organizationsByName.get(membership.organization)!;
      const tenant = membership.tenant ? tenantsByName.get(membership.tenant)! : null;
      const existing = await prisma.membership.findFirst({
        where: { userId: user.id, tenantId: tenant?.id ?? null },
        select: { id: true },
      });
      if (existing) {
        await prisma.membership.update({ where: { id: existing.id }, data: { role: membership.role } });
      } else {
        await prisma.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            tenantId: tenant?.id ?? null,
            role: membership.role,
          },
        });
      }
    }
  }

  let taskCount = 0;
  for (const seedBoard of boards) {
    const tenant = tenantsByName.get(seedBoard.tenant)!;
    const creator = usersByEmail.get('rahul@abctech.dev')!;
    const board =
      (await prisma.board.findFirst({ where: { tenantId: tenant.id, name: seedBoard.name } })) ??
      (await prisma.board.create({
        data: {
          organizationId: tenant.organizationId,
          tenantId: tenant.id,
          name: seedBoard.name,
          description: seedBoard.description,
          createdBy: creator.id,
        },
      }));

    const columns = new Map<string, { id: string }>();
    for (const [index, columnName] of DEFAULT_COLUMNS.entries()) {
      const existing = await prisma.boardColumn.findFirst({
        where: { boardId: board.id, name: columnName },
        select: { id: true },
      });
      const column =
        existing ??
        (await prisma.boardColumn.create({
          data: {
            boardId: board.id,
            tenantId: tenant.id,
            name: columnName,
            position: (index + 1) * GAP,
          },
          select: { id: true },
        }));
      columns.set(columnName, column);
    }

    const positions = new Map<string, number>();
    for (const seedTask of seedBoard.tasks) {
      const column = columns.get(seedTask.column)!;
      const assignee = usersByEmail.get(seedTask.assignee)!;
      const nextPosition = (positions.get(seedTask.column) ?? 0) + GAP;
      positions.set(seedTask.column, nextPosition);

      const existing = await prisma.task.findFirst({
        where: { boardId: board.id, title: seedTask.title },
        select: { id: true },
      });
      if (existing) continue;

      await prisma.task.create({
        data: {
          boardId: board.id,
          columnId: column.id,
          tenantId: tenant.id,
          title: seedTask.title,
          description: seedTask.description,
          priority: seedTask.priority,
          assignedTo: assignee.id,
          dueDate: daysFromNow(seedTask.dueInDays),
          position: nextPosition,
          createdBy: creator.id,
        },
      });
      taskCount += 1;
    }
  }

  // A handful of activity entries so the audit feed is not empty on first load.
  const hyderabad = tenantsByName.get('Hyderabad')!;
  const bangalore = tenantsByName.get('Bangalore')!;
  const mumbai = tenantsByName.get('Mumbai')!;
  const existingActivity = await prisma.activityLog.count();
  if (existingActivity === 0) {
    const priya = usersByEmail.get('priya@abctech.dev')!;
    const arjun = usersByEmail.get('arjun@abctech.dev')!;
    const sneha = usersByEmail.get('sneha@abctech.dev')!;
    const kiran = usersByEmail.get('kiran@xyzsolutions.dev')!;
    const websiteBoard = await prisma.board.findFirst({
      where: { tenantId: hyderabad.id, name: 'Website Development' },
      select: { id: true },
    });

    const entries = [
      { tenantId: hyderabad.id, organizationId: hyderabad.organizationId, userId: priya.id, entityType: 'task', entityId: websiteBoard!.id, action: 'UPDATED', details: { title: 'Test Authentication', changes: { priority: { from: 'HIGH', to: 'URGENT' } } } },
      { tenantId: hyderabad.id, organizationId: hyderabad.organizationId, userId: arjun.id, entityType: 'task', entityId: websiteBoard!.id, action: 'MOVED', details: { title: 'Develop Registration API', toColumn: 'In Progress' } },
      { tenantId: bangalore.id, organizationId: bangalore.organizationId, userId: sneha.id, entityType: 'board', entityId: websiteBoard!.id, action: 'CREATED', details: { name: 'CRM Development' } },
      { tenantId: mumbai.id, organizationId: mumbai.organizationId, userId: kiran.id, entityType: 'task', entityId: websiteBoard!.id, action: 'CREATED', details: { title: 'Chatbot Handoff Flow' } },
    ];
    for (const entry of entries) {
      await prisma.activityLog.create({ data: entry });
    }
  }

  console.log(`Seed complete: ${users.length} users, ${organizations.length} organizations, ${tenantsByName.size} tenants, ${boards.length} boards, ${taskCount} new tasks.`);
  console.log(`Demo login: rahul@abctech.dev / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
