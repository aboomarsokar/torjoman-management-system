import type { Ref } from 'vue'
import { filtersFromQuery, genderOptions, hasBothGenders, queryFromFilters } from '~/utils/halaqaFilters'
import { ALL_CYCLES, cycleOptions, examinerOptions, filterQueue, groupQueue, queueSummary, type QueueFilters, type QueueItem } from '~/utils/exams/queueGroups'

/** قيمةُ الدورة من الرابط (`?c=`)؛ الغائبُ «كلّ الدورات». */
export function cycleFromQuery(v: unknown): string {
  return typeof v === 'string' && v ? v : ALL_CYCLES
}

/**
 * فلاترُ طابور الرصد (القسم · المختبِر المسنَد · البحث · الدورة) في الرابط فوق بنود الطابور، والمجموعاتُ بالحلقة
 * وخلاصتُها على المعروض. الفلترُ الذي لا يفرّق شيئاً يُخفى (المختبِرُ يرى حلقاته وحده فلا فلترَ مختبِرٍ له).
 */
export function useExamQueueFilters(items: Ref<QueueItem[]>) {
  const route = useRoute()
  const router = useRouter()

  const filters = computed<QueueFilters>({
    get: () => ({ ...filtersFromQuery(route.query), cycle: cycleFromQuery(route.query.c) }),
    set: (f) => {
      void router.replace({ query: { ...route.query, ...queryFromFilters(f), c: f.cycle === ALL_CYCLES ? undefined : f.cycle } })
    }
  })
  const update = (patch: Partial<QueueFilters>) => {
    filters.value = { ...filters.value, ...patch }
  }
  const reset = () => update({ gender: 'all', supervisor: 'all', query: '', cycle: ALL_CYCLES })

  const base = computed(() => filterQueue(items.value, { gender: 'all', supervisor: 'all', query: '', cycle: ALL_CYCLES }))
  const shown = computed(() => filterQueue(items.value, filters.value))
  const groups = computed(() => groupQueue(shown.value))
  const summary = computed(() => queueSummary(groups.value))

  // خياراتُ الشريط الموحّد: الجنسُ بعدد المنتظرين في كلّ قسم
  const asRows = computed(() => base.value.map(i => ({ halaqa_id: i.halaqaId, halaqa_name: i.halaqa, gender: i.gender })))
  const genderItems = computed(() => genderOptions(asRows.value))
  const showGender = computed(() => hasBothGenders(asRows.value))
  const examinerItems = computed(() => examinerOptions(base.value))
  const showExaminer = computed(() => examinerItems.value.length > 1)
  const cycleItems = computed(() => cycleOptions(base.value))
  const showCycle = computed(() => cycleItems.value.length > 1)
  const active = computed(() => shown.value.length !== base.value.length || !!filters.value.query.trim())

  return { filters, update, reset, base, shown, groups, summary, genderItems, showGender, examinerItems, showExaminer, cycleItems, showCycle, active }
}
