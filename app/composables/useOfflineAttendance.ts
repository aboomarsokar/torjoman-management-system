/**
 * شاشةُ حضور المعلّم بلا إنترنت (`/t` — البند 14، نمطُ الصحابة، 2026-10-26): تجمع نسخةَ الجهاز وصندوقَ الرفع
 * واليومَ المعروض. الإقلاعُ من الجهاز أوّلاً (يعمل بلا شبكة)، ثمّ — إن وُجد اتصال — يُعرف الدورُ وتُحدَّث النسخة
 * ويُرفع الصندوق. والدورُ بلا شبكةٍ يُستدلّ عليه بوجود نسخة معلّمٍ على الجهاز.
 */
import type { Database } from '~/types/database.types'
import { PROJECT_START_DATE } from '~/constants/project'
import type { AttendanceChoice } from '~/composables/useAttendanceDay'
import { absencesFor, effectiveDay, syncStatusLine, type Absences, type OutboxEntry } from '~/utils/attendanceOutbox'
import { attendanceStrip, lastSchoolDays } from '~/utils/attendanceStrip'
import { isOnlineNow } from '~/utils/reachability'
import { gazaToday, isFriday, schoolDayOnOrBefore } from '~/utils/reportWindow'

/** هل في المسوّدة تغييرٌ عن اليوم المعروض لطلاب القائمة. */
export function draftChanged(shown: Absences, draft: Absences, studentIds: string[]): boolean {
  return studentIds.some(id => shown[id] !== draft[id])
}

export function useOfflineAttendance() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const toast = useToast()
  const { isReadOnlyNow } = useImpersonation()
  const { mirror, refreshing, loadLocal, refresh, loadDay } = useOfflineMirror()

  const uid = computed(() => mirror.value?.uid ?? user.value?.sub ?? null)
  const outbox = useAttendanceOutbox(uid)
  // يومٌ رُفع (من هذه الشاشة أو غيرها): الصندوقُ كتبه في نسخة الجهاز، فتُقرأ ثانيةً — ويُخبَر المعلّمُ بمن تُخطّي
  watch(() => outbox.lastUploaded.value, async (up) => {
    const e = up?.entry as OutboxEntry | undefined
    if (!e || e.uid !== uid.value) return
    await loadLocal(e.uid)
    const skipped = (up?.data as { skipped?: string[] } | null)?.skipped ?? []
    if (skipped.length) toast.add({ title: `رُفع حضور ${e.day} — وتُخطّي ${skipped.length} لم يعد في الحلقة.`, color: 'warning', icon: 'i-lucide-info' })
  })

  const ready = ref(false)
  /** `teacher` · `other` (متّصلٌ بدورٍ آخر) · `unknown` (لا جلسةَ ولا نسخة). */
  const access = ref<'teacher' | 'other' | 'unknown'>('unknown')

  async function start() {
    await loadLocal(user.value?.sub ?? null)
    await outbox.load()
    access.value = mirror.value ? 'teacher' : 'unknown'
    ready.value = true
    await syncFromServer()
  }

  /** متّصلاً: يُعرف الدورُ وتُحدَّث النسخةُ ويُرفع الصندوق — عند الإقلاع، وعند كلّ عودةٍ للاتصال. */
  async function syncFromServer() {
    // بلا شبكةٍ عند الإقلاع قد لا تُعرف الجلسةُ بعد عودتها، والنسخةُ تحمل صاحبَها
    const me = user.value?.sub ?? mirror.value?.uid
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

  // عودةُ الاتصال بعد إقلاعٍ منقطع: تحديثُ النسخة ورفعُ الصندوق بلا تحديثٍ للصفحة
  watch(() => outbox.online.value, (now, before) => {
    if (now && !before && ready.value) void syncFromServer()
  })

  // ── اليومُ المعروض ──
  const today = gazaToday()
  const day = ref(schoolDayOnOrBefore(today < PROJECT_START_DATE ? PROJECT_START_DATE : today))
  const halaqaId = computed(() => mirror.value?.halaqa?.id ?? null)
  const students = computed(() => (mirror.value?.students ?? []).filter(s => !s.enrollment_date || s.enrollment_date <= day.value))
  const studentIds = computed(() => students.value.map(s => s.id))
  const entry = computed(() => (halaqaId.value ? outbox.entryFor(halaqaId.value, day.value) : undefined))
  const inMirror = computed(() => !!mirror.value && (day.value in mirror.value.days || (!!mirror.value.from && day.value >= mirror.value.from)))
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
      // يومٌ داخل النسخة غائبٌ عنها = لم يُسجَّل؛ وما قبل أوّلها لا يُعرف (كان يُقاس بأوّل يومٍ مسجَّل فيُخفي الأيامَ غيرَ المسجَّلة)
      dayUnknown.value = day.value < (mirror.value?.from ?? day.value)
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

  const syncedAt = computed(() => mirror.value?.syncedAt
    ? new Date(mirror.value.syncedAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Gaza', hour: '2-digit', minute: '2-digit', hour12: false })
    : null)
  const statusText = computed(() => syncStatusLine({
    online: outbox.online.value, pending: outbox.pending.value.length, rejected: outbox.rejected.value.length,
    syncing: outbox.syncing.value, syncedAt: syncedAt.value
  }))
  /** تعثّرت محاولةٌ وستُعاد — فيظهر «أعد المحاولة الآن» (لا قبلها: الرفعُ تلقائيّ). */
  const retrying = computed(() => outbox.pending.value.some(e => e.attempts > 0))

  // شريطُ آخر 15 يومَ دوام
  const strip = computed(() => attendanceStrip({
    days: lastSchoolDays(today, PROJECT_START_DATE),
    mirror: mirror.value?.days ?? {},
    queued: new Set(outbox.pending.value.filter(e => e.halaqaId === halaqaId.value).map(e => e.day)),
    approvedMonths: mirror.value?.approvedMonths ?? []
  }))

  return {
    ready, access, mirror, refreshing, outbox, start, today, day, students, shown, locked, draft, dirty,
    dayUnknown, canWrite, setChoice, save, statusText, retrying, strip
  }
}
