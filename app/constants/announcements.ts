/**
 * إشعاراتُ المعلّمين (طلب المستخدم 2026-10-25): حدودُها كقيود `teacher_announcements`، وجمهورُها، والصفحاتُ
 * التي يفتحها الإشعارُ عند المعلّم (من قائمته هو، فلا رابطَ يقوده إلى صفحةٍ لا يراها).
 */
import type { Role } from '~/constants/roles'

export const MAX_ANNOUNCEMENT_TITLE = 120
export const MAX_ANNOUNCEMENT_BODY = 400

export type Audience = 'all' | 'male' | 'female'

export const AUDIENCE_LABELS: Record<Audience, string> = {
  all: 'كلُّ المعلّمين والمعلّمات',
  male: 'معلّمو البنين',
  female: 'معلّمات البنات'
}

/** مَن يرسل لمن — كحارس `send_teacher_announcement` (قرار المستخدم: كلٌّ لقسمه). */
export const AUDIENCES_BY_ROLE: Partial<Record<Role, Audience[]>> = {
  admin_manager: ['all', 'male', 'female'],
  technical_manager: ['male'],
  women_admin: ['female']
}

export const ANNOUNCEMENT_LINKS: { label: string, to: string }[] = [
  { label: 'لوحة التحكم', to: '/dashboard' },
  { label: 'الملازم', to: '/my-booklets' },
  { label: 'الحضور اليوميّ', to: '/attendance' },
  { label: 'الإنجاز القرآني', to: '/reports' },
  { label: 'الطلاب', to: '/students' },
  { label: 'الاختبارات', to: '/exams' },
  { label: 'المقرّرات', to: '/programs' },
  { label: 'كشف الحوافز', to: '/incentives' },
  { label: 'تقييمي الشهري', to: '/quality' },
  { label: 'الزيارات الإشرافية', to: '/visits' }
]
