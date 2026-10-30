/**
 * مقابلاتُ المرشّحين (طلب المستخدم 2026-10-30): بنودُ استمارة التحكيم العشرة وأوزانُها (المجموع 100، كلُّ بندٍ من 5)،
 * وحالاتُ الطلب وألوانُها، وحدودُ الحقول (تطابق قيود القاعدة).
 */
import type { Database } from '~/types/database.types'

export type CandidateStatus = Database['public']['Enums']['candidate_status']

/** كلُّ بندٍ يُقيَّم من هذا العدد، ثم يُحوَّل بوزنه. */
export const CRITERION_MAX = 5

/** بنودُ الاستمارة بترتيبها في الورقة — والقاعدةُ تحفظ الدرجات مصفوفةً بهذا الترتيب نفسه (عشرُ خانات). */
export const CANDIDATE_CRITERIA = [
  { key: 'recitation', label: 'جودة التلاوة والتجويد', weight: 10 },
  { key: 'memorization', label: 'إتقان الحفظ من جزء عمّ', weight: 10 },
  { key: 'understanding', label: 'الفهم', weight: 7.5 },
  { key: 'reflection', label: 'التدبّر', weight: 7.5 },
  { key: 'situations', label: 'معالجة المواقف التربوية', weight: 25 },
  { key: 'communication', label: 'التواصل مع الطالب والأهل', weight: 15 },
  { key: 'appearance', label: 'الهيئة وأدب الحديث والوقار', weight: 7.5 },
  { key: 'discipline', label: 'الالتزام والانضباط', weight: 7.5 },
  { key: 'wisdom', label: 'الحكمة وأدب الخلاف', weight: 5 },
  { key: 'tech', label: 'المهارات التقنية', weight: 5 }
] as const

/** علامةُ الترشيح للقبول الافتراضية (تُعرض علامةً، والقرارُ للمدير). */
export const CANDIDATE_PASS_MARK = 70

export const CANDIDATE_STATUS_LABEL: Record<CandidateStatus, string> = {
  new: 'جديد',
  invited: 'مدعوّ للمقابلة',
  interviewed: 'قوبل',
  accepted: 'مقبول',
  reserve: 'احتياط',
  rejected: 'مرفوض',
  hired: 'صار معلّماً'
}

export const CANDIDATE_STATUS_COLOR: Record<CandidateStatus, 'neutral' | 'info' | 'warning' | 'success' | 'error' | 'primary'> = {
  new: 'neutral',
  invited: 'info',
  interviewed: 'warning',
  accepted: 'success',
  reserve: 'primary',
  rejected: 'error',
  hired: 'success'
}

/** ما يراه المرشّح عند الاستعلام عن طلبه. */
export const CANDIDATE_PUBLIC_STATUS: Record<CandidateStatus, string> = {
  new: 'استلمنا طلبك، وهو قيد المراجعة.',
  invited: 'دُعيت إلى المقابلة.',
  interviewed: 'أجريت المقابلة، والنتيجة قيد الاعتماد.',
  accepted: 'مبارك! قُبلت، وسنتواصل معك لاستكمال الإجراءات.',
  reserve: 'أنت على قائمة الاحتياط، وسنتواصل معك عند الحاجة.',
  rejected: 'نشكر اهتمامك، ولم يُقبل الطلب هذه المرّة.',
  hired: 'مبارك! أصبحت من معلّمي ترجمان.'
}

export const MAX_CANDIDATE_TEXT = 120
export const MAX_CANDIDATE_LONG = 1000
export const MAX_INTERVIEW_PLACE = 200
