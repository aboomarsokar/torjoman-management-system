/**
 * الحضورُ بلا إنترنت (البند 14 — نمطُ الصحابة، 2026-10-26): ثوابتُ النسخة المحلّية وصندوقِ الرفع.
 */
// نوعٌ فقط (يُمحى عند البناء) فلا استيرادَ دائريّ مع `offlineSnapshot` الذي يستورد هذا الملفّ بدوره
import type { OfflineOwnerRole } from '~/utils/offlineSnapshot'

/** قاعدةُ الجهاز (IndexedDB) ونسختُها — رفعُ النسخة يعيد بناء المخازن. */
export const OFFLINE_DB_NAME = 'torjoman-offline'
export const OFFLINE_DB_VERSION = 5

/** كم يوماً من الحضور تُحفظ على الجهاز — يكفي انقطاعاً لأيّام وتصحيحَ الأسابيع الماضية. */
export const MIRROR_DAYS = 40

/**
 * مهلُ إعادة الرفع متصاعدةً ثمّ تثبت (درسُ الصحابة): لا تُغرق شبكةً متعثّرة، ولا تترك الحضورَ على الجهاز طويلاً.
 * والمحاولاتُ لا تنفد بعدّاد — تقف بخلوّ الصندوق أو بانقطاع الاتصال.
 */
export const RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000] as const

/** بعد فشلٍ شبكيّ يُعَدّ الجهازُ منقطعاً هذه المدّة ولو قال النظامُ «متّصل» (شبكةٌ ميتةٌ تُعلَن حيّة). */
export const NETWORK_FAILURE_WINDOW_MS = 30_000

/** حضورُ المعلّم بلا إنترنت (2026-10-26). */
export const OFFLINE_HOME = '/t'

/** لوحةُ المعلّم بلا إنترنت — يُقلع عليها التطبيقُ، وإليها يُحوَّل التنقّلُ بلا اتصال (2026-10-27). */
export const OFFLINE_DASHBOARD = '/t/home'

/** الإنجازُ القرآنيّ للمعلّم بلا إنترنت (2026-10-27). */
export const OFFLINE_QURAN = '/t/quran'

/** شاشةُ المشرف الميدانيّ بلا إنترنت — يُقلع عليها جهازُه، وإليها يُحوَّل التنقّلُ بلا اتصال (2026-10-29). */
export const OFFLINE_SUPERVISOR_HOME = '/visits'

/** شاشةُ المختبِر بلا إنترنت — يُقلع عليها جهازُه، وإليها يُحوَّل التنقّلُ بلا اتصال (2026-10-29). */
export const OFFLINE_EXAMINER_HOME = '/exams'

/** شاشةُ الإقلاع بلا إنترنت بحسب دورِ صاحب الجهاز: المعلّمُ (أو من لا دورَ محفوظاً له) على لوحته. */
export function offlineStartFor(role: OfflineOwnerRole | null): string {
  if (role === 'field_supervisor') return OFFLINE_SUPERVISOR_HOME
  if (role === 'examiner') return OFFLINE_EXAMINER_HOME
  return OFFLINE_DASHBOARD
}
