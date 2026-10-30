/**
 * نسخةٌ من السجلّ بلا مفتاحٍ واحد — بديلُ `delete rec[key]` بمفتاحٍ محسوب (تمنعه قاعدةُ lint)، ولا يمسّ الأصل.
 * المفتاحُ الغائب لا يضرّ، والسجلُّ الغائب (`undefined`) يردّ سجلًّا فارغاً.
 */
export function withoutKey<T>(rec: Record<string, T> | undefined, key: string): Record<string, T> {
  const { [key]: _removed, ...rest } = rec ?? {}
  return rest
}
