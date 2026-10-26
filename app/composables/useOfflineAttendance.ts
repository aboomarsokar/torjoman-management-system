/**
 * شاشةُ حضور المعلّم بلا إنترنت (`/t` — البند 14، نمطُ الصحابة، 2026-10-26): تجمع نسخةَ الجهاز وصندوقَ الرفع
 * واليومَ المعروض. الإقلاعُ من الجهاز أوّلاً (يعمل بلا شبكة)، ثمّ — إن وُجد اتصال — يُعرف الدورُ وتُحدَّث النسخة
 * ويُرفع الصندوق. والدورُ بلا شبكةٍ يُستدلّ عليه بوجود نسخة معلّمٍ على الجهاز.
 */
import type { Database } from '~/types/database.types'
import { PROJECT_START_DATE } from '~/constants/project'
import type { AttendanceChoice } from '~/composables/useAttendanceDay'
import { absencesFor, effectiveDay, syncStatusText, type Absences } from '~/utils/attendanceOutbox'
import { isOnlineNow } from '~/utils/reachability'
import { gazaToday, isFriday, schoolDayOnOrBefore } from '~/utils/reportWindow'

/** غياباتٌ بعد حذف من تخطّاهم الرفع (لم يعودوا في الحلقة). */
export function keptAbsences(absences: Absences, skipped: string[]): Absences {
  const drop = new Set(skipped)
  return Object.fromEntries(Object.entries(absences).filter(([id]) => !drop.has(id)))
}

/** هل في المسوّدة تغييرٌ عن اليوم المعروض لطلاب القائمة. */
export function draftChanged(shown: Absences, draft: Absences, studentIds: string[]): boolean {
  return studentIds.some(id => shown[id] !== draft[id])
}

export function useOfflineAttendance() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const toast = useToast()
  const { isReadOnlyNow } = useImpersonation()
  const { mirror, refreshing, loadLocal, refresh, loadDay, setDay } = useOfflineMirror()

  const uid = computed(() => mirror.value?.uid ?? user.value?.sub ?? null)
  const outbox = useAttendanceOutbox(uid, async (entry, skipped) => {
    await setDay(entry.day, { held: true, absences: keptAbsences(entry.absences, skipped) })
    if (skipped.length) toast.add({ title: `رُفع حضور ${entry.day} — وتُخطّي ${skipped.length} لم يعد في الحلقة.`, color: 'warning', icon: 'i-lucide-info' })
  })

  const ready = ref(false)
  /** `teacher` · `other` (متّصلٌ بدورٍ آخر) · `unknown` (لا جلسةَ ولا نسخة). */
  const access = ref<'teacher' | 'other' | 'unknown'>('unknown')

  async function start() {
    await loadLocal(user.value?.sub ?? null)
    await outbox.load()
    access.value = mirror.value ? 'teacher' : 'unknown'
    ready.value = true
    const me = user.value?.sub
    if (!me || !isOnlineNow()) return
    const { data } = await supabase.from('profiles').select('role, full_name').eq('id', me).maybeSingle()
    if (!data) return
    if (data.role !== 'teacher') {
      access.value = 'other'
      return
    }
    try {
      await refresh(me, data.full_name, gazaToday(), PROJECT_START_DATE)
      access.value = 'teacher'
      await outbox.load()
      void outbox.flush()
    } catch {
      // تعذّر التحديث: تبقى نسخةُ الجهاز كما هي
    }
  }

  // ── اليومُ المعروض ──
  const today = gazaToday()
  const day = ref(schoolDayOnOrBefore(today < PROJECT_START_DATE ? PROJECT_START_DATE : today))
  const halaqaId = computed(() => mirror.value?.halaqa?.id ?? null)
  const students = computed(() => (mirror.value?.students ?? []).filter(s => !s.enrollment_date || s.enrollment_date <= day.value))
  const studentIds = computed(() => students.value.map(s => s.id))
  const entry = computed(() => (halaqaId.value ? outbox.entryFor(halaqaId.value, day.value) : undefined))
  const inMirror = computed(() => !!mirror.value && day.value in mirror.value.days)
  const shown = computed(() => effectiveDay(mirror.value?.days[day.value], entry.value))
  const locked = computed(() => !!mirror.value?.approvedMonths.includes(day.value.slice(0, 7)))

  const draft = ref<Absences>({})
  watch([day, () => shown.value.absences], () => {
    draft.value = { ...shown.value.absences }
  }, { immediate: true, deep: true })
  const dirty = computed(() => draftChanged(shown.value.absences, draft.value, studentIds.value))

  // يومٌ خارج النسخة: يُقرأ متّصلاً — وبلا اتصالٍ لا يُعرف أكان مسجَّلاً
  const dayUnknown = ref(false)
  watch([day, halaqaId], async () => {
    dayUnknown.value = false
    if (!halaqaId.value || inMirror.value || entry.value) return
    if (!isOnlineNow()) {
      dayUnknown.value = day.value < (Object.keys(mirror.value?.days ?? {}).sort()[0] ?? day.value)
      return
    }
    await loadDay(halaqaId.value, day.value).catch(() => undefined)
  })

  const canWrite = computed(() => access.value === 'teacher' && !!halaqaId.value && !locked.value
    && !isFriday(day.value) && students.value.length > 0 && !dayUnknown.value && !isReadOnlyNow())

  function setChoice(studentId: string, choice: AttendanceChoice) {
    const { [studentId]: _removed, ...rest } = draft.value
    draft.value = choice === 'present' ? rest : { ...rest, [studentId]: choice }
  }

  /** «حفظ الحضور»: على الجهاز فوراً، والرفعُ في الخلفية. */
  async function save(): Promise<boolean> {
    if (!canWrite.value || !halaqaId.value) return false
    await outbox.enqueue(halaqaId.value, day.value, absencesFor(draft.value, studentIds.value))
    return true
  }

  const statusText = computed(() => syncStatusText(outbox.pending.value.length, outbox.rejected.value.length, outbox.online.value, outbox.syncing.value))

  return {
    ready, access, mirror, refreshing, outbox, start, today, day, students, shown, locked, draft, dirty,
    dayUnknown, canWrite, setChoice, save, statusText
  }
}
