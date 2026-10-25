/**
 * شارةُ «جديد» على بنود القائمة الجانبية (طلب المستخدم 2026-10-25): تظهر على البند الموسوم `isNew`
 * حتى يزوره صاحبُ المتصفّح أوّلَ مرّة، ثم تختفي. الحفظُ في المتصفّح (تفضيلٌ لا بيانات) — فإن حُجب
 * التخزينُ بقيت الشارةُ للجلسة وتختفي بالزيارة.
 */
const SEEN_KEY = 'torjoman-nav-seen'

/** مفاتيحُ البنود التي تُعرض عليها الشارة: الموسومةُ جديدةً ولم تُزر بعد. */
export function unseenKeys(items: { key: string, isNew?: boolean }[], seen: ReadonlySet<string>): Set<string> {
  return new Set(items.filter(i => i.isNew && !seen.has(i.key)).map(i => i.key))
}

export function useNavNewBadges(activeKey: Ref<string | null | undefined>) {
  const seen = ref<Set<string>>(new Set())
  const ready = ref(false)

  function markSeen(key: string) {
    if (seen.value.has(key)) return
    seen.value = new Set([...seen.value, key])
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...seen.value]))
    } catch { /* لا يُحفظ — تبقى للجلسة */ }
  }

  onMounted(() => {
    try {
      seen.value = new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]') as string[])
    } catch { /* تخزينٌ محجوب */ }
    ready.value = true
  })
  // زيارةُ الصفحة تُطفئ شارتَها — ولو دخلها برابطٍ أو إشعارٍ لا من القائمة
  watch([activeKey, ready], ([k, r]) => {
    if (r && k) markSeen(k)
  }, { immediate: true })

  /** لا تظهر قبل قراءة المحفوظ، كي لا تومض لمن رآها. */
  const isNewFor = (items: { key: string, isNew?: boolean }[]) =>
    computed(() => (ready.value ? unseenKeys(items, seen.value) : new Set<string>()))

  return { isNewFor }
}
