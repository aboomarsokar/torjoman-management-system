import type { Database } from '~/types/database.types'
import type { DayState } from '~/utils/recordingStatus'

export interface Absentee { name: string, kind: string }
export interface DayDetail { roster: number, absentees: Absentee[] }

/** الحاضرون = المقيَّدون حتى اليوم − الغائبين؛ والغائبون بالاسم مرتّبين. */
export function buildDayDetail(day: string, abs: { kind: string, student: { full_name: string } | null }[], studs: { enrollment_date: string | null }[]): DayDetail {
  return {
    roster: studs.filter(s => !s.enrollment_date || s.enrollment_date <= day).length,
    absentees: abs.map(a => ({ name: a.student?.full_name ?? '—', kind: a.kind })).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }
}

/**
 * اليومُ المفتوح تحت حلقته في «متابعة الرصد» (واحدٌ في الصفحة): الضغطُ يفتحه أو يطويه، وحالُ اليوم المرصود
 * (الحضورُ والغيابُ بالأسماء) يُقرأ عند طلبه مرّةً ويُخبّأ.
 */
export function useFollowUpDayDetail() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const open = ref<{ hid: string, day: string, state: DayState, female: boolean } | null>(null)
  const detail = ref<DayDetail | null>(null)
  const detailLoading = ref(false)
  const cache = new Map<string, DayDetail>()

  async function toggleDay(hid: string, day: string, state: DayState, female: boolean) {
    if (open.value?.hid === hid && open.value.day === day) {
      open.value = null
      return
    }
    open.value = { hid, day, state, female }
    detail.value = null
    if (state !== 'held') return
    const key = `${hid}|${day}`
    if (cache.has(key)) {
      detail.value = cache.get(key)!
      return
    }
    detailLoading.value = true
    // RLS بنطاق الحلقة
    const [{ data: abs, error: e1 }, { data: studs, error: e2 }] = await Promise.all([
      supabase.from('attendance_absences').select('kind, student:student_id(full_name)').eq('halaqa_id', hid).eq('day', day)
        .returns<{ kind: string, student: { full_name: string } | null }[]>(),
      supabase.from('students').select('id, enrollment_date').eq('halaqa_id', hid).eq('status', 'active')
    ])
    detailLoading.value = false
    if (e1 || e2) {
      handle(e1 ?? e2)
      return
    }
    const d = buildDayDetail(day, abs ?? [], studs ?? [])
    cache.set(key, d)
    if (open.value?.hid === hid && open.value.day === day) detail.value = d
  }

  const excused = computed(() => detail.value?.absentees.filter(a => a.kind === 'excused').length ?? 0)
  const unexcused = computed(() => detail.value?.absentees.filter(a => a.kind !== 'excused').length ?? 0)
  const present = computed(() => Math.max(0, (detail.value?.roster ?? 0) - (detail.value?.absentees.length ?? 0)))

  return { open, detail, detailLoading, toggleDay, excused, unexcused, present }
}
