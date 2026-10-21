/**
 * طباعةُ ورقةٍ واحدة إلى PDF («حفظ بتنسيق PDF» في نافذة الطباعة) — مشتركٌ بين المحضر وسجلّ تقييم المعلمين.
 * يضع عنوانَ المستند اسماً مقترحاً للملفّ، ويضيف `printing-sheet` على html فيُخفي التطبيقَ وقتَ الطباعة
 * (main.css) وتبقى الورقةُ المنقولة إلى body، ثم يعيد كلَّ شيءٍ بعد `afterprint` ويستدعي `onDone`.
 * `createSheetPrinter` نقيّةُ الاعتماد (البيئةُ تُمرَّر) فتُختبر بلا متصفّح.
 */
export const PRINTING_CLASS = 'printing-sheet'

export interface PrintEnv {
  doc: { title: string, documentElement: { classList: { add: (c: string) => void, remove: (c: string) => void } } }
  win: { print: () => void, addEventListener: (e: 'afterprint', f: () => void) => void, removeEventListener: (e: 'afterprint', f: () => void) => void }
}

export function createSheetPrinter(env: PrintEnv) {
  let restoreTitle: string | null = null
  let done: (() => void) | null = null

  function cleanup() {
    env.win.removeEventListener('afterprint', cleanup)
    env.doc.documentElement.classList.remove(PRINTING_CLASS)
    if (restoreTitle !== null) env.doc.title = restoreTitle
    restoreTitle = null
    const cb = done
    done = null
    cb?.()
  }

  /** يطبع الآن بعنوانٍ مقترحٍ لاسم الملفّ؛ `onDone` بعد إغلاق نافذة الطباعة. */
  function print(title: string, onDone?: () => void) {
    if (restoreTitle !== null) cleanup()
    restoreTitle = env.doc.title
    done = onDone ?? null
    env.doc.title = title
    env.doc.documentElement.classList.add(PRINTING_CLASS)
    env.win.addEventListener('afterprint', cleanup)
    env.win.print()
  }

  /** طباعةٌ لم تكتمل (غادر الصفحة): يُعاد العنوانُ والصنف. */
  function dispose() {
    if (restoreTitle !== null) cleanup()
  }

  return { print, dispose }
}

/** في المكوّن: الطابعةُ على document/window، وتُنظَّف عند الإزالة. */
export function usePrintSheet() {
  const printer = import.meta.client ? createSheetPrinter({ doc: document, win: window }) : null
  onBeforeUnmount(() => printer?.dispose())
  return {
    print: (title: string, onDone?: () => void) => printer?.print(title, onDone)
  }
}
