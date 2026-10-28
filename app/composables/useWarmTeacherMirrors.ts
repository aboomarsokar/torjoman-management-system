/**
 * تهيئةُ نُسخ المعلّم على الجهاز من لوحته (البند 14، 2026-10-27): متّصلاً تُحدَّث في الخلفية —
 *   • نسخُ الحضور والإنجاز والطلاب مرّةً كلَّ ساعةٍ على الأكثر (`WARM_GAP_MS` — قرار المستخدم: ما يسجّله المعلّمُ على
 *     جهازه يظهر فوراً، وما يغيّره غيرُه يصل خلالها).
 *   • ونُسخُ الشاشات التي تُقرأ (خطةُ الاختبارات، والبرامج، والزيارات، والتقييم، والتنبيهات، والرسائل، والملفّ) **مرّةً
 *     في اليوم** (`SCREENS_GAP_MS`) — لا تكاد تتغيّر خلاله، وكلُّ فتحٍ متّصلٍ لشاشةٍ يحدّث نسختَها أصلاً بلا طلبٍ زائد.
 * فتعمل الشاشاتُ بلا إنترنت ولو لم يفتحها المعلّمُ متّصلاً قطّ (التطبيقُ يُقلع على اللوحة). متتابعةً لا متوازية، وفشلُها
 * صامت (تبقى النسخُ كما كانت). والجلبُ نفسُه الذي تناديه الشاشات (`teacherScreens` ودوالُّ القراءة) فلا تتشعّب الاستعلامات.
 */
import type { Database } from '~/types/database.types'
import { PROJECT_START_DATE } from '~/constants/project'
import type { MyMessage } from '~/composables/useMyMessages'
import { fetchReadingSettings, fetchReadingUnits, READING_SETTINGS_KEY, READING_UNITS_KEY } from '~/composables/useReadingPlan'
import { fetchReadingProgress, READING_HALAQAT_KEY, readingProgressKey } from '~/composables/useReadingProgress'
import { readCache, WARMED_CACHE_KEY as WARM_KEY, WARMED_SCREENS_CACHE_KEY, writeCache } from '~/utils/offlineCache'
import { writeSnapshot } from '~/utils/offlineSnapshot'
import { isOnlineNow } from '~/utils/reachability'
import { gazaToday, shiftMonth } from '~/utils/reportWindow'
import {
  fetchAlerts, fetchExamCycles, fetchMyMessages, fetchProfileView, fetchQualityHalqat, fetchQualityRecords, fetchVisitHalqat,
  fetchVisits, SCREEN_KEYS
} from '~/utils/teacherScreens'

const WARM_GAP_MS = 60 * 60_000
const SCREENS_GAP_MS = 24 * 60 * 60_000

/** هل حان تحديثُ النسخ (لم تُحدَّث لهذا المعلّم منذ `gap`)؟ */
export function warmDue(last: { uid: string, at: number } | null, uid: string, now: number, gap: number = WARM_GAP_MS): boolean {
  return !last || last.uid !== uid || now - last.at >= gap
}

export function useWarmTeacherMirrors() {
  const supabase = useSupabaseClient<Database>()
  const attendance = useOfflineMirror()
  const quran = useQuranMirror()
  const students = useStudentsMirror()

  /** يجلب شاشةً ويحفظ نسختها — فشلُها لا يمسّ النسخةَ القائمة. */
  async function snap(uid: string, key: string, fetcher: () => Promise<unknown>) {
    try {
      const data = await fetcher()
      if (isOnlineNow()) await writeSnapshot(uid, key, data)
    } catch {
      // تبقى النسخةُ كما كانت
    }
  }

  async function warmScreens(uid: string) {
    const today = gazaToday()
    const current = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
    const previous = shiftMonth(current.year, current.month, -1)
    await snap(uid, SCREEN_KEYS.examCycles, () => fetchExamCycles(supabase))
    await snap(uid, SCREEN_KEYS.visits, () => fetchVisits(supabase))
    await snap(uid, SCREEN_KEYS.visitHalqat, () => fetchVisitHalqat(supabase))
    await snap(uid, SCREEN_KEYS.qualityHalqat, () => fetchQualityHalqat(supabase))
    for (const p of [current, previous]) await snap(uid, SCREEN_KEYS.qualityRecords(p.year, p.month), () => fetchQualityRecords(supabase, p.year, p.month))
    await snap(uid, SCREEN_KEYS.alerts, () => fetchAlerts(supabase, true))
    // الصفحةُ الأولى من رسائل الإدارة (الأحدث)؛ والصفحاتُ الأقدم تُحفظ حين تُفتح
    await snap(uid, SCREEN_KEYS.myMessages(1), () => fetchMyMessages<MyMessage>(supabase, uid, 1))
    await snap(uid, SCREEN_KEYS.profile(uid), () => fetchProfileView(supabase, uid))
    await snap(uid, READING_UNITS_KEY, () => fetchReadingUnits(supabase))
    await snap(uid, READING_SETTINGS_KEY, () => fetchReadingSettings(supabase))
    // حلقتُه لإنجاز الطلاب في البرامج — بالاستعلام نفسه الذي تقرؤه الشاشةُ للمعلّم
    const { data: halaqat } = await supabase.from('halaqat').select('id, name').eq('status', 'active').eq('teacher_id', uid).order('name')
    if (halaqat) {
      await writeSnapshot(uid, READING_HALAQAT_KEY, halaqat)
      const hid = halaqat[0]?.id
      if (hid) await snap(uid, readingProgressKey(hid), () => fetchReadingProgress(supabase, hid))
    }
  }

  async function warm(uid: string, fullName: string): Promise<void> {
    if (!isOnlineNow()) return
    const now = Date.now()
    if (warmDue(readCache(WARM_KEY), uid, now)) {
      writeCache(WARM_KEY, { uid, at: now })
      const today = gazaToday()
      // متتابعةً لا متوازية: الشبكةُ الضعيفةُ لا تُغرَق، واللوحةُ نفسُها تُجلب في الوقت نفسه
      await attendance.refresh(uid, fullName, today, PROJECT_START_DATE).catch(() => undefined)
      await quran.refresh(uid, today).catch(() => undefined)
      await students.refresh(uid).catch(() => undefined)
    }
    if (isOnlineNow() && warmDue(readCache(WARMED_SCREENS_CACHE_KEY), uid, now, SCREENS_GAP_MS)) {
      writeCache(WARMED_SCREENS_CACHE_KEY, { uid, at: now })
      await warmScreens(uid)
    }
  }

  return { warm }
}
