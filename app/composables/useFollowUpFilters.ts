import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import {
  applyFollowUpFilters, filtersFromQuery, hasBothGenders, queryFromFilters, supervisorOptions,
  withoutTestHalaqa, type FilterableRow, type FollowUpFilters, type SupervisorRef
} from '~/utils/followUpFilters'

/** صفُّ الحلقة ومشرفِها كما يعود من الاستعلام. */
export interface HalaqaSupervisorRow {
  id: string
  supervisor: { id: string, full_name: string } | null
}

/** صفوفُ الاستعلام ← مشرفُ كلّ حلقة (الحلقةُ بلا مشرفٍ غائبةٌ عن الخريطة). */
export function supervisorMap(rows: HalaqaSupervisorRow[]): Map<string, SupervisorRef> {
  return new Map(rows.flatMap(r => r.supervisor ? [[r.id, { id: r.supervisor.id, name: r.supervisor.full_name }] as const] : []))
}

/**
 * فلاترُ «متابعة الرصد» (الجنس · المشرف · البحث) مربوطةً بالرابط، فوق الحلقات بلا التجريبية. المشرفون بطلبٍ واحد
 * لحلقات النطاق (RLS)؛ والفلترُ الذي لا يفرّق شيئاً يُخفى (الجنسُ لقسمٍ واحد، والمشرفُ لخيارٍ واحد).
 */
export function useFollowUpFilters<T extends FilterableRow>(rows: Ref<T[]>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const route = useRoute()
  const router = useRouter()

  const { data: sups } = useLazyAsyncData<Map<string, SupervisorRef>>('follow-up-supervisors', async () => {
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

  const filters = computed<FollowUpFilters>({
    get: () => filtersFromQuery(route.query),
    set: (f) => {
      void router.replace({ query: { ...route.query, ...queryFromFilters(f) } })
    }
  })
  const update = (patch: Partial<FollowUpFilters>) => {
    filters.value = { ...filters.value, ...patch }
  }

  const base = computed(() => withoutTestHalaqa(rows.value))
  const filtered = computed(() => applyFollowUpFilters(base.value, filters.value, sups.value ?? new Map()))
  const supItems = computed(() => supervisorOptions(base.value, sups.value ?? new Map()))
  const showGender = computed(() => hasBothGenders(base.value))
  const showSupervisor = computed(() => supItems.value.length > 1)
  const active = computed(() => filtered.value.length !== base.value.length || !!filters.value.query.trim())

  return { filters, update, base, filtered, supItems, showGender, showSupervisor, active }
}
