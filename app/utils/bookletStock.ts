/**
 * مخزونُ الملازم (طلب المستخدم 2026-10-28): مستوى رصيد كلّ ملزمة (نفد / قارب النفاد / كافٍ / غيرُ متتبَّع)،
 * وعددُ ما يحتاج تنبيهاً. منطقٌ صرفٌ مختبَر.
 */
import { BOOKLETS } from '~/constants/booklets'

export interface StockRow { booklet: number, quantity: number, alert_at: number }
export type StockLevel = 'untracked' | 'out' | 'low' | 'ok'
export interface StockItem { no: number, label: string, quantity: number | null, alertAt: number | null, level: StockLevel }

/** مستوى الرصيد: لا صفَّ = غيرُ متتبَّع، وصفرٌ = نفد، وعند الحدّ أو دونه = قارب النفاد. */
export function stockLevel(row: StockRow | undefined): StockLevel {
  if (!row) return 'untracked'
  if (row.quantity <= 0) return 'out'
  return row.quantity <= row.alert_at ? 'low' : 'ok'
}

/** الملازمُ الخمسَ عشرة بأرصدتها بترتيبها. */
export function stockItems(rows: StockRow[]): StockItem[] {
  const by = new Map(rows.map(r => [r.booklet, r]))
  return BOOKLETS.map((b) => {
    const r = by.get(b.no)
    return { no: b.no, label: b.label, quantity: r?.quantity ?? null, alertAt: r?.alert_at ?? null, level: stockLevel(r) }
  })
}

/** كم ملزمةً نفدت أو قاربت — لعدّاد القائمة. */
export function lowStockCount(rows: StockRow[]): number {
  return rows.filter(r => ['out', 'low'].includes(stockLevel(r))).length
}

/** تنبيهٌ بعد التسليم إن صار رصيدُ ملزمته عند الحدّ أو دونه، وإلا null. */
export function lowStockWarning(rows: StockRow[], booklet: number): string | null {
  const r = rows.find(x => x.booklet === booklet)
  const level = stockLevel(r)
  const label = BOOKLETS.find(b => b.no === booklet)?.label ?? ''
  if (level === 'out') return `نفد مخزون ملزمة ${label}.`
  if (level === 'low') return `قارب مخزون ملزمة ${label} على النفاد: بقي ${r!.quantity} نسخة.`
  return null
}
