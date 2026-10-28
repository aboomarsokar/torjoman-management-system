/**
 * «إنجاز الطلاب» في البرامج المصاحبة للعاملين — اطّلاعاً (طلب المستخدم 2026-10-21: «المشرف يطّلع على إنجاز
 * البرامج المصاحبة الخاصّة بحلقاته»). الحلقاتُ ما تسمح به RLS (المعلم حلقتُه، والمشرف حلقاتُه، والمديرون الكلّ)،
 * والجلبُ لحلقةٍ واحدة مختارة (لا الشبكةُ كلُّها دفعةً): طلابُها النشطون ومحاولاتُهم بالتوازي.
 * الحسابُ في `readingProgressRows` (utils/reading.ts، مختبَر). والمعلّمُ تُحفظ له نسخةٌ تُعرض بلا إنترنت (2026-10-27).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { readingProgressRows, type ReadingAttempt } from '~/utils/reading'

type AttemptRow = ReadingAttempt & { student_id: string }
export type ReadingProgressData = { students: { id: string, full_name: string, enrollment_date: string | null }[], attempts: AttemptRow[] }

export const READING_HALAQAT_KEY = 'reading-progress-halaqat'
export const readingProgressKey = (hid: string | null) => `reading-progress-${hid ?? 'none'}`

/** طلابُ الحلقة النشطون ومحاولاتُهم (تناديها الصفحةُ وتجهيزُ نُسخ المعلّم اليوميّ — `useWarmTeacherMirrors`). */
export async function fetchReadingProgress(supabase: SupabaseClient<Database>, hid: string): Promise<ReadingProgressData> {
  const [students, attempts] = await Promise.all([
    supabase.from('students').select('id, full_name, enrollment_date').eq('halaqa_id', hid).eq('status', 'active').order('full_name'),
    supabase.from('reading_attempts')
      .select('id, student_id, unit_id, started_at, deadline_at, submitted_at, score, total, percent, passed, student:student_id!inner(halaqa_id)')
      .eq('student.halaqa_id', hid)
  ])
  const failure = students.error ?? attempts.error
  if (failure) throw failure
  return { students: students.data ?? [], attempts: (attempts.data ?? []) as AttemptRow[] }
}

export function useReadingProgress() {
  const supabase = useSupabaseClient<Database>()
  const { role, profile } = useProfile()
  const { units, settings } = useReadingUnits()
  const { wrap } = useOfflineCopy()

  const { data: halaqat } = useLazyAsyncData(READING_HALAQAT_KEY, wrap(READING_HALAQAT_KEY, async () => {
    if (!role.value) return []
    const query = supabase.from('halaqat').select('id, name').eq('status', 'active').order('name')
    const { data } = role.value === 'teacher' ? await query.eq('teacher_id', profile.value?.id ?? '') : await query
    return data ?? []
  }), { server: false, default: () => [], watch: [role] })

  const halaqaId = ref<string | null>(null)
  watch(halaqat, (list) => {
    if (!list.some(h => h.id === halaqaId.value)) halaqaId.value = list[0]?.id ?? null
  }, { immediate: true })

  const progressKey = () => readingProgressKey(halaqaId.value)
  const { data, pending } = useLazyAsyncData(progressKey, wrap(progressKey, async (): Promise<ReadingProgressData> => {
    const hid = halaqaId.value
    if (!hid) return { students: [], attempts: [] }
    try {
      return await fetchReadingProgress(supabase, hid)
    } catch (err) {
      console.error('[reading] فشل جلب الإنجاز:', (err as Error).message)
      return { students: [], attempts: [] }
    }
  }), { server: false, default: () => ({ students: [], attempts: [] as AttemptRow[] }) })

  const rows = computed(() => readingProgressRows(data.value?.students ?? [], data.value?.attempts ?? [], units.value ?? [], {
    retryDays: settings.value?.reading_retry_days ?? 7,
    now: Date.now()
  }))

  return { halaqat, halaqaId, rows, pending, progressKey }
}
