import type { Database } from '~/types/database.types'
import { canReviewOffDayRole } from '~/composables/usePermissions'
import { normalizeOffNote, OFF_REASON_LABELS, type OffReason } from '~/utils/offDays'
import { weekdayName } from '~/utils/recordingStatus'

/**
 * طابورُ بلاغات «لم تنعقد الحلقة» المعلّقة لبطاقة لوحة المعتمِدين (2026-10-30): يقرأ `attendance_off_days` المعلّقة
 * مرتّبةً باليوم، ومعها الحلقةُ وجنسُها والمبلِّغ؛ وتُعرض منها ما يعتمده الدورُ وحدَه (`visibleQueue`، فالمدير الفنيّ لا يرى
 * حلقاتِ البنات والمديرةُ لا ترى حلقاتِ البنين). والقبولُ والرفض عبر `review_off_day` — الخادمُ يفحص الدورَ والنطاق
 * والشهرَ المعتمَد — وبعد النجاح يخرج البندُ من القائمة بلا إعادة جلب؛ وبعد الفشل يُعرض الخطأ ويُعاد الجلبُ (فقد يكون
 * معتمِدٌ آخرُ سبقه). مشرفُ المشروع لا يعتمد فلا يسأل القاعدةَ أصلاً.
 */

/** بلاغٌ معلّق كما تعرضه البطاقة. */
export interface OffDayQueueItem {
  id: string
  halaqaId: string
  halaqaName: string
  /** جنسُ الحلقة؛ المجهولُ لا يعتمد به فنيٌّ ولا مديرة. */
  halaqaGender: string | null
  /** YYYY-MM-DD. */
  day: string
  reason: OffReason
  note: string | null
  reporterName: string | null
  reportedAt: string
}

/** صفُّ القاعدة بعد الربط بالحلقة والمبلِّغ. */
interface QueueRow {
  id: string
  halaqa_id: string
  day: string
  reason: string
  note: string | null
  reported_at: string
  halaqa: { name: string, gender: string | null } | null
  reporter: { full_name: string } | null
}

/** البنودُ التي يعتمدها هذا الدور وحدَها (مرآةٌ لـ`can_review_off_day`؛ طبقةُ تجربةٍ والحكمُ للخادم). */
export function visibleQueue(items: OffDayQueueItem[], role: string | null | undefined): OffDayQueueItem[] {
  return items.filter(i => canReviewOffDayRole(role, i.halaqaGender))
}

/** سطرُ اليوم: `dd/mm · اسمُ يوم الأسبوع` — الشهرُ بالرقم. */
export function offDayLine(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)} · ${weekdayName(day)}`
}

/** صفُّ القاعدة ← بند، أو `null` إن جاء سببٌ لا يعرفه التطبيق (لا يُعرض نصفُ بلاغ). */
function toItem(row: QueueRow): OffDayQueueItem | null {
  if (!(row.reason in OFF_REASON_LABELS)) return null
  return {
    id: row.id,
    halaqaId: row.halaqa_id,
    halaqaName: row.halaqa?.name ?? '—',
    halaqaGender: row.halaqa?.gender ?? null,
    day: row.day,
    reason: row.reason as OffReason,
    note: row.note,
    reporterName: row.reporter?.full_name ?? null,
    reportedAt: row.reported_at
  }
}

export function useOffDayQueue() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const { blockIfReadOnly } = useImpersonation()
  const { role } = useProfile()
  const all = ref<OffDayQueueItem[]>([])
  const loading = ref(false)
  // آخرُ قراءةٍ تغلب ما سبقها
  let generation = 0

  /** ما يعتمده الدورُ من المعلّق — تتبع القائمةَ والدور. */
  const items = computed(() => visibleQueue(all.value, role.value))

  async function load() {
    const mine = ++generation
    // من لا يعتمد حلقةً مطلقاً (مشرفُ المشروع) لا حاجةَ لسؤال القاعدة
    if (!canReviewOffDayRole(role.value, 'male') && !canReviewOffDayRole(role.value, 'female')) {
      all.value = []
      return
    }
    loading.value = true
    try {
      const { data, error } = await supabase.from('attendance_off_days')
        .select('id, halaqa_id, day, reason, note, reported_at, halaqa:halaqa_id(name, gender), reporter:profiles!attendance_off_days_reported_by_fkey(full_name)')
        .eq('status', 'pending')
        .order('day', { ascending: true })
        .order('reported_at', { ascending: true })
        .returns<QueueRow[]>()
      if (error) throw error
      if (mine !== generation) return
      all.value = (data ?? []).map(toItem).filter((i): i is OffDayQueueItem => i !== null)
    } catch (err) {
      if (mine === generation) {
        all.value = []
        handle(err)
      }
    } finally {
      if (mine === generation) loading.value = false
    }
  }

  /**
   * قبولُ البلاغ أو رفضُه. `note` سببُ الرفض (اختياريّ، يراه المعلّم) ويُهمَل مع القبول. الناجحُ يخرج من القائمة فوراً،
   * والفاشلُ يُعرض خطؤه ويُعاد الجلب.
   */
  async function review(id: string, approve: boolean, note: string | null): Promise<boolean> {
    try {
      // نيابةُ القراءة: تُرفض قبل الإرسال
      blockIfReadOnly()
      const reason = approve ? undefined : normalizeOffNote(note) ?? undefined
      const { error } = await supabase.rpc('review_off_day', { p_id: id, p_approve: approve, p_note: reason })
      if (error) throw error
      all.value = all.value.filter(i => i.id !== id)
      return true
    } catch (err) {
      handle(err)
      await load()
      return false
    }
  }

  return { items, loading, load, review }
}
