/**
 * نسخةُ الجهاز لحضور المعلّم (البند 14 — نمطُ الصحابة، 2026-10-26): حلقتُه وطلابُها النشطون وآخرُ `MIRROR_DAYS` يوماً
 * من الحضور والشهورُ المعتمَدة — تُقرأ من القاعدة حين الاتصال وتُحفظ في IndexedDB، فتُفتح الشاشةُ بلا إنترنت منها.
 * و`meta.current` آخرُ معلّمٍ فتحها على هذا الجهاز: بلا شبكةٍ قد لا تُعرف الجلسةُ، فيُقلع عليه.
 */
import type { Database } from '~/types/database.types'
import { MIRROR_DAYS } from '~/constants/offline'
import type { AbsenceKind } from '~/composables/useAttendanceDay'
import type { MirrorDay } from '~/utils/attendanceOutbox'
import { idbGet, idbPut } from '~/utils/offlineDb'

export type MirrorStudent = { id: string, full_name: string, enrollment_date: string | null }

export interface AttendanceMirror {
  uid: string
  fullName: string
  halaqa: { id: string, name: string, gender: string | null } | null
  students: MirrorStudent[]
  days: Record<string, MirrorDay>
  /** شهورٌ رصدُها معتمَد (`YYYY-MM`) — أيامُها للقراءة. */
  approvedMonths: string[]
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
      if (halaqa) {
        const from = mirrorFrom(today, projectStart)
        const [st, ds, ab, rp] = await Promise.all([
          supabase.from('students').select('id, full_name, enrollment_date').eq('halaqa_id', halaqa.id).eq('status', 'active').order('full_name'),
          supabase.from('attendance_days').select('day').eq('halaqa_id', halaqa.id).gte('day', from),
          supabase.from('attendance_absences').select('day, student_id, kind').eq('halaqa_id', halaqa.id).gte('day', from),
          supabase.from('monthly_reports').select('report_year, report_month').eq('halaqa_id', halaqa.id).eq('status', 'approved')
        ])
        const failure = st.error ?? ds.error ?? ab.error ?? rp.error
        if (failure) throw failure
        students = st.data ?? []
        days = buildMirrorDays(ds.data ?? [], ab.data ?? [])
        approvedMonths = (rp.data ?? []).map(r => `${r.report_year}-${String(r.report_month).padStart(2, '0')}`)
      }
      const next: AttendanceMirror = { uid, fullName, halaqa: halaqa ?? null, students, days, approvedMonths, syncedAt: new Date().toISOString() }
      await idbPut('mirror', next)
      await idbPut('meta', uid, 'current')
      mirror.value = next
      return next
    } finally {
      refreshing.value = false
    }
  }

  /** يومٌ أقدمُ من النسخة يُقرأ من القاعدة عند الطلب (متّصلاً) ويُضاف إليها. */
  async function loadDay(halaqaId: string, day: string) {
    const [ds, ab] = await Promise.all([
      supabase.from('attendance_days').select('day').eq('halaqa_id', halaqaId).eq('day', day),
      supabase.from('attendance_absences').select('day, student_id, kind').eq('halaqa_id', halaqaId).eq('day', day)
    ])
    const failure = ds.error ?? ab.error
    if (failure) throw failure
    await setDay(day, buildMirrorDays(ds.data ?? [], ab.data ?? [])[day] ?? { held: false, absences: {} })
  }

  /** يكتب يوماً رُفع إلى النسخة (بلا انتظار تحديثٍ كامل). */
  async function setDay(day: string, value: MirrorDay) {
    if (!mirror.value) return
    mirror.value = { ...mirror.value, days: { ...mirror.value.days, [day]: value } }
    await idbPut('mirror', mirror.value)
  }

  return { mirror, refreshing, loadLocal, refresh, loadDay, setDay }
}
