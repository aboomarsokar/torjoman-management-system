/**
 * صفوفُ جدول تخصيص حوافز الحلقات (طلب المستخدم 2026-11-19): الحلقاتُ النشطة ذاتُ المعلّم النشط وحدها،
 * وتبقى حلقةٌ خُصّص لها مبلغٌ في الشهر ولو توقّفت (فلا يضيع مبلغُها). وفي شهرٍ لم يُحفظ له تخصيصٌ بعد
 * يُملأ لكلّ حلقةٍ المبلغُ الافتراضيّ؛ فإن حُفظ شهرٌ عُرض ما حُفظ كما هو.
 */
import { DEFAULT_MONTHLY_INCENTIVE } from '~/constants/incentives'

export interface AllocationHalaqa {
  id: string
  name: string
  status: string
  teacher: { full_name: string, status: string } | null
}

export interface AllocationRow { halaqa_id: string, name: string, teacher: string, amount: string }

export function allocationRows(halqat: AllocationHalaqa[], saved: Record<string, number>): AllocationRow[] {
  const monthSaved = Object.keys(saved).length > 0
  return halqat
    .filter(h => saved[h.id] != null || (h.status === 'active' && h.teacher?.status === 'active'))
    .map(h => ({
      halaqa_id: h.id,
      name: h.name,
      teacher: h.teacher?.full_name ?? '—',
      amount: saved[h.id] != null ? String(saved[h.id]) : monthSaved ? '' : String(DEFAULT_MONTHLY_INCENTIVE)
    }))
}
