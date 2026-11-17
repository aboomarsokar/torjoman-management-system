import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import type { TrackNo } from '~/constants/tracks'
import type { TrackStanding } from '~/utils/tracks'

/**
 * موقفُ حلقةٍ في نظام المسارين لشهر (`halaqa_track_standing`): المسار والمحتسبون والخصم والإنجاز وقائمةُ الطلاب
 * بحضورهم، وطلبُ المعلم المعلّق؛ مع طلب المسار وسحبه للمعلم. الحسابُ كلُّه في القاعدة.
 */
export function useTrackStanding(halaqaId: Ref<string | null | undefined>, year: Ref<number>, month: Ref<number>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const busy = ref(false)

  const { data: standing, pending, refresh } = useLazyAsyncData<TrackStanding | null>(
    () => `track-standing-${halaqaId.value ?? 'none'}-${year.value}-${month.value}`,
    async () => {
      if (!halaqaId.value) return null
      const { data, error } = await supabase.rpc('halaqa_track_standing', {
        p_halaqa: halaqaId.value, p_year: year.value, p_month: month.value
      })
      if (error) {
        handle(error)
        return null
      }
      return data as unknown as TrackStanding
    },
    { server: false, default: () => null, watch: [halaqaId, year, month] }
  )

  /** يطلب المعلمُ مسارَ حلقته؛ يعتمده المدير الإداري. */
  async function requestTrack(track: TrackNo, note: string): Promise<boolean> {
    if (!halaqaId.value) return false
    busy.value = true
    try {
      const { error } = await supabase.rpc('request_halaqa_track', { p_halaqa: halaqaId.value, p_track: track, p_note: note })
      if (error) {
        handle(error)
        return false
      }
      toast.add({ title: 'أُرسل الطلب', description: 'يصلك إشعارٌ حين يعتمده المدير الإداري.', color: 'success' })
      await refresh()
      return true
    } finally {
      busy.value = false
    }
  }

  async function cancelRequest(): Promise<void> {
    const id = standing.value?.pending_request?.id
    if (!id) return
    busy.value = true
    try {
      const { error } = await supabase.rpc('cancel_halaqa_track_request', { p_request: id })
      if (error) handle(error)
      else await refresh()
    } finally {
      busy.value = false
    }
  }

  return { standing, pending, busy, refresh, requestTrack, cancelRequest }
}
