/** ثوابتُ تصدير البيانات إلى Excel (طلب المستخدم 2026-10-28) — تسمياتُ القيم المخزّنة بالعربية ورموزُ الحضور. */

export const GENDER_LABELS: Record<string, string> = { male: 'ذكر', female: 'أنثى' }
export const USER_STATUS_LABELS: Record<string, string> = { active: 'نشط', disabled: 'معطّل' }
export const STUDENT_STATUS_LABELS: Record<string, string> = { active: 'منتظم', withdrawn: 'منسحب', graduated: 'متخرّج', transferred: 'منقول' }
export const HALAQA_STATUS_LABELS: Record<string, string> = { active: 'نشطة', stopped: 'متوقّفة' }
export const REPORT_STATUS_LABELS: Record<string, string> = { draft: 'مسوّدة', submitted: 'مُرسَل', approved: 'معتمَد' }

/** خانةُ الحضور: حاضر · غائب بلا عذر · غائب بعذر · يومٌ لم تفتحه الحلقة. */
export const ATTENDANCE_MARKS = { present: '✓', unexcused: 'غ', excused: 'ع', closed: '—' } as const

/** أقصى صفوفٍ في الطلب الواحد إلى Supabase — يُجلب الأكثرُ على دفعات. */
export const EXPORT_PAGE_SIZE = 1000
/** أقصى طول اسم ورقةٍ في Excel. */
export const SHEET_NAME_MAX = 31
