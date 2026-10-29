/**
 * أدواتُ الدخول بالنيابة في الواجهة — دوالّ نقيّة بلا Nuxt (تُختبر في impersonation.test.ts):
 * الساعةُ والعدُّ التنازليّ ونافذةُ الكتابة والانتهاء ونصُّ التأكيد، وقرارُ رسالة الرفض في وضع القراءة،
 * وعلَمُ «تبديل الجلسة جارٍ» الذي يسأله وسيطُ المسارات.
 * الخادمُ هو الحَكَم في كلّ ذلك — هذه طبقةُ تجربة.
 */
import { IMPERSONATION_READ_ONLY_MESSAGE, type ImpersonationStatus } from '~/constants/impersonation'

/** مفتاحُ حالة النيابة في useState — يقرؤه useErrorHandler بلا useImpersonation. */
export const IMPERSONATION_STATE_KEY = 'impersonation'

/** ما يُعرض قبل كتابةٍ في نيابة القراءة (blockIfReadOnly) وعند رفضٍ عامّ من RLS أو المستودع فيها. */
export const IMPERSONATION_BLOCKED_MESSAGE = 'أنت في وضع القراءة — فعّل التعديل أولاً.'

/** حين تعذّر تبديلُ الجلسة بعد نجاح الخادم. */
export const SESSION_SWITCH_FAILED = 'تعذّر تبديلُ الجلسة.'

const gazaClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Gaza', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', numberingSystem: 'latn'
})

/** 'HH:MM' بأرقامٍ لاتينية وبتوقيت غزة. */
export function clockLabel(iso: string): string {
  const parts = gazaClock.formatToParts(new Date(iso))
  const hour = parts.find(p => p.type === 'hour')?.value ?? '00'
  const minute = parts.find(p => p.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

/** 'mm:ss' حتى `untilIso` — لا يقلّ عن '00:00'. */
export function countdownLabel(untilIso: string, nowMs: number): string {
  const left = Math.max(0, Math.floor((Date.parse(untilIso) - nowMs) / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(left / 60))}:${pad(left % 60)}`
}

/** ما يُقرأ لقارئ الشاشة بدل العدّ بالثواني (لا يُعلَن كلَّ ثانية): «تبقّى N د» بالتقريب إلى أعلى. */
export function minutesLeftLabel(untilIso: string, nowMs: number): string {
  const minutes = Math.max(0, Math.ceil((Date.parse(untilIso) - nowMs) / 60_000))
  return `تبقّى ${minutes} د`
}

/**
 * لسانٌ آخر بدّل الجلسةَ (الكعكةُ مشتركة وrefreshSession يُذاع بين الألسنة): هذا اللسانُ صار حسابَ غيره
 * بلا شريط، أو بقي شريطُه بعد الإنهاء — فيُعاد تحميلُه. لا عند أوّل تحميل (prev فارغ)، ولا عند الخروج
 * (next فارغ — الوسيطُ يتولّاه)، ولا في اللسان الذي يبدّل بنفسه (تحميلُه الكامل آتٍ).
 */
export function shouldReloadOnIdentityChange(prev: string | null | undefined, next: string | null | undefined, switchingHere: boolean): boolean {
  return !!prev && !!next && prev !== next && !switchingHere
}

/** نافذةُ الكتابة مفتوحة: `writeUntil` في المستقبل. */
export function writeOpen(s: Pick<ImpersonationStatus, 'writeUntil'> | null, nowMs: number): boolean {
  return !!s?.writeUntil && Date.parse(s.writeUntil) > nowMs
}

/** بلغت النيابةُ نهايةَ مدّتها. */
export function expired(s: Pick<ImpersonationStatus, 'expiresAt'> | null, nowMs: number): boolean {
  return !!s && Date.parse(s.expiresAt) <= nowMs
}

/** الجلسةُ نيابةُ قراءة الآن: نيابةٌ بلا نافذةٍ مفتوحة، أو مختومة (تفشل مغلقة كالقاعدة). */
export function sessionReadOnly(s: Pick<ImpersonationStatus, 'writeUntil' | 'ended'> | null, nowMs: number): boolean {
  return !!s && (s.ended || !writeOpen(s, nowMs))
}

/** نصُّ نافذة التأكيد قبل الدخول بحساب موظف — حرفاً كالمواصفة. */
export function impersonateConfirmText(name: string, female = false): { title: string, lines: string[] } {
  return {
    title: `الدخول بحساب ${name}`,
    lines: female
      ? ['تفتح شاشتها كما تراها، قراءةً فقط', 'يصلها إشعارٌ بالاطّلاع على حسابها', 'تنتهي بعد نصف ساعة']
      : ['تفتح شاشته كما يراها، قراءةً فقط', 'يصله إشعارٌ بأنّك اطّلعت على حسابه', 'تنتهي بعد نصف ساعة']
  }
}

/**
 * رفضُ RLS («row-level security» أو رسالةُ حارس القاعدة) أو 403 من المستودع في نيابة القراءة ← رسالةُ وضع القراءة.
 * ⚠️ لا كلَّ `42501`/«permission denied»: ذاك وجهُ المنح المنسيّ — إخفاؤه خلف «وضع القراءة» يُضلّ التشخيص.
 * null لغير ذلك فيمضي المعالجُ إلى ترجمته المعتادة.
 */
export function readOnlyRefusal(
  err: unknown,
  s: Pick<ImpersonationStatus, 'writeUntil' | 'ended'> | null,
  nowMs: number
): string | null {
  if (!sessionReadOnly(s, nowMs) || !err || typeof err !== 'object') return null
  const e = err as { statusCode?: unknown, status?: unknown, message?: unknown, name?: unknown, __isStorageError?: unknown }
  const message = typeof e.message === 'string' ? e.message : ''
  const rls = message.toLowerCase().includes('row-level security') || message.includes(IMPERSONATION_READ_ONLY_MESSAGE)
  const storageForbidden = (e.__isStorageError === true || e.name === 'StorageApiError')
    && String(e.statusCode ?? e.status ?? '') === '403'
  return rls || storageForbidden ? IMPERSONATION_BLOCKED_MESSAGE : null
}

// ── علَمُ تبديل الجلسة ──
// الخادمُ يُبطل الجلسةَ القديمة (الفاعل عند البدء، والنيابة عند الإنهاء) قبل أن يحمّل المتصفّحُ الجديدة؛
// تجديدٌ تلقائيّ بالرمز المُبطَل في تلك الفجوة يُطلق SIGNED_OUT فيصير المستخدمُ null لحظة —
// فيمتنع الوسيطُ عن التحويل إلى /login ما دام العلَمُ مرفوعاً (التحميلُ الكامل يُسقطه).
let switching = false

export function markSessionSwitching(on: boolean): void {
  switching = on
}

export function isSessionSwitching(): boolean {
  return switching
}

// ── علَمُ «نيابةٌ الآن» ──
// متغيّرٌ على مستوى الوحدة يُقرأ بلا سياق Nuxt (نُسخُ الجهاز والصناديقُ تسأله من أدواتٍ نقيّة)؛
// `useImpersonation` يرفعه ويُنزله كلّما تغيّرت حالةُ النيابة.
let impersonating = false

export function setImpersonatingNow(on: boolean): void {
  impersonating = on
}

export function impersonatingNow(): boolean {
  return impersonating
}
