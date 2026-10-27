/**
 * جلبُ الشاشات التي تُقرأ في تطبيق المعلّم (البند 14، الدفعة الأولى — 2026-10-27) — مستخرَجٌ من صفحاتها كي تناديه
 * الصفحةُ نفسُها **وتجهيزُ النُّسخ اليوميّ** في الخلفية (`useWarmTeacherMirrors`) بطريقٍ واحد، فلا تتشعّب الاستعلامات.
 * كلُّ دالّةٍ ترمي خطأها؛ والصفحةُ تعرضه كما كانت. ومفاتيحُها (`SCREEN_KEYS`) مفاتيحُ الجلب ومفاتيحُ النُّسخ معاً.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { VisitHalqaOption, VisitRow } from '~/types/visits'
import { CYCLE_COLUMNS, toExamCycle, type ExamCycle } from '~/utils/exams/cycles'
import type { QualityHalaqa, QualityRow } from '~/utils/qualityRecord'

type Client = SupabaseClient<Database>
type Profile = Database['public']['Tables']['profiles']['Row']

export const SCREEN_KEYS = {
  examCycles: 'exam-cycles',
  visits: 'visits-list',
  visitHalqat: 'visits-halqat',
  qualityHalqat: 'quality-halqat',
  qualityRecords: (year: number, month: number) => `quality-records|${year}-${month}`,
  alerts: 'alerts-list',
  myMessages: 'my-staff-messages',
  profile: (id: string) => `profile-${id}`
} as const

export async function fetchExamCycles(supabase: Client): Promise<ExamCycle[]> {
  const { data, error } = await supabase.from('exam_cycles').select(CYCLE_COLUMNS).order('stage_number').order('cycle_number')
  if (error) throw error
  return (data ?? []).map(toExamCycle)
}

export async function fetchVisits(supabase: Client): Promise<VisitRow[]> {
  const { data, error } = await supabase
    .from('supervision_visits')
    .select('*, halaqa:halaqa_id(name, teacher:teacher_id(full_name)), supervisor:supervisor_id(full_name, role, gender)')
    .order('scheduled_at', { ascending: false })
    .returns<VisitRow[]>()
  if (error) throw error
  return data ?? []
}

export async function fetchVisitHalqat(supabase: Client): Promise<VisitHalqaOption[]> {
  const { data, error } = await supabase.from('halaqat')
    .select('id, name, daily_time, supervisor_id, status, teacher:teacher_id(full_name)').order('name')
    .returns<VisitHalqaOption[]>()
  if (error) throw error
  return data ?? []
}

export async function fetchQualityHalqat(supabase: Client): Promise<QualityHalaqa[]> {
  const { data, error } = await supabase.from('halaqat')
    .select('id, name, supervisor_id, teacher:teacher_id(id, full_name), supervisor:supervisor_id(full_name)')
    .eq('status', 'active').not('supervisor_id', 'is', null).order('name')
    .returns<QualityHalaqa[]>()
  if (error) throw error
  return data ?? []
}

export async function fetchQualityRecords(supabase: Client, year: number, month: number): Promise<QualityRow[]> {
  const { data, error } = await supabase.from('teacher_quality_months').select('*').eq('year', year).eq('month', month)
  if (error) throw error
  return data ?? []
}

/** المعلمُ لا يرى مُصدِرَ التنبيه (قرار 2026-10-19): لا يُطلب الاسمُ من القاعدة أصلاً فلا يصل إلى متصفّحه. */
export async function fetchAlerts<T>(supabase: Client, forTeacher: boolean): Promise<T[]> {
  const cols = 'id, alert_date, violation_type, description, severity, status, acknowledged_at, teacher:teacher_id(full_name)'
  const { data, error } = await supabase.from('admin_alerts')
    .select(forTeacher ? cols : `${cols}, issuer:issuer_id(full_name)`)
    .order('alert_date', { ascending: false })
    .returns<T[]>()
  if (error) throw error
  return data ?? []
}

export async function fetchMyMessages<T>(supabase: Client, me: string): Promise<T[]> {
  const { data, error } = await supabase.from('staff_message_recipients')
    .select('seen_at, message:message_id(id, title, body, link, created_at, sender:sent_by(full_name))')
    .eq('recipient_id', me)
    .returns<T[]>()
  if (error) throw error
  return data ?? []
}

export type ProfileScope = { label: string, value: string | number }
export type ProfileView = { p: Profile, scope: ProfileScope[] } | null

/** الملفُّ الشخصيّ ونطاقُ صاحبه (حلقتُه وعددُ طلابها للمعلّم، وعددُ الحلقات للمشرف والمختبِر). */
export async function fetchProfileView(supabase: Client, id: string): Promise<ProfileView> {
  if (!id) return null
  const { data: p, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle<Profile>()
  if (error) throw error
  if (!p) return null
  const scope: ProfileScope[] = []
  if (p.role === 'teacher') {
    const { data: h } = await supabase.from('halaqat').select('id, name').eq('teacher_id', p.id).limit(1).maybeSingle()
    if (h) {
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('halaqa_id', h.id).eq('status', 'active')
      scope.push({ label: 'الحلقة', value: h.name }, { label: 'عدد الطلاب', value: count ?? 0 })
    }
  } else if (p.role === 'field_supervisor') {
    const { count } = await supabase.from('halaqat').select('*', { count: 'exact', head: true }).eq('supervisor_id', p.id)
    scope.push({ label: 'الحلقات المُسندة', value: count ?? 0 })
  } else if (p.role === 'examiner') {
    const { count } = await supabase.from('halaqat').select('*', { count: 'exact', head: true }).eq('examiner_id', p.id)
    scope.push({ label: 'الحلقات المُسندة للاختبار', value: count ?? 0 })
  }
  return { p, scope }
}
