export interface PresenceUser {
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  connections: number;
  lastSeen: string;
}

interface PresenceEntry {
  user: { id: string; name: string; email: string; avatarColor: string };
  sockets: Set<string>;
  lastSeen: Date;
}

/** tenantId -> userId -> presence entry */
const presenceByTenant = new Map<string, Map<string, PresenceEntry>>();

function tenantMap(tenantId: string): Map<string, PresenceEntry> {
  let map = presenceByTenant.get(tenantId);
  if (!map) {
    map = new Map();
    presenceByTenant.set(tenantId, map);
  }
  return map;
}

/**
 * Tracks one connection. Multiple tabs are counted, so closing one tab does
 * not mark the user offline while another tab is still open.
 */
export function addPresence(
  tenantId: string,
  user: { id: string; name: string; email: string; avatarColor: string },
  socketId: string,
): PresenceUser[] {
  const map = tenantMap(tenantId);
  const existing = map.get(user.id);
  if (existing) {
    existing.sockets.add(socketId);
    existing.lastSeen = new Date();
  } else {
    map.set(user.id, { user, sockets: new Set([socketId]), lastSeen: new Date() });
  }
  return listPresence(tenantId);
}

/** Returns true when this was the user's last connection in the tenant. */
export function removePresence(tenantId: string, userId: string, socketId: string): boolean {
  const map = presenceByTenant.get(tenantId);
  if (!map) return false;
  const entry = map.get(userId);
  if (!entry) return false;

  entry.sockets.delete(socketId);
  entry.lastSeen = new Date();
  if (entry.sockets.size === 0) {
    map.delete(userId);
    if (map.size === 0) presenceByTenant.delete(tenantId);
    return true;
  }
  return false;
}

export function listPresence(tenantId: string): PresenceUser[] {
  const map = presenceByTenant.get(tenantId);
  if (!map) return [];
  return [...map.values()]
    .map((entry) => ({
      userId: entry.user.id,
      name: entry.user.name,
      email: entry.user.email,
      avatarColor: entry.user.avatarColor,
      connections: entry.sockets.size,
      lastSeen: entry.lastSeen.toISOString(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
