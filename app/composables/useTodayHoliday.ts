import type { Database } from '~/types/database.types'
import { queueOnline } from '~/composables/useOfflineQueue'
import { isOnlineNow } from '~/utils/reachability'
import { gazaToday } from '~/utils/reportWindow'

/**
 * سببُ إجازة اليوم العامة (`attendance_holidays` ليوم `gazaToday()`) لسطر «اليوم إجازة: …» في لوحات الكادر
 * (بلاغ «لم تنعقد» 2026-10-30). قراءةٌ متّصلة فقط: بلا اتصالٍ لا يُرسَل طلبٌ أصلاً، وفشلُ القراءة يعني `null` بلا
 * رسالة خطأ — السطرُ تنبيهٌ هادئ لا شاشةٌ تتعطّل بغيابه. تُقرأ عند التركيب، وتُعاد حين يعود الاتصال بعد انقطاع.
 */
export function useTodayHoliday() {
  const supabase = useSupabaseClient<Database>()
  const reason = ref<string | null>(null)

  async function load(): Promise<void> {
    if (!isOnlineNow()) return
    try {
      const { data, error } = await supabase.from('attendance_holidays').select('reason').eq('day', gazaToday()).maybeSingle()
      reason.value = error ? null : data?.reason ?? null
    } catch {
      reason.value = null
    }
  }

  onMounted(() => void load())
  watch(queueOnline, (now, before) => {
    if (now && !before) void load()
  })

  return { reason }
}
