/**
 * حسابُ استلام المكافأة (طلب المستخدم 2026-11-16) — تطبيعُ المُدخَل وفحصُه قبل الإرسال، مطابقاً لفحص
 * `set_payout_account` في القاعدة (وهي الحَكَم): جوال باي وحده، ورقمُه رقمُ جوّال،
 * واسمُ صاحب الحساب كاملاً، ورقمُ هويته تسعة أرقام.
 */
import { IDENTITY_LENGTH, isValidIdentity, normalizeDigits } from '~/constants/identity'
import { arabicFold } from '~/utils/arabicSearch'

export const PAYOUT_ACCOUNT_TYPES = ['jawwalpay', 'palpay', 'bank_palestine'] as const
export type PayoutAccountType = typeof PAYOUT_ACCOUNT_TYPES[number]

/** النوعُ المقبول في التعديل الجديد وحده (قرار المستخدم 2026-11-17): المكافآتُ تُحوَّل كلُّها عبر جوال باي. */
export const PAYOUT_REQUIRED_TYPE: PayoutAccountType = 'jawwalpay'

export const PAYOUT_HOLDER_MIN = 3
export const PAYOUT_HOLDER_MAX = 80

const WALLET = /^05\d{8}$/

export interface PayoutAccountInput {
  type: PayoutAccountType | null
  number: string
  holder: string
  holderId: string
}

/** ما يُرسَل للقاعدة: أرقامٌ لاتينية بلا مسافاتٍ ولا شُرَط، والاسمُ بمسافةٍ واحدة. */
export function normalizePayoutInput(v: PayoutAccountInput): PayoutAccountInput {
  return {
    type: v.type,
    number: normalizeDigits(v.number).replace(/[\s-]/g, '').toUpperCase(),
    holder: v.holder.trim().replace(/\s+/g, ' '),
    holderId: normalizeDigits(v.holderId).replace(/[\s-]/g, '')
  }
}

/**
 * الحسابُ باسم العامل نفسه؟ (طلب المستخدم 2026-11-16) — بلا فرقٍ في الهمزات والتاء المربوطة والياء والمسافات،
 * فـ«ايمان» = «إيمان» و«هبة منيراحمد» = «هبة منير أحمد». الاسمُ المختصَر أو باللاتينية ليس هو.
 */
export function isSameHolderName(holder: string, workerName: string): boolean {
  const key = (s: string) => arabicFold(s).replace(/\s/g, '')
  return !!key(holder) && key(holder) === key(workerName)
}

/** هويةُ العامل تُملأ لصاحب الحساب إن كان الاسمُ اسمَه وهويتُه صالحة، وإلا null. */
export function holderIdFromWorker(holder: string, worker: { name: string, nationalId: string | null }): string | null {
  if (!worker.nationalId || !isValidIdentity(worker.nationalId)) return null
  return isSameHolderName(holder, worker.name) ? normalizeDigits(worker.nationalId.trim()) : null
}

/** أوّلُ خطأٍ بالعربية في المُدخَل بعد تطبيعه، أو null. */
export function payoutAccountError(raw: PayoutAccountInput): string | null {
  const v = normalizePayoutInput(raw)
  if (v.type !== PAYOUT_REQUIRED_TYPE) return 'يلزم حسابُ جوال باي.'
  if (!WALLET.test(v.number)) return 'رقمُ المحفظة رقمُ جوّالٍ من 10 أرقام يبدأ بـ05.'
  if (v.holder.length < PAYOUT_HOLDER_MIN || v.holder.length > PAYOUT_HOLDER_MAX) return 'اكتب اسمَ صاحب الحساب كاملاً.'
  if (!new RegExp(`^\\d{${IDENTITY_LENGTH}}$`).test(v.holderId)) return 'رقمُ هوية صاحب الحساب تسعةُ أرقام.'
  return null
}
