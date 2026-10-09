/** Page arithmetic shared by the staff lists. Pure, so it is unit-tested. */

export type PageInfo = { page: number; pageSize: number; total: number; pages: number; from: number; to: number }

export function parsePage(value: string | undefined | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 100_000 ? n : 1
}

export function pageInfo(total: number, page: number, pageSize: number): PageInfo {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pages)
  return {
    page: current,
    pageSize,
    total,
    pages,
    from: total === 0 ? 0 : (current - 1) * pageSize + 1,
    to: Math.min(total, current * pageSize),
  }
}

/** Escapes the characters that mean something to LIKE/ILIKE, so a search for "50%" finds "50%". */
export function likePattern(input: string): string {
  return `%${input.trim().replace(/[\\%_]/g, (c) => '\\' + c)}%`
}
