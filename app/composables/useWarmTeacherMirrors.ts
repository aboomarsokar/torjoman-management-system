/**
 * تهيئةُ نُسخ المعلّم على الجهاز من لوحته (البند 14، 2026-10-27): متّصلاً تُحدَّث في الخلفية نسخُ الحضور والإنجاز
 * والطلاب — فتعمل شاشاتُها بلا إنترنت ولو لم يفتحها المعلّمُ متّصلاً قطّ (التطبيقُ يُقلع على اللوحة). مرّةً كلَّ ساعةٍ
 * على الأكثر (`WARM_GAP_MS`) كي لا تتكرّر طلباتُها مع كلّ عودةٍ إلى اللوحة، وفشلُها صامت (تبقى النسخُ كما كانت).
 */
import { PROJECT_START_DATE } from '~/constants/project'
import { readCache, WARMED_CACHE_KEY as WARM_KEY, writeCache } from '~/utils/offlineCache'
import { isOnlineNow } from '~/utils/reachability'
import { gazaToday } from '~/utils/reportWindow'

/** ساعةٌ بين تحديثين (قرار المستخدم 2026-10-27 — كانت ربعَ ساعة): ما يسجّله المعلّمُ على جهازه يظهر فوراً، وما يغيّره غيرُه يصل خلالها. */
const WARM_GAP_MS = 60 * 60_000

/** هل حان تحديثُ النسخ (لم تُحدَّث لهذا المعلّم منذ `gap`)؟ */
export function warmDue(last: { uid: string, at: number } | null, uid: string, now: number, gap: number = WARM_GAP_MS): boolean {
  return !last || last.uid !== uid || now - last.at >= gap
}

export function useWarmTeacherMirrors() {
  const attendance = useOfflineMirror()
  const quran = useQuranMirror()
  const students = useStudentsMirror()

  async function warm(uid: string, fullName: string): Promise<void> {
    if (!isOnlineNow() || !warmDue(readCache(WARM_KEY), uid, Date.now())) return
    writeCache(WARM_KEY, { uid, at: Date.now() })
    const today = gazaToday()
    // متتابعةً لا متوازية: الشبكةُ الضعيفةُ لا تُغرَق، واللوحةُ نفسُها تُجلب في الوقت نفسه
    await attendance.refresh(uid, fullName, today, PROJECT_START_DATE).catch(() => undefined)
    await quran.refresh(uid, today).catch(() => undefined)
    await students.refresh(uid).catch(() => undefined)
  }

  return { warm }
}
