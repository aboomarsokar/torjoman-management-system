/**
 * رسائلُ SMS (طلب المستخدم 2026-10-27): الكادرُ بجوّالاتهم، ودفترُ جهات الاتصال الخارجية (مرشّحون وغيرُهم)، وسجلُّ
 * ما أُرسل، ورصيدُ الحساب، والإرسالُ عبر `POST /api/sms/send`. للمدير الإداريّ، ومشرفُ المشروع يقرأ السجلّ.
 */
import type { Database } from '~/types/database.types'
import { SMS_REQUEST_CHUNK, normalizeLocalPhone } from '~/utils/sms'

export type Recipient = { key: string, name: string | null, phone: string }
export type StaffRow = { id: string, full_name: string, role: string, gender: string | null, phone: string | null }
export type SmsContact = { id: string, name: string, phone: string, tag: string | null, note: string | null }
export type SmsLogRow = { id: string, body: string, recipients_count: number, segments: number, ok: boolean, code: string, result: string | null, created_at: string, sender: { full_name: string } | null }

/** أرقامٌ مكتوبةٌ سطراً سطراً (أو بفواصل) ← مستلمون صالحون، وعددُ ما لم يُفهم. */
export function parseManualNumbers(text: string): { list: Recipient[], invalid: number } {
  const parts = text.split(/[\n,،;]+/).map(s => s.trim()).filter(Boolean)
  const list: Recipient[] = []
  let invalid = 0
  for (const p of parts) {
    const phone = normalizeLocalPhone(p)
    if (phone) list.push({ key: `m:${phone}`, name: null, phone })
    else invalid++
  }
  return { list, invalid }
}

export function useSms() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const sending = ref(false)
  /** تقدّمُ الإرسال الكبير: كم رقماً عولج من كم. */
  const progress = ref<{ done: number, total: number } | null>(null)

  const { data: staff } = useLazyAsyncData<StaffRow[]>('sms-staff', async () => {
    const { data, error } = await supabase.from('profiles').select('id, full_name, role, gender, phone')
      .neq('role', 'student').eq('status', 'active').order('full_name')
    if (error) handle(error)
    return data ?? []
  }, { server: false, default: () => [] })

  const { data: contacts, refresh: refreshContacts } = useLazyAsyncData<SmsContact[]>('sms-contacts', async () => {
    const { data, error } = await supabase.from('sms_contacts').select('id, name, phone, tag, note').order('created_at', { ascending: false })
    if (error) handle(error)
    return data ?? []
  }, { server: false, default: () => [] })

  const { data: log, refresh: refreshLog } = useLazyAsyncData<SmsLogRow[]>('sms-log', async () => {
    const { data, error } = await supabase.from('sms_log')
      .select('id, body, recipients_count, segments, ok, code, result, created_at, sender:sent_by(full_name)')
      .order('created_at', { ascending: false }).limit(50).returns<SmsLogRow[]>()
    if (error) handle(error)
    return data ?? []
  }, { server: false, default: () => [] })

  const balance = ref<string | null>(null)
  const balanceError = ref<string | null>(null)
  async function refreshBalance() {
    try {
      const r = await $fetch<{ ok: true, balance: string } | { ok: false, message: string }>('/api/sms/balance')
      balance.value = r.ok ? r.balance : null
      balanceError.value = r.ok ? null : r.message
    } catch (err) {
      balance.value = null
      balanceError.value = rawErrorText(err) || 'تعذّر جلب الرصيد.'
    }
  }

  async function addContact(c: { name: string, phone: string, tag: string, note: string }): Promise<boolean> {
    const phone = normalizeLocalPhone(c.phone)
    if (c.name.trim().length < 2) {
      toast.add({ title: 'اكتب الاسم.', color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    if (!phone) {
      toast.add({ title: 'رقم الجوال غير صحيح — 05 وعشر خانات.', color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    const { error } = await supabase.from('sms_contacts').insert({ name: c.name.trim(), phone, tag: c.tag.trim() || null, note: c.note.trim() || null })
    if (error) {
      handle(error)
      return false
    }
    await refreshContacts()
    return true
  }

  async function removeContact(id: string) {
    const { error } = await supabase.from('sms_contacts').delete().eq('id', id)
    if (error) handle(error)
    else await refreshContacts()
  }

  /** يرسل على أجزاءٍ من `SMS_REQUEST_CHUNK` متتابعة، ويتوقّف عند خطأ الحساب (لا رقمَ وصل في جزءٍ كامل). */
  async function send(message: string, recipients: { name: string | null, phone: string }[]): Promise<boolean> {
    sending.value = true
    progress.value = { done: 0, total: recipients.length }
    try {
      let sent = 0
      let failed = 0
      let error: string | null = null
      for (let i = 0; i < recipients.length; i += SMS_REQUEST_CHUNK) {
        const part = recipients.slice(i, i + SMS_REQUEST_CHUNK)
        const r = await $fetch<{ sent: number, failed: number, invalid: number, error: string | null }>('/api/sms/send', {
          method: 'POST', body: { message, recipients: part.map(x => ({ name: x.name, phone: x.phone })) }
        })
        sent += r.sent
        failed += r.failed
        error ??= r.error
        progress.value = { done: Math.min(i + part.length, recipients.length), total: recipients.length }
        if (!r.sent && r.failed) {
          failed += recipients.length - (i + part.length)
          break
        }
      }
      if (sent) toast.add({ title: `أُرسلت الرسالة إلى ${sent}.`, color: 'success', icon: 'i-lucide-circle-check' })
      if (failed) toast.add({ title: `تعذّر الإرسال إلى ${failed}: ${error ?? ''}`, color: 'error', icon: 'i-lucide-circle-alert' })
      await Promise.all([refreshLog(), refreshBalance()])
      return sent > 0
    } catch (err) {
      handle(err)
      return false
    } finally {
      sending.value = false
      progress.value = null
    }
  }

  return { staff, contacts, log, balance, balanceError, sending, progress, refreshBalance, addContact, removeContact, send, refreshLog }
}
