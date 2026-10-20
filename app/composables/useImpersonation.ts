/**
 * الدخول بالنيابة في المتصفّح — الحالةُ من الخادم (`GET /api/me/impersonation`) لا من الذاكرة،
 * والبدءُ والإنهاءُ ووضعُ التعديل. منقولٌ من الصحابة ومكيَّف.
 * ⚠️ التبديلُ بـ`refreshSession({ refresh_token })` لا `setSession` (ترمي بلا access_token)، ثم
 * `window.location.replace` — تحميلٌ كامل: الملفُّ وروابطُ الصور الموقَّعة في الذاكرة لصاحب الجلسة السابقة.
 * ⚠️ الخادمُ يُبطل الجلسةَ القديمة قبل التبديل: يُوقَف التجديدُ التلقائيّ ويُرفع علَمُ التبديل كي لا
 * يُطلق رمزٌ مُبطَلٌ SIGNED_OUT فيسوق الوسيطُ إلى /login في الفجوة (markSessionSwitching).
 */
import type { Database } from '~/types/database.types'
import type { ImpersonationStatus } from '~/constants/impersonation'
import {
  IMPERSONATION_BLOCKED_MESSAGE, IMPERSONATION_STATE_KEY, markSessionSwitching, sessionReadOnly, SESSION_SWITCH_FAILED
} from '~/utils/impersonation'
import { PROFILE_PHOTOS_GENERATIONS_KEY, PROFILE_PHOTOS_SIGNED_KEY } from '~/composables/useProfilePhotoUrls'

/** رسالةُ الإنهاء المرفوض (نيابةٌ مختومة، أو فاعلٌ عُطِّل) — يُخرج محلّياً إلى الدخول. */
export const IMPERSONATION_ENDED_RELOGIN = 'انتهت النيابة — سجّل دخولك من جديد.'

/** ردّا مسارَي البدء والإنهاء (server/api/impersonate.post.ts و impersonate/end.post.ts). */
type StartResult = { refreshToken: string, targetName: string, targetHome: string, expiresAt: string }
type EndResult = { ok: true } | { refreshToken: string, returnTo: string }

/** خطوتا التبديل محقونتين — كي تُختبرا بلا Supabase ولا متصفّح. */
export interface SessionSwitchSteps {
  refreshSession: (refreshToken: string) => Promise<{ error: unknown }>
  replace: (to: string) => void
}

/** يبدّل الجلسةَ برمز التحديث ثم يحمّل الوجهة تحميلاً كاملاً؛ ولا تحميلَ إن فشل التبديل. */
export async function applySessionSwitch(refreshToken: string, to: string, steps: SessionSwitchSteps): Promise<void> {
  if (!refreshToken) throw new Error(SESSION_SWITCH_FAILED)
  const { error } = await steps.refreshSession(refreshToken)
  if (error) throw new Error(SESSION_SWITCH_FAILED)
  steps.replace(to)
}

export function applyStart(result: { refreshToken: string, targetHome: string }, steps: SessionSwitchSteps): Promise<void> {
  return applySessionSwitch(result.refreshToken, result.targetHome, steps)
}

/** 401 (نيابةٌ مختومة أو جلسةٌ مُبطَلة) و409 (فاعلٌ عُطِّل) نهائيّان: لا جلسةَ عودة. */
export function endFailureIsTerminal(err: unknown): boolean {
  const e = err as { statusCode?: unknown, status?: unknown, response?: { status?: unknown } } | null
  const status = Number(e?.statusCode ?? e?.status ?? e?.response?.status)
  return status === 401 || status === 409
}

/** طلبُ الفحص الجاري — واحدٌ للصفحة مهما تعدّد السائلون. */
let checking: Promise<void> | null = null

export function useImpersonation() {
  const client = useSupabaseClient<Database>()
  const router = useRouter()
  const toast = useToast()
  const state = useState<ImpersonationStatus | null>(IMPERSONATION_STATE_KEY, () => null)
  const isChecked = useState<boolean>(`${IMPERSONATION_STATE_KEY}-checked`, () => false)

  /** يسأل الخادم؛ تعثّرُ الشبكة لا يُخفي شريطاً ظاهراً (تبقى الحالةُ كما هي). */
  async function refresh(): Promise<void> {
    try {
      const s = await $fetch<ImpersonationStatus | null>('/api/me/impersonation')
      state.value = s && typeof s === 'object' ? s : null
      isChecked.value = true
    } catch (err) {
      console.error('[useImpersonation] تعذّر فحصُ النيابة:', err)
    }
  }

  /** مرّةً في عمر الصفحة (والتحميلُ الكامل يبدأ عمراً جديداً). */
  async function ensureChecked(): Promise<ImpersonationStatus | null> {
    if (!isChecked.value) {
      checking ??= refresh().finally(() => {
        checking = null
      })
      await checking
    }
    return state.value
  }

  const switchSteps: SessionSwitchSteps = {
    refreshSession: async refresh_token => await client.auth.refreshSession({ refresh_token }),
    replace: to => window.location.replace(to)
  }

  /** يُوقف التجديدَ التلقائيّ ويرفع العلَم قبل أن يُبطل الخادمُ الجلسةَ القديمة؛ ويُعيدهما إن تعثّر. */
  async function switching<T>(task: () => Promise<T>): Promise<T> {
    markSessionSwitching(true)
    await client.auth.stopAutoRefresh()
    try {
      return await task()
    } catch (err) {
      markSessionSwitching(false)
      void client.auth.startAutoRefresh()
      throw err
    }
  }

  /** يبدأ النيابة ويبدّل الجلسة ثم يحمّل صفحة الهدف. */
  async function start(profileId: string): Promise<void> {
    const from = router.currentRoute.value.fullPath
    await switching(async () => {
      const result = await $fetch<StartResult>('/api/impersonate', { method: 'POST', body: { profileId, from } })
      await applyStart(result, switchSteps)
    })
  }

  /** خروجٌ محلّيّ إلى الدخول — الحالةُ تُفرَّغ (لا شريطَ لمن يدخل بعده). */
  async function signOutLocally(message: string): Promise<void> {
    await client.auth.signOut({ scope: 'local' })
    state.value = null
    isChecked.value = false
    // روابطُ الصور الموقَّعة لصاحب الجلسة السابقة (تفريغٌ لا محو — انظر useAuth.signOut)
    useState(PROFILE_PHOTOS_SIGNED_KEY).value = {}
    useState(PROFILE_PHOTOS_GENERATIONS_KEY).value = {}
    markSessionSwitching(false)
    toast.add({ title: message, color: 'warning', icon: 'i-lucide-log-out' })
    await navigateTo('/login')
  }

  /**
   * يُنهي النيابة ويعود إلى حساب الفاعل (`returnTo`). `resume: false` خروجٌ بلا عودة (useAuth.signOut).
   * الإنهاءُ المرفوض (401/409) ← خروجٌ محلّيّ إلى الدخول برسالة.
   */
  async function end(opts: { resume?: boolean } = {}): Promise<void> {
    const resume = opts.resume ?? true
    if (!resume) {
      await $fetch('/api/impersonate/end', { method: 'POST', body: { resume: false } })
      return
    }
    try {
      await switching(async () => {
        const result = await $fetch<EndResult>('/api/impersonate/end', { method: 'POST', body: { resume: true } })
        if (!('refreshToken' in result)) throw new Error(SESSION_SWITCH_FAILED)
        await applySessionSwitch(result.refreshToken, result.returnTo, switchSteps)
      })
    } catch (err) {
      if (endFailureIsTerminal(err)) return signOutLocally(IMPERSONATION_ENDED_RELOGIN)
      throw err
    }
  }

  /** يفتح نافذةَ الكتابة أو يغلقها ثم يسأل الخادم — هو الحَكَم في وقتها. */
  async function setWriteMode(on: boolean): Promise<void> {
    await $fetch('/api/impersonate/write-mode', { method: 'POST', body: { on } })
    await refresh()
  }

  /** دالّةٌ لا computed: الوقتُ يمضي ولا يتغيّر شيءٌ في الذاكرة. */
  function isReadOnlyNow(): boolean {
    return sessionReadOnly(state.value, Date.now())
  }

  /** قبل كتابةٍ لا يحرسها رفضٌ صريح (الرفع، التحديثُ الذي قد يطابق صفر صفوف): يرمي فيعرضه المعالجُ ويُلغى. */
  function blockIfReadOnly(): void {
    if (isReadOnlyNow()) throw new Error(IMPERSONATION_BLOCKED_MESSAGE)
  }

  return { state, isChecked, refresh, ensureChecked, start, end, setWriteMode, isReadOnlyNow, blockIfReadOnly }
}
