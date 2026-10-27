/**
 * صناديقُ الرفع بلا إنترنت (البند 14 — نمطُ الصحابة): كلُّ حفظٍ يُكتب على الجهاز أوّلاً ثمّ يُرفع في الخلفية سطراً سطراً.
 * صندوقٌ لكلّ نوع (الحضور، الإنجاز القرآنيّ…) **واحدٌ في التطبيق** — حالتُه على مستوى الوحدة لا المكوّن، فيُرفع من أيّ
 * شاشةٍ مفتوحة (إضافةُ `offline-sync` توقظه عند الإقلاع وعودة الشبكة والعودة للواجهة)، والشاشةُ تقرأ منه. دروسُ الصحابة:
 *   • كلُّ سطرٍ يُرفع وحده — رفضُه (شهرٌ اعتُمد…) يُعلَّم «مرفوضاً» ويمضي الرفعُ إلى غيره.
 *   • الإعادةُ مجدولةٌ بمهلٍ متصاعدة ولا تنفد بعدّاد؛ والمنقطعُ يعيد الفحصَ بلا طلب.
 *   • سطرٌ أُعيد حفظُه أثناء رفع نسخته السابقة لا يُمحى بنجاح القديمة (يُقارَن وقتُ الحفظ).
 * المتصفّحُ وحده (IndexedDB) — والخادمُ لا يحمّل صندوقاً.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import { RETRY_DELAYS_MS } from '~/constants/offline'
import { classifySyncError, nextRetryDelay } from '~/utils/attendanceOutbox'
import { idbDelete, idbGet, idbGetAll, idbPut, type StoreName } from '~/utils/offlineDb'
import { isOnlineNow } from '~/utils/reachability'

export interface QueueEntry {
  key: string
  uid: string
  /** وقتُ الحفظ على الجهاز (ISO). */
  recordedAt: string
  attempts: number
  status: 'pending' | 'rejected'
  error?: string
}

type Client = SupabaseClient<Database>
type UploadResult = { data: unknown, error: { code?: string | null, message?: string | null } | null }

export interface QueueDef<E extends QueueEntry> {
  store: StoreName
  /** يرتّب الرفع (الأقدمُ أوّلاً). */
  order: (a: E, b: E) => number
  upload: (supabase: Client, entry: E) => PromiseLike<UploadResult>
  /** بعد رفعٍ ناجح: يكتب النتيجةَ في نسخة الجهاز — يجري من أيّ شاشة. */
  settle?: (entry: E, data: unknown) => Promise<void>
}

interface QueueState {
  entries: Ref<QueueEntry[]>
  syncing: Ref<boolean>
  /** آخرُ ما رُفع — تراقبه الشاشةُ لتحديث نسختها وإخبار المعلّم. */
  lastUploaded: Ref<{ entry: QueueEntry, data: unknown, at: number } | null>
  flushing: Promise<void> | null
  timer: ReturnType<typeof setTimeout> | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- سجلُّ صناديق بأنواع سطورٍ مختلفة؛ كلُّ صندوقٍ يُقرأ بنوعه عبر `useOfflineQueue<E>`
const defs = new Map<string, QueueDef<any>>()
const states = new Map<string, QueueState>()
/** حكمُ الاتصال الذي تعرضه الشاشات — تحدّثه الإضافةُ وكلُّ محاولة رفع. */
export const queueOnline = ref(true)

export function defineOfflineQueue<E extends QueueEntry>(name: string, def: QueueDef<E>): void {
  defs.set(name, def)
}

export function registeredQueues(): string[] {
  return [...defs.keys()]
}

function stateOf(name: string): QueueState {
  let s = states.get(name)
  if (!s) {
    s = { entries: ref([]), syncing: ref(false), lastUploaded: ref(null), flushing: null, timer: null }
    states.set(name, s)
  }
  return s
}

function defOf(name: string): QueueDef<QueueEntry> {
  const def = defs.get(name)
  if (!def) throw new Error(`صندوقٌ غير معرَّف: ${name}`)
  return def
}

/** يقرأ الصندوقَ من الجهاز (كلَّ أصحابه — الشاشةُ تعرض صاحبَ الجلسة). */
export async function loadQueue(name: string): Promise<void> {
  stateOf(name).entries.value = await idbGetAll<QueueEntry>(defOf(name).store)
}

async function storeEntry(name: string, entry: QueueEntry) {
  await idbPut(defOf(name).store, entry)
  const s = stateOf(name)
  s.entries.value = [...s.entries.value.filter(e => e.key !== entry.key), entry]
}

function schedule(name: string, supabase: Client, ms: number) {
  const s = stateOf(name)
  if (s.timer) clearTimeout(s.timer)
  s.timer = setTimeout(() => void flushQueue(name, supabase), ms)
}

async function runFlush(name: string, supabase: Client) {
  const s = stateOf(name)
  const def = defOf(name)
  queueOnline.value = isOnlineNow()
  if (!queueOnline.value) {
    // منقطع: يُعاد الفحصُ بعد مهلةٍ ولا ينتظر حدثاً قد لا يقع — بلا طلبٍ إلى الخادم
    if (s.entries.value.some(e => e.status === 'pending')) schedule(name, supabase, RETRY_DELAYS_MS[0])
    return
  }
  // لا يُرفع سطرٌ إلا بجلسة صاحبه: بلا جلسةٍ (صفحةُ الدخول) يُنادى بدور anon فيُرفض فيُعلَّم «لم تقبله الإدارة» خطأً
  // (بلاغ المستخدم بلقطة 2026-10-27)، وبجلسة معلّمٍ آخر على الجهاز نفسه تردّه الصلاحيات. الدخولُ يوقظ الصندوق (offline-sync)
  const { data: { session } } = await supabase.auth.getSession()
  const me = session?.user.id
  if (!me) return
  const pending = s.entries.value.filter(e => e.status === 'pending' && e.uid === me)
  s.syncing.value = true
  try {
    for (const entry of [...pending].sort(def.order)) {
      let { data, error } = await def.upload(supabase, entry)
      let kind = error ? classifySyncError(error) : null
      if (kind === 'reauth') {
        await supabase.auth.refreshSession().catch(() => undefined)
        ;({ data, error } = await def.upload(supabase, entry))
        kind = error ? classifySyncError(error) : null
      }
      if (!error) {
        // يُمحى إلا إن أُعيد حفظُه أثناء الرفع (النسخةُ الأحدث تُرفع في دورتها)
        const current = await idbGet<QueueEntry>(def.store, entry.key)
        if (current?.recordedAt === entry.recordedAt) {
          await idbDelete(def.store, entry.key)
          s.entries.value = s.entries.value.filter(e => e.key !== entry.key)
        }
        await def.settle?.(entry, data)
        s.lastUploaded.value = { entry, data, at: Date.now() }
        continue
      }
      if (kind === 'reject') {
        await storeEntry(name, { ...entry, status: 'rejected', error: error.message ?? undefined })
        continue
      }
      // شبكةٌ أو خادم: يُعاد لاحقاً، ويقف الرفعُ الآن (الباقي يمرّ بالشبكة نفسها)
      const attempts = entry.attempts + 1
      await storeEntry(name, { ...entry, attempts })
      queueOnline.value = isOnlineNow()
      schedule(name, supabase, nextRetryDelay(attempts - 1))
      return
    }
  } finally {
    s.syncing.value = false
  }
}

/** يرفع ما في الصندوق — رفعٌ واحدٌ جارٍ لكلّ صندوقٍ في كلّ وقت. */
export function flushQueue(name: string, supabase: Client): Promise<void> {
  const s = stateOf(name)
  if (!s.flushing) {
    s.flushing = runFlush(name, supabase).finally(() => {
      s.flushing = null
    })
  }
  return s.flushing
}

export async function flushAllQueues(supabase: Client): Promise<void> {
  await Promise.all(registeredQueues().map(n => flushQueue(n, supabase)))
}

/** صندوقٌ لصاحب الجلسة في الشاشة: سطورُه، وحفظٌ، وإعادةٌ أو تركٌ للمرفوض. */
export function useOfflineQueue<E extends QueueEntry>(name: string, uid: Ref<string | null>) {
  const supabase = useSupabaseClient<Database>()
  const s = stateOf(name)
  const entries = computed(() => (s.entries.value as E[]).filter(e => e.uid === uid.value))
  const pending = computed(() => entries.value.filter(e => e.status === 'pending'))
  const rejected = computed(() => entries.value.filter(e => e.status === 'rejected'))

  async function put(entry: E) {
    await storeEntry(name, entry)
    void flushQueue(name, supabase)
  }
  async function discard(key: string) {
    await idbDelete(defOf(name).store, key)
    s.entries.value = s.entries.value.filter(e => e.key !== key)
  }
  async function retry(key: string) {
    const entry = s.entries.value.find(e => e.key === key)
    if (!entry) return
    await storeEntry(name, { ...entry, status: 'pending', attempts: 0, error: undefined })
    await flushQueue(name, supabase)
  }

  return {
    entries, pending, rejected, syncing: s.syncing, lastUploaded: s.lastUploaded, online: queueOnline,
    load: () => loadQueue(name), flush: () => flushQueue(name, supabase), put, discard, retry
  }
}
