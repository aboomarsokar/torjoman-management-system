/**
 * نسخةُ الإنجاز القرآنيّ على جهاز المعلّم (البند 14 — نمطُ الصحابة، 2026-10-27): الشهرُ الجاري والسابقُ لحلقته —
 * مدخلاتُ الصفوف كما تقرؤها الشاشةُ المتّصلة (`fetchMonthInputs`) — ومراجعُ المصحف. تُقرأ بلا شبكة، وتُحدَّث متّصلاً.
 */
import type { Database } from '~/types/database.types'
import { idbGet, idbPut } from '~/utils/offlineDb'
import { isBeforeProjectStart } from '~/utils/projectStart'
import { fetchMonthInputs } from '~/utils/quran/monthInputs'
import { quranMirrorKey, type QuranMirror } from '~/utils/quranOutbox'
import type { Period } from '~/utils/quran/screen'
import { shiftMonth } from '~/utils/reportWindow'

/** الشهران المحفوظان: السابقُ (إن لم يسبق المشروع) ثمّ الجاري. */
export function mirrorPeriods(today: string): Period[] {
  const current = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
  const previous = shiftMonth(current.year, current.month, -1)
  return isBeforeProjectStart(previous) ? [current] : [previous, current]
}

export function useQuranMirror() {
  const supabase = useSupabaseClient<Database>()
  const reference = useQuranReference()
  const months = ref<QuranMirror[]>([])
  const refreshing = ref(false)

  /** نسخةُ هذا المعلّم — أو آخرِ معلّمٍ فتح شاشاتِه إن لم تُعرف الجلسة. */
  async function loadLocal(uid: string | null, today: string): Promise<QuranMirror[]> {
    const id = uid ?? await idbGet<string>('meta', 'current') ?? null
    const found = id
      ? await Promise.all(mirrorPeriods(today).map(p => idbGet<QuranMirror>('quran_mirror', quranMirrorKey(id, p.year, p.month))))
      : []
    months.value = found.filter((m): m is QuranMirror => !!m)
    await reference.load()
    return months.value
  }

  /** يحدّث الشهرين والمراجعَ من القاعدة ويحفظها — يرمي عند الفشل (يبقى المحفوظ). */
  async function refresh(uid: string, today: string): Promise<QuranMirror[]> {
    refreshing.value = true
    try {
      const { data: halaqa, error } = await supabase.from('halaqat').select('id, name')
        .eq('teacher_id', uid).eq('status', 'active').limit(1).maybeSingle()
      if (error) throw error
      await reference.load()
      const syncedAt = new Date().toISOString()
      const next = await Promise.all(mirrorPeriods(today).map(async (p): Promise<QuranMirror> => ({
        key: quranMirrorKey(uid, p.year, p.month), uid, halaqa: halaqa ?? null, year: p.year, month: p.month,
        inputs: halaqa ? await fetchMonthInputs(supabase, halaqa.id, p.year, p.month) : null, syncedAt
      })))
      for (const m of next) await idbPut('quran_mirror', m)
      await idbPut('meta', uid, 'current')
      months.value = next
      return next
    } finally {
      refreshing.value = false
    }
  }

  return { months, refreshing, loadLocal, refresh, reference }
}
