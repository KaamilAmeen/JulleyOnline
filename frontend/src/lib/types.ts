export type Role = "ORG_ADMIN" | "TENANT_ADMIN" | "MEMBER";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  createdAt?: string;
}

export type UserLite = Pick<User, "id" | "name" | "email" | "avatarColor">;

export interface Membership {
  id: string;
  role: Role;
  organizationId: string;
  tenantId: string | null;
  organization: { id: string; name: string; slug: string };
  tenant: { id: string; name: string; slug: string } | null;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  boardCount: number;
  memberCount: number;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  role: Role;
  createdAt: string;
  boardCount: number;
  tenants: TenantSummary[];
}

export interface BoardSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  creator: UserLite;
  _count: { tasks: number; columns: number };
}

export interface BoardColumn {
  id: string;
  boardId: string;
  tenantId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  boardId: string;
  columnId: string;
  tenantId: string;
  title: string;
  description: string | null;
  priority: Priority;
  assignedTo: string | null;
  dueDate: string | null;
  position: number;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  assignee: UserLite | null;
  creator: UserLite;
}

export interface Board {
  id: string;
  organizationId: string;
  tenantId: string;
  name: string;
  description: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator: UserLite;
  columns: BoardColumn[];
  tasks: Task[];
}

export interface Activity {
  id: string;
  tenantId: string;
  organizationId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  details: Record<string, unknown>;
  createdAt: string;
  user: UserLite;
}

export interface PresenceUser {
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  connections: number;
  lastSeen: string;
}

export interface TenantPerson extends UserLite {
  role: Role;
}

export interface AiAnswer {
  answer: string;
  toolsUsed: string[];
  provider: string;
  model?: string;
  generatedAt: string;
}
