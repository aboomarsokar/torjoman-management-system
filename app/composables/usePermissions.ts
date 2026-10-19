/**
 * أعلام الواجهة المشتقّة من الدور — طبقة تجربة فقط؛ الحكم لـ RLS في القاعدة.
 * مشرف المشروع يرى كل الشاشات بلا أزرار كتابة (isReadOnly).
 * النطاق في الدور نفسه (لا عمود قسم): المديرة الإدارية = قسم البنات.
 */
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
    /** من يعتمد رصد الشهر (قرار 2026-10-19): الإداري، والمديرة للبنات، والمشرف الميدانيّ لحلقاته — لا الفنيّ (يطّلع ولا يعتمد). */
    canApproveReports: isIn(['admin_manager', 'women_admin', 'field_supervisor']),
    isTeacher: is('teacher'),
    isStudent: is('student'),
    isFieldSupervisor: is('field_supervisor'),
    isExaminer: is('examiner')
  }
}
