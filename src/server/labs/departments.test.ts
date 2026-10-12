import { describe, expect, it } from 'vitest'
import { ancestorIds, orderTree, rollUp, wouldCreateCycle, type Department } from './departments'

const dept = (id: string, name: string, parentId: string | null = null): Department => ({ id, slug: id, name, parentId })
// Engineering > (Mechanical, Electrical > Power), Science
const TREE = [dept('eng', 'Engineering'), dept('mech', 'Mechanical', 'eng'), dept('elec', 'Electrical', 'eng'), dept('power', 'Power', 'elec'), dept('sci', 'Science')]
const KEYS = ['requests', 'hours'] as const

describe('the department tree', () => {
  it('lists ancestors nearest first', () => {
    expect(ancestorIds(TREE, 'power')).toEqual(['elec', 'eng'])
    expect(ancestorIds(TREE, 'eng')).toEqual([])
    expect(ancestorIds(TREE, 'unknown')).toEqual([])
  })

  it('orders depth first with siblings by name', () => {
    expect(orderTree(TREE).map((d) => `${d.depth}:${d.name}`)).toEqual(['0:Engineering', '1:Electrical', '2:Power', '1:Mechanical', '0:Science'])
  })

  it('refuses a move that would make a cycle', () => {
    expect(wouldCreateCycle(TREE, 'eng', 'power')).toBe(true) // under its own grandchild
    expect(wouldCreateCycle(TREE, 'eng', 'eng')).toBe(true)
    expect(wouldCreateCycle(TREE, 'power', 'sci')).toBe(false)
    expect(wouldCreateCycle(TREE, 'power', null)).toBe(false)
  })

  it('survives bad data: a cycle already in the table neither loops nor hides a department', () => {
    const bad = [dept('a', 'A', 'b'), dept('b', 'B', 'a'), dept('c', 'C')]
    expect(ancestorIds(bad, 'a')).toEqual(['b'])
    expect(orderTree(bad).map((d) => d.id).sort()).toEqual(['a', 'b', 'c'])
  })
})

describe('roll-up', () => {
  const rows = [
    { departmentId: 'power', values: { requests: 10, hours: 20 } },
    { departmentId: 'mech', values: { requests: 5, hours: 8 } },
    { departmentId: 'elec', values: { requests: 1, hours: 1 } },
    { departmentId: 'sci', values: { requests: 2, hours: 3 } },
    { departmentId: null, values: { requests: 100, hours: 100 } }, // not placed: in no department
    { departmentId: 'gone', values: { requests: 100, hours: 100 } }, // an id that no longer exists
  ]

  it('adds a lab to its department and to every department above it', () => {
    const byId = Object.fromEntries(rollUp(TREE, rows, KEYS).map((r) => [r.department.id, r]))
    expect(byId.power!.values).toEqual({ requests: 10, hours: 20 })
    expect(byId.elec!.values).toEqual({ requests: 11, hours: 21 })
    expect(byId.eng!.values).toEqual({ requests: 16, hours: 29 })
    expect(byId.eng!.labs).toBe(3)
    expect(byId.sci!.values).toEqual({ requests: 2, hours: 3 })
  })

  it('leaves out unplaced labs and departments with no lab at or below them', () => {
    const only = rollUp(TREE, [{ departmentId: 'sci', values: { requests: 1, hours: 1 } }], KEYS)
    expect(only.map((r) => r.department.id)).toEqual(['sci'])
  })

  it('follows a reorganisation: move Electrical under Science and the totals follow', () => {
    const moved = TREE.map((d) => (d.id === 'elec' ? { ...d, parentId: 'sci' } : d))
    const byId = Object.fromEntries(rollUp(moved, rows, KEYS).map((r) => [r.department.id, r]))
    expect(byId.eng!.values).toEqual({ requests: 5, hours: 8 })
    expect(byId.sci!.values).toEqual({ requests: 13, hours: 24 })
  })
})
