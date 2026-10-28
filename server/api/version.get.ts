/**
 * تاريخُ النسخة المنشورة الآن (2026-10-28): تسأله بطاقةُ التحديث حين يبدأ تنزيلُ نسخةٍ جديدة فتعرض «نسخة 28-10 · 14:30» —
 * الخادمُ هو النسخةُ الجديدة دائماً، والصفحةُ المفتوحة قديمة. وقتُ البناء ليس سرّاً، فبلا جلسة، ولا يُخبَّأ.
 */
export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  return { builtAt: useRuntimeConfig(event).public.buildTime || null }
})
