/**
 * The department hierarchy as pure functions of rows. The hierarchy is data (the `lab_departments`
 * table), so a reorganisation is an edit in the admin screen, never a code change.
 */

export type Department = { id: string; slug: string; name: string; parentId: string | null }

/** Ancestor ids of a department, nearest first. Stops at a missing parent and never loops, whatever the data. */
export function ancestorIds(departments: Department[], id: string): string[] {
  const byId = new Map(departments.map((d) => [d.id, d]))
  const seen = new Set<string>([id])
  const out: string[] = []
  let cursor = byId.get(id)?.parentId ?? null
  while (cursor && !seen.has(cursor) && byId.has(cursor)) {
    out.push(cursor)
    seen.add(cursor)
    cursor = byId.get(cursor)!.parentId
  }
  return out
}

/** Whether giving `id` the parent `newParentId` would make a cycle (including making it its own parent). */
export function wouldCreateCycle(departments: Department[], id: string, newParentId: string | null): boolean {
  if (newParentId === null) return false
  if (newParentId === id) return true
  return ancestorIds(departments, newParentId).includes(id)
}

export type DepartmentNode = Department & { depth: number }

/** Depth-first, siblings by name: the order a tree is shown in. Departments caught in a cycle are shown as roots. */
export function orderTree(departments: Department[]): DepartmentNode[] {
  const ids = new Set(departments.map((d) => d.id))
  const children = new Map<string | null, Department[]>()
  for (const d of departments) {
    const parent = d.parentId && ids.has(d.parentId) && !wouldCreateCycle(departments, d.id, d.parentId) ? d.parentId : null
    children.set(parent, [...(children.get(parent) ?? []), d])
  }
  const out: DepartmentNode[] = []
  const visit = (parent: string | null, depth: number) => {
    for (const d of (children.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ ...d, depth })
      visit(d.id, depth + 1)
    }
  }
  visit(null, 0)
  return out
}

/**
 * Adds each lab's figures to its department and to every ancestor. `rows` carry the lab's own
 * numbers; the result is one entry per department that has at least one lab at or below it, in tree
 * order. A lab with no (or an unknown) department is not in the roll-up.
 */
export function rollUp<T extends Record<string, number>>(
  departments: Department[],
  rows: { departmentId: string | null; values: T }[],
  keys: readonly (keyof T)[],
): { department: DepartmentNode; labs: number; values: T }[] {
  const known = new Set(departments.map((d) => d.id))
  const acc = new Map<string, { labs: number; values: Record<string, number> }>()
  for (const row of rows) {
    if (!row.departmentId || !known.has(row.departmentId)) continue
    for (const id of [row.departmentId, ...ancestorIds(departments, row.departmentId)]) {
      const entry = acc.get(id) ?? { labs: 0, values: Object.fromEntries(keys.map((k) => [k as string, 0])) }
      entry.labs += 1
      for (const k of keys) entry.values[k as string]! += row.values[k] as number
      acc.set(id, entry)
    }
  }
  return orderTree(departments)
    .filter((d) => acc.has(d.id))
    .map((d) => ({ department: d, labs: acc.get(d.id)!.labs, values: acc.get(d.id)!.values as T }))
}
