/** الأدوار ومسمّياتها — مصدر واحد. المسمّى = الدور + جنس صاحب الحساب. */
import type { Database } from '~/types/database.types'

export type Role = Database['public']['Enums']['user_role']
type Gender = 'male' | 'female'

const LABELS: Record<Role, Record<Gender, string>> = {
  project_supervisor: { male: 'مشرف المشروع', female: 'مشرفة المشروع' },
  admin_manager: { male: 'المدير الإداري', female: 'المديرة الإدارية' },
  technical_manager: { male: 'المدير الفني', female: 'المديرة الفنية' },
  // دور نسائي حصراً (قسم البنات): المسمّى واحد لأيّ جنس ليبقى السجلّ كاملاً
  women_admin: { male: 'المديرة الإدارية', female: 'المديرة الإدارية' },
  field_supervisor: { male: 'مشرف ميداني', female: 'مشرفة ميدانية' },
  examiner: { male: 'مختبِر', female: 'مختبِرة' },
  teacher: { male: 'معلم', female: 'معلمة' },
  student: { male: 'طالب', female: 'طالبة' }
}

export function roleLabel(role: Role, gender: Gender | null): string {
  return LABELS[role][gender ?? 'male']
}

export const MANAGER_ROLES: Role[] = ['admin_manager', 'technical_manager']
export const STAFF_ROLES: Role[] = [
  'project_supervisor',
  'admin_manager',
  'technical_manager',
  'women_admin',
  'field_supervisor',
  'examiner',
  'teacher'
]
