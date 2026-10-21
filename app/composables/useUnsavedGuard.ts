/**
 * حارسُ «التعديل غير المحفوظ» لشاشةٍ فيها مسوّدة: تأكيدٌ قبل مغادرة الشاشة (داخل التطبيق)، وتنبيهُ المتصفّح عند
 * الإغلاق أو التحديث، و`keepsEdits()` لتبديلٍ داخل الشاشة نفسها (اليوم أو الحلقة) يُرجع true إن اختار البقاء.
 * أوّلُ استعماله الحضورُ اليوميّ (حفظٌ بزرٍّ لا فوريّ — 2026-10-21).
 */

/** هل يُمنع التبديل؟ لا تعديلَ ← لا؛ وإلا يُسأل (`ask` = window.confirm) ويُمنع إن رفض. نقيّ ومختبَر. */
export function blocksLeave(dirty: boolean, ask: () => boolean): boolean {
  return dirty && !ask()
}

export function useUnsavedGuard(dirty: Ref<boolean>, message: string) {
  const keepsEdits = () => blocksLeave(dirty.value, () => window.confirm(message))

  onBeforeRouteLeave(() => !keepsEdits())
  const warnUnload = (e: BeforeUnloadEvent) => {
    if (dirty.value) e.preventDefault()
  }
  onMounted(() => window.addEventListener('beforeunload', warnUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', warnUnload))

  return { keepsEdits }
}
