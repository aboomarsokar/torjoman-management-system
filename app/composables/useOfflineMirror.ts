/**
 * نسخةُ الجهاز لحضور المعلّم (البند 14 — نمطُ الصحابة، 2026-10-26): حلقتُه وطلابُها النشطون وآخرُ `MIRROR_DAYS` يوماً
 * من الحضور والشهورُ المعتمَدة — تُقرأ من القاعدة حين الاتصال وتُحفظ في IndexedDB، فتُفتح الشاشةُ بلا إنترنت منها.
 * و`meta.current` آخرُ معلّمٍ فتحها على هذا الجهاز: بلا شبكةٍ قد لا تُعرف الجلسةُ، فيُقلع عليه.
 */
import type { Database } from '~/types/database.types'
import { MIRROR_DAYS } from '~/constants/offline'
import type { AbsenceKind } from '~/composables/useAttendanceDay'
import type { MirrorDay } from '~/utils/attendanceOutbox'
import { OFF_REASONS, OFF_STATUSES, type OffDay, type OffReason, type OffStatus } from '~/utils/offDays'
import { idbGet, idbPut } from '~/utils/offlineDb'
import { withoutKey } from '~/utils/withoutKey'

export type MirrorStudent = { id: string, full_name: string, enrollment_date: string | null }

export interface AttendanceMirror {
  uid: string
  fullName: string
  halaqa: { id: string, name: string, gender: string | null } | null
  students: MirrorStudent[]
  days: Record<string, MirrorDay>
  /** أوّلُ يومٍ في النسخة — ما قبله لا يُعرف بلا اتصال، وما بعده يومٌ غائبٌ عنها لم يُسجَّل. */
  from: string
  /** شهورٌ رصدُها معتمَد (`YYYY-MM`) — أيامُها للقراءة. */
  approvedMonths: string[]
  /** بلاغاتُ «لم تنعقد» المرفوعة بمفتاح اليوم — الغائبُ (نسخةُ جهازٍ قديمة) = لا بلاغات. */
  offDays?: Record<string, OffDay>
  /** الإجازاتُ العامة (يوم ← سبب) من `from` بلا حدٍّ أعلى — الغائبُ = لا إجازات. */
  holidays?: Record<string, string>
  /** آخرُ تحديثٍ من القاعدة (ISO). */
  syncedAt: string
}

/** أوّلُ يومٍ يُنسخ: قبل `MIRROR_DAYS` يوماً، ولا قبل بداية المشروع. */
export function mirrorFrom(today: string, projectStart: string): string {
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - MIRROR_DAYS)
  const from = d.toISOString().slice(0, 10)
  return from < projectStart ? projectStart : from
}

/** يبني أيامَ النسخة من صفوف القاعدة. */
export function buildMirrorDays(days: { day: string }[], absences: { day: string, student_id: string, kind: string }[]): Record<string, MirrorDay> {
  const out: Record<string, MirrorDay> = Object.fromEntries(days.map(d => [d.day, { held: true, absences: {} }]))
  for (const a of absences) {
    const day = out[a.day] ?? (out[a.day] = { held: true, absences: {} })
    day.absences[a.student_id] = a.kind as AbsenceKind
  }
  return out
}

/** يبني بلاغاتِ النسخة من صفوف القاعدة؛ صفٌّ بسببٍ أو حالةٍ غير معروفين يُسقط (لا يُعرض ما لا تفهمه الشاشة). */
export function buildOffDays(rows: { day: string, reason: string, note: string | null, status: string, review_note: string | null }[]): Record<string, OffDay> {
  const out: Record<string, OffDay> = {}
  for (const r of rows) {
    if (!(OFF_REASONS as readonly string[]).includes(r.reason) || !(OFF_STATUSES as readonly string[]).includes(r.status)) continue
    out[r.day] = { reason: r.reason as OffReason, note: r.note, status: r.status as OffStatus, reviewNote: r.review_note }
  }
  return out
}

/** يبني إجازاتِ النسخة (يوم ← سبب) من صفوف القاعدة. */
export function buildHolidays(rows: { day: string, reason: string }[]): Record<string, string> {
  return Object.fromEntries(rows.map(r => [r.day, r.reason]))
}

export function useOfflineMirror() {
  const supabase = useSupabaseClient<Database>()
  const mirror = ref<AttendanceMirror | null>(null)
  const refreshing = ref(false)

  /** النسخةُ المحفوظة لهذا المعلّم — أو لآخر معلّمٍ فتح الشاشة إن لم تُعرف الجلسة. */
  async function loadLocal(uid: string | null): Promise<AttendanceMirror | null> {
    const id = uid ?? await idbGet<string>('meta', 'current') ?? null
    mirror.value = id ? (await idbGet<AttendanceMirror>('mirror', id)) ?? null : null
    return mirror.value
  }

  /** يحدّث النسخةَ من القاعدة ويحفظها — يرمي عند الفشل (يبقى المحفوظ). */
  async function refresh(uid: string, fullName: string, today: string, projectStart: string): Promise<AttendanceMirror> {
    refreshing.value = true
    try {
      const { data: halaqa, error: hErr } = await supabase.from('halaqat').select('id, name, gender')
        .eq('teacher_id', uid).limit(1).maybeSingle()
      if (hErr) throw hErr
      let students: MirrorStudent[] = []
      let days: Record<string, MirrorDay> = {}
      let approvedMonths: string[] = []
      let offDays: Record<string, OffDay> = {}
      let holidays: Record<string, string> = {}
      const from = mirrorFrom(today, projectStart)
      if (halaqa) {
        const [st, ds, ab, rp, od, hl] = await Promise.all([
          supabase.from('students').select('id, full_name, enrollment_date').eq('halaqa_id', halaqa.id).eq('status', 'active').order('full_name'),
          supabase.from('attendance_days').select('day').eq('halaqa_id', halaqa.id).gte('day', from),
          supabase.from('attendance_absences').select('day, student_id, kind').eq('halaqa_id', halaqa.id).gte('day', from),
          supabase.from('monthly_reports').select('report_year, report_month').eq('halaqa_id', halaqa.id).eq('status', 'approved'),
          supabase.from('attendance_off_days').select('day, reason, note, status, review_note').eq('halaqa_id', halaqa.id).gte('day', from),
          // الإجازاتُ بلا حدٍّ أعلى: إجازةٌ مُعلَنةٌ لما بعد اليوم تظهر بلا اتصال
          supabase.from('attendance_holidays').select('day, reason').gte('day', from)
        ])
        const failure = st.error ?? ds.error ?? ab.error ?? rp.error ?? od.error ?? hl.error
        if (failure) throw failure
        students = st.data ?? []
        days = buildMirrorDays(ds.data ?? [], ab.data ?? [])
        approvedMonths = (rp.data ?? []).map(r => `${r.report_year}-${String(r.report_month).padStart(2, '0')}`)
        offDays = buildOffDays(od.data ?? [])
        holidays = buildHolidays(hl.data ?? [])
      }
      const next: AttendanceMirror = { uid, fullName, halaqa: halaqa ?? null, students, days, from, approvedMonths, offDays, holidays, syncedAt: new Date().toISOString() }
      await idbPut('mirror', next)
      await idbPut('meta', uid, 'current')
      mirror.value = next
      return next
    } finally {
      refreshing.value = false
    }
  }

  /** يومٌ أقدمُ من النسخة يُقرأ من القاعدة عند الطلب (متّصلاً) ويُضاف إليها، ومعه بلاغُه وإجازتُه إن وُجدا. */
  async function loadDay(halaqaId: string, day: string) {
    const [ds, ab, od, hl] = await Promise.all([
      supabase.from('attendance_days').select('day').eq('halaqa_id', halaqaId).eq('day', day),
      supabase.from('attendance_absences').select('day, student_id, kind').eq('halaqa_id', halaqaId).eq('day', day),
      supabase.from('attendance_off_days').select('day, reason, note, status, review_note').eq('halaqa_id', halaqaId).eq('day', day),
      supabase.from('attendance_holidays').select('day, reason').eq('day', day)
    ])
    const failure = ds.error ?? ab.error ?? od.error ?? hl.error
    if (failure) throw failure
    if (!mirror.value) return
    const offDays = { ...withoutKey(mirror.value.offDays, day), ...buildOffDays(od.data ?? []) }
    const holidays = { ...withoutKey(mirror.value.holidays, day), ...buildHolidays(hl.data ?? []) }
    const value = buildMirrorDays(ds.data ?? [], ab.data ?? [])[day] ?? { held: false, absences: {} }
    mirror.value = { ...mirror.value, days: { ...mirror.value.days, [day]: value }, offDays, holidays }
    await idbPut('mirror', mirror.value)
  }

  return { mirror, refreshing, loadLocal, refresh, loadDay }
}
