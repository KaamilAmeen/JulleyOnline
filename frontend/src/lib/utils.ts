import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}

export function relativeTime(value: string): string {
  const date = new Date(value).getTime();
  const diff = Date.now() - date;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(value);
}

export function isOverdue(dueDate: string | null): boolean {
  return Boolean(dueDate && new Date(dueDate).getTime() < Date.now());
}

export function toDateInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export const PRIORITY_META = {
  LOW: { label: "Low", className: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
  MEDIUM: { label: "Medium", className: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  HIGH: { label: "High", className: "bg-orange-500/10 text-orange-300 border-orange-500/30" },
  URGENT: { label: "Urgent", className: "bg-rose-500/10 text-rose-300 border-rose-500/30" },
} as const;

export const ROLE_LABEL = {
  ORG_ADMIN: "Org Admin",
  TENANT_ADMIN: "Tenant Admin",
  MEMBER: "Member",
} as const;

export const ACTION_LABEL: Record<string, string> = {
  CREATED: "created",
  UPDATED: "updated",
  MOVED: "moved",
  DELETED: "deleted",
  ASSIGNED: "assigned",
  MEMBER_ADDED: "added a member",
  MEMBER_UPDATED: "changed a member role",
  MEMBER_REMOVED: "removed a member",
};
