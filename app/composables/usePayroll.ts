/**
 * كشفُ رواتب الشهر (طلب المستخدم 2026-11-03): أصحابُ الرواتب النشطون بمكافأتهم الأساسية (`profile_financials.base_reward`
 * أو الافتراضيّة من الإعدادات)، وتقييمُ المعلم النهائيّ من سجلّ جودةٍ **مقفل** (`teacher_quality_months.final`)، وما حُفظ للشهر.
 * الحسابُ في `utils/payroll.ts`؛ والحفظُ لقطةٌ في `monthly_salaries` ومكافأةٌ خاصّة في `profile_financials`. للمدير الإداري (RLS).
 */
import type { Database } from '~/types/database.types'
import type { Role } from '~/constants/roles'
import { DEFAULT_REWARD, netSalary, suggestedSalary } from '~/utils/payroll'

export interface PayrollRow {
  profile_id: string
  name: string
  role: Role
  gender: 'male' | 'female' | null
  /** المكافأةُ الأساسية نصّاً للحقل. */
  base: string
  /** التقييمُ النهائيّ من سجلٍّ مقفل (للمعلم وحده)؛ null = بانتظار التقييم. */
  final: number | null
  adjustment: string
  note: string
}

/** المحسوبُ والصافي لسطر (الأساسُ الفارغ = الافتراضيّة). */
export function rowAmounts(r: PayrollRow, fallback: number) {
  const base = Number(r.base) > 0 ? Number(r.base) : fallback
  const suggested = suggestedSalary(r.role, base, r.final)
  return { base, suggested, net: netSalary(suggested, Number(r.adjustment) || 0) }
}

/** خطأُ السطر قبل الحفظ، أو null: التعديلُ بلا سبب، أو مكافأةٌ غيرُ موجبة. */
export function rowError(r: PayrollRow): string | null {
  if (r.base.trim() && !(Number(r.base) > 0)) return `مكافأة ${r.name} غير صالحة.`
  if ((Number(r.adjustment) || 0) !== 0 && !r.note.trim()) return `اكتب سبب التعديل لـ${r.name}.`
  return null
}

export function usePayroll(salariedRoles: Role[]) {
  const supabase = useSupabaseClient<Database>()
  const rows = ref<PayrollRow[]>([])
  const fallback = ref(DEFAULT_REWARD)
  const approved = ref(false)

  async function load(month: number, year: number) {
    const [workers, sal, fin, quality, settings] = await Promise.all([
      supabase.from('profiles').select('id, full_name, role, gender').in('role', salariedRoles).eq('status', 'active').order('full_name'),
      supabase.from('monthly_salaries').select('profile_id, amount, approved, base_reward, adjustment, adjustment_note').eq('salary_month', month).eq('salary_year', year),
      supabase.from('profile_financials').select('profile_id, base_reward'),
      supabase.from('teacher_quality_months').select('teacher_id, final, locked_at').eq('month', month).eq('year', year).not('locked_at', 'is', null),
      supabase.from('app_settings').select('default_reward').limit(1).maybeSingle()
    ])
    const failure = workers.error ?? sal.error ?? fin.error ?? quality.error ?? settings.error
    if (failure) throw failure
    fallback.value = Number(settings.data?.default_reward ?? DEFAULT_REWARD)
    const saved = new Map((sal.data ?? []).map(s => [s.profile_id, s]))
    const bases = new Map((fin.data ?? []).map(f => [f.profile_id, f.base_reward]))
    const finals = new Map((quality.data ?? []).map(q => [q.teacher_id, q.final === null ? null : Number(q.final)]))
    approved.value = (sal.data ?? []).some(s => s.approved)
    rows.value = (workers.data ?? []).map((w) => {
      const s = saved.get(w.id)
      const base = s?.base_reward ?? bases.get(w.id) ?? null
      return {
        profile_id: w.id,
        name: w.full_name,
        role: w.role,
        gender: w.gender,
        base: base === null ? '' : String(base),
        final: finals.get(w.id) ?? null,
        adjustment: s?.adjustment ? String(s.adjustment) : '',
        note: s?.adjustment_note ?? ''
      }
    })
  }

  /** يحفظ الشهر: لقطةٌ لكلّ من له صافٍ، ويحذف من لم يبقَ له مبلغ، ويحفظ المكافآتِ الخاصّة. يرمي أوّلَ خطأ. */
  async function save(month: number, year: number) {
    const problem = rows.value.map(rowError).find(Boolean)
    if (problem) throw new Error(problem)
    const computed = rows.value.map(r => ({ r, ...rowAmounts(r, fallback.value) }))
    const payload = computed.filter(c => c.net !== null).map(c => ({
      profile_id: c.r.profile_id, salary_month: month, salary_year: year, amount: c.net!, approved: false,
      base_reward: c.base, final_score: c.r.role === 'teacher' ? c.r.final : null,
      adjustment: Number(c.r.adjustment) || 0, adjustment_note: c.r.note.trim() || null
    }))
    if (payload.length) {
      const { error } = await supabase.from('monthly_salaries').upsert(payload, { onConflict: 'profile_id,salary_month,salary_year' })
      if (error) throw error
    }
    const cleared = computed.filter(c => c.net === null).map(c => c.r.profile_id)
    if (cleared.length) {
      const { error } = await supabase.from('monthly_salaries').delete().eq('salary_month', month).eq('salary_year', year).in('profile_id', cleared)
      if (error) throw error
    }
    // المكافأةُ الخاصّة تبقى للأشهر القادمة؛ والفارغةُ تعود إلى الافتراضيّة
    const fin = rows.value.map(r => ({ profile_id: r.profile_id, base_reward: Number(r.base) > 0 ? Number(r.base) : null }))
    const { error } = await supabase.from('profile_financials').upsert(fin, { onConflict: 'profile_id' })
    if (error) throw error
  }

  return { rows, fallback, approved, load, save }
}
