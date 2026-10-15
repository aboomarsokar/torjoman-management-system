import type { Database } from '~/types/database.types'

/**
 * جرس الإشعارات — محسوب من البيانات الموجودة (لا جدول إشعارات).
 * حسب الدور، مع RLS الذي يقصر النطاق تلقائيّاً:
 *  - المعلّم: تنبيهات إدارية جديدة لم يؤكّد اطّلاعه عليها + نتائج رُصدت اليوم.
 *  - المختبِر: بنود اختبار بانتظار رصده.
 *  - المشرف: زيارات اليوم.
 *  - المدير: تقارير شهرية مُرسلة بانتظار اعتماده.
 *  - الجودة: تقارير مُرسلة في نطاقها للمتابعة.
 * تحديث: عند التركيب + عند تغيّر المسار + استطلاع كل 60 ثانية.
 */
export type NotifItem = { id: string, label: string, sub?: string, to: string, icon: string }

export function useNotifications() {
  const supabase = useSupabaseClient<Database>()
  const { role, profile } = useProfile()
  const route = useRoute()

  const items = ref<NotifItem[]>([])
  const count = computed(() => items.value.length)

  async function refresh() {
    const r = role.value
    const me = profile.value?.id
    if (!r || !me) {
      items.value = []
      return
    }
    const out: NotifItem[] = []

    if (r === 'teacher') {
      const { data } = await supabase
        .from('admin_alerts')
        .select('id, violation_type, alert_date')
        .eq('status', 'new')
        .order('alert_date', { ascending: false })
        .limit(10)
      for (const a of data ?? []) {
        out.push({ id: a.id, label: 'تنبيه إداري جديد', sub: a.violation_type, to: '/alerts', icon: 'i-lucide-bell' })
      }

      // RLS يقصرها على طلاب حلقته
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const { count: gradedToday } = await supabase
        .from('exam_results')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startOfDay.toISOString())
      if (gradedToday) {
        out.push({ id: 'graded', label: `${gradedToday} نتيجة اختبار رُصدت اليوم`, to: '/exams', icon: 'i-lucide-circle-check' })
      }
    }

    if (r === 'examiner') {
      const { data: examItems } = await supabase
        .from('exam_list_items')
        .select('id, exam_results(id)')
        .returns<{ id: string, exam_results: { id: string }[] }[]>()
      const pending = (examItems ?? []).filter(i => !i.exam_results?.length).length
      if (pending) {
        out.push({ id: 'grade', label: `${pending} بند اختبار بانتظار رصدك`, to: '/exams', icon: 'i-lucide-clipboard-check' })
      }
    }

    if (r === 'supervisor') {
      const today = new Date().toISOString().slice(0, 10)
      const { data: visits } = await supabase
        .from('supervision_visits')
        .select('id, scheduled_at, halaqa:halaqa_id(name)')
        .eq('supervisor_id', me).eq('status', 'scheduled').gte('scheduled_at', today)
        .order('scheduled_at', { ascending: true }).limit(5)
        .returns<{ id: string, scheduled_at: string, halaqa: { name: string } | null }[]>()
      for (const v of visits ?? []) {
        out.push({ id: v.id, label: `زيارة قادمة: ${v.halaqa?.name ?? '—'}`, sub: new Date(v.scheduled_at).toLocaleDateString('ar', { day: 'numeric', month: 'short' }), to: '/visits', icon: 'i-lucide-calendar-clock' })
      }
    }

    if (r === 'manager' || r === 'quality') {
      const { data } = await supabase
        .from('monthly_reports')
        .select('id, report_month, report_year, halaqa:halaqa_id(name)')
        .eq('status', 'submitted')
        .order('report_year', { ascending: false }).order('report_month', { ascending: false }).limit(10)
        .returns<{ id: string, report_month: number, report_year: number, halaqa: { name: string } | null }[]>()
      for (const rep of data ?? []) {
        out.push({ id: rep.id, label: r === 'manager' ? 'تقرير بانتظار اعتمادك' : 'تقرير مُرسل للمتابعة', sub: rep.halaqa?.name ?? '—', to: '/reports', icon: 'i-lucide-file-text' })
      }
    }

    items.value = out
  }

  // الاستطلاع الدوري يتوقّف والتبويب مخفي (توفير طلبات)، ويُحدَّث فور العودة إليه
  let timer: ReturnType<typeof setInterval> | null = null
  function onVisible() {
    if (!document.hidden) refresh()
  }
  onMounted(() => {
    refresh()
    timer = setInterval(() => {
      if (!document.hidden) refresh()
    }, 60000)
    document.addEventListener('visibilitychange', onVisible)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  })
  watch(role, refresh)
  watch(() => route.path, refresh)

  return { count, items, refresh }
}
