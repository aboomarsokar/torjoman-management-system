/**
 * تسجيلٌ مرّةً واحدة لكلّ هدف — للمراقِبات التي يجب أن تكون واحدةً في التطبيق ولو استُدعي
 * الـcomposable من عشرات المكوّنات (الهدف تطبيقُ Nuxt، فتطبيقٌ جديدٌ في الاختبار يُسجَّل له من جديد).
 */
export function once(target: object, key: symbol, register: () => void): void {
  const flags = target as Record<symbol, true | undefined>
  if (flags[key]) return
  flags[key] = true
  register()
}
