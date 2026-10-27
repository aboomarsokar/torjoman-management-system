/**
 * طلباتُ إضافة الطلاب (طلب المستخدم 2026-10-27): المعلّمُ يطلب لحلقته طالباً ببياناته فيُشعَر المديرُ الإداريّ
 * (والمديرةُ الإدارية في حلقات البنات اطّلاعاً)، والمديرُ يُنشئ الحسابَ من الطلب أو يرفضه بسبب فيُشعَر المعلّم.
 * `halaqaId` يقصر الجلبَ على حلقة (صفحة المعلّم)، وبدونه كلُّ ما تسمح به RLS. التحقّقُ نقيٌّ ومختبَر.
 */
import type { Database } from '~/types/database.types'
import type { AccountCredentials } from '~/composables/useAccountAdmin'
import { normalizeDigits } from '~/constants/identity'
import { REJECT_NOTE_MIN, REQUEST_NAME_MAX, REQUEST_NAME_MIN, REQUEST_NOTE_MAX, type StudentRequestStatus } from '~/constants/studentRequests'
import { hasValidCheckDigit } from '~/utils/nationalId'
import { teacherCredentialsMessage, whatsappMessageLink } from '~/utils/credentialsMessage'

export type StudentRequest = {
  id: string
  halaqa_id: string
  full_name: string
  national_id: string
  birth_date: string | null
  guardian_phone: string | null
  tajweed_level: string | null
  residence: string | null
  nearest_mosque: string | null
  note: string | null
  status: StudentRequestStatus
  reject_note: string | null
  created_at: string
  closed_at: string | null
  halaqa: { name: string, gender: string | null, teacher: { full_name: string } | null } | null
}

export interface StudentRequestDraft {
  full_name: string
  national_id: string
  birth_date: string
  guardian_phone: string
  tajweed_level: string | undefined
  residence: string
  nearest_mosque: string
  note: string
}

export const blankStudentRequest = (): StudentRequestDraft => ({
  full_name: '', national_id: '', birth_date: '', guardian_phone: '', tajweed_level: undefined, residence: '', nearest_mosque: '', note: ''
})

/** خطأُ نموذج الطلب بالعربية، أو null — والقاعدةُ تحكم بعده (الهويةُ المسجّلة تُرفض هناك). */
export function studentRequestError(d: StudentRequestDraft): string | null {
  const name = d.full_name.trim().replace(/\s+/g, ' ')
  if (name.length < REQUEST_NAME_MIN) return 'اكتب اسم الطالب رباعياً.'
  if (name.length > REQUEST_NAME_MAX) return `الاسم لا يتجاوز ${REQUEST_NAME_MAX} حرفاً.`
  const id = normalizeDigits(d.national_id.trim())
  if (!/^\d{9}$/.test(id)) return 'رقم الهوية تسع خانات.'
  if (!hasValidCheckDigit(id)) return 'رقم الهوية غير صحيح — تحقّق من خاناته.'
  const phone = normalizeDigits(d.guardian_phone.trim())
  if (phone && !/^05\d{8}$/.test(phone)) return 'جوال وليّ الأمر عشر خانات يبدأ بـ05.'
  if (d.note.trim().length > REQUEST_NOTE_MAX) return `الملاحظة لا تتجاوز ${REQUEST_NOTE_MAX} حرف.`
  return null
}

/** زرُّ «أرسلها للمعلّم» برسالة بيانات الدخول، أو null إن لم يكن للمعلّم رقم. */
/** ردُّ `POST /api/student-requests/:id/approve`. */
interface ApproveResult {
  temp_password: string
  full_name: string
  national_id: string
  female: boolean
  teacher_name: string | null
  teacher_phone: string | null
  request_closed: boolean
}

function whatsappFor(res: ApproveResult) {
  const text = teacherCredentialsMessage({
    teacherName: res.teacher_name, studentName: res.full_name, nationalId: res.national_id, password: res.temp_password, female: res.female
  })
  const url = whatsappMessageLink(res.teacher_phone, text)
  return url ? { label: res.female ? 'أرسلها للمعلّمة على واتساب' : 'أرسلها للمعلّم على واتساب', url } : null
}

const SELECT = 'id, halaqa_id, full_name, national_id, birth_date, guardian_phone, tajweed_level, residence, nearest_mosque, note, status, reject_note, created_at, closed_at, halaqa:halaqa_id(name, gender, teacher:teacher_id(full_name))'

export function useStudentRequests(halaqaId?: Ref<string | null | undefined>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const busy = ref(false)

  const { data: requests, pending, refresh } = useLazyAsyncData<StudentRequest[]>(
    () => `student-requests-${halaqaId?.value ?? 'all'}`,
    async () => {
      let q = supabase.from('student_requests').select(SELECT)
      if (halaqaId?.value) q = q.eq('halaqa_id', halaqaId.value)
      const { data, error } = await q.order('created_at', { ascending: false }).returns<StudentRequest[]>()
      if (error) handle(error)
      return data ?? []
    }, { server: false, default: () => [], watch: halaqaId ? [halaqaId] : [] })

  const openCount = computed(() => (requests.value ?? []).filter(r => r.status === 'open').length)

  /** المعلّمُ يطلب لحلقته. */
  async function addRequest(forHalaqa: string, d: StudentRequestDraft): Promise<boolean> {
    const problem = studentRequestError(d)
    if (problem) {
      toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    busy.value = true
    try {
      const { error } = await supabase.from('student_requests').insert({
        halaqa_id: forHalaqa,
        full_name: d.full_name.trim().replace(/\s+/g, ' '),
        national_id: normalizeDigits(d.national_id.trim()),
        birth_date: d.birth_date || null,
        guardian_phone: normalizeDigits(d.guardian_phone.trim()) || null,
        tajweed_level: d.tajweed_level || null,
        residence: d.residence.trim() || null,
        nearest_mosque: d.nearest_mosque.trim() || null,
        note: d.note.trim() || null
      })
      if (error) throw error
      toast.add({ title: 'أُرسل طلبُك إلى الإدارة.', color: 'success', icon: 'i-lucide-circle-check' })
      await refresh()
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  /** المديرُ يُنشئ الحسابَ من الطلب؛ يُعيد بياناتِ الدخول لتُعرض مرّةً واحدة. */
  async function approve(r: StudentRequest): Promise<AccountCredentials | null> {
    busy.value = true
    try {
      const res = await $fetch<ApproveResult>(`/api/student-requests/${r.id}/approve`, { method: 'POST' })
      if (!res.request_closed) toast.add({ title: 'أُنشئ الحساب، وتعذّر إغلاقُ الطلب — أغلقه بالرفض أو أعد التحميل.', color: 'warning', icon: 'i-lucide-circle-alert' })
      await refresh()
      return {
        title: 'أُضيف الطالب',
        message: `أُنشئ حسابُ ${res.full_name} في حلقته، وأُشعر المعلّم.`,
        loginLabel: 'رقم الهوية',
        loginId: res.national_id,
        password: res.temp_password,
        whatsapp: whatsappFor(res)
      }
    } catch (err) {
      handle(err)
      return null
    } finally {
      busy.value = false
    }
  }

  /** المديرُ يرفض بسببٍ يراه المعلّم. */
  async function reject(id: string, note: string): Promise<boolean> {
    const reason = note.trim()
    if (reason.length < REJECT_NOTE_MIN) {
      toast.add({ title: 'اكتب سبب الرفض.', color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    busy.value = true
    try {
      const { error } = await supabase.from('student_requests')
        .update({ status: 'rejected', reject_note: reason, closed_at: new Date().toISOString() })
        .eq('id', id).eq('status', 'open')
      if (error) throw error
      toast.add({ title: 'رُفض الطلبُ وأُشعر المعلّم.', color: 'success', icon: 'i-lucide-circle-check' })
      await refresh()
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      busy.value = false
    }
  }

  return { requests, pending, busy, openCount, addRequest, approve, reject, refresh }
}
