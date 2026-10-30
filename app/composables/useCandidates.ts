/**
 * مقابلاتُ المرشّحين — طرفُ الإدارة واللجنة (طلب المستخدم 2026-10-30): قراءةُ المرشّحين بلجانهم وتقييماتهم (النطاقُ في
 * RLS: الإداريُّ الكلّ، والفنيُّ البنين، والمديرةُ البنات، والعضوُ من أُسند إليه)، والجدولةُ واللجنة، والقرار، وتقييمُ العضو نفسه.
 */
import type { Database } from '~/types/database.types'
import type { Role } from '~/constants/roles'
import { CANDIDATE_CRITERIA, CRITERION_MAX, MAX_CANDIDATE_LONG, MAX_INTERVIEW_PLACE, type CandidateStatus } from '~/constants/candidates'

type Row = Database['public']['Tables']['candidates']['Row']
export interface CandidateEvaluation { evaluator_id: string, scores: number[], notes: string | null, updated_at: string }
export interface Candidate extends Row { committee: string[], evaluations: CandidateEvaluation[] }
export interface StaffOption { id: string, name: string, role: Role, gender: 'male' | 'female' | null }
export interface ScheduleDraft { ids: string[], at: string, place: string, committee: string[] }

/** خطأُ تقييم العضو: عشرُ درجاتٍ كلٌّ من 0 إلى 5. */
export function evaluationError(scores: (number | null)[], notes: string): string | null {
  if (scores.length !== CANDIDATE_CRITERIA.length || scores.some(s => s === null)) return 'قيّم البنود كلّها.'
  if (scores.some(s => !Number.isInteger(s) || (s as number) < 0 || (s as number) > CRITERION_MAX)) return `كلُّ بندٍ من 0 إلى ${CRITERION_MAX}.`
  if (notes.trim().length > MAX_CANDIDATE_LONG) return `الملاحظة لا تتجاوز ${MAX_CANDIDATE_LONG} حرف.`
  return null
}

export function useCandidates() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const candidates = ref<Candidate[]>([])
  const staff = ref<StaffOption[]>([])
  const loading = ref(false)
  const busy = ref(false)

  const warn = (title: string) => {
    toast.add({ title, color: 'warning', icon: 'i-lucide-circle-alert' })
    return false
  }

  async function load() {
    loading.value = true
    const { data, error } = await supabase.from('candidates')
      .select('*, candidate_committee(profile_id), candidate_evaluations(evaluator_id, scores, notes, updated_at)')
      .order('created_at', { ascending: false })
    loading.value = false
    if (error) return handle(error)
    candidates.value = (data ?? []).map(({ candidate_committee, candidate_evaluations, ...c }) => ({
      ...c,
      committee: (candidate_committee ?? []).map(m => m.profile_id),
      evaluations: (candidate_evaluations ?? []).map(e => ({ ...e, scores: e.scores.map(Number) }))
    }))
  }

  async function loadStaff() {
    const { data, error } = await supabase.from('profiles').select('id, full_name, role, gender')
      .neq('role', 'student').eq('status', 'active').order('full_name')
    if (error) return handle(error)
    staff.value = (data ?? []).map(s => ({ id: s.id, name: s.full_name, role: s.role, gender: s.gender }))
  }

  async function run(fn: () => PromiseLike<{ error: unknown }>, ok: string): Promise<boolean> {
    busy.value = true
    const { error } = await fn()
    busy.value = false
    if (error) {
      handle(error)
      return false
    }
    toast.add({ title: ok, color: 'success', icon: 'i-lucide-circle-check' })
    await load()
    return true
  }

  /** دعوةٌ لمقابلة: الموعدُ والمكان لمرشّحٍ أو أكثر، ولجنتُهم (تُستبدل اللجنة كلُّها بما اختير). */
  async function schedule(d: ScheduleDraft): Promise<boolean> {
    if (!d.ids.length) return warn('اختر مرشّحاً واحداً على الأقلّ.')
    if (!d.at) return warn('حدّد موعد المقابلة.')
    if (d.place.trim().length > MAX_INTERVIEW_PLACE) return warn(`المكان لا يتجاوز ${MAX_INTERVIEW_PLACE} حرف.`)
    busy.value = true
    const at = new Date(d.at).toISOString()
    const { error } = await supabase.from('candidates')
      .update({ interview_at: at, interview_place: d.place.trim() || null, status: 'invited' })
      .in('id', d.ids).in('status', ['new', 'invited', 'reserve'])
    if (error) {
      busy.value = false
      handle(error)
      return false
    }
    const del = await supabase.from('candidate_committee').delete().in('candidate_id', d.ids)
    const rows = d.ids.flatMap(id => d.committee.map(p => ({ candidate_id: id, profile_id: p })))
    const ins = rows.length ? await supabase.from('candidate_committee').insert(rows) : { error: null }
    busy.value = false
    if (del.error || ins.error) {
      handle(del.error ?? ins.error)
      return false
    }
    toast.add({ title: d.ids.length > 1 ? `دُعي ${d.ids.length} مرشّحين إلى المقابلة.` : 'دُعي المرشّح إلى المقابلة.', color: 'success', icon: 'i-lucide-circle-check' })
    await load()
    return true
  }

  function decide(id: string, status: CandidateStatus, note: string) {
    if (note.trim().length > MAX_CANDIDATE_LONG) return Promise.resolve(warn(`الملاحظة لا تتجاوز ${MAX_CANDIDATE_LONG} حرف.`))
    return run(() => supabase.from('candidates').update({ status, decision_note: note.trim() || null }).eq('id', id), 'حُفظ القرار.')
  }

  function remove(id: string) {
    return run(() => supabase.from('candidates').delete().eq('id', id), 'حُذف المرشّح.')
  }

  /** تقييمُ العضو نفسه (يُستبدل إن سبق). */
  async function evaluate(candidateId: string, evaluatorId: string, scores: (number | null)[], notes: string): Promise<boolean> {
    const problem = evaluationError(scores, notes)
    if (problem) return warn(problem)
    return run(() => supabase.from('candidate_evaluations').upsert({
      candidate_id: candidateId, evaluator_id: evaluatorId, scores: scores as number[], notes: notes.trim() || null
    }, { onConflict: 'candidate_id,evaluator_id' }), 'حُفظ تقييمك.')
  }

  return { candidates, staff, loading, busy, load, loadStaff, schedule, decide, remove, evaluate }
}
