import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'
import { asOffStatus, OFF_REASON_LABELS, type OffDay, type OffReason } from '~/utils/offDays'

/**
 * حضورُ يومٍ واحدٍ لحلقة: الحضورُ هو الأصل، والغياباتُ وحدها (بعذر / بلا عذر) تُسجَّل. التعديلُ في مسوّدةٍ
 * على الشاشة، و«حفظ الحضور» يكتبها ويفتح اليومَ إن لم يُسجَّل — فالحلقةُ «انعقدت» إذا سُجّل حضورُها، ولا زرَّ
 * منفصلاً (طلب المستخدم 2026-10-21). الفاشلُ يُعيد قراءةَ اليوم من القاعدة.
 * `locked` = رصدُ شهر اليوم معتمَد (الحارس في القاعدة يرفض الكتابة).
 * ويقرأ بلاغَ «لم تنعقد» (`offDay`) والإجازةَ العامة (`holiday`) لليوم، ويعتمد البلاغَ أو يرفضه (`reviewOffDay`) —
 * بلاغ 2026-10-30. وحفظُ الحضور ليومٍ فيه بلاغٌ معلّق أو مرفوض يمحو البلاغَ بحارس القاعدة.
 */
export type AbsenceKind = 'excused' | 'unexcused'
export type AttendanceChoice = 'present' | AbsenceKind
export interface DaySummary { present: number, excused: number, unexcused: number }

/** ملخّصُ اليوم لمن في القائمة وحدَهم: غيابُ مَن خرج من الحلقة لا يُحسب، والباقي حاضر. */
export function summarizeDay(students: { id: string }[], absences: Record<string, AbsenceKind>): DaySummary {
  const summary: DaySummary = { present: 0, excused: 0, unexcused: 0 }
  for (const s of students) {
    const kind = absences[s.id]
    if (kind) summary[kind]++
    else summary.present++
  }
  return summary
}

/**
 * الفرقُ بين المحفوظ والمسوّدة لطلاب القائمة: مَن صار حاضراً (يُحذف غيابُه) ومَن غاب أو تبدّل نوعُ غيابه
 * (يُكتب). طالبٌ خارج القائمة لا يُمسّ. نقيّ ومختبَر.
 */
export function absenceDiff(saved: Record<string, AbsenceKind>, draft: Record<string, AbsenceKind>, studentIds: string[]) {
  const remove: string[] = []
  const upsert: { student_id: string, kind: AbsenceKind }[] = []
  for (const id of studentIds) {
    const before = saved[id]
    const after = draft[id]
    if (before === after) continue
    if (!after) remove.push(id)
    else upsert.push({ student_id: id, kind: after })
  }
  return { remove, upsert }
}

/** بلاغُ يومٍ كما تعرضه الشاشة. */
export type DayOffReport = OffDay & { id: string, reporterName: string | null, reportedAt: string }

/** صفُّ `attendance_off_days` مع اسم المبلِّغ (join على `reported_by`). */
export interface OffDayRow {
  id: string
  reason: string
  note: string | null
  status: string
  review_note: string | null
  reported_at: string
  reporter: { full_name: string } | null
}

/** صفُّ القاعدة ← بلاغٌ معروض، أو `null` إن غاب الصفُّ أو جاءت قيمةٌ لا يعرفها التطبيق (لا يُعرض نصفُ بلاغ). */
export function parseOffDayRow(row: OffDayRow | null | undefined): DayOffReport | null {
  if (!row) return null
  const status = asOffStatus(row.status)
  if (!status || !(row.reason in OFF_REASON_LABELS)) return null
  return {
    id: row.id,
    reason: row.reason as OffReason,
    note: row.note,
    status,
    reviewNote: row.review_note,
    reporterName: row.reporter?.full_name ?? null,
    reportedAt: row.reported_at
  }
}

/** هل يمحو «حفظ الحضور» بلاغاً قائماً؟ المعلّقُ والمرفوضُ يُمحيان بالحارس، والمعتمَدُ يمنع الحفظ أصلاً. */
export function saveWouldRemoveReport(off: Pick<OffDay, 'status'> | null): boolean {
  return off?.status === 'pending' || off?.status === 'rejected'
}

export function useAttendanceDay(halaqaId: Ref<string | null>, day: Ref<string>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const { blockIfReadOnly } = useImpersonation()
  const held = ref(false)
  const absences = ref<Record<string, AbsenceKind>>({})
  const locked = ref(false)
  const offDay = ref<DayOffReport | null>(null)
  const holiday = ref<string | null>(null)
  const reviewing = ref(false)
  const loading = ref(false)
  // آخرُ قراءةٍ تغلب ما سبقها: تبديلُ اليوم أو الحلقة بسرعةٍ لا يُظهر نتيجةَ طلبٍ قديم
  let generation = 0
  // الكتاباتُ تُسلسَل كي لا يسبق طلبٌ لاحقٌ سابقَه على الطالب نفسه
  let writes: Promise<unknown> = Promise.resolve()

  async function load() {
    const hid = halaqaId.value
    const d = day.value
    const mine = ++generation
    if (!hid || !d) {
      held.value = false
      absences.value = {}
      locked.value = false
      offDay.value = null
      holiday.value = null
      return
    }
    // بلاغُ اليوم السابق وإجازتُه لا يبقيان أثناء القراءة: لا يُعتمد بلاغٌ بمعرّفٍ قديم بعد تبديل اليوم أو الحلقة
    offDay.value = null
    holiday.value = null
    loading.value = true
    try {
      const [dayRow, absenceRows, approved, offRow, holidayRow] = await Promise.all([
        supabase.from('attendance_days').select('day').eq('halaqa_id', hid).eq('day', d).maybeSingle(),
        supabase.from('attendance_absences').select('student_id, kind').eq('halaqa_id', hid).eq('day', d),
        supabase.from('monthly_reports').select('id').eq('halaqa_id', hid)
          .eq('report_month', Number(d.slice(5, 7))).eq('report_year', Number(d.slice(0, 4)))
          .eq('status', 'approved').limit(1),
        supabase.from('attendance_off_days')
          .select('id, reason, note, status, review_note, reported_at, reporter:profiles!attendance_off_days_reported_by_fkey(full_name)')
          .eq('halaqa_id', hid).eq('day', d).maybeSingle(),
        supabase.from('attendance_holidays').select('reason').eq('day', d).maybeSingle()
      ])
      const failure = dayRow.error ?? absenceRows.error ?? approved.error ?? offRow.error ?? holidayRow.error
      if (failure) throw failure
      if (mine !== generation) return
      held.value = !!dayRow.data
      absences.value = Object.fromEntries((absenceRows.data ?? []).map(r => [r.student_id, r.kind as AbsenceKind]))
      locked.value = (approved.data?.length ?? 0) > 0
      offDay.value = parseOffDayRow(offRow.data)
      holiday.value = holidayRow.data?.reason ?? null
    } catch (err) {
      if (mine === generation) handle(err)
    } finally {
      if (mine === generation) loading.value = false
    }
  }

  /** يسلسل الكتابة، وعند الفشل يعرض الخطأ ثم يعيد قراءة اليوم (فقد يكون الشهرُ اعتُمد في الأثناء). */
  function write(run: () => PromiseLike<{ error: unknown }>): Promise<boolean> {
    const result = writes.then(async () => {
      try {
        // نيابةُ القراءة: الحذفُ الذي لا يطابق صفّاً يعود نجاحاً صامتاً — فيُرفض قبل الإرسال
        blockIfReadOnly()
        const { error } = await run()
        if (error) throw error
        return true
      } catch (err) {
        handle(err)
        await load()
        return false
      }
    })
    writes = result
    return result
  }

  // المسوّدة: تتغيّر بالنقر ولا تُكتب إلا بـ«حفظ الحضور» (طلب المستخدم 2026-10-21)، وتعود إلى المحفوظ بكلّ قراءة
  const draft = ref<Record<string, AbsenceKind>>({})
  watch(absences, (saved) => {
    draft.value = { ...saved }
  }, { immediate: true })
  const saving = ref(false)

  /** يضبط حالة طالبٍ في المسوّدة وحدها. */
  function setDraft(studentId: string, kind: AttendanceChoice) {
    const { [studentId]: _removed, ...others } = draft.value
    draft.value = kind === 'present' ? others : { ...others, [studentId]: kind }
  }

  /** هل في المسوّدة تعديلٌ لم يُحفظ لطلاب القائمة (للتنبيه قبل المغادرة). */
  function isDirty(studentIds: string[]): boolean {
    const d = absenceDiff(absences.value, draft.value, studentIds)
    return d.remove.length + d.upsert.length > 0
  }

  /**
   * «حفظ الحضور»: يفتح اليوم إن لم يُسجَّل (فتنعقد الحلقة به — لا زرَّ منفصلاً)، ثم يحذف غيابَ مَن صار حاضراً
   * ويكتب الغائبين — كلٌّ بطلبٍ واحد. الفاشلُ يعيد قراءةَ اليوم من القاعدة.
   */
  async function save(studentIds: string[]): Promise<boolean> {
    const hid = halaqaId.value
    if (!hid || locked.value) return false
    const d = day.value
    const diff = absenceDiff(absences.value, draft.value, studentIds)
    saving.value = true
    try {
      const steps: (() => PromiseLike<{ error: unknown }>)[] = []
      if (!held.value) steps.push(() => supabase.from('attendance_days').upsert({ halaqa_id: hid, day: d }, { onConflict: 'halaqa_id,day', ignoreDuplicates: true }))
      if (diff.remove.length) steps.push(() => supabase.from('attendance_absences').delete().eq('day', d).in('student_id', diff.remove))
      if (diff.upsert.length) {
        steps.push(() => supabase.from('attendance_absences')
          .upsert(diff.upsert.map(r => ({ halaqa_id: hid, day: d, student_id: r.student_id, kind: r.kind })), { onConflict: 'day,student_id' }))
      }
      for (const step of steps) {
        if (!await write(step)) return false
      }
      if (hid === halaqaId.value && d === day.value) {
        held.value = true
        absences.value = { ...draft.value }
        // الحارسُ في القاعدة محا البلاغَ المعلّق أو المرفوض مع تسجيل الحضور
        offDay.value = null
      }
      return true
    } finally {
      saving.value = false
    }
  }

  /** يلغي حضورَ اليوم (سُجّل خطأً: لم تنعقد الحلقة) فتُحذف غياباتُه تتابعاً؛ التأكيدُ في الشاشة. */
  async function cancelDay(): Promise<boolean> {
    const hid = halaqaId.value
    if (!hid || locked.value || !held.value) return false
    const d = day.value
    const ok = await write(() => supabase.from('attendance_days').delete().eq('halaqa_id', hid).eq('day', d))
    if (ok && hid === halaqaId.value && d === day.value) {
      held.value = false
      absences.value = {}
    }
    return ok
  }

  /**
   * اعتمادُ البلاغ أو رفضُه (`review_off_day`): الخادمُ يفحص الدورَ والنطاق، وبعد النجاح يُعاد قراءةُ اليوم.
   * `note` سببُ الرفض (اختياريّ، يراه المعلّم) ويُهمَل مع القبول.
   */
  async function reviewOffDay(approve: boolean, note: string | null): Promise<boolean> {
    const off = offDay.value
    if (!off || loading.value) return false
    reviewing.value = true
    try {
      const reason = approve ? undefined : note?.trim() || undefined
      const ok = await write(() => supabase.rpc('review_off_day', { p_id: off.id, p_approve: approve, p_note: reason }))
      if (ok) await load()
      return ok
    } finally {
      reviewing.value = false
    }
  }

  return { held, absences, draft, locked, loading, saving, offDay, holiday, reviewing, load, setDraft, isDirty, save, cancelDay, reviewOffDay }
}
