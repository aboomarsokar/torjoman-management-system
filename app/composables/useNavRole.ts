/**
 * دورُ القائمة الجانبية ثابتٌ من أوّل لحظة (طلب المستخدم 2026-10-28: «ما بدي أسماء التبويبات يصير فيها تحميل»
 * و«لمن أحدث بتختفي كلها»): آخرُ دورٍ عُرف لهذا المستخدم محفوظٌ في كوكي يقرؤه الخادمُ أيضاً، فتأتي البنودُ مرسومةً
 * مع الصفحة نفسها قبل تحميل الكود، ثم تُصحَّح إن تغيّر الدور. مقرونٌ بمعرّف المستخدم متى عُرف، كي لا يرى حسابٌ آخرُ
 * على الجهاز نفسه قائمةَ غيره. القائمةُ عرضٌ فقط — RLS تحكم.
 */
import type { Role } from '~/constants/roles'

export const NAV_ROLE_COOKIE = 'torjoman-nav-role'
const ONE_YEAR = 60 * 60 * 24 * 365

export interface CachedNavRole { sub?: string, role?: Role }

/** الدورُ المحفوظ: لهذا المستخدم إن عُرف معرّفُه، وإلا كما هو (الخادمُ قد لا يعرف المعرّف — والعميلُ يصحّح). */
export function readCachedRole(v: CachedNavRole | null | undefined, sub: string | null | undefined): Role | null {
  if (!v || typeof v.role !== 'string') return null
  if (sub && v.sub && v.sub !== sub) return null
  return v.role
}

export function useNavRole() {
  const user = useSupabaseUser()
  const { role } = useProfile()
  const cookie = useCookie<CachedNavRole | null>(NAV_ROLE_COOKIE, { maxAge: ONE_YEAR, sameSite: 'lax', default: () => null })

  watch(role, (r) => {
    const sub = user.value?.sub
    if (r && sub && (cookie.value?.role !== r || cookie.value?.sub !== sub)) cookie.value = { sub, role: r }
  }, { immediate: true })

  /** الدورُ الحقيقيّ متى وصل، وإلا المحفوظ. */
  const navRole = computed<Role | null>(() => role.value ?? readCachedRole(cookie.value, user.value?.sub))
  return { navRole }
}
