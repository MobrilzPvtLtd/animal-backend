// Legacy names remain aliases while existing installations migrate their role rows.
export function isRetiredRole(name: string | null | undefined): boolean {
  return ['approver', 'manager'].includes((name || '').trim().toLowerCase());
}

export function roleKey(name: string | null | undefined): string {
  const key = (name || '').trim().toLowerCase();
  return ['owner', 'admin', 'super admin', 'super_admin', 'superadmin'].includes(key) ? 'super admin' : key;
}

export function isSuperAdmin(name: string | null | undefined): boolean {
  return roleKey(name) === 'super admin';
}

export function roleLabel(name: string): string {
  return isSuperAdmin(name) ? 'Super Admin' : name.trim();
}

// Options are derived only from database rows, never from a fixed role list.
// Keep source IDs so legacy assignments can be filtered and edited together.
export function systemRoleOptions<T extends { role_id: number; name: string }>(roles: T[]) {
  const groups = new Map<string, T & { role_ids: number[] }>();
  roles.forEach(role => {
    if (isRetiredRole(role.name)) return;
    const key = roleKey(role.name);
    if (!key) return;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.role_ids.includes(role.role_id)) existing.role_ids.push(role.role_id);
      // Prefer the actual canonical row for new assignments when it exists.
      if (role.name === 'Super Admin') groups.set(key, { ...role, role_ids: existing.role_ids });
    } else groups.set(key, { ...role, name: roleLabel(role.name), role_ids: [role.role_id] });
  });
  return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
}
