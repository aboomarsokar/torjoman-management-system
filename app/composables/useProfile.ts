import type { Database } from '~/types/database.types'
import { once } from '~/utils/once'
import { PROFILE_CACHE_KEY, readCache, writeCache } from '~/utils/offlineCache'
import { isOnlineNow } from '~/utils/reachability'

/** مفتاحُ مراقِب الهويّة الوحيد على تطبيق Nuxt. */
const PROFILE_IDENTITY_WATCH = Symbol('profile-identity-watch')

type Profile = Database['public']['Tables']['profiles']['Row']
type Role = Database['public']['Enums']['user_role']

/**
 * دالة الجلب معرَّفة بمستوى الملف (مرجع ثابت) لا داخل useProfile — عشرات
 * المكوّنات تستدعي useProfile()، ولو كانت الدالة تُعرَّف من جديد بكل استدعاء
 * يرى useAsyncData «مُعالجاً مختلفاً» لنفس المفتاح current-profile ويُعيد
 * الجلب من الصفر (يُبطل الكاش) — وهذا كان يُظهر سكيلتون البروفايل عند كل
 * تنقّل بين الصفحات بدل الجلب مرّة واحدة فقط. استدعاء useSupabaseClient()
 * داخل الدالة نفسها آمن — Nuxt يحافظ على سياق التطبيق عبر الجلب غير المتزامن.
 */
async function fetchCurrentProfile(): Promise<Profile | null> {
  // بلا إنترنت: آخرُ ملفٍّ عُرف على هذا الجهاز (البند 14 — رأسُ اللوحة والقائمةُ في تطبيق المعلّم)
  if (import.meta.client && !isOnlineNow()) return readCache<Profile>(PROFILE_CACHE_KEY)
  const supabase = useSupabaseClient<Database>()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return isOnlineNow() ? null : readCache<Profile>(PROFILE_CACHE_KEY)
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', auth.user.id)
    .single()
  if (error) {
    console.error('[useProfile] فشل جلب الملف:', error.message)
    const cached = readCache<Profile>(PROFILE_CACHE_KEY)
    return !isOnlineNow() && cached?.id === auth.user.id ? cached : data
  }
  if (data) writeCache(PROFILE_CACHE_KEY, data)
  return data
}

/**
 * ملف المستخدم الحالي ودوره.
 * يُجلب على العميل (server:false) حيث الجلسة مضمونة. نقرأ المستخدم من
 * supabase.auth.getUser() داخل الجلب لتفادي سباق توقيت الـ ref التفاعلي.
 * مصدر الدور لإظهار قوائم التنقّل وصلاحيات الواجهة (RLS يفرضها الخادم).
 *
 * المراقبة على هويّة المستخدم (user.value?.sub) لا على مرجع user كاملاً:
 * موديول Supabase يُحدّث مرجع user عند كل تنقّل (إعادة التحقّق من الجلسة)،
 * فمراقبة المرجع كلّه كانت تُعيد جلب الملف عند كل تنقّل → pending يرجع true
 * → يومض سكيلتون الدور (الشريط الجانبي/البوّابات) ويتأخّر المحتوى. مراقبة
 * الـ id تُعيد الجلب فقط عند تسجيل دخول/خروج فعلي (تغيّر الهويّة).
 * ⚠️ useSupabaseUser في @nuxtjs/supabase v2 يحمل claims الـJWT: المعرّف في `sub` لا `id`
 * (كان `id` دائماً undefined فلا يُعاد الجلب بعد خروجٍ ثم دخولٍ بحسابٍ آخر في الجلسة نفسها).
 */
export function useProfile() {
  const user = useSupabaseUser()

  const { data: profile, refresh, pending } = useAsyncData<Profile | null>(
    'current-profile',
    fetchCurrentProfile,
    { server: false, default: () => null }
  )

  // إعادة الجلب عند تغيّر هويّة المستخدم فقط (دخول/خروج)، لا عند تنقّل الصفحات — بمراقِبٍ **واحدٍ للتطبيق**:
  // كان كلّ استدعاءٍ لـuseProfile (27 موضعاً، منها usePermissions) يسجّل مراقِبه، فعند الدخول يُطلق كلٌّ منها
  // جلباً (getUser + profiles)، وقفلُ جلسة Supabase يُسلسلها، فتنتظر طلباتُ الصفحة كلُّها خلفها
  // (سجلّ 2026-10-20: ستّة أزواجٍ متتالية ≈ 1.1 ث قبل أوّل طلبٍ للّوحة). نطاقٌ منفصل كي لا يموت بزوال المكوّن الأول.
  once(useNuxtApp(), PROFILE_IDENTITY_WATCH, () => {
    effectScope(true).run(() => {
      watch(() => user.value?.sub, (id, prev) => {
        if (id !== prev) void refresh()
      })
    })
  })

  const role = computed<Role | null>(() => profile.value?.role ?? null)
  const status = computed(() => profile.value?.status ?? null)
  const fullName = computed(() => profile.value?.full_name ?? '')
  /** أول حرف من الاسم — بديل الصورة الرمزية. */
  const initial = computed(() => fullName.value.trim().charAt(0) || '؟')

  return { profile, role, status, fullName, initial, pending, fetchProfile: refresh }
}
