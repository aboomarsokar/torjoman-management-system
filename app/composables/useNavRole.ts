/**
 * دورُ القائمة الجانبية ثابتٌ من أوّل لحظة (طلب المستخدم 2026-10-28: «ما بدي أسماء التبويبات يصير فيها تحميل»):
 * يُحفظ آخرُ دورٍ عُرف لهذا المستخدم على الجهاز، فتُرسم البنودُ به فوراً حتى يصل الملفّ ثم يُصحَّح إن تغيّر.
 * المفتاحُ مقرونٌ بمعرّف المستخدم كي لا يرى حسابٌ آخرُ على الجهاز نفسه قائمةَ غيره. القائمةُ عرضٌ فقط — RLS تحكم.
 */
import type { Role } from '~/constants/roles'

export const NAV_ROLE_KEY = 'torjoman:nav-role'

/** الدورُ المحفوظ إن كان لهذا المستخدم نفسه، وإلا null. */
export function readCachedRole(raw: string | null, sub: string | null | undefined): Role | null {
  if (!raw || !sub) return null
  try {
    const v = JSON.parse(raw) as { sub?: string, role?: Role }
    return v.sub === sub && typeof v.role === 'string' ? v.role : null
  } catch {
    return null
  }
}

export function useNavRole() {
  const user = useSupabaseUser()
  const { role } = useProfile()
  const cached = ref<Role | null>(null)

  onMounted(() => {
    watch(() => user.value?.sub, (sub) => {
      try {
        cached.value = readCachedRole(localStorage.getItem(NAV_ROLE_KEY), sub)
      } catch {
        cached.value = null
      }
    }, { immediate: true })
    watch(role, (r) => {
      const sub = user.value?.sub
      if (!r || !sub) return
      cached.value = r
      try {
        localStorage.setItem(NAV_ROLE_KEY, JSON.stringify({ sub, role: r }))
      } catch {
        // التخزينُ محجوبٌ (نافذةٌ خاصّة): القائمةُ تنتظر الملفّ كما كانت
      }
    }, { immediate: true })
  })

  /** الدورُ الحقيقيّ متى وصل، وإلا المحفوظ. */
  const navRole = computed<Role | null>(() => role.value ?? cached.value)
  return { navRole }
}
