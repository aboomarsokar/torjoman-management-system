/**
 * رسائلُ الإدارة — جهةُ المرسِل (طلب المستخدم 2026-10-25): الإرسالُ لمجموعةٍ (فئاتٌ × قسم) أو لشخصٍ بعينه عبر
 * `send_staff_message` (الحارسُ في القاعدة: كلٌّ لقسمه)، والسجلُّ بعدد من شاهد، ومستلمو رسالةٍ بأوقات مشاهدتهم.
 * التحقّقُ وعدُّ المشاهدات نقيّان ومختبَران.
 */
import type { Database } from '~/types/database.types'
import { MAX_MESSAGE_BODY, MAX_MESSAGE_TITLE, type Section, type StaffRole } from '~/constants/announcements'

export type SentMessage = {
  id: string
  title: string
  body: string | null
  link: string | null
  roles: string[] | null
  section: string | null
  recipients: number
  created_at: string
  sender: { full_name: string } | null
  target: { full_name: string } | null
  reads: { seen_at: string | null }[]
}

export type MessageRecipient = {
  seen_at: string | null
  person: { full_name: string, role: string, gender: string | null } | null
}

export type StaffPerson = { id: string, full_name: string, role: string, gender: string | null }

export interface MessageDraft {
  mode: 'group' | 'person'
  title: string
  body: string
  link: string | undefined
  roles: StaffRole[]
  section: Section | undefined
  target: string | undefined
}

/** خطأُ النموذج بالعربية، أو null. */
export function messageError(d: MessageDraft): string | null {
  const title = d.title.trim()
  if (!title) return 'اكتب عنوانَ الرسالة.'
  if (title.length > MAX_MESSAGE_TITLE) return `العنوان لا يتجاوز ${MAX_MESSAGE_TITLE} حرفاً.`
  if (d.body.trim().length > MAX_MESSAGE_BODY) return `النصّ لا يتجاوز ${MAX_MESSAGE_BODY} حرف.`
  if (d.mode === 'person') return d.target ? null : 'اختر مَن تصله الرسالة.'
  if (!d.roles.length) return 'اختر فئةً واحدةً على الأقلّ.'
  if (!d.section) return 'اختر القسم.'
  return null
}

/** كم شاهدها من مستلميها. */
export function seenCount(m: Pick<SentMessage, 'reads'>): number {
  return m.reads.filter(r => r.seen_at).length
}

export function useStaffMessages() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const busy = ref(false)

  const { data: sent, pending, refresh } = useLazyAsyncData<SentMessage[]>('staff-messages-sent', async () => {
    const { data, error } = await supabase.from('staff_messages')
      .select('id, title, body, link, roles, section, recipients, created_at, sender:sent_by(full_name), target:target_id(full_name), reads:staff_message_recipients(seen_at)')
      .order('created_at', { ascending: false })
      .returns<SentMessage[]>()
    if (error) handle(error)
    return data ?? []
  }, { server: false, default: () => [] })

  /** الكادرُ النشط الذي تصله الرسائل (والقراءةُ بنطاق RLS: الفنيُّ البنينَ والمديرةُ البنات). */
  const { data: people } = useLazyAsyncData<StaffPerson[]>('staff-messages-people', async () => {
    const { data, error } = await supabase.from('profiles')
      .select('id, full_name, role, gender')
      .in('role', ['teacher', 'field_supervisor', 'examiner']).eq('status', 'active')
      .order('full_name')
      .returns<StaffPerson[]>()
    if (error) handle(error)
    return data ?? []
  }, { server: false, default: () => [] })

  async function recipientsOf(messageId: string): Promise<MessageRecipient[]> {
    const { data, error } = await supabase.from('staff_message_recipients')
      .select('seen_at, person:recipient_id(full_name, role, gender)')
      .eq('message_id', messageId)
      .returns<MessageRecipient[]>()
    if (error) handle(error)
    return data ?? []
  }

  /** يُرجع عددَ من وصلتهم، أو null عند الرفض. */
  async function send(d: MessageDraft): Promise<number | null> {
    const problem = messageError(d)
    if (problem) {
      toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
      return null
    }
    busy.value = true
    try {
      const person = d.mode === 'person'
      const { data, error } = await supabase.rpc('send_staff_message', {
        p_title: d.title.trim(),
        p_body: d.body.trim(),
        p_link: d.link ?? '',
        // الدالّةُ تقبل null للمجموعة حين يُرسَل لشخص (والأنواعُ المولّدة لا تعرف ذلك)
        p_roles: (person ? null : d.roles) as unknown as string[],
        p_section: (person ? null : d.section) as unknown as string,
        p_target: (person ? d.target : null) as unknown as string
      })
      if (error) throw error
      toast.add({ title: data === 1 ? 'وصلت الرسالة.' : `وصلت الرسالةُ إلى ${data}.`, color: 'success', icon: 'i-lucide-circle-check' })
      await refresh()
      return data
    } catch (err) {
      handle(err)
      return null
    } finally {
      busy.value = false
    }
  }

  return { sent, pending, people, busy, send, recipientsOf }
}
