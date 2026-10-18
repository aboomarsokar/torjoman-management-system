/**
 * بطاقات بيانات الطالب للقراءة — مصدرٌ واحدٌ لملف الطالب الداخلي (`/students/[id]`)
 * وصفحة الطالب نفسه (`/me`)، فلا يتشعّب العرضان.
 */
import type { Database } from '~/types/database.types'

export type StudentRecord = Database['public']['Tables']['students']['Row']

export interface StudentField { label: string, value: string, ltr?: boolean, wide?: boolean }
export interface StudentSection { title: string, icon: string, tone: 'blue' | 'green' | 'neutral', fields: StudentField[] }

const GENDER: Record<string, string> = { male: 'ذكر', female: 'أنثى' }
const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000

/** القيمة الفارغة تُعرض شرطةً. */
export function dash(v: string | number | null | undefined): string {
  return (v === null || v === undefined || v === '') ? '—' : String(v)
}

/** العمر بالسنوات من تاريخ الميلاد، أو شرطة إن غاب أو كان أقلّ من سنة. */
export function ageFrom(birthDate: string | null, now: number = Date.now()): string {
  if (!birthDate) return '—'
  const years = Math.floor((now - new Date(birthDate).getTime()) / MS_PER_YEAR)
  return years > 0 ? `${years} سنة` : '—'
}

/** أقسام بطاقات الطالب: أساسية، قرآنية، سكن، وليّ الأمر. */
export function buildStudentSections(s: StudentRecord): StudentSection[] {
  return [
    {
      title: 'البيانات الأساسية',
      icon: 'i-lucide-id-card',
      tone: 'blue',
      fields: [
        { label: 'الاسم رباعي', value: dash(s.full_name), wide: true },
        { label: 'الجنس', value: (s.gender && GENDER[s.gender]) || '—' },
        { label: 'تاريخ الميلاد', value: dash(s.birth_date), ltr: true },
        { label: 'العمر', value: ageFrom(s.birth_date) },
        { label: 'رقم الهوية', value: dash(s.national_id), ltr: true },
        { label: 'عدد الأفراد', value: dash(s.family_count) }
      ]
    },
    {
      title: 'بيانات قرآنية',
      icon: 'i-lucide-book-open',
      tone: 'green',
      fields: [
        { label: 'الأجزاء المثبتة', value: s.quran_parts != null ? `${s.quran_parts} جزء` : '—' },
        { label: 'الأحكام (التجويد)', value: dash(s.tajweed_level) }
      ]
    },
    {
      title: 'السكن',
      icon: 'i-lucide-home',
      tone: 'neutral',
      fields: [
        { label: 'المنطقة / المدينة', value: dash(s.residence) },
        { label: 'أقرب مسجد', value: dash(s.nearest_mosque) }
      ]
    },
    {
      title: 'وليّ الأمر والتواصل',
      icon: 'i-lucide-phone',
      tone: 'blue',
      fields: [
        { label: 'اسم وليّ الأمر', value: dash(s.guardian_name) },
        { label: 'جوال وليّ الأمر', value: dash(s.guardian_phone), ltr: true },
        { label: 'جوال الطالب', value: dash(s.phone), ltr: true },
        { label: 'بريد وليّ الأمر', value: dash(s.guardian_email), ltr: true },
        { label: 'تاريخ الالتحاق', value: dash(s.enrollment_date), ltr: true }
      ]
    }
  ]
}
