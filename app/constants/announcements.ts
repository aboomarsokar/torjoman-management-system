/**
 * رسائلُ الإدارة للكادر (طلب المستخدم 2026-10-25): حدودُها كقيود `staff_messages`، وفئاتُ الجمهور وأقسامُه
 * ومَن يرسل لمن (كحارس `send_staff_message`)، والصفحاتُ التي تفتحها الرسالة.
 */
import type { Role } from '~/constants/roles'

export const MAX_MESSAGE_TITLE = 120
export const MAX_MESSAGE_BODY = 600

export type StaffRole = 'teacher' | 'field_supervisor' | 'examiner'
export type Section = 'all' | 'male' | 'female'

/** الفئاتُ بتسميتها للقسمين (المذكّر للكلّ والبنين، والمؤنّث للبنات). */
export const STAFF_ROLE_LABELS: Record<StaffRole, { m: string, f: string }> = {
  teacher: { m: 'المعلّمون', f: 'المعلّمات' },
  field_supervisor: { m: 'المشرفون الميدانيون', f: 'المشرفات الميدانيات' },
  examiner: { m: 'المختبِرون', f: 'المختبِرات' }
}
export const STAFF_ROLES = Object.keys(STAFF_ROLE_LABELS) as StaffRole[]

export const SECTION_LABELS: Record<Section, string> = {
  all: 'القسمان',
  male: 'قسم البنين',
  female: 'قسم البنات'
}

/** أقسامُ كلّ مرسِل (قرار المستخدم: كلٌّ لقسمه). */
export const SECTIONS_BY_ROLE: Partial<Record<Role, Section[]>> = {
  admin_manager: ['all', 'male', 'female'],
  technical_manager: ['male'],
  women_admin: ['female']
}

/** مَن تصلهم الرسائل — ولهم صفحةُ «رسائل الإدارة». */
export const MESSAGE_RECIPIENT_ROLES: Role[] = ['teacher', 'field_supervisor', 'examiner']

export const MESSAGE_LINKS: { label: string, to: string }[] = [
  { label: 'لوحة التحكم', to: '/dashboard' },
  { label: 'الملازم', to: '/my-booklets' },
  { label: 'الحضور اليوميّ', to: '/attendance' },
  { label: 'الإنجاز القرآني', to: '/reports' },
  { label: 'الطلاب', to: '/students' },
  { label: 'الحلقات', to: '/halqat' },
  { label: 'الزيارات الإشرافية', to: '/visits' },
  { label: 'الاختبارات', to: '/exams' },
  { label: 'المقرّرات', to: '/programs' },
  { label: 'كشف الحوافز', to: '/incentives' },
  { label: 'تقييمي الشهري', to: '/quality' }
]

/** «المعلّمون والمشرفون الميدانيون · قسم البنين». */
export function audienceLabel(roles: string[] | null, section: string | null): string {
  const female = section === 'female'
  const names = (roles ?? []).map(r => STAFF_ROLE_LABELS[r as StaffRole]?.[female ? 'f' : 'm'] ?? r)
  const joined = names.length > 1 ? `${names.slice(0, -1).join('، ')} و${names.at(-1)}` : (names[0] ?? '')
  return section ? `${joined} · ${SECTION_LABELS[section as Section] ?? section}` : joined
}
