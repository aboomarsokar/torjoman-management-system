/**
 * مقرّراتُ القراءة ومحاولاتُ طالبٍ واحد — لبطاقة القراءة ومحطّاتها في صفحة الطالب وملفّه عند العاملين.
 * المقرّراتُ والإعداداتُ مفتاحٌ واحدٌ للجلسة، والمحاولاتُ بالطالب (RLS: الطالبُ محاولاتِه، والعاملُ نطاقَه).
 * الحسابُ في `readingJourney` (utils/reading.ts، مختبَر).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { isOnlineNow } from '~/utils/reachability'
import { readingJourney, type ReadingAttempt, type ReadingUnit } from '~/utils/reading'

type UnitRow = { id: number, sort_order: number, title: string, pdf_path?: string | null, cover_path?: string | null, parts: { page_from: number, page_to: number, sort_order: number, book: { title: string, author: string | null } | null }[] }

/** صفوفُ المقرّرات بتضمين أجزائها وكتبها ← مقرّراتٌ مرتّبة. نقيّ. */
export function toReadingUnits(rows: UnitRow[]): ReadingUnit[] {
  return rows
    .map(r => ({
      id: r.id,
      sort_order: r.sort_order,
      title: r.title,
      pdfPath: r.pdf_path ?? null,
      coverPath: r.cover_path ?? null,
      parts: [...r.parts].sort((a, b) => a.sort_order - b.sort_order)
        .map(p => ({ book: p.book?.title ?? '—', author: p.book?.author ?? null, page_from: p.page_from, page_to: p.page_to }))
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
}

export const READING_UNITS_KEY = 'reading-units'
export const READING_SETTINGS_KEY = 'reading-settings'
const DEFAULT_READING_SETTINGS = { reading_pass_mark: 80, reading_test_questions: 20, reading_test_minutes: 20, reading_retry_days: 7 }

/** المقرّراتُ بأجزائها وكتبها (تناديها الصفحةُ وتجهيزُ نُسخ المعلّم اليوميّ — `useWarmTeacherMirrors`). */
export async function fetchReadingUnits(supabase: SupabaseClient<Database>): Promise<ReadingUnit[]> {
  const { data, error } = await supabase.from('reading_units')
    .select('id, sort_order, title, pdf_path, cover_path, parts:reading_unit_parts(page_from, page_to, sort_order, book:reading_books(title, author))')
    .returns<UnitRow[]>()
  if (error) throw error
  return toReadingUnits(data ?? [])
}

export async function fetchReadingSettings(supabase: SupabaseClient<Database>) {
  const { data } = await supabase.from('app_settings')
    .select('reading_pass_mark, reading_test_questions, reading_test_minutes, reading_retry_days').eq('id', 1).maybeSingle()
  return data ?? DEFAULT_READING_SETTINGS
}

export function useReadingUnits() {
  const supabase = useSupabaseClient<Database>()
  // والمعلّمُ تُحفظ له نسخةٌ تُعرض بلا إنترنت (البند 14، 2026-10-27)
  const { wrap } = useOfflineCopy()
  const { data: units, refresh: refreshUnits } = useLazyAsyncData<ReadingUnit[]>(READING_UNITS_KEY, wrap(READING_UNITS_KEY, async () => {
    try {
      return await fetchReadingUnits(supabase)
    } catch (err) {
      console.error('[reading] فشل جلب المقرّرات:', (err as Error).message)
      return []
    }
  }), { server: false, default: () => [] })

  const { data: settings } = useLazyAsyncData(READING_SETTINGS_KEY, wrap(READING_SETTINGS_KEY, () => fetchReadingSettings(supabase)),
    { server: false, default: () => DEFAULT_READING_SETTINGS })

  // روابطُ الأغلفة الموقَّتة (ساعة) — طلبٌ واحدٌ لكلّ الأغلفة، ويتجدّد بتجدّد المقرّرات (وبلا اتصالٍ لا أغلفة)
  const { data: coverUrls } = useLazyAsyncData<Record<number, string>>('reading-covers', async () => {
    const withCover = (units.value ?? []).filter(u => u.coverPath)
    if (!withCover.length || !isOnlineNow()) return {}
    const { data } = await supabase.storage.from('reading-books').createSignedUrls(withCover.map(u => u.coverPath!), 3600)
    return Object.fromEntries(withCover.flatMap((u, i) => (data?.[i]?.signedUrl ? [[u.id, data[i].signedUrl]] : [])))
  }, { server: false, default: () => ({}), watch: [units] })

  return { units, settings, refreshUnits, coverUrls }
}

/** صفُّ الطالب صاحب الجلسة (معرّفُه وتاريخُ التحاقه) — لصفحتَي البرامج المصاحبة واختبارها. */
export function useMyReadingStudent() {
  const supabase = useSupabaseClient<Database>()
  const { profile } = useProfile()
  const { data } = useLazyAsyncData('reading-my-student', async () => {
    const id = profile.value?.id
    if (!id) return null
    const { data: row } = await supabase.from('students').select('id, enrollment_date').eq('user_id', id).maybeSingle()
    return row
  }, { server: false, default: () => null, watch: [() => profile.value?.id] })
  return data
}

export function useReadingPlan(source: () => { studentId: string, enrollmentDate: string | null }) {
  const supabase = useSupabaseClient<Database>()
  const { units, settings, coverUrls } = useReadingUnits()
  const s = computed(source)

  const { data: attempts, refresh } = useLazyAsyncData<ReadingAttempt[]>(() => `reading-attempts-${s.value.studentId}`, async () => {
    // المعرّفُ قد يصل بعد التركيب (صفحةُ الاختبار تجلب صفَّ الطالب أوّلاً) — لا طلبَ بمعرّفٍ فارغ
    if (!s.value.studentId) return []
    const { data, error } = await supabase.from('reading_attempts')
      .select('id, unit_id, started_at, deadline_at, submitted_at, score, total, percent, passed')
      .eq('student_id', s.value.studentId)
      .order('started_at', { ascending: false })
    if (error) console.error('[reading] فشل جلب المحاولات:', error.message)
    return data ?? []
  }, { server: false, default: () => [] })

  const journey = computed(() => readingJourney(units.value ?? [], attempts.value ?? [], {
    retryDays: settings.value?.reading_retry_days ?? 7,
    now: Date.now(),
    enrollmentDate: s.value.enrollmentDate
  }))

  return { units, settings, coverUrls, attempts, journey, refresh }
}
