import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import {
  ALL_SUPERVISORS, applyHalaqaFilters, filtersFromQuery, genderOptions, hasBothGenders, queryFromFilters, supervisorOptions,
  withoutTestHalaqa, type FilterableRow, type HalaqaFilters, type SupervisorRef
} from '~/utils/halaqaFilters'

/** صفُّ الحلقة ومشرفِها كما يعود من الاستعلام. */
export interface HalaqaSupervisorRow {
  id: string
  supervisor: { id: string, full_name: string } | null
}

/** صفوفُ الاستعلام ← مشرفُ كلّ حلقة (الحلقةُ بلا مشرفٍ غائبةٌ عن الخريطة). */
export function supervisorMap(rows: HalaqaSupervisorRow[]): Map<string, SupervisorRef> {
  return new Map(rows.flatMap(r => r.supervisor ? [[r.id, { id: r.supervisor.id, name: r.supervisor.full_name }] as const] : []))
}

interface Options {
  /** فلترُ المشرف المسنَد (الافتراضُ نعم) — لا يُطلب المشرفون بدونه. */
  supervisor?: boolean
}

/**
 * فلاترُ قوائم الحلقات (الجنس · المشرف المسنَد · البحث) مربوطةً بالرابط، فوق الحلقات بلا التجريبية. المشرفون بطلبٍ
 * واحدٍ مشترك لحلقات النطاق (RLS)؛ والفلترُ الذي لا يفرّق شيئاً يُخفى (الجنسُ لقسمٍ واحد، والمشرفُ لخيارٍ واحد).
 */
export function useHalaqaFilters<T extends FilterableRow>(rows: Ref<T[]>, options: Options = {}) {
  const withSupervisor = options.supervisor !== false
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const route = useRoute()
  const router = useRouter()

  // مفتاحٌ مشترك بين الصفحات (طلبٌ واحد)؛ ومن لا يريد المشرفَ لا يطلبه ولا يكتب في المفتاح نسخةً فارغة
  const { data: sups } = withSupervisor ? fetchSupervisors() : { data: ref(new Map<string, SupervisorRef>()) }

  function fetchSupervisors() {
    return useLazyAsyncData<Map<string, SupervisorRef>>('halaqa-supervisors', async () => {
      const { data, error } = await supabase.from('halaqat')
        .select('id, supervisor:profiles!halaqat_supervisor_id_fkey(id, full_name)')
        .eq('status', 'active')
        .returns<HalaqaSupervisorRow[]>()
      if (error) {
        handle(error)
        return new Map()
      }
      return supervisorMap(data ?? [])
    }, { server: false, default: () => new Map() })
  }

  const filters = computed<HalaqaFilters>({
    get: () => {
      const f = filtersFromQuery(route.query)
      return withSupervisor ? f : { ...f, supervisor: ALL_SUPERVISORS }
    },
    set: (f) => {
      void router.replace({ query: { ...route.query, ...queryFromFilters(f) } })
    }
  })
  const update = (patch: Partial<HalaqaFilters>) => {
    filters.value = { ...filters.value, ...patch }
  }
  const reset = () => update({ gender: 'all', supervisor: ALL_SUPERVISORS, query: '' })

  const supMap = computed(() => sups.value ?? new Map<string, SupervisorRef>())
  const base = computed(() => withoutTestHalaqa(rows.value))
  const filtered = computed(() => applyHalaqaFilters(base.value, filters.value, supMap.value))
  const supItems = computed(() => withSupervisor ? supervisorOptions(base.value, supMap.value) : [])
  const genderItems = computed(() => genderOptions(base.value))
  const showGender = computed(() => hasBothGenders(base.value))
  const showSupervisor = computed(() => supItems.value.length > 1)
  const active = computed(() => filters.value.gender !== 'all' || filters.value.supervisor !== ALL_SUPERVISORS || !!filters.value.query.trim())

  return { filters, update, reset, base, filtered, supItems, genderItems, showGender, showSupervisor, active }
}
