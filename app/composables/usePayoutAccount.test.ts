/** فحصُ المُدخَل وتطبيعُه مختبَران في `utils/payoutAccount.test.ts`؛ وهنا أنّ الأنواعَ تطابق نوعَ القاعدة. */
import { describe, expect, it } from 'vitest'
import type { Database } from '~/types/database.types'
import { PAYOUT_ACCOUNT_TYPES } from '~/utils/payoutAccount'
import { ACCOUNT_TYPE_LABELS } from '~/constants/dataExport'

type DbAccountType = Database['public']['Enums']['account_type']

describe('أنواعُ حساب الاستلام', () => {
  it('هي نوعُ القاعدة نفسُه، ولكلٍّ تسميةٌ عربية', () => {
    const types: readonly DbAccountType[] = PAYOUT_ACCOUNT_TYPES
    expect(types.every(t => !!ACCOUNT_TYPE_LABELS[t])).toBe(true)
  })
})
