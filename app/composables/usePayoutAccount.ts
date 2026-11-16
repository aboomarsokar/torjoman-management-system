/**
 * حسابُ استلام المكافأة لعاملٍ واحد (طلب المستخدم 2026-11-16): يقرؤه صاحبُه والمديرُ الإداريّ ومشرفُ المشروع
 * (`get_payout_account` — بلا المكافأة الأساسية)، ويعدّله صاحبُه والمديرُ الإداريّ (`set_payout_account`). التعديلُ
 * يُعتمد فوراً، والقاعدةُ تُشعر المديرَ الإداريّ بالقديم والجديد وتحفظ سطراً في سجلٍّ خاصّ.
 */
import type { Database } from '~/types/database.types'
import { normalizePayoutInput, payoutAccountError, type PayoutAccountInput } from '~/utils/payoutAccount'

export type PayoutAccount = Database['public']['Functions']['get_payout_account']['Returns'][number]

export function usePayoutAccount(profileId: Ref<string>) {
  const supabase = useSupabaseClient<Database>()
  const { handle } = useErrorHandler()
  const toast = useToast()
  const account = ref<PayoutAccount | null>(null)
  const loading = ref(false)
  const saving = ref(false)

  async function load() {
    if (!profileId.value) return
    loading.value = true
    const { data, error } = await supabase.rpc('get_payout_account', { p_profile: profileId.value })
    loading.value = false
    if (error) {
      handle(error)
      return
    }
    account.value = data?.[0] ?? null
  }

  /** يحفظ الحساب ويُرجع true عند النجاح؛ والخطأُ (من الفحص أو القاعدة) يُعرض بالعربية. */
  async function save(input: PayoutAccountInput): Promise<boolean> {
    const problem = payoutAccountError(input)
    if (problem) {
      toast.add({ title: problem, color: 'warning', icon: 'i-lucide-circle-alert' })
      return false
    }
    const v = normalizePayoutInput(input)
    saving.value = true
    try {
      const { error } = await supabase.rpc('set_payout_account', {
        p_profile: profileId.value, p_type: v.type!, p_number: v.number, p_holder: v.holder, p_holder_id: v.holderId
      })
      if (error) throw error
      toast.add({ title: 'حُفظ حسابُ الاستلام.', color: 'success', icon: 'i-lucide-circle-check' })
      await load()
      return true
    } catch (err) {
      handle(err)
      return false
    } finally {
      saving.value = false
    }
  }

  return { account, loading, saving, load, save }
}
