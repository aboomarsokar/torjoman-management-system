/**
 * بناءُ ملفّ Excel وتنزيلُه (طلب المستخدم 2026-10-28): ورقةٌ لكلّ جدول، من اليمين لليسار، برؤوسٍ عربيةٍ مثبّتةٍ
 * وفلترٍ تلقائيّ. مكتبةُ exceljs تُحمَّل عند الطلب فقط (ثقيلة) فلا تُثقل الصفحات الأخرى.
 */
import { SHEET_NAME_MAX } from '~/constants/dataExport'

export type Cell = string | number | boolean | null | undefined
export interface SheetColumn { header: string, key: string, width?: number }
export interface SheetSpec { name: string, columns: SheetColumn[], rows: Record<string, Cell>[] }

const DEFAULT_WIDTH = 16
/** لونُ الرأس من الهوية البصرية (Navy) — ملفُّ Excel لا يقرأ متغيّرات CSS. */
const HEADER_FILL = 'FF094064'
const HEADER_FONT = 'FFFFFFFF'

/** اسمُ ورقةٍ صالحٌ في Excel: بلا الرموز الممنوعة، وبحدّه، وفريدٌ بين الأوراق. */
export function safeSheetName(name: string, taken: Set<string>): string {
  const base = name.replace(/[[\]:*?/\\]/g, '-').trim().slice(0, SHEET_NAME_MAX) || 'ورقة'
  let candidate = base
  for (let i = 2; taken.has(candidate); i++) candidate = `${base.slice(0, SHEET_NAME_MAX - String(i).length - 1)} ${i}`
  taken.add(candidate)
  return candidate
}

/** اسمُ الملفّ: «ترجمان — العاملون — 28-10-2026.xlsx». */
export function exportFileName(title: string, today: string): string {
  const [y, m, d] = today.split('-')
  return `ترجمان — ${title} — ${d}-${m}-${y}.xlsx`
}

export async function downloadWorkbook(fileName: string, sheets: SheetSpec[]): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  wb.creator = 'منصة ترجمان القرآنية'
  wb.created = new Date()
  const taken = new Set<string>()
  for (const spec of sheets) {
    const ws = wb.addWorksheet(safeSheetName(spec.name, taken), {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
    })
    ws.columns = spec.columns.map(c => ({ header: c.header, key: c.key, width: c.width ?? DEFAULT_WIDTH }))
    ws.addRows(spec.rows)
    const header = ws.getRow(1)
    header.font = { bold: true, color: { argb: HEADER_FONT } }
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } }
    header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    header.height = 28
    if (spec.columns.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: spec.columns.length } }
  }
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
