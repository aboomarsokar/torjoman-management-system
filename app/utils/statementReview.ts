/**
 * الاطّلاعُ على كشوف الحوافز دفعةً واحدة (طلب المستخدم 2026-11-19): المحدَّدُ القابلُ للاطّلاع
 * (المُرسَلُ وحده) ونصُّ التأكيد بعدده وما سيُرحَّل منه إلى الشهر التالي.
 */
export interface StatementRow {
  id: string
  halaqa_id: string
  halaqa: string
  halaqa_name: string
  gender: string | null
  teacher_name: string | null
  received: number
  carried: number
  spent: number
  status: string
  returnNote: string | null
}

/** متبقّي الكشف: المستلَم + المرحَّل − المصروف. */
export const statementLeft = (s: Pick<StatementRow, 'received' | 'carried' | 'spent'>) => s.received + s.carried - s.spent

/** معرّفاتُ المحدَّد التي يجوز الاطّلاعُ عليها (المُرسَلةُ وحدها). */
export function reviewableIds(rows: Pick<StatementRow, 'id' | 'status'>[], selected: string[]): string[] {
  const set = new Set(selected)
  return rows.filter(r => r.status === 'submitted' && set.has(r.id)).map(r => r.id)
}

/** نصُّ التأكيد: العددُ، ومجموعُ الفائض الذي سيُرحَّل (التجاوزُ لا يُرحَّل). */
export function bulkReviewText(rows: Pick<StatementRow, 'received' | 'carried' | 'spent'>[]): string {
  const carry = rows.reduce((t, r) => t + Math.max(statementLeft(r), 0), 0)
  const n = rows.length === 1 ? 'كشفٍ واحد' : rows.length === 2 ? 'كشفين' : `${rows.length} كشوف`
  return `تأكيدُ الاطّلاع على ${n}؟ ${carry > 0 ? `يُرحَّل منها ${carry} شيكل إلى الشهر التالي.` : 'لا فائضَ فيها يُرحَّل.'}`
}
