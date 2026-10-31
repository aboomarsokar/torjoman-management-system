/**
 * رسالةُ النتيجة SMS للمرشّحين (طلب المستخدم 2026-10-31): ثلاثُ صيغٍ معتمدةٍ في `app_settings` (مقبول · احتياط · مرفوض)
 * يعدّلها المدير الإداريّ ويعتمدها، والإرسالُ عبر `/api/candidates/result-sms` بدفعاتٍ. منطقُ الدفعات والرسائل مختبَر.
 */
import type { Database } from '~/types/database.types'
import { DEFAULT_RESULT_SMS, type ResultSmsKind } from '~/constants/candidates'
import { SMS_REQUEST_CHUNK } from '~/utils/sms'

export type ResultTemplates = Record<ResultSmsKind, string>
export interface SendTotals { sent: number, failed: number, skipped: number, error: string | null }

/** رسائلُ ما بعد الإرسال بالعربية. */
export function resultSendToasts(t: SendTotals): { title: string, color: 'success' | 'error' | 'warning' }[] {
  const out: { title: string, color: 'success' | 'error' | 'warning' }[] = []
  if (t.sent) out.push({ title: `أُرسلت رسالة النتيجة إلى ${t.sent}.`, color: 'success' })
  if (t.failed) out.push({ title: `تعذّر الإرسال إلى ${t.failed}: ${t.error ?? ''}`.trim(), color: 'error' })
  if (t.skipped) out.push({ title: `تُرك ${t.skipped} بلا قرارٍ أو رقمٍ صالح.`, color: 'warning' })
  return out
}

export function useCandidateResultSms() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const templates = ref<ResultTemplates>({ ...DEFAULT_RESULT_SMS })
  const busy = ref(false)

  async function loadTemplates() {
    const { data, error } = await supabase.from('app_settings')
      .select('candidate_result_sms_accepted, candidate_result_sms_reserve, candidate_result_sms_rejected').eq('id', 1).maybeSingle()
    if (error) return handle(error)
    if (data) {
      templates.value = {
        accepted: data.candidate_result_sms_accepted,
        reserve: data.candidate_result_sms_reserve,
        rejected: data.candidate_result_sms_rejected
      }
    }
  }

  async function saveTemplates(t: ResultTemplates): Promise<boolean> {
    busy.value = true
    try {
      const { error } = await supabase.from('app_settings').update({
        candidate_result_sms_accepted: t.accepted, candidate_result_sms_reserve: t.reserve, candidate_result_sms_rejected: t.rejected
      }).eq('id', 1)
      if (error) throw error
      templates.value = { ...t }
      toast.add({ title: 'اعتُمدت صيغُ رسائل النتيجة.', color: 'success', icon: 'i-lucide-circle-check' })
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  /** يُرسل بدفعاتٍ، والاعتمادُ مع الدفعة الأولى وحدها، ويتوقّف إن فشلت دفعةٌ كلُّها (رصيدٌ أو مرسِل). */
  async function send(ids: string[], t: ResultTemplates, save: boolean): Promise<boolean> {
    if (!ids.length) return false
    busy.value = true
    const total: SendTotals = { sent: 0, failed: 0, skipped: 0, error: null }
    try {
      for (let i = 0; i < ids.length; i += SMS_REQUEST_CHUNK) {
        const r = await $fetch<SendTotals>('/api/candidates/result-sms', {
          method: 'POST', body: { ids: ids.slice(i, i + SMS_REQUEST_CHUNK), templates: t, save: save && i === 0 }
        })
        total.sent += r.sent
        total.failed += r.failed
        total.skipped += r.skipped
        total.error ??= r.error
        if (!r.sent && r.failed) break
      }
      if (save) templates.value = { ...t }
    } catch (err) {
      handle(err, 'تعذّر إرسال رسالة النتيجة.')
    } finally {
      busy.value = false
    }
    for (const m of resultSendToasts(total)) {
      toast.add({ ...m, icon: m.color === 'success' ? 'i-lucide-circle-check' : m.color === 'error' ? 'i-lucide-circle-alert' : 'i-lucide-info' })
    }
    return total.sent > 0
  }

  return { templates, busy, loadTemplates, saveTemplates, send }
}
