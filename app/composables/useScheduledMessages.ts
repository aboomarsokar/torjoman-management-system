/**
 * الرسائلُ المجدولة (طلب المستخدم 2026-10-27): تذكيرٌ مرّةً أو أسبوعياً أو شهرياً لفئات الكادر والإدارة — داخل المنصّة
 * و/أو SMS. المديرُ الإداريّ للقسمين وبالقناتين، والمديرُ الفنيّ للبنين والمديرةُ الإدارية للبنات داخل المنصّة. الحكمُ
 * للقاعدة (`scheduled_messages` وحارسُها)، والمُطلِقُ `pg_cron` كلَّ خمس دقائق. الوصفُ والتحقّقُ نقيّان ومختبَران.
 */
import type { Database } from '~/types/database.types'
import { formatTime12 } from '~/utils/time'

export type Recurrence = 'once' | 'weekly' | 'monthly'
export type ScheduledRow = Database['public']['Tables']['scheduled_messages']['Row']

/** الأحد 0 … السبت 6 (كـextract(dow) في القاعدة). */
export const WEEKDAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'] as const

export const SCHEDULE_ROLES: { key: string, label: string, group: 'staff' | 'admin' }[] = [
  { key: 'teacher', label: 'المعلمون', group: 'staff' },
  { key: 'field_supervisor', label: 'المشرفون الميدانيون', group: 'staff' },
  { key: 'examiner', label: 'المختبِرون', group: 'staff' },
  { key: 'project_supervisor', label: 'مشرف المشروع', group: 'admin' },
  { key: 'admin_manager', label: 'المدير الإداري', group: 'admin' },
  { key: 'technical_manager', label: 'المدير الفني', group: 'admin' },
  { key: 'women_admin', label: 'المديرة الإدارية', group: 'admin' }
]

export interface ScheduleDraft {
  title: string
  body: string
  roles: string[]
  section: 'all' | 'male' | 'female'
  in_app: boolean
  sms: boolean
  recurrence: Recurrence
  run_date: string
  run_time: string
  weekday: number
  month_day: number
}

export const blankSchedule = (section: ScheduleDraft['section'] = 'all'): ScheduleDraft => ({
  title: '', body: '', roles: ['teacher'], section, in_app: true, sms: false,
  recurrence: 'weekly', run_date: '', run_time: '08:00', weekday: 6, month_day: 1
})

/** «كلَّ سبت 8:00 ص» / «كلَّ شهر يوم 28 · 9:00 ص» / «مرّةً 31-10-2026 · 4:00 م». */
export function describeSchedule(r: Pick<ScheduledRow, 'recurrence' | 'run_at' | 'weekday' | 'month_day' | 'time_of_day'>): string {
  if (r.recurrence === 'weekly') return `كلَّ ${WEEKDAYS[r.weekday ?? 0]} · ${formatTime12(r.time_of_day)}`
  if (r.recurrence === 'monthly') return `كلَّ شهر يوم ${r.month_day} · ${formatTime12(r.time_of_day)}`
  if (!r.run_at) return 'مرّةً واحدة'
  const d = new Date(r.run_at)
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Gaza', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d).replace(/\//g, '-')
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Gaza', hour: '2-digit', minute: '2-digit', hour12: false }).format(d)
  return `مرّةً ${day} · ${formatTime12(time)}`
}

/** خطأُ النموذج بالعربية، أو null. */
export function scheduleError(d: ScheduleDraft): string | null {
  if (!d.title.trim()) return 'اكتب عنوان الرسالة.'
  if (d.title.trim().length > 120) return 'العنوان لا يتجاوز 120 حرفاً.'
  if (d.body.trim().length > 600) return 'النصّ لا يتجاوز 600 حرف.'
  if (!d.roles.length) return 'اختر فئةً واحدةً على الأقلّ.'
  if (!d.in_app && !d.sms) return 'اختر قناةً واحدةً على الأقلّ.'
  if (!/^\d{2}:\d{2}$/.test(d.run_time)) return 'اختر الوقت.'
  if (d.recurrence === 'once' && !/^\d{4}-\d{2}-\d{2}$/.test(d.run_date)) return 'اختر اليوم.'
  return null
}

/** «2026-10-31» + «16:00» بتوقيت غزة ← ISO (غزة +02 شتاءً و+03 صيفاً — يُحسب الفارقُ لذلك اليوم). */
export function gazaLocalToIso(date: string, time: string): string {
  const [y, m, dd] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y!, m! - 1, dd!, h!, mi!)
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Gaza', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(guess)).reduce<Record<string, string>>((a, p) => ({ ...a, [p.type]: p.value }), {})
  const asGaza = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
  return new Date(guess - (asGaza - guess)).toISOString()
}

export function useScheduledMessages() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const busy = ref(false)

  const { data: rows, pending, refresh } = useLazyAsyncData<ScheduledRow[]>('scheduled-messages', async () => {
    const { data, error } = await supabase.from('scheduled_messages').select('*')
      .order('active', { ascending: false }).order('next_run_at', { ascending: true, nullsFirst: false })
    if (error) handle(error)
    return data ?? []
  }, { server: false, default: () => [] })

  async function run(task: () => PromiseLike<{ error: unknown }>, done: string): Promise<boolean> {
    busy.value = true
    try {
      const { error } = await task()
      if (error) throw error
      toast.add({ title: done, color: 'success', icon: 'i-lucide-circle-check' })
      await refresh()
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  function payload(d: ScheduleDraft) {
    return {
      title: d.title.trim(),
      body: d.body.trim() || null,
      roles: d.roles,
      section: d.section,
      in_app: d.in_app,
      sms: d.sms,
      recurrence: d.recurrence,
      run_at: d.recurrence === 'once' ? gazaLocalToIso(d.run_date, d.run_time) : null,
      weekday: d.recurrence === 'weekly' ? d.weekday : null,
      month_day: d.recurrence === 'monthly' ? d.month_day : null,
      time_of_day: d.recurrence === 'once' ? null : d.run_time
    }
  }

  async function save(d: ScheduleDraft, id?: string): Promise<boolean> {
    const problem = scheduleError(d)
    if (problem) {
      toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    return id
      ? run(() => supabase.from('scheduled_messages').update(payload(d)).eq('id', id), 'حُفظ الموعد.')
      : run(() => supabase.from('scheduled_messages').insert(payload(d)), 'جُدولت الرسالة.')
  }

  const setActive = (id: string, active: boolean) =>
    run(() => supabase.from('scheduled_messages').update({ active }).eq('id', id), active ? 'استؤنفت الجدولة.' : 'أُوقفت الجدولة.')
  const remove = (id: string) =>
    run(() => supabase.from('scheduled_messages').delete().eq('id', id), 'حُذفت الرسالة المجدولة.')

  return { rows, pending, busy, save, setActive, remove, refresh }
}
