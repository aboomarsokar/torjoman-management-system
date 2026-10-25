/**
 * شارةُ «جديد» على بنود القائمة الجانبية (طلب المستخدم 2026-10-25): تظهر على البند الموسوم `isNew`
 * حتى يزوره صاحبُ الحساب أوّلَ مرّة، ثم تختفي. الحفظُ في المتصفّح **لكلّ حسابٍ وحدَه** (المديرُ ينوب عن معلّمين
 * كثيرين في متصفّحٍ واحد، فزيارتُه بحساب أحدهم لا تُطفئها عند غيره) — فإن حُجب التخزينُ بقيت للجلسة.
 */
const SEEN_KEY = 'torjoman-nav-seen'

/** مفاتيحُ البنود التي تُعرض عليها الشارة: الموسومةُ جديدةً ولم تُزر بعد. */
export function unseenKeys(items: { key: string, isNew?: boolean }[], seen: ReadonlySet<string>): Set<string> {
  return new Set(items.filter(i => i.isNew && !seen.has(i.key)).map(i => i.key))
}

export function useNavNewBadges(active: Ref<{ key: string, isNew?: boolean } | null | undefined>, userId: Ref<string | null | undefined>) {
  const seen = ref<Set<string>>(new Set())
  const ready = ref(false)

  const storageKey = () => `${SEEN_KEY}:${userId.value}`

  function markSeen(key: string) {
    if (seen.value.has(key)) return
    seen.value = new Set([...seen.value, key])
    try {
      localStorage.setItem(storageKey(), JSON.stringify([...seen.value]))
    } catch { /* لا يُحفظ — تبقى للجلسة */ }
  }

  // يُقرأ المحفوظُ لكلّ حسابٍ حين يُعرف (وعند تبدّله بالنيابة أو إنهائها)
  function load() {
    ready.value = false
    if (!userId.value) return
    try {
      seen.value = new Set(JSON.parse(localStorage.getItem(storageKey()) ?? '[]') as string[])
    } catch {
      seen.value = new Set()
    }
    ready.value = true
  }
  onMounted(() => {
    load()
    watch(userId, load)
  })
  // زيارةُ الصفحة تُطفئ شارتَها — ولو دخلها برابطٍ أو إشعارٍ لا من القائمة
  watch([active, ready], ([a, r]) => {
    if (r && a?.isNew) markSeen(a.key)
  }, { immediate: true })

  /** لا تظهر قبل قراءة المحفوظ، كي لا تومض لمن رآها. */
  const isNewFor = (items: { key: string, isNew?: boolean }[]) =>
    computed(() => (ready.value ? unseenKeys(items, seen.value) : new Set<string>()))

  return { isNewFor }
}
