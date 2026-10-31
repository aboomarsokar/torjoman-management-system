/**
 * مقابلاتُ المرشّحين (طلب المستخدم 2026-10-30): بنودُ استمارة التحكيم العشرة وأوزانُها (المجموع 100، كلُّ بندٍ من 10)،
 * وحالاتُ الطلب وألوانُها، وحدودُ الحقول (تطابق قيود القاعدة).
 */
import type { Database } from '~/types/database.types'

export type CandidateStatus = Database['public']['Enums']['candidate_status']

/** كلُّ بندٍ يُقيَّم من هذا العدد، ثم يُحوَّل بوزنه. */
export const CRITERION_MAX = 10

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

/** صيغةُ رسالة الدعوة SMS الافتراضية (تطابق قيمة `app_settings.candidate_invite_sms` الابتدائية) ومتغيّراتُها. */
export const DEFAULT_INVITE_SMS = '{الأخ/الأخت} {الاسم}، يسرّنا دعوتك لمقابلة الالتحاق بمعلّمي منصة ترجمان القرآنية يوم {الموعد} في {المكان}.'
export const INVITE_SMS_VARS = ['{الأخ/الأخت}', '{الاسم}', '{الموعد}', '{المكان}'] as const
export const MAX_INVITE_SMS_TEMPLATE = 500

/** أدوارُ لجنة التحكيم: الإداريون والمختبرون (طلب المستخدم 2026-10-30) — يطابق `private.candidate_committee_guard`. */
export const CANDIDATE_COMMITTEE_ROLES = ['admin_manager', 'project_supervisor', 'technical_manager', 'examiner'] as const

/** رؤيةُ المشروع — تتصدّر صفحة الالتحاق. */
export const PROJECT_VISION = 'أن يكونَ في كلِّ بيتٍ طالبٌ يحفظُ كلامَ الله، ويفهمُ معانيَه، ويعملُ بما فيه.'

/** رابطُ مقرّر المقابلة (فهمُ جزء عمّ وتدبّره). */
export const INTERVIEW_SYLLABUS_URL = 'https://drive.google.com/file/d/1CATHBAM7VyCoP_1XdBAJlm9sY5-GFd-I/view?usp=sharing'

/** مقدّمةُ صفحة الالتحاق: [عنوان، نص]. */
export const JOIN_INTRO: readonly (readonly [string, string])[] = [
  ['مدة المشروع', 'سنتان.'],
  ['التسجيل', 'متاحٌ للمعلّمين والمعلّمات، لمدينة غزة فقط في الوقت الحالي.'],
  ['الشروط', 'للمشروع شروطٌ محدّدة للمعلّم ولطلابه، وهي موضّحة أدناه.'],
  ['المقابلة', 'يُدعى من تنطبق عليه الشروط إلى مقابلةٍ شخصية قبل البدء.'],
  ['مقرّر المقابلة', 'اختبارٌ في فهم جزء عمّ وتدبّره من الملف المرفق.'],
  ['تفرّغ الحلقة', 'لا يُسمح أن تتبع الحلقة أكثر من جهةٍ في الوقت نفسه.'],
  ['المكافأة', 'من 100$ إلى 200$ شهرياً، بحسب الأداء والإنجاز.']
]

export const TEACHER_CONDITIONS = [
  'أن يجتاز مقرّر المقابلة بنجاح.',
  'أن يكون حافظاً مثبتاً لخمسة أجزاء على الأقلّ من القرآن الكريم.',
  'أن يكون حاصلاً على الدورة العليا في أحكام التجويد.',
  'أن يكون قادراً على جمع 15 طالباً ضمن شروط المشروع.',
  'أن يكون قادراً على التطبيق العمليّ لفكرة المشروع.',
  'أن تكون لديه القدرة على تفريغ ساعتين يومياً للقيام بمهامّه التعليمية.',
  'أن يكون مشهوداً له بالسمت الحسن، ليكون قدوةً حسنة للطلاب.',
  'أن يمتلك خبرةً في مجال تعليم القرآن وتحفيظه لا تقلّ عن 5 سنوات.'
] as const

export const STUDENT_CONDITIONS = [
  'أن يكون الطالب حافظاً لخمسة أجزاء على الأقلّ من القرآن الكريم.',
  'أن يكون قد حصل على دورة تأهيلية.',
  'أن يمتلك رغبةً جادّة وحافزاً قوياً للانخراط في البرنامج وتحقيق التفوّق.',
  'أن تكون لديه القدرة الجيدة على حفظ الآيات والتفسير، وفهم معاني القرآن.',
  'أن يكون عمر الطالب ما بين 12 و17 سنة.',
  'أن يكون معدّل الطالب المدرسيّ 85% فما فوق.',
  'أن يكون الطالب ذا سمتٍ صالح وتربيةٍ صالحة.'
] as const

export const OTHER_AREA = 'أخرى'
export const CANDIDATE_RESIDENCES = ['غزة', 'الوسطى', 'النصيرات', 'الزوايدة', 'دير البلح', 'خانيونس', OTHER_AREA] as const
/** المنطقةُ التي يُقبل منها التسجيل الآن (مدينة غزة). */
export const ELIGIBLE_RESIDENCE = 'غزة'
export const HALAQA_AREAS = ['الدرج', 'التفاح', 'الرمال', 'الشاطئ الجنوبي', 'الشاطئ الشمالي والنصر', 'الشيخ رضوان', 'الصبرة', 'تل الهوا', 'الزيتون', OTHER_AREA] as const

/** حدودُ الشروط (تطابق نصوص الشروط أعلاه). */
export const MIN_TEACHER_PARTS = 5
export const MIN_EXPERIENCE_YEARS = 5
/** مستوياتُ التجويد التي تحقّق شرط «الدورة العليا» فما فوق. */
export const ADVANCED_TAJWEED_LEVELS = ['عليا', 'تأهيل سند', 'سند'] as const
export const MAX_ADDRESS_DETAIL = 200
export const MAX_HALAQA_AREA = 80
export const MAX_EXPERIENCE_YEARS = 60
/** طولُ رقم الجوال (05XXXXXXXX). */
export const CANDIDATE_PHONE_LENGTH = 10
