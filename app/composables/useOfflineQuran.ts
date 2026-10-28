/**
 * شاشةُ الإنجاز القرآنيّ للمعلّم بلا إنترنت (`/t/quran` — البند 14، نمطُ الصحابة، 2026-10-27): نسخةُ الجهاز للشهرين
 * وصندوقُ الرفع والشهرُ المعروض. الصفوفُ تُبنى كما في الشاشة المتّصلة (`buildStudentRows`) وما ينتظر الرفعَ مدموجٌ
 * فيها. رصدُ الطالب يُحفظ على الجهاز ويُرفع في الخلفية؛ **والإرسالُ للاعتماد متّصلاً وحده** وبعد رفع كلّ السجلّات.
 */
import type { Database } from '~/types/database.types'
import { prorationApplies } from '~/constants/quran'
import { buildStudentRows } from '~/utils/quran/month'
import type { Period, RecordInput } from '~/utils/quran/screen'
import { canEditMonth, defaultPeriod, teacherOpeningNote } from '~/utils/quran/screen'
import { syncStatusLine } from '~/utils/attendanceOutbox'
import { QURAN_QUEUE } from '~/utils/offlineQueues'
import { newQuranEntry, offlineSubmitBlock, overlayRecords, recordsCount, type QuranEntry, type QuranMirror } from '~/utils/quranOutbox'
import { isOnlineNow } from '~/utils/reachability'
import { formatDay, gazaToday, isSubmittable, openingDay } from '~/utils/reportWindow'
import { gazaClock12 } from '~/utils/time'

/** الشهرُ الذي تفتح عليه الشاشة من الشهرين المحفوظين (السابقُ ثمّ الجاري): قاعدةُ `defaultPeriod` نفسُها. */
export function offlinePeriod(months: Pick<QuranMirror, 'year' | 'month' | 'inputs'>[], today: string): Period | null {
  if (!months.length) return null
  const previous = months.length > 1 ? months[0]! : null
  const p = defaultPeriod(today, { previousStatus: previous ? (previous.inputs?.report?.status ?? 'none') : 'none' })
  const found = months.find(m => m.year === p.year && m.month === p.month) ?? months[months.length - 1]!
  return { year: found.year, month: found.month }
}

export function useOfflineQuran() {
  const supabase = useSupabaseClient<Database>()
  const user = useSupabaseUser()
  const { handle } = useErrorHandler()
  const { isReadOnlyNow } = useImpersonation()
  const today = gazaToday()
  const { months, refreshing, loadLocal, refresh, reference } = useQuranMirror()

  const uid = computed(() => months.value[0]?.uid ?? user.value?.sub ?? null)
  const queue = useOfflineQueue<QuranEntry>(QURAN_QUEUE, uid)
  const ready = ref(false)
  /** `teacher` · `other` (متّصلٌ بدورٍ آخر) · `unknown` (لا جلسةَ ولا نسخة). */
  const access = ref<'teacher' | 'other' | 'unknown'>('unknown')

  // ── الشهرُ المعروض: المسوّدةُ السابقةُ المعلّقة وإلا الجاري (كالشاشة المتّصلة)، ومن الشهرين المحفوظين وحدهما ──
  const year = ref(Number(today.slice(0, 4)))
  const month = ref(Number(today.slice(5, 7)))
  let periodPicked = false
  function pickPeriod() {
    const p = offlinePeriod(months.value, today)
    if (periodPicked || !p) return
    periodPicked = true
    year.value = p.year
    month.value = p.month
  }

  async function start() {
    await loadLocal(user.value?.sub ?? null, today)
    await queue.load()
    access.value = months.value.length ? 'teacher' : 'unknown'
    pickPeriod()
    ready.value = true
    await syncFromServer()
  }

  /** متّصلاً: يُعرف الدورُ وتُحدَّث النسخةُ ويُرفع الصندوق — عند الإقلاع، وعند كلّ عودةٍ للاتصال. */
  async function syncFromServer() {
    const me = user.value?.sub ?? uid.value
    if (!me || !isOnlineNow()) return
    const { data } = await supabase.from('profiles').select('role').eq('id', me).maybeSingle()
    if (!data) return
    if (data.role !== 'teacher') {
      access.value = 'other'
      return
    }
    try {
      await refresh(me, today)
      access.value = 'teacher'
      pickPeriod()
      void queue.flush()
    } catch {
      // تعذّر التحديث: تبقى نسخةُ الجهاز كما هي
    }
  }

  watch(() => queue.online.value, (now, before) => {
    if (now && !before && ready.value) void syncFromServer()
  })
  // سجلٌّ رُفع (من هذه الشاشة أو غيرها): الصندوقُ كتبه في النسخة فتُقرأ ثانيةً؛ وبعد آخرِه تُحدَّث من القاعدة (رأسُ الشهر)
  watch(() => queue.lastUploaded.value, async (up) => {
    const me = uid.value
    if (!up || up.entry.uid !== me) return
    await loadLocal(me, today)
    if (!queue.pending.value.length && isOnlineNow()) await refresh(me, today).catch(() => undefined)
  })

  // ── صفوفُ الشهر المعروض ──
  const current = computed(() => months.value.find(m => m.year === year.value && m.month === month.value) ?? null)
  const halaqa = computed(() => current.value?.halaqa ?? months.value[0]?.halaqa ?? null)
  const entriesHere = computed(() => queue.entries.value.filter(e =>
    e.halaqaId === halaqa.value?.id && e.year === year.value && e.month === month.value))
  const pendingHere = computed(() => entriesHere.value.filter(e => e.status === 'pending'))
  const pendingStudents = computed(() => new Set(pendingHere.value.map(e => e.studentId)))
  const rows = computed(() => {
    const inputs = current.value?.inputs
    if (!inputs || !reference.ready.value) return []
    return buildStudentRows({
      ...inputs,
      records: overlayRecords(inputs.records, entriesHere.value),
      prorate: prorationApplies(inputs.year, inputs.month),
      juz: reference.juz.value,
      ayahCountOf: reference.ayahCountOf
    })
  })
  const report = computed(() => current.value?.inputs?.report ?? null)
  const status = computed(() => report.value?.status ?? null)
  /** قبل يوم فتح الشهر لا يُدخل المعلّمُ إنجازَه (قرار المستخدم 2026-10-28) — بتاريخ الجهاز، والقاعدةُ ترفض عند الرفع. */
  const openingNote = computed(() => teacherOpeningNote(year.value, month.value, today))
  const canEdit = computed(() => access.value === 'teacher' && !!halaqa.value
    && canEditMonth({ readOnly: isReadOnlyNow(), isTeacher: true, canApprove: false, status: status.value, beforeOpening: !!openingNote.value }))

  /** رصدُ طالب: على الجهاز فوراً، والرفعُ في الخلفية. */
  async function save(studentId: string, input: RecordInput): Promise<boolean> {
    const hid = halaqa.value?.id
    const me = uid.value
    if (!canEdit.value || !hid || !me) return false
    if (rows.value.find(r => r.studentId === studentId)?.recordedElsewhere) {
      handle(new Error('رُصد هذا الشهرُ للطالب في حلقته السابقة.'))
      return false
    }
    await queue.put(newQuranEntry(me, hid, year.value, month.value, studentId, input))
    return true
  }

  // ── الإرسالُ للاعتماد: متّصلاً وبعد رفع سجلّات الشهر ──
  const submitBlock = computed(() => offlineSubmitBlock({
    online: queue.online.value,
    pending: pendingHere.value.length,
    windowBlock: !isSubmittable(year.value, month.value, today)
      ? `يُرسَل ابتداءً من ${formatDay(openingDay(year.value, month.value))}.`
      : report.value ? null : 'ارصد طالباً واحداً على الأقلّ قبل الإرسال.'
  }))
  async function submit(): Promise<boolean> {
    const me = uid.value
    try {
      if (submitBlock.value) throw new Error(submitBlock.value)
      if (isReadOnlyNow()) throw new Error('هذه الجلسةُ للاطّلاع — لا إرسال.')
      const { data, error } = await supabase.from('monthly_reports').update({ status: 'submitted' })
        .eq('id', report.value!.id).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('لم يتغيّر شيء — قد لا تملك هذه الخطوة.')
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      if (me && isOnlineNow()) await refresh(me, today).catch(() => undefined)
    }
  }

  const syncedAt = computed(() => current.value?.syncedAt
    ? gazaClock12(current.value.syncedAt)
    : null)
  const statusText = computed(() => syncStatusLine({
    online: queue.online.value, pending: queue.pending.value.length, rejected: queue.rejected.value.length,
    syncing: queue.syncing.value, syncedAt: syncedAt.value
  }, recordsCount))
  /** تعثّرت محاولةٌ وستُعاد — فيظهر «أعد المحاولة الآن». */
  const retrying = computed(() => queue.pending.value.some(e => e.attempts > 0))

  return {
    ready, access, months, refreshing, queue, reference, start, today, year, month, current, halaqa, rows, report, status,
    canEdit, openingNote, pendingStudents, save, submitBlock, submit, statusText, retrying
  }
}
