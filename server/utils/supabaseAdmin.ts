import type { H3Event } from 'h3'
import { requireCaller } from './caller'

/**
 * يتأكّد أن صاحب الطلب مسجّل ونشط ودوره «المدير الإداري» وحده، وإلا يرفع خطأ 401/403.
 * (المديرة الإدارية women_admin لا تنشئ حسابات ولا تعيد تعيين كلمات المرور.)
 * يبني على requireCaller (الدور وصفُّ النيابة معاً) ويُرجع `caller` ليستدعي المسارُ الكاتب requireWritableSession.
 * يعيد عميل الخدمة (service_role — يتجاوز RLS وحارس الأعمدة المحمية) لاستخدامه في العمليات الإدارية.
 * عميل الخدمة خادمي فقط ولا يُستورَد في كود العميل أبداً.
 */
export async function requireAdminManager(event: H3Event) {
  const { caller, admin } = await requireCaller(event)
  if (caller.role !== 'admin_manager') {
    throw createError({ statusCode: 403, statusMessage: 'هذه العملية للمدير الإداري فقط.' })
  }
  return { admin, user: { id: caller.id }, caller }
}
