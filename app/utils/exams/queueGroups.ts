/**
 * طابورُ الرصد مجمّعاً بالحلقة (طلب المستخدم 2026-11-10): المختبِرُ يختبر الحلقةَ في جلسةٍ واحدة، فرأسٌ لكلّ حلقة
 * (معلّمُها ومختبِرُها ودورتُها إن توحّدت ومدّةُ انتظارها) وتحته طلابُها. الأقدمُ انتظاراً أولاً — حلقاتٍ وطلاباً.
 * والفلاتر: القسم · المختبِر المسنَد · البحث (الطالب والحلقة والمعلم) · الدورة (متى تعدّدت).
 */
import { TEST_HALAQA_NAME } from '~/constants/halqat'
import { searchKey } from '~/utils/arabicSearch'
import type { HalaqaFilters } from '~/utils/halaqaFilters'

/** بعد هذه الأيام يصير الانتظارُ «طال»، وبعد الثانية «متأخّر». */
export const QUEUE_WAIT_WARN_DAYS = 7
export const QUEUE_WAIT_LATE_DAYS = 14
/** «كلّ الدورات» — لا يُكتب في الرابط. */
export const ALL_CYCLES = 'all'

export interface QueueItem {
  id: string
  student: { id: string, full_name: string } | null
  name: string
  halaqaId: string
  halaqa: string
  gender: string | null
  teacher: string
  examinerId: string | null
  examiner: string | null
  cycleId: string | null
  title: string
  detail: string
  span: string
  /** أيامُ الانتظار منذ الترشيح؛ null لنسخةٍ قديمة بلا موعد. */
  waitDays: number | null
}

export interface QueueGroup {
  halaqaId: string
  halaqa: string
  teacher: string
  examiner: string | null
  items: QueueItem[]
  /** أطولُ انتظارٍ في الحلقة. */
  oldest: number | null
  /** الدورةُ إن توحّدت لكلّ طلاب الحلقة — تُكتب مرّةً في الرأس. */
  cycle: { title: string, detail: string, span: string } | null
}

export type WaitTone = 'calm' | 'warn' | 'late'

/** أيامٌ كاملة بين يومَي `YYYY-MM-DD` (الترشيحُ بتوقيت غزة). */
export function waitDaysBetween(fromDay: string | null | undefined, today: string): number | null {
  if (!fromDay) return null
  const d = Math.round((Date.parse(today) - Date.parse(fromDay.slice(0, 10))) / 864e5)
  return Number.isFinite(d) ? Math.max(0, d) : null
}

export const waitTone = (days: number | null): WaitTone =>
  days === null || days <= QUEUE_WAIT_WARN_DAYS ? 'calm' : days <= QUEUE_WAIT_LATE_DAYS ? 'warn' : 'late'

/** «اليوم» · «أمس» · «منذ يومين» · «منذ 5 أيام» · «منذ 16 يوماً». */
export function waitLabel(days: number | null): string {
  if (days === null) return ''
  if (days === 0) return 'اليوم'
  if (days === 1) return 'أمس'
  if (days === 2) return 'منذ يومين'
  return days <= 10 ? `منذ ${days} أيام` : `منذ ${days} يوماً`
}

/** فلاترُ الشريط الموحّد (والمسؤولُ فيها المختبِر) ومعها الدورة. */
export interface QueueFilters extends HalaqaFilters { cycle: string }

/** الحلقةُ التجريبية خارج الطابور، ثم القسم والمختبِر والدورة والبحث. */
export function filterQueue(items: QueueItem[], f: QueueFilters): QueueItem[] {
  const needle = searchKey(f.query)
  return items.filter(i => i.halaqa !== TEST_HALAQA_NAME
    && (f.gender === 'all' || i.gender === f.gender)
    && (f.supervisor === 'all' || (f.supervisor === 'none' ? !i.examinerId : i.examinerId === f.supervisor))
    && (f.cycle === ALL_CYCLES || i.cycleId === f.cycle)
    && (!needle || searchKey(`${i.name} ${i.halaqa} ${i.teacher}`).includes(needle)))
}

const byWaitThenName = (a: QueueItem, b: QueueItem) => (b.waitDays ?? -1) - (a.waitDays ?? -1) || a.name.localeCompare(b.name, 'ar')

/** تجميعٌ بالحلقة: الأطولُ انتظاراً أولاً، وداخلَها الأقدمُ ثم الاسم. */
export function groupQueue(items: QueueItem[]): QueueGroup[] {
  const map = new Map<string, QueueItem[]>()
  for (const i of items) {
    const list = map.get(i.halaqaId)
    if (list) list.push(i)
    else map.set(i.halaqaId, [i])
  }
  return [...map.values()].map((list) => {
    const sorted = [...list].sort(byWaitThenName)
    const first = sorted[0]!
    const uniform = sorted.every(i => i.cycleId === first.cycleId && i.title === first.title)
    const waits = sorted.map(i => i.waitDays).filter((d): d is number => d !== null)
    return {
      halaqaId: first.halaqaId,
      halaqa: first.halaqa,
      teacher: first.teacher,
      examiner: first.examiner,
      items: sorted,
      oldest: waits.length ? Math.max(...waits) : null,
      cycle: uniform && first.title ? { title: first.title, detail: first.detail, span: first.span } : null
    }
  }).sort((a, b) => (b.oldest ?? -1) - (a.oldest ?? -1) || b.items.length - a.items.length || a.halaqa.localeCompare(b.halaqa, 'ar'))
}

/** خياراتُ المختبِر بعدد المنتظرين عنده مرتّبةً بالاسم، و«بلا مختبِر» آخراً. */
export function examinerOptions(items: QueueItem[]) {
  const counts = new Map<string, { name: string, n: number }>()
  let none = 0
  for (const i of items) {
    if (!i.examinerId) {
      none++
      continue
    }
    const c = counts.get(i.examinerId)
    if (c) c.n++
    else counts.set(i.examinerId, { name: i.examiner ?? '—', n: 1 })
  }
  const list = [...counts].sort((a, b) => a[1].name.localeCompare(b[1].name, 'ar')).map(([value, c]) => ({ value, label: `${c.name} (${c.n})` }))
  if (none) list.push({ value: 'none', label: `بلا مختبِر (${none})` })
  return list
}

/** خياراتُ الدورة بعدد المنتظرين فيها، بترتيب الطابور. */
export function cycleOptions(items: QueueItem[]) {
  const map = new Map<string, { label: string, n: number }>()
  for (const i of items) {
    if (!i.cycleId) continue
    const c = map.get(i.cycleId)
    if (c) c.n++
    else map.set(i.cycleId, { label: i.title, n: 1 })
  }
  return [...map].map(([value, c]) => ({ value, label: `${c.label} (${c.n})` }))
}

/** سطرُ الخلاصة: المنتظرون والحلقات وأطولُ انتظار. */
export function queueSummary(groups: QueueGroup[]) {
  const waits = groups.map(g => g.oldest).filter((d): d is number => d !== null)
  return { students: groups.reduce((s, g) => s + g.items.length, 0), halqat: groups.length, oldest: waits.length ? Math.max(...waits) : null }
}
