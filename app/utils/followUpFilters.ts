/**
 * فلاترُ «متابعة الرصد» (طلب المستخدم 2026-11-09): الجنسُ والمشرفُ المسنَد والبحثُ بالاسم، تجتمع مع «الكل/المقصّرة».
 * قيمُها في الرابط (`?g=` · `?sup=` · `?q=`) فتبقى بعد الرجوع ويُرسَل الرابطُ مفلتراً. «بلا مشرف» قيمةٌ مستقلة
 * لأن الحلقةَ بلا مشرفٍ لا تُرسل رصدها الشهريّ.
 */
import { TEST_HALAQA_NAME } from '~/constants/halqat'
import { searchKey } from '~/utils/arabicSearch'

export type GenderFilter = 'all' | 'male' | 'female'
/** قيمةُ «بلا مشرف» في فلتر المشرف (لا تصطدم بمعرّف uuid). */
export const NO_SUPERVISOR = 'none'
/** «كلّ المشرفين» — لا يُكتب في الرابط. */
export const ALL_SUPERVISORS = 'all'

export interface FollowUpFilters {
  gender: GenderFilter
  /** `all` · `none` · معرّفُ المشرف. */
  supervisor: string
  query: string
}

/** ما تحتاجه الفلاترُ من سطر الحلقة. */
export interface FilterableRow {
  halaqa_id: string
  halaqa_name: string
  gender: string
  teacher_name: string | null
}

export interface SupervisorRef { id: string, name: string }

const firstString = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : '')

/** معاملاتُ الرابط ← الفلاتر؛ المجهولُ يرجع إلى «الكل». */
export function filtersFromQuery(q: Record<string, unknown>): FollowUpFilters {
  const g = firstString(q.g)
  return {
    gender: g === 'male' || g === 'female' ? g : 'all',
    supervisor: firstString(q.sup) || ALL_SUPERVISORS,
    query: firstString(q.q)
  }
}

/** الفلاتر ← معاملاتُ الرابط؛ الافتراضيُّ يُحذف (undefined). */
export function queryFromFilters(f: FollowUpFilters): Record<string, string | undefined> {
  const q = f.query.trim()
  return {
    g: f.gender === 'all' ? undefined : f.gender,
    sup: f.supervisor === ALL_SUPERVISORS ? undefined : f.supervisor,
    q: q || undefined
  }
}

/** الحلقةُ التجريبية خارج المتابعة. */
export const withoutTestHalaqa = <T extends FilterableRow>(rows: T[]): T[] => rows.filter(r => r.halaqa_name !== TEST_HALAQA_NAME)

/** تطبيقُ الفلاتر الثلاثة؛ `sups` مشرفُ كلّ حلقة (الغائبُ = بلا مشرف). */
export function applyFollowUpFilters<T extends FilterableRow>(rows: T[], f: FollowUpFilters, sups: Map<string, SupervisorRef>): T[] {
  const needle = searchKey(f.query)
  return rows.filter((r) => {
    if (f.gender !== 'all' && r.gender !== f.gender) return false
    if (f.supervisor !== ALL_SUPERVISORS) {
      const s = sups.get(r.halaqa_id)
      if (f.supervisor === NO_SUPERVISOR ? !!s : s?.id !== f.supervisor) return false
    }
    if (needle && !searchKey(`${r.halaqa_name} ${r.teacher_name ?? ''}`).includes(needle)) return false
    return true
  })
}

/** خياراتُ المشرف من الحلقات المعروضة: كلُّ مشرفٍ بعدد حلقاته مرتّباً بالاسم، و«بلا مشرف» إن وُجدت حلقةٌ بلا مشرف. */
export function supervisorOptions(rows: FilterableRow[], sups: Map<string, SupervisorRef>) {
  const counts = new Map<string, { name: string, n: number }>()
  let none = 0
  for (const r of rows) {
    const s = sups.get(r.halaqa_id)
    if (!s) {
      none++
      continue
    }
    const c = counts.get(s.id)
    if (c) c.n++
    else counts.set(s.id, { name: s.name, n: 1 })
  }
  const items = [...counts].sort((a, b) => a[1].name.localeCompare(b[1].name, 'ar'))
    .map(([id, c]) => ({ value: id, label: `${c.name} (${c.n})` }))
  if (none) items.push({ value: NO_SUPERVISOR, label: `بلا مشرف (${none})` })
  return items
}

/** يظهر فلترُ الجنس متى اجتمع القسمان في النطاق. */
export const hasBothGenders = (rows: FilterableRow[]) => rows.some(r => r.gender === 'female') && rows.some(r => r.gender !== 'female')
