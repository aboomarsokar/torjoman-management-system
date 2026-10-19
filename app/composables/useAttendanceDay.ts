import type { Ref } from 'vue'
import type { Database } from '~/types/database.types'

/**
 * حضورُ يومٍ واحدٍ لحلقة: الحضورُ هو الأصل، فيومُ الحلقة المفتوح = الجميع حاضر،
 * والغياباتُ وحدها (بعذر / بلا عذر) تُسجَّل. الحفظُ فوريٌّ؛ والفاشلُ يُعيد قراءةَ اليوم من القاعدة
 * فلا تبقى الشاشةُ على حالٍ لم تُحفظ. `locked` = رصدُ شهر اليوم معتمَد (الحارس في القاعدة يرفض الكتابة).
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

export function useAttendanceDay(halaqaId: Ref<string | null>, day: Ref<string>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
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

  /** يفتح يومَ الحلقة (الجميع حاضر) أو يلغيه فتُحذف غياباتُه تتابعاً؛ التأكيدُ قبل الإلغاء في الشاشة. */
  async function setHeld(on: boolean): Promise<boolean> {
    const hid = halaqaId.value
    if (!hid || locked.value || held.value === on) return false
    const d = day.value
    const ok = await write(() => on
      ? supabase.from('attendance_days').upsert({ halaqa_id: hid, day: d }, { onConflict: 'halaqa_id,day', ignoreDuplicates: true })
      : supabase.from('attendance_days').delete().eq('halaqa_id', hid).eq('day', d))
    if (ok && hid === halaqaId.value && d === day.value) {
      held.value = on
      if (!on) absences.value = {}
    }
    return ok
  }

  /** يضبط حالة طالبٍ في اليوم المفتوح: الحاضرُ يمحو سطرَ الغياب، والغائبُ يكتبه أو يبدّل نوعَه. */
  async function setAbsence(studentId: string, kind: AttendanceChoice): Promise<boolean> {
    const hid = halaqaId.value
    if (!hid || locked.value || !held.value) return false
    const d = day.value
    const before = absences.value[studentId]
    if ((kind === 'present' ? undefined : kind) === before) return true
    const { [studentId]: _removed, ...others } = absences.value
    absences.value = kind === 'present' ? others : { ...others, [studentId]: kind }
    return write(() => kind === 'present'
      ? supabase.from('attendance_absences').delete().eq('day', d).eq('student_id', studentId)
      : supabase.from('attendance_absences').upsert({ halaqa_id: hid, day: d, student_id: studentId, kind }, { onConflict: 'day,student_id' }))
  }

  return { held, absences, locked, loading, load, setHeld, setAbsence }
}
