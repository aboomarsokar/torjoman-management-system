/**
 * أعلام الواجهة المشتقّة من الدور — طبقة تجربة فقط؛ الحكم لـ RLS في القاعدة.
 * مشرف المشروع يرى كل الشاشات بلا أزرار كتابة (isReadOnly).
 * النطاق في الدور نفسه (لا عمود قسم): المديرة الإدارية = قسم البنات.
 */
/** من يعتمد رصد الشهر (قرار 2026-10-21): المشرفُ الميدانيّ لحلقاته وحده — لا الإداريُّ ولا المديرةُ احتياطاً، ولا الفنيّ. */
export const REPORT_APPROVER_ROLES = ['field_supervisor']

/** هل يعتمد هذا الدور رصدَ الشهر؟ (نطاقُ الحلقات يقصره RLS والتصفية الصريحة للمشرف.) */
export function canApproveReportsRole(role: string | null | undefined): boolean {
  return REPORT_APPROVER_ROLES.includes(role ?? '')
}

export function usePermissions() {
  const { role } = useProfile()
  const is = (r: string) => computed(() => role.value === r)
  const isIn = (roles: string[]) => computed(() => roles.includes(role.value ?? ''))
  return {
    role,
    isReadOnly: is('project_supervisor'),
    isAdmin: is('admin_manager'),
    isTechnical: is('technical_manager'),
    isWomenAdmin: is('women_admin'),
    isManager: isIn(['admin_manager', 'technical_manager']),
    canAssign: isIn(['admin_manager', 'technical_manager', 'women_admin', 'field_supervisor']),
    canApprove: isIn(['admin_manager', 'technical_manager', 'women_admin']),
    canApproveReports: computed(() => canApproveReportsRole(role.value)),
    isTeacher: is('teacher'),
    isStudent: is('student'),
    isFieldSupervisor: is('field_supervisor'),
    isExaminer: is('examiner')
  }
}
