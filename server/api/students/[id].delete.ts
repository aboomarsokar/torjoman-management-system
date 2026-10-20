import { requireAdminManager } from '../../utils/supabaseAdmin'
import { requireWritableSession } from '../../utils/impersonationGuard'
import { parseRecordId } from '../../utils/accountInput'

/**
 * حذف طالب مع حسابه (المدير الإداري فقط): ملف profiles ← حساب Auth ← صفّ students، وكل خطوةٍ يُفحص ناتجها.
 * لماذا خادميّ: الحذف المباشر عبر RLS كان يُبقي حساب الدخول والملف — فيدخل الطالب المحذوف،
 * ويفشل إنشاؤه من جديد بهويته (409) إلى الأبد.
 * لماذا الحساب قبل الصفّ: أيُّ فشلٍ في الوسط يُبقي صفّ الطالب ظاهراً في الشاشة فيُعاد الحذف منها
 * (لو حُذف الصفّ أولاً ثم تعثّر حذف الحساب لبقي حسابٌ يتيم لا تصل إليه أي شاشة).
 * ⚠️ صفوف الطالب التابعة (النتائج والترشيحات…) تُحذف معه بالتتالي (on delete cascade) كما كان.
 */
export default defineEventHandler(async (event) => {
  const { admin, caller } = await requireAdminManager(event)
  requireWritableSession(caller)
  const parsedId = parseRecordId(getRouterParam(event, 'id'))
  if (!parsedId.ok) throw createError({ statusCode: 400, statusMessage: parsedId.message })
  const studentId = parsedId.value

  const { data: student, error: readErr } = await admin.from('students').select('id, user_id').eq('id', studentId).maybeSingle()
  if (readErr) throw createError({ statusCode: 500, statusMessage: 'تعذّرت قراءة سجلّ الطالب.' })
  if (!student) throw createError({ statusCode: 404, statusMessage: 'الطالب غير موجود.' })

  // طالبٌ قديم بلا حساب: يكفي حذف الصفّ
  if (student.user_id) {
    const { error: profErr } = await admin.from('profiles').delete().eq('id', student.user_id)
    if (profErr) throw createError({ statusCode: 500, statusMessage: 'تعذّر حذف ملف حساب الطالب، لم يُحذف شيء من سجلّه. حاول مرة أخرى.' })

    const { error: authErr } = await admin.auth.admin.deleteUser(student.user_id)
    // 404: الحساب محذوفٌ أصلاً (محاولةٌ سابقة تعثّرت بعده) — يُكمَل الحذف
    if (authErr && authErr.status !== 404) {
      throw createError({ statusCode: 500, statusMessage: 'تعذّر حذف حساب دخول الطالب — سجلّه باقٍ، أعد محاولة الحذف.' })
    }
  }

  const { error: rowErr } = await admin.from('students').delete().eq('id', studentId)
  if (rowErr) throw createError({ statusCode: 500, statusMessage: 'حُذف حساب الطالب وتعذّر حذف سجلّه — أعد محاولة الحذف.' })

  return { ok: true }
})
