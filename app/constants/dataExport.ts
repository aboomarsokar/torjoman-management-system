/** ثوابتُ تصدير البيانات إلى Excel (طلب المستخدم 2026-10-28) — تسمياتُ القيم المخزّنة بالعربية ورموزُ الحضور. */

export const GENDER_LABELS: Record<string, string> = { male: 'ذكر', female: 'أنثى' }
export const USER_STATUS_LABELS: Record<string, string> = { active: 'نشط', disabled: 'معطّل' }
export const STUDENT_STATUS_LABELS: Record<string, string> = { active: 'منتظم', withdrawn: 'منسحب', graduated: 'متخرّج', transferred: 'منقول' }
export const HALAQA_STATUS_LABELS: Record<string, string> = { active: 'نشطة', stopped: 'متوقّفة' }
export const REPORT_STATUS_LABELS: Record<string, string> = { draft: 'مسوّدة', submitted: 'مُرسَل', approved: 'معتمَد' }

export const VISIT_STATUS_LABELS: Record<string, string> = { scheduled: 'مجدولة', done: 'منفّذة', late: 'متأخرة', missed: 'فائتة' }
export const ALERT_SEVERITY_LABELS: Record<string, string> = { note: 'ملاحظة', first_warning: 'إنذار أول', final_warning: 'إنذار نهائي' }
export const ALERT_STATUS_LABELS: Record<string, string> = { new: 'جديد', acknowledged: 'اطّلع عليه' }
export const STATEMENT_STATUS_LABELS: Record<string, string> = { draft: 'مسوّدة', submitted: 'مُرسَل', reviewed: 'مُراجَع' }
export const ACCOUNT_TYPE_LABELS: Record<string, string> = { jawwalpay: 'جوال باي', palpay: 'بال باي', bank_palestine: 'بنك فلسطين' }
export const STOCK_REASON_LABELS: Record<string, string> = { count: 'جرد', supply: 'توريد', delivery: 'تسليم', delivery_removed: 'إرجاع' }
export const BOOKLET_REQUEST_STATUS_LABELS: Record<string, string> = { open: 'بانتظار التسليم', done: 'سُلِّم' }
export const STUDENT_REQUEST_STATUS_LABELS: Record<string, string> = { open: 'مفتوح', added: 'أُضيف', rejected: 'رُفض' }
export const SECTION_LABELS: Record<string, string> = { all: 'القسمان', male: 'البنين', female: 'البنات' }

/** خانةُ الحضور: حاضر · غائب بلا عذر · غائب بعذر · يومٌ لم تفتحه الحلقة. */
export const ATTENDANCE_MARKS = { present: '✓', unexcused: 'غ', excused: 'ع', closed: '—' } as const

/** أقصى صفوفٍ في الطلب الواحد إلى Supabase — يُجلب الأكثرُ على دفعات. */
export const EXPORT_PAGE_SIZE = 1000
/** أقصى طول اسم ورقةٍ في Excel. */
export const SHEET_NAME_MAX = 31
