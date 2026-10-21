import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'

/**
 * حضورُ يومٍ واحدٍ لحلقة: الحضورُ هو الأصل، والغياباتُ وحدها (بعذر / بلا عذر) تُسجَّل. التعديلُ في مسوّدةٍ
 * على الشاشة، و«حفظ الحضور» يكتبها ويفتح اليومَ إن لم يُسجَّل — فالحلقةُ «انعقدت» إذا سُجّل حضورُها، ولا زرَّ
 * منفصلاً (طلب المستخدم 2026-10-21). الفاشلُ يُعيد قراءةَ اليوم من القاعدة.
 * `locked` = رصدُ شهر اليوم معتمَد (الحارس في القاعدة يرفض الكتابة).
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

export function useAttendanceDay(halaqaId: Ref<string | null>, day: Ref<string>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const { blockIfReadOnly } = useImpersonation()
  const held = ref(false)
  const absences = ref<Record<string, AbsenceKind>>({})
  const locked = ref(false)
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
      return
    }
    loading.value = true
    try {
      const [dayRow, absenceRows, approved] = await Promise.all([
        supabase.from('attendance_days').select('day').eq('halaqa_id', hid).eq('day', d).maybeSingle(),
        supabase.from('attendance_absences').select('student_id, kind').eq('halaqa_id', hid).eq('day', d),
        supabase.from('monthly_reports').select('id').eq('halaqa_id', hid)
          .eq('report_month', Number(d.slice(5, 7))).eq('report_year', Number(d.slice(0, 4)))
          .eq('status', 'approved').limit(1)
      ])
      const failure = dayRow.error ?? absenceRows.error ?? approved.error
      if (failure) throw failure
      if (mine !== generation) return
      held.value = !!dayRow.data
      absences.value = Object.fromEntries((absenceRows.data ?? []).map(r => [r.student_id, r.kind as AbsenceKind]))
      locked.value = (approved.data?.length ?? 0) > 0
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

  return { held, absences, draft, locked, loading, saving, load, setDraft, isDirty, save, cancelDay }
}
