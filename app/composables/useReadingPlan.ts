/**
 * مقرّراتُ القراءة ومحاولاتُ طالبٍ واحد — لبطاقة القراءة ومحطّاتها في صفحة الطالب وملفّه عند العاملين.
 * المقرّراتُ والإعداداتُ مفتاحٌ واحدٌ للجلسة، والمحاولاتُ بالطالب (RLS: الطالبُ محاولاتِه، والعاملُ نطاقَه).
 * الحسابُ في `readingJourney` (utils/reading.ts، مختبَر).
 */
import type { Database } from '~/types/database.types'
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

export function useReadingUnits() {
  const supabase = useSupabaseClient<Database>()
  const { data: units, refresh: refreshUnits } = useLazyAsyncData<ReadingUnit[]>('reading-units', async () => {
    const { data, error } = await supabase.from('reading_units')
      .select('id, sort_order, title, pdf_path, cover_path, parts:reading_unit_parts(page_from, page_to, sort_order, book:reading_books(title, author))')
      .returns<UnitRow[]>()
    if (error) console.error('[reading] فشل جلب المقرّرات:', error.message)
    return toReadingUnits(data ?? [])
  }, { server: false, default: () => [] })

  const { data: settings } = useLazyAsyncData('reading-settings', async () => {
    const { data } = await supabase.from('app_settings')
      .select('reading_pass_mark, reading_test_questions, reading_test_minutes, reading_retry_days').eq('id', 1).maybeSingle()
    return data ?? { reading_pass_mark: 80, reading_test_questions: 20, reading_test_minutes: 20, reading_retry_days: 7 }
  }, { server: false, default: () => ({ reading_pass_mark: 80, reading_test_questions: 20, reading_test_minutes: 20, reading_retry_days: 7 }) })

  // روابطُ الأغلفة الموقَّتة (ساعة) — طلبٌ واحدٌ لكلّ الأغلفة، ويتجدّد بتجدّد المقرّرات
  const { data: coverUrls } = useLazyAsyncData<Record<number, string>>('reading-covers', async () => {
    const withCover = (units.value ?? []).filter(u => u.coverPath)
    if (!withCover.length) return {}
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
