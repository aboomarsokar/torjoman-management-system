import { describe, expect, it } from 'vitest'
import { exportFileName, safeSheetName } from './workbook'

describe('safeSheetName', () => {
  it('يحذف الرموز الممنوعة ويقصّ ويجعل الاسم فريداً', () => {
    const taken = new Set<string>()
    expect(safeSheetName('الحضور 10/2026', taken)).toBe('الحضور 10-2026')
    expect(safeSheetName('الحضور 10/2026', taken)).toBe('الحضور 10-2026 2')
    expect(safeSheetName('ا'.repeat(40), taken)).toHaveLength(31)
  })
})

describe('exportFileName', () => {
  it('بتاريخ اليوم بالأرقام', () => {
    expect(exportFileName('العاملون', '2026-10-28')).toBe('ترجمان — العاملون — 28-10-2026.xlsx')
  })
})
