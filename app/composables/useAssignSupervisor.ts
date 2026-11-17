import type { Database } from '~/types/database.types'
import { NO_STAFF, fetchStaff, staffOfGender, type StaffRow } from '~/composables/useHalaqaStaffOptions'

/**
 * إسنادُ المشرفة لحلقة بنات (طلب المستخدم 2026-11-17): للمديرة الإدارية — تكتب `supervisor_id` وحده عبر
 * `assign_halaqa_supervisor` (لا تعديلَ لسائر الحلقة). القائمةُ مشرفاتٌ ميدانياتٌ نشطات، و«بلا مشرفة».
 */
export interface SupervisorTarget { id: string, name: string, supervisor_id: string | null }

/** خياراتُ القائمة: «بلا مشرفة» ثم المشرفات بالاسم. */
export function supervisorChoices(rows: StaffRow[]): { label: string, value: string }[] {
  return [{ label: 'بلا مشرفة', value: NO_STAFF }, ...staffOfGender(rows, 'female').map(r => ({ label: r.full_name, value: r.id }))]
}

export function useAssignSupervisor(onDone: () => Promise<unknown>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()

  const target = ref<SupervisorTarget | null>(null)
  const selected = ref<string>(NO_STAFF)
  const busy = ref(false)
  const { data: supervisors } = useLazyAsyncData('assign-supervisor-options', () => fetchStaff('field_supervisor'),
    { server: false, default: () => [] as StaffRow[] })
  const items = computed(() => supervisorChoices(supervisors.value ?? []))

  const open = computed({
    get: () => !!target.value,
    set: (v: boolean) => {
      if (!v) target.value = null
    }
  })

  function start(t: SupervisorTarget) {
    target.value = t
    selected.value = t.supervisor_id ?? NO_STAFF
  }

  async function save() {
    if (!target.value) return
    busy.value = true
    try {
      const { error } = await supabase.rpc('assign_halaqa_supervisor', {
        p_halaqa: target.value.id,
        // الأنواعُ المولّدة لا تعرف أن الدالّة تقبل null (= بلا مشرفة)، والقاعدةُ تقبله
        p_supervisor: (selected.value === NO_STAFF ? null : selected.value) as string
      })
      if (error) {
        handle(error)
        return
      }
      toast.add({ title: 'أُسندت المشرفة', color: 'success' })
      target.value = null
      await onDone()
    } finally {
      busy.value = false
    }
  }

  return { target, selected, items, busy, open, start, save }
}
