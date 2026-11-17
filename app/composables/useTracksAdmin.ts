import type { Database } from '~/types/database.types'
import type { TrackNo } from '~/constants/tracks'
import { gazaToday } from '~/utils/reportWindow'
import { nextTermStart, trackAt } from '~/utils/tracks'

/**
 * صفحةُ «مسارات المعلمين» (نظامُ المسارين — قرار المستخدم 2026-11-16): طلباتُ المعلمين المعلّقة وما حُسم مؤخراً،
 * والحلقاتُ بمسار الشهر الحاليّ ومسار الفصل التالي؛ والمديرُ الإداريّ يعتمد أو يرفض أو يعيّن مباشرةً بسبب.
 * المساراتُ تُقرأ من `halaqa_tracks` ويُحسب مسارُ الشهر بـ`trackAt` (مرآةُ `private.halaqa_track`)؛ والكتابةُ عبر الدوالّ.
 */
export interface TrackRequestRow {
  id: string
  halaqa_id: string
  requested_track: number
  note: string | null
  status: string
  effective_year: number | null
  effective_month: number | null
  decision_note: string | null
  created_at: string
  decided_at: string | null
  halaqa: { name: string } | null
  requester: { full_name: string } | null
}

export interface TrackHalaqaRow {
  id: string
  name: string
  gender: 'male' | 'female' | null
  teacher: string | null
  current: TrackNo
  next: TrackNo
}

const REQUEST_COLUMNS = 'id, halaqa_id, requested_track, note, status, effective_year, effective_month, decision_note, created_at, decided_at, halaqa:halaqat(name), requester:profiles!halaqa_track_requests_requested_by_fkey(full_name)'

/** عددُ الطلبات المحسومة المعروضة. */
const DECIDED_LIMIT = 30

export function useTracksAdmin() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const busy = ref(false)

  const today = gazaToday()
  const now = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
  const term = nextTermStart(now.year, now.month)

  const { data, pending, refresh } = useLazyAsyncData('tracks-admin', async () => {
    const [halaqat, tracks, pendingReq, decided] = await Promise.all([
      supabase.from('halaqat').select('id, name, gender, teacher:profiles!halaqat_teacher_id_fkey(full_name)').eq('status', 'active').order('name'),
      supabase.from('halaqa_tracks').select('halaqa_id, track, effective_year, effective_month'),
      supabase.from('halaqa_track_requests').select(REQUEST_COLUMNS).eq('status', 'pending').order('created_at'),
      supabase.from('halaqa_track_requests').select(REQUEST_COLUMNS).neq('status', 'pending').order('decided_at', { ascending: false }).limit(DECIDED_LIMIT)
    ])
    const failure = halaqat.error ?? tracks.error ?? pendingReq.error ?? decided.error
    if (failure) {
      handle(failure)
      return null
    }
    const rows = tracks.data ?? []
    const list: TrackHalaqaRow[] = (halaqat.data ?? []).map(h => ({
      id: h.id,
      name: h.name,
      gender: h.gender,
      teacher: h.teacher?.full_name ?? null,
      current: trackAt(rows, h.id, now.year, now.month),
      next: trackAt(rows, h.id, term.year, term.month)
    }))
    return {
      halaqat: list,
      pending: (pendingReq.data ?? []) as TrackRequestRow[],
      decided: (decided.data ?? []) as TrackRequestRow[]
    }
  }, { server: false, default: () => null })

  async function run(fn: () => PromiseLike<{ error: unknown }>, done: string): Promise<boolean> {
    busy.value = true
    try {
      const { error } = await fn()
      if (error) {
        handle(error)
        return false
      }
      toast.add({ title: done, color: 'success' })
      await refresh()
      return true
    } finally {
      busy.value = false
    }
  }

  /** يعتمد الطلبَ أو يرفضه (الرفضُ بسببٍ إلزاميّ — تحرسه القاعدة أيضاً). */
  const decide = (id: string, approve: boolean, note: string) =>
    run(() => supabase.rpc('decide_halaqa_track_request', { p_request: id, p_approve: approve, p_note: note }), approve ? 'اعتُمد الطلب' : 'رُفض الطلب')

  /** تعيينٌ مباشر لمسار حلقةٍ من شهرٍ بسبب. */
  const assign = (halaqaId: string, track: TrackNo, year: number, month: number, reason: string) =>
    run(() => supabase.rpc('set_halaqa_track', { p_halaqa: halaqaId, p_track: track, p_year: year, p_month: month, p_reason: reason }), 'عُيّن المسار')

  return { data, pending, busy, now, term, decide, assign }
}
