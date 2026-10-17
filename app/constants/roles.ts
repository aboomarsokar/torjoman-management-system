/** تسميات الأدوار — مصدر واحد بدل نسخٍ متفرّقة في الصفحات. */
import type { Database } from '~/types/database.types'

export type Role = Database['public']['Enums']['user_role']

export const ROLE_LABEL: Record<Role, string> = {
  manager: 'المدير',
  quality: 'مشرف الجودة',
  supervisor: 'المشرف',
  teacher: 'المعلم',
  examiner: 'المختبِر'
}
