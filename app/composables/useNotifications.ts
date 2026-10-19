import type { Database } from '~/types/database.types'
import { pendingLists, type PendingItemRow } from '~/utils/exams/nomination'

/**
 * طوابير «بانتظارك» في جرس الإشعارات — محسوبةٌ عند العرض من البيانات الموجودة، لا مخزّنة.
 * الأخبارُ المخزّنة (جدول notifications) تقرؤها useInbox، والجرسُ يجمع القسمين.
 * حسب الدور، مع RLS الذي يقصر النطاق تلقائيّاً:
 *  - المعلّم: تنبيهات إدارية جديدة لم يؤكّد اطّلاعه عليها (ونتائجُ الاختبار خبرُ `exam_graded` لا بندٌ هنا).
 *  - المختبِر: بندٌ لكلّ قائمة ترشيح بانتظار رصده، معرّفُه معرّفُ القائمة فتُسقطه pendingQueue ما دام إشعارُ
 *    `exam_nominated` (مصدرُه `exam_lists`) غيرَ مقروء.
 *  - المشرف الميداني: زيارات اليوم.
 *  - مَن يعتمد رصد الشهر (الإداري، والمديرة الإدارية، والمشرف الميداني لحلقاته — لا المدير الفني): رصدٌ مُرسَلٌ بانتظار الاعتماد.
 *    RLS يقصر نطاقه، والمشرفُ يُصفّى صراحةً على `halaqat.supervisor_id`. معرّفُ العنصر معرّفُ التقرير فتُسقطه pendingQueue ما دام إشعارُه غيرَ مقروء.
 * تحديث: عند التركيب + عند تغيّر المسار + استطلاع كل 60 ثانية.
 */
export type NotifItem = { id: string, label: string, sub?: string, to: string, icon: string }

/** سقفُ بنود الاختبار المعلّقة التي يُجمَّع منها طابورُ المختبِر. */
const PENDING_ITEMS_LIMIT = 500

export function useNotifications() {
  const supabase = useSupabaseClient<Database>()
  const { role, profile } = useProfile()
  const { canApproveReports } = usePermissions()
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
      // نتائجُ الاختبار تصل خبراً مخزّناً (exam_graded) لا بنداً في الطابور
    }

    if (r === 'examiner') {
      // بندٌ لكلّ قائمة ترشيح فيها بنودٌ بلا نتيجة؛ معرّفُه معرّفُ القائمة (مصدرُ exam_nominated).
      // المعلّقُ وحده يُصفّى في الخادم (ضمٌّ عكسيّ) والأحدثُ أولاً بسقفٍ دون سقف PostgREST
      const { data: examItems } = await supabase
        .from('exam_list_items')
        .select('exam_list_id, exam_results(id), exam_list:exam_list_id(halaqa:halaqa_id(name))')
        .is('exam_results', null)
        .order('created_at', { ascending: false })
        .limit(PENDING_ITEMS_LIMIT)
        .returns<PendingItemRow[]>()
      for (const l of pendingLists(examItems ?? [])) {
        out.push({ id: l.listId, label: 'قائمة ترشيح بانتظار رصدك', sub: `${l.halaqa} · ${l.count}`, to: '/exams', icon: 'i-lucide-clipboard-check' })
      }
    }

    if (r === 'field_supervisor') {
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

    if (canApproveReports.value) {
      // المشرف الميداني: حلقاته وحدها (inner لتسقط الصفوف الأخرى من الجانب الآخر للتضمين)
      const mine = r === 'field_supervisor'
      let query = supabase
        .from('monthly_reports')
        .select(`id, report_month, report_year, halaqa:halaqa_id${mine ? '!inner' : ''}(name, supervisor_id)`)
        .eq('status', 'submitted')
      if (mine) query = query.eq('halaqa.supervisor_id', me)
      const { data } = await query
        .order('report_year', { ascending: false }).order('report_month', { ascending: false }).limit(10)
        .returns<{ id: string, report_month: number, report_year: number, halaqa: { name: string } | null }[]>()
      for (const rep of data ?? []) {
        out.push({ id: rep.id, label: 'تقرير بانتظار اعتمادك', sub: rep.halaqa?.name ?? '—', to: `/reports?y=${rep.report_year}&m=${rep.report_month}`, icon: 'i-lucide-file-text' })
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
