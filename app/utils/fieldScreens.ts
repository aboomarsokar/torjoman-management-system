/**
 * جلبُ ما تحتاجه شاشتا المشرف الميداني والمختبِر بلا إنترنت (الدفعة الثالثة — 2026-10-29): تناديه الشاشةُ/المكوّنُ
 * **وتسخينُ النُّسخ** بطريقٍ واحد فلا يتشعّب الاستعلام. كلُّ دالّةٍ ترمي خطأها.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database.types'
import type { DeductionItem } from '~/utils/visitForm'

type Client = SupabaseClient<Database>

/** مفتاحُ بنود الخصم: مفتاحُ الجلب ومفتاحُ نسختها على الجهاز معاً (البنودُ ثابتةٌ للجلسة). */
export const VISIT_ITEMS_KEY = 'visit-deduction-items'

/** بنودُ خصم نموذج الزيارة بترتيبها — الاستعلامُ نفسُه في `ResultModal`. */
export async function fetchDeductionItems(supabase: Client): Promise<DeductionItem[]> {
  const { data, error } = await supabase.from('visit_deduction_items')
    .select('key, criterion, criterion_label, criterion_hint, label, per_time, sort_order').order('sort_order')
  if (error) throw error
  return data ?? []
}
