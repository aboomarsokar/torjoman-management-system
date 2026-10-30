/**
 * تهيئةُ نُسخ المشرف الميداني والمختبِر على الجهاز من لوحتهما (الدفعة الثالثة، 2026-10-29): متّصلاً تُحدَّث في الخلفية
 * مرّةً كلَّ ساعةٍ على الأكثر ما تحتاجه شاشتاهما بلا إنترنت — للمشرف الزياراتُ وحلقاتُها وبنودُ الخصم، وللمختبِر طابورُ
 * الرصد ودرجةُ النجاح ومرجعُ المصحف. بالجلب نفسِه والمفتاح نفسِه اللذين تلفّ بهما الشاشاتُ `wrap` فلا تتباعد النسختان.
 * وتكتب علامةَ صاحب الجهاز (`meta.current`) التي يقرؤها الإقلاعُ البارد بلا اتصال (`hasOfflineOwner`). متتابعةً لا
 * متوازية، وفشلُ كلّ نسخةٍ صامت (تبقى كما كانت). أثناء النيابة `offlineOwnerUid()` فارغ فلا يُحفظ شيء.
 */
import type { Database } from '~/types/database.types'
import { warmDue } from '~/composables/useWarmTeacherMirrors'
import {
  EXAMS_PASSMARK_KEY, EXAMS_QUEUE_KEY, fetchDeductionItems, fetchExamQueue, fetchPassMark, VISIT_ITEMS_KEY
} from '~/utils/fieldScreens'
import { readCache, WARMED_FIELD_CACHE_KEY, writeCache } from '~/utils/offlineCache'
import { idbPut } from '~/utils/offlineDb'
import { offlineOwnerRole, offlineOwnerUid, writeSnapshot } from '~/utils/offlineSnapshot'
import { isOnlineNow } from '~/utils/reachability'
import { fetchVisitHalqat, fetchVisits, SCREEN_KEYS } from '~/utils/teacherScreens'

/** التسخينُ الجاري (على العميل وحده) — نداءان متزامنان (التركيبُ وظهورُ الدور) لا يجلبان مرّتين. */
let running: Promise<void> | null = null

export function useWarmFieldCopies() {
  const supabase = useSupabaseClient<Database>()
  const quran = useQuranReference()

  /** يجلب نسخةً ويحفظها — فشلُها لا يمسّ النسخةَ القائمة ولا يوقف ما بعدها. */
  async function snap(uid: string, key: string, fetcher: () => Promise<unknown>) {
    try {
      const data = await fetcher()
      if (isOnlineNow()) await writeSnapshot(uid, key, data)
    } catch {
      // تبقى النسخةُ كما كانت
    }
  }

  async function run(uid: string, role: 'field_supervisor' | 'examiner') {
    // علامةُ الجهاز أوّلاً: بها يُقلع التطبيقُ بلا اتصال، ولو تعثّرت النسخُ بعدها
    await idbPut('meta', uid, 'current').catch(() => undefined)
    if (role === 'field_supervisor') {
      await snap(uid, SCREEN_KEYS.visits, () => fetchVisits(supabase))
      await snap(uid, SCREEN_KEYS.visitHalqat, () => fetchVisitHalqat(supabase))
      await snap(uid, VISIT_ITEMS_KEY, () => fetchDeductionItems(supabase))
    } else {
      await snap(uid, EXAMS_QUEUE_KEY, () => fetchExamQueue(supabase))
      await snap(uid, EXAMS_PASSMARK_KEY, () => fetchPassMark(supabase))
      // يحفظ المرجعَ على الجهاز بنفسه عند التحميل
      await quran.load().catch(() => undefined)
    }
    writeCache(WARMED_FIELD_CACHE_KEY, { uid, at: Date.now() })
  }

  async function warm(): Promise<void> {
    if (!isOnlineNow() || running) return
    const role = offlineOwnerRole()
    if (role !== 'field_supervisor' && role !== 'examiner') return
    const uid = offlineOwnerUid()
    if (!uid) return
    if (!warmDue(readCache(WARMED_FIELD_CACHE_KEY), uid, Date.now())) return
    running = run(uid, role).finally(() => {
      running = null
    })
    await running
  }

  return { warm }
}
