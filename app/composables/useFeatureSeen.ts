/**
 * «ميزةٌ جديدة» داخل شاشة (طلب المستخدم 2026-10-25 — زرُّ «تغيير الموعد»): تلفت الانتباهَ حتى يستعملها صاحبُ
 * الحساب أوّلَ مرّة، ثم تهدأ. الحفظُ في المتصفّح لكلّ حسابٍ وحدَه كشارة القائمة (`useNavNewBadges`) — النيابةُ
 * في متصفّح المدير لا تُطفئها على جهاز المعلّم — فإن حُجب التخزينُ بقيت للجلسة.
 */
const STORAGE_PREFIX = 'torjoman-feature-seen'

/** القائمةُ بعد إضافة الميزة (بلا تكرار). */
export function addSeen(list: string[], feature: string): string[] {
  return list.includes(feature) ? list : [...list, feature]
}

export function useFeatureSeen(feature: string) {
  const { profile } = useProfile()
  const seen = ref<string[] | null>(null)
  const key = () => `${STORAGE_PREFIX}:${profile.value?.id}`

  function load() {
    if (!profile.value?.id) return
    try {
      seen.value = JSON.parse(localStorage.getItem(key()) ?? '[]') as string[]
    } catch {
      seen.value = []
    }
  }
  onMounted(() => {
    load()
    watch(() => profile.value?.id, load)
  })

  /** لا تظهر قبل قراءة المحفوظ، كي لا تومض لمن استعملها. */
  const isNew = computed(() => seen.value !== null && !seen.value.includes(feature))

  function markSeen() {
    if (!isNew.value) return
    seen.value = addSeen(seen.value ?? [], feature)
    try {
      localStorage.setItem(key(), JSON.stringify(seen.value))
    } catch { /* لا يُحفظ — تبقى للجلسة */ }
  }

  return { isNew, markSeen }
}
