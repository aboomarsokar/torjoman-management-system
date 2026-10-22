import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import { achievementTotals, sortWeakFirst, type AchievementRow } from '~/utils/halaqatAchievement'

/**
 * «إنجاز الحلقات» لشهرٍ: طلبٌ واحد (`halaqat_achievement`) لكلّ حلقات النطاق — لا طلبٌ لكلّ حلقة،
 * فالطلباتُ المتوازية الثقيلة تقتلها المهلة. الترتيبُ والملخّصُ من `utils/halaqatAchievement` (مختبَرة).
 */
export function useHalaqatAchievement(year: Ref<number>, month: Ref<number>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()

  const { data, pending } = useLazyAsyncData<AchievementRow[]>(
    () => `halaqat-achievement-${year.value}-${month.value}`,
    async () => {
      const { data: rows, error } = await supabase.rpc('halaqat_achievement', { p_year: year.value, p_month: month.value })
      if (error) {
        handle(error)
        return []
      }
      return rows ?? []
    },
    { server: false, default: () => [], watch: [year, month] }
  )

  const rows = computed(() => sortWeakFirst(data.value ?? []))
  const totals = computed(() => achievementTotals(data.value ?? []))
  return { rows, totals, pending }
}
