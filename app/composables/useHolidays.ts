import type { Database } from '~/types/database.types'
import { HOLIDAY_READ_PAGE } from '~/constants/holidays'
import { cleanHolidayReason, sortHolidays, type Holiday } from '~/utils/holidays'
import { gazaToday } from '~/utils/reportWindow'

/**
 * أيامُ الإجازة العامة (`attendance_holidays`) للمدير الإداري: قراءةُ القائمة (القادمةُ أولاً)، وإضافةُ أيامٍ بطلبٍ واحد،
 * وحذفُ يوم، وعدُّ الحلقات التي سجّلت حضوراً في أيامٍ قبل تعيينها (يبقى حضورُها كما هو). الكتابةُ للمدير الإداري وحده
 * بحكم RLS، ومشغّلُ القاعدة يرفض الجمعةَ وما قبل بداية المشروع برسالةٍ عربية يعرضها `useErrorHandler`.
 */
export function useHolidays() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const { blockIfReadOnly } = useImpersonation()
  const list = ref<Holiday[]>([])
  const loading = ref(false)
  const saving = ref(false)

  /** يقرأ كلَّ الإجازات ويرتّبها: القادمةُ أولاً ثم الماضية. */
  async function load(): Promise<void> {
    loading.value = true
    try {
      const { data, error } = await supabase.from('attendance_holidays').select('day, reason')
      if (error) throw error
      list.value = sortHolidays(data ?? [], gazaToday())
    } catch (err) {
      handle(err)
    } finally {
      loading.value = false
    }
  }

  /** يشغّل كتابةً واحدة: نيابةُ القراءة تُرفض قبل الإرسال، والفشلُ يُعرض ثم تُعاد القراءةُ من القاعدة. */
  async function write(run: () => PromiseLike<{ error: unknown }>): Promise<boolean> {
    saving.value = true
    try {
      blockIfReadOnly()
      const { error } = await run()
      if (error) throw error
      await load()
      return true
    } catch (err) {
      handle(err)
      await load()
      return false
    } finally {
      saving.value = false
    }
  }

  /** يضيف الأيامَ إجازةً بسببٍ واحد في طلبٍ واحد. السببُ الفارغ أو الطويل ولا أيامَ ← `false` دون طلب. */
  async function add(days: string[], reason: string): Promise<boolean> {
    const clean = cleanHolidayReason(reason)
    if (!clean || !days.length) return false
    return write(() => supabase.from('attendance_holidays').insert(days.map(day => ({ day, reason: clean }))))
  }

  /** يحذف إجازةَ يومٍ (التعيينُ يُحذف ولا يُعدَّل). */
  function remove(day: string): Promise<boolean> {
    return write(() => supabase.from('attendance_holidays').delete().eq('day', day))
  }

  /**
   * عددُ الحلقات المتميّزة التي سجّلت حضوراً (`attendance_days`) في أيٍّ من الأيام. يقرأ صفحاتٍ حتى تنقص صفحة
   * (سقفُ الصفوف ألف). الخطأُ يرتفع إلى المستدعي — لا رقمٌ مضلِّل في نافذة التأكيد.
   */
  async function recordedHalaqat(days: string[]): Promise<number> {
    if (!days.length) return 0
    const halaqat = new Set<string>()
    for (let from = 0; ; from += HOLIDAY_READ_PAGE) {
      const { data, error } = await supabase.from('attendance_days').select('halaqa_id')
        .in('day', days).order('halaqa_id').order('day').range(from, from + HOLIDAY_READ_PAGE - 1)
      if (error) throw error
      for (const row of data ?? []) halaqat.add(row.halaqa_id)
      if ((data?.length ?? 0) < HOLIDAY_READ_PAGE) break
    }
    return halaqat.size
  }

  return { list, loading, saving, load, add, remove, recordedHalaqat }
}
