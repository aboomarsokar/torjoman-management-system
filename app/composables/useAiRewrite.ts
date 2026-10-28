/**
 * إعادةُ صياغة المسوّدة بالذكاء الاصطناعي (طلب المستخدم 2026-10-27) عبر `POST /api/ai/rewrite`: تُستبدل المسوّدةُ
 * بالصياغة المقترحة في مكانها، ويبقى «تراجع» متاحاً ما لم يُعدَّل النصُّ بعدها. لا يُرسَل شيءٌ للمستلمين.
 */
export type RewriteKind = 'sms' | 'announcement'
export type RewriteAudience = 'male' | 'female' | 'mixed'
export interface RewriteDraft { title: string, body: string }

/** جمهورُ الرسالة من قسمها أو جنس المستلم: البناتُ مؤنّثٌ بلا قلوب، والبنين مذكّر، وغيرُهما مختلط. */
export function rewriteAudience(section: string | null | undefined, gender?: string | null): RewriteAudience {
  const g = section ?? gender
  return g === 'female' ? 'female' : g === 'male' ? 'male' : 'mixed'
}

/** النصّ لم يُمسّ بعد الصياغة — فالتراجعُ يعيد الأصلَ دون أن يمحو تعديلاً يدوياً. */
export function sameDraft(a: RewriteDraft | null, b: RewriteDraft): boolean {
  return !!a && a.title === b.title && a.body === b.body
}

export function useAiRewrite(current: () => RewriteDraft, apply: (d: RewriteDraft) => void) {
  const { handle } = useErrorHandler()
  const busy = ref(false)
  const original = ref<RewriteDraft | null>(null)
  const suggested = ref<RewriteDraft | null>(null)
  const canUndo = computed(() => !!original.value && sameDraft(suggested.value, current()))

  async function rewrite(kind: RewriteKind, audience: RewriteAudience) {
    const draft = current()
    if (!draft.title.trim() && !draft.body.trim()) return
    busy.value = true
    try {
      const out = await $fetch<RewriteDraft>('/api/ai/rewrite', { method: 'POST', body: { kind, audience, ...draft } })
      const next = { title: kind === 'sms' ? draft.title : (out.title || draft.title), body: out.body }
      original.value = draft
      suggested.value = next
      apply(next)
    } catch (error) {
      handle(error, 'تعذّرت إعادة الصياغة الآن — حاول بعد قليل.')
    } finally {
      busy.value = false
    }
  }

  function undo() {
    if (!original.value) return
    apply(original.value)
    original.value = null
    suggested.value = null
  }

  return { busy, canUndo, rewrite, undo }
}
