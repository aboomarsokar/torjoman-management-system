import { requireAdminManager } from '../../../utils/supabaseAdmin'
import { requireWritableSession } from '../../../utils/impersonationGuard'
import { parseRecordId } from '../../../utils/accountInput'
import { createStudentAccount } from '../../../utils/createStudentAccount'

/**
 * قبولُ طلب المعلّم إضافةَ طالب (المدير الإداري فقط — طلب المستخدم 2026-10-27): يُنشئ حسابَ الطالب ببيانات الطلب
 * في حلقته وبجنسها، ثم يُغلق الطلبَ «أُضيف» مربوطاً بالطالب — فيُشعَر المعلّمُ (مشغّلُ `student_requests_notify_closed`).
 * يُعيد الكلمةَ المؤقّتة مرّةً واحدة. إن تعثّر إغلاقُ الطلب بعد الإنشاء يبقى الطالبُ ويُبلَّغ المديرُ ليُغلقه بيده.
 */
export default defineEventHandler(async (event) => {
  const { admin, user, caller } = await requireAdminManager(event)
  requireWritableSession(caller)
  const parsedId = parseRecordId(getRouterParam(event, 'id'))
  if (!parsedId.ok) throw createError({ statusCode: 400, statusMessage: parsedId.message })

  const { data: req, error: readErr } = await admin.from('student_requests')
    .select('id, status, full_name, national_id, birth_date, guardian_phone, tajweed_level, residence, nearest_mosque, halaqa:halaqa_id(id, gender, teacher:profiles!halaqat_teacher_id_fkey(id, full_name, phone, whatsapp))')
    .eq('id', parsedId.value).maybeSingle()
  if (readErr) throw createError({ statusCode: 500, statusMessage: 'تعذّرت قراءة الطلب.' })
  if (!req) throw createError({ statusCode: 404, statusMessage: 'الطلب غير موجود.' })
  if (req.status !== 'open') throw createError({ statusCode: 409, statusMessage: 'أُغلق هذا الطلب من قبل.' })
  const halaqa = req.halaqa as {
    id: string
    gender: 'male' | 'female' | null
    teacher: { id: string, full_name: string, phone: string | null, whatsapp: string | null } | null
  } | null
  if (!halaqa?.gender) throw createError({ statusCode: 400, statusMessage: 'حلقة الطلب غير موجودة.' })

  const created = await createStudentAccount(admin, {
    fullName: req.full_name,
    gender: halaqa.gender,
    nationalId: req.national_id,
    halaqaId: halaqa.id,
    birthDate: req.birth_date,
    guardianPhone: req.guardian_phone
  }, user.id, { tajweed_level: req.tajweed_level, residence: req.residence, nearest_mosque: req.nearest_mosque })

  // عميلُ الخدمة بلا auth.uid() فلا يتخطّى الإشعارُ المديرَ — والمستلمُ المعلّمُ وحده
  const { error: closeErr } = await admin.from('student_requests')
    .update({ status: 'added', student_id: created.id, closed_at: new Date().toISOString(), closed_by: user.id })
    .eq('id', req.id).eq('status', 'open')

  return {
    ...created,
    full_name: req.full_name,
    national_id: req.national_id,
    female: halaqa.gender === 'female',
    // لزرّي «أرسلها للمعلّم على واتساب» و«عبر المحادثة» في نافذة بيانات الدخول
    teacher_id: halaqa.teacher?.id ?? null,
    teacher_name: halaqa.teacher?.full_name ?? null,
    teacher_phone: halaqa.teacher?.whatsapp || halaqa.teacher?.phone || null,
    request_closed: !closeErr
  }
})
