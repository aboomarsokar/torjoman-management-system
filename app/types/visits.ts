/**
 * صفُّ الزيارة كما تجلبه شاشة الزيارات (مع الحلقة ومعلّمها والزائر)، وخيارُ الحلقة في نافذة الجدولة.
 */
import type { Database } from '~/types/database.types'
import type { Role } from '~/constants/roles'

type Gender = Database['public']['Enums']['gender_type']

export type VisitRow = Database['public']['Tables']['supervision_visits']['Row'] & {
  /** `gender` لفلتر القسم (2026-11-09) — اختياريٌّ لنسخةٍ محفوظةٍ على الجهاز قبله. */
  halaqa: { name: string, gender?: Gender | null, teacher: { full_name: string } | null } | null
  supervisor: { full_name: string, role: Role, gender: Gender | null } | null
}

export type VisitHalqaOption = {
  id: string
  name: string
  daily_time: string | null
  supervisor_id: string | null
  /** للمطلوب في «إنجاز الزيارات» (النشطةُ وحدها) — اختياريٌّ لمن لا يجلبه. */
  status?: string | null
  /** لفلتر القسم في «إنجاز الزيارات» — اختياريٌّ لمن لا يجلبه. */
  gender?: Gender | null
  teacher: { full_name: string } | null
}
