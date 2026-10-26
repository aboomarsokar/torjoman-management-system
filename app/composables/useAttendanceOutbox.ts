/**
 * صندوقُ رفع الحضور (البند 14 — نمطُ الصحابة، 2026-10-26): «حفظ الحضور» يُكتب على الجهاز أوّلاً ثمّ يُرفع في الخلفية،
 * يوماً يوماً بنداءٍ واحد (`save_attendance_day`). دروسُ الصحابة فيه:
 *   • كلُّ يومٍ يُرفع وحده — رفضُ يومٍ (شهرٌ اعتُمد، جمعة) يُعلَّم «مرفوضاً» ويمضي الرفعُ إلى غيره.
 *   • الإعادةُ مجدولةٌ بمهلٍ متصاعدة ولا تنتظر فعلَ المعلّم، ولا تنفد بعدّاد؛ وتوقظها عودةُ الشبكة وعودةُ التطبيق للواجهة.
 *   • يومٌ أُعيد حفظُه أثناء رفع نسخته السابقة لا يُمحى بنجاح القديمة (يُقارَن وقتُ الحفظ).
 */
import type { Database } from '~/types/database.types'
import { classifySyncError, newEntry, nextRetryDelay, type Absences, type OutboxEntry } from '~/utils/attendanceOutbox'
import { idbDelete, idbGet, idbGetAll, idbPut } from '~/utils/offlineDb'
import { RETRY_DELAYS_MS } from '~/constants/offline'
import { isOnlineNow, noteNetworkSuccess } from '~/utils/reachability'

export type UploadedHandler = (entry: OutboxEntry, skipped: string[]) => Promise<void> | void

export function useAttendanceOutbox(uid: Ref<string | null>, onUploaded: UploadedHandler) {
  const supabase = useSupabaseClient<Database>()
  const entries = ref<OutboxEntry[]>([])
  const syncing = ref(false)
  const online = ref(isOnlineNow())
  let timer: ReturnType<typeof setTimeout> | null = null
  let flushing: Promise<void> | null = null

  const pending = computed(() => entries.value.filter(e => e.status === 'pending'))
  const rejected = computed(() => entries.value.filter(e => e.status === 'rejected'))
  const entryFor = (halaqaId: string, day: string) => entries.value.find(e => e.halaqaId === halaqaId && e.day === day)

  async function load() {
    const me = uid.value
    entries.value = me ? (await idbGetAll<OutboxEntry>('outbox')).filter(e => e.uid === me) : []
  }

  function replace(entry: OutboxEntry) {
    entries.value = [...entries.value.filter(e => e.key !== entry.key), entry]
  }

  async function store(entry: OutboxEntry) {
    await idbPut('outbox', entry)
    replace(entry)
  }

  /** «حفظ الحضور»: على الجهاز فوراً، ثمّ محاولةُ رفع. */
  async function enqueue(halaqaId: string, day: string, absences: Absences): Promise<OutboxEntry> {
    if (!uid.value) throw new Error('لا جلسةَ معلّمٍ على هذا الجهاز.')
    const entry = newEntry(uid.value, halaqaId, day, absences)
    await store(entry)
    void flush()
    return entry
  }

  function schedule(ms: number) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), ms)
  }

  async function upload(entry: OutboxEntry) {
    return supabase.rpc('save_attendance_day', {
      p_halaqa: entry.halaqaId, p_day: entry.day, p_absences: entry.absences, p_recorded_at: entry.recordedAt
    })
  }

  /** يُتمّ يوماً رُفع: يُمحى من الصندوق إلا إن أُعيد حفظُه أثناء الرفع. */
  async function settle(entry: OutboxEntry, skipped: string[]) {
    const current = await idbGet<OutboxEntry>('outbox', entry.key)
    if (current?.recordedAt === entry.recordedAt) {
      await idbDelete('outbox', entry.key)
      entries.value = entries.value.filter(e => e.key !== entry.key)
    }
    await onUploaded(entry, skipped)
  }

  async function runFlush() {
    online.value = isOnlineNow()
    if (!online.value) {
      // منقطع: يُعاد الفحصُ بعد مهلةٍ ولا ينتظر حدثاً قد لا يقع (عودةُ الشبكة لا تُعلَن دائماً) — بلا طلبٍ إلى الخادم
      if (pending.value.length) schedule(RETRY_DELAYS_MS[0])
      return
    }
    syncing.value = true
    try {
      // الأقدمُ يوماً أوّلاً
      for (const entry of [...pending.value].sort((a, b) => a.day.localeCompare(b.day))) {
        let { data, error } = await upload(entry)
        let kind = error ? classifySyncError(error) : null
        if (kind === 'reauth') {
          await supabase.auth.refreshSession().catch(() => undefined)
          ;({ data, error } = await upload(entry))
          kind = error ? classifySyncError(error) : null
        }
        if (!error) {
          const skipped = ((data as { skipped?: string[] } | null)?.skipped) ?? []
          await settle(entry, skipped)
          continue
        }
        if (kind === 'reject') {
          await store({ ...entry, status: 'rejected', error: error.message })
          continue
        }
        // شبكةٌ أو خادم: يُعاد لاحقاً، ويقف الرفعُ الآن (الباقي يمرّ بالشبكة نفسها)
        const attempts = entry.attempts + 1
        await store({ ...entry, attempts })
        online.value = isOnlineNow()
        schedule(nextRetryDelay(attempts - 1))
        return
      }
    } finally {
      syncing.value = false
    }
  }

  /** يرفع ما في الصندوق — نداءٌ واحدٌ جارٍ في كلّ وقت. */
  function flush(): Promise<void> {
    if (!flushing) {
      flushing = runFlush().finally(() => {
        flushing = null
      })
    }
    return flushing
  }

  /** يومٌ مرفوض: يُترك (يعود اليومُ كما في القاعدة) — أو يُعاد رفعُه بعد أن تفتح الإدارةُ الشهر. */
  async function discard(key: string) {
    await idbDelete('outbox', key)
    entries.value = entries.value.filter(e => e.key !== key)
  }
  async function retry(key: string) {
    const entry = entries.value.find(e => e.key === key)
    if (!entry) return
    await store({ ...entry, status: 'pending', attempts: 0, error: undefined })
    await flush()
  }

  const wake = () => {
    online.value = isOnlineNow()
    if (pending.value.length) void flush()
  }
  // النظامُ أعلن عودةَ الشبكة: يُمحى أثرُ فشل الانقطاع فوراً (كان يحجب الرفعَ ثلاثين ثانيةً بعد العودة، ولا موعدَ
  // يعيده — فيبقى «بانتظار الاتصال» حتى تحديث الصفحة؛ بلاغُ المستخدم 2026-10-26)
  const onOnline = () => {
    noteNetworkSuccess()
    wake()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') wake()
  }
  const onOffline = () => {
    online.value = false
  }
  onMounted(() => {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
    if (timer) clearTimeout(timer)
  })

  return { entries, pending, rejected, syncing, online, entryFor, load, enqueue, flush, discard, retry }
}
