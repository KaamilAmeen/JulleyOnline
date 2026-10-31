export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'item';
}

/** Finds a free slug by appending -2, -3, ... when the base is taken. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    const candidate = `${root}-${suffix}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root}-${Date.now()}`;
}
