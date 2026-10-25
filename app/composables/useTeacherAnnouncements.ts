/**
 * إشعاراتُ المعلّمين (طلب المستخدم 2026-10-25): المديرُ يرسل عنواناً ونصّاً ورابطاً اختيارياً إلى جمهورٍ من المعلّمين
 * فيصل إلى أجراسهم (`send_teacher_announcement` — الحارسُ في القاعدة: كلٌّ لقسمه)، والسجلُّ بما أُرسل.
 * التحقّقُ نقيٌّ ومختبَر.
 */
import type { Database } from '~/types/database.types'
import { MAX_ANNOUNCEMENT_BODY, MAX_ANNOUNCEMENT_TITLE, type Audience } from '~/constants/announcements'

export type TeacherAnnouncement = {
  id: string
  title: string
  body: string | null
  link: string | null
  audience: string
  recipients: number
  created_at: string
  sender: { full_name: string } | null
}

export interface AnnouncementDraft { title: string, body: string, link: string | undefined, audience: Audience | undefined }

/** خطأُ النموذج بالعربية، أو null. */
export function announcementError(d: AnnouncementDraft): string | null {
  const title = d.title.trim()
  if (!title) return 'اكتب عنوانَ الإشعار.'
  if (title.length > MAX_ANNOUNCEMENT_TITLE) return `العنوان لا يتجاوز ${MAX_ANNOUNCEMENT_TITLE} حرفاً.`
  if (d.body.trim().length > MAX_ANNOUNCEMENT_BODY) return `النصّ لا يتجاوز ${MAX_ANNOUNCEMENT_BODY} حرف.`
  if (!d.audience) return 'اختر مَن يصلهم الإشعار.'
  return null
}

export function useTeacherAnnouncements() {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const busy = ref(false)

  const { data: sent, pending, refresh } = useLazyAsyncData<TeacherAnnouncement[]>('teacher-announcements', async () => {
    const { data, error } = await supabase.from('teacher_announcements')
      .select('id, title, body, link, audience, recipients, created_at, sender:sent_by(full_name)')
      .order('created_at', { ascending: false })
      .returns<TeacherAnnouncement[]>()
    if (error) handle(error)
    return data ?? []
  }, { server: false, default: () => [] })

  /** يُرجع عددَ من وصلهم، أو null عند الرفض. */
  async function send(d: AnnouncementDraft): Promise<number | null> {
    const problem = announcementError(d)
    if (problem) {
      toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
      return null
    }
    busy.value = true
    try {
      const { data, error } = await supabase.rpc('send_teacher_announcement', {
        p_title: d.title.trim(), p_body: d.body.trim(), p_link: d.link ?? '', p_audience: d.audience!
      })
      if (error) throw error
      toast.add({ title: `وصل الإشعارُ إلى ${data} من المعلّمين والمعلّمات.`, color: 'success', icon: 'i-lucide-circle-check' })
      await refresh()
      return data
    } catch (err) {
      handle(err)
      return null
    } finally {
      busy.value = false
    }
  }

  return { sent, pending, busy, send }
}
