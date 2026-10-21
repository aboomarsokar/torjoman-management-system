/**
 * محاضر الاجتماعات — أقسامُ المضمون الأربعة، وتقسيمُ النصّ بنوداً، ونموذجُ الإدخال وحمولتُه.
 * دوالُّ نقيّة مختبَرة في minutes.test.ts.
 */

import type { Role } from '~/constants/roles'
import type { Database } from '~/types/database.types'

export type MinuteStatus = 'draft' | 'final'

/** عاملٌ مؤهّلٌ لحضور الاجتماع الإداري. */
export interface MinuteStaff { id: string, full_name: string, role: Role, gender: Database['public']['Enums']['gender_type'] | null }

/** صفُّ المحضر كما تقرؤه الشاشة. */
export interface MinuteRow {
  id: string
  title: string
  meeting_date: string
  agenda: string | null
  decisions: string | null
  deferred_items: string | null
  tasks: string | null
  attendee_ids: string[]
  status: MinuteStatus
}

/** تاريخُ الاجتماع بالأرقام `DD/MM/YYYY` (الشهورُ بالأرقام لا بالأسماء) — من نصّ التاريخ مباشرةً بلا منطقةٍ زمنيّة. */
export function minuteDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}
/** أعمدةُ المضمون النصّيّة في `meeting_minutes` — كلٌّ منها بندٌ في كلّ سطر. */
export type MinuteSectionKey = 'agenda' | 'decisions' | 'deferred_items' | 'tasks'

export interface MinuteSection {
  key: MinuteSectionKey
  /** عنوانُ الحقل في النافذة وفي القراءة. */
  label: string
  /** ما يُكتب فيه — يظهر تحت العنوان. */
  hint: string
  /** اسمُ البند المفرد في القراءة («القرار ٢»). */
  item: string
  icon: string
}

/** بترتيب المحضر: ما طُرح ← ما حُسم ← ما رُحِّل ← من يفعل ماذا. */
export const MINUTE_SECTIONS: readonly MinuteSection[] = [
  { key: 'agenda', label: 'جدول الأعمال', hint: 'ما طُرح للنقاش — بندٌ في كلّ سطر.', item: 'البند', icon: 'i-lucide-list' },
  { key: 'decisions', label: 'القرارات المتّخذة', hint: 'ما حُسم في الاجتماع — قرارٌ في كلّ سطر.', item: 'القرار', icon: 'i-lucide-gavel' },
  { key: 'deferred_items', label: 'الأمور المؤجّلة', hint: 'ما طُرح ولم يُحسم فيُرحَّل إلى اجتماعٍ لاحق.', item: 'المؤجَّل', icon: 'i-lucide-clock-arrow-up' },
  { key: 'tasks', label: 'المهام والمسؤوليات', hint: 'من يفعل ماذا ومتى — مهمّةٌ في كلّ سطر.', item: 'المهمّة', icon: 'i-lucide-list-checks' }
]

/** أسطرُ الحقل في النافذة: يبدأ بهذا ويتمدّد مع النصّ حتى الحدّ ثم يُمرَّر. */
export const MINUTE_FIELD_MIN_ROWS = 4
export const MINUTE_FIELD_MAX_ROWS = 14

// ترقيمٌ أو تنقيطٌ كتبه المدير في أوّل السطر (1. / ١- / (٢) / - / •) — القراءةُ ترقّم بنفسها
const LEADING_MARKER = /^\s*(?:[-–—•·*▪]+|\(?[0-9٠-٩]+\s*[).\-–:]\)?)\s*/

/** يقسم نصّ القسم بنوداً: سطرٌ لكلّ بند، بلا أسطر فارغة ولا ترقيمٍ مكتوب يدويّاً. */
export function minuteItems(text: string | null | undefined): string[] {
  if (!text) return []
  return text.split(/\r?\n/)
    .map(line => line.replace(LEADING_MARKER, '').trim())
    .filter(Boolean)
}

export interface MinuteForm {
  title: string
  meeting_date: string
  attendees: string[]
  agenda: string
  decisions: string
  deferred_items: string
  tasks: string
}

export function emptyMinuteForm(today: string): MinuteForm {
  return { title: '', meeting_date: today, attendees: [], agenda: '', decisions: '', deferred_items: '', tasks: '' }
}

// محارفُ تمنعها أنظمةُ الملفّات في اسم ملفّ PDF المحفوظ
const FILENAME_UNSAFE = /[\\/:*?"<>|]+/g

/**
 * عنوانُ المستند وقتَ الطباعة — والمتصفّحُ يقترحه اسماً لملفّ PDF المحفوظ:
 * «محضر — <العنوان> — 21-10-2026» (التاريخُ بشُرَط لا بخطوطٍ مائلة تمنعها أسماءُ الملفّات).
 */
export function minutePdfTitle(m: Pick<MinuteRow, 'title' | 'meeting_date'>): string {
  const title = m.title.replace(FILENAME_UNSAFE, ' ').replace(/\s+/g, ' ').trim()
  return `محضر — ${title} — ${minuteDate(m.meeting_date).replaceAll('/', '-')}`
}

/** نموذجُ التعديل من صفٍّ محفوظ. */
export function minuteFormFrom(row: MinuteRow): MinuteForm {
  return {
    title: row.title,
    meeting_date: row.meeting_date,
    attendees: [...row.attendee_ids],
    agenda: row.agenda ?? '',
    decisions: row.decisions ?? '',
    deferred_items: row.deferred_items ?? '',
    tasks: row.tasks ?? ''
  }
}

/** حمولةُ الحفظ: النصوصُ مشذَّبة والفارغُ منها null، والحالةُ من الزرّ المضغوط. */
export function minutePayload(form: MinuteForm, status: MinuteStatus) {
  const text = (v: string) => v.trim() || null
  return {
    title: form.title.trim(),
    meeting_date: form.meeting_date,
    attendee_ids: [...form.attendees],
    agenda: text(form.agenda),
    decisions: text(form.decisions),
    deferred_items: text(form.deferred_items),
    tasks: text(form.tasks),
    status
  }
}
