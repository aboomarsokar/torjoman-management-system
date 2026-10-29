/**
 * أيُّ الروابط تعمل بلا إنترنت (البند 14): الشاشاتُ المخزَّنة لدور صاحب الجهاز وحدها (`offlinePathsFor` — للمعلّم
 * `OFFLINE_PATHS`، وللمشرف الميدانيّ والمختبِر شاشتاهما، 2026-10-29). غيرُها يُعتَم ويقول ضغطُه ذلك بدل أن يُحوَّل
 * صامتاً — في القائمة وفي أزرار لوحة المعلّم وبطاقاتها (طلب المستخدم 2026-10-26).
 */
import { offlinePathsFor } from '~/constants/navigation'
import { offlineOwnerRole, type OfflineOwnerRole } from '~/utils/offlineSnapshot'

export const OFFLINE_NAV_MESSAGE = 'هذه الشاشة تحتاج اتصالاً — بلا إنترنت تعمل لوحةُ التحكم والحضورُ اليوميّ والإنجازُ القرآنيّ.'

/** مسارُ الرابط بلا استعلام (`/t/quran?y=2026&m=10` ← `/t/quran`). */
export function linkPath(to: string): string {
  return to.split(/[?#]/)[0] ?? to
}

/** هل يعمل الرابطُ بلا إنترنت لدور صاحب الجهاز المحفوظ (أو للدور المعطى)؟ */
export function worksOffline(to: string | undefined, role: OfflineOwnerRole | null = offlineOwnerRole()): boolean {
  return !!to && offlinePathsFor(role).includes(linkPath(to))
}

export function useOfflineNav() {
  const toast = useToast()
  const { online, check } = useNetworkStatus()
  const needsNetwork = (to: string | undefined) => !online.value && !worksOffline(to)
  /** يمنع التنقّلَ إلى شاشةٍ تحتاج اتصالاً ويقول ذلك — true إن مُنع. */
  function blockIfOffline(to: string | undefined, event?: Event): boolean {
    check()
    if (!needsNetwork(to)) return false
    event?.preventDefault()
    toast.add({ title: OFFLINE_NAV_MESSAGE, icon: 'i-lucide-wifi-off', color: 'warning' })
    return true
  }
  return { online, needsNetwork, blockIfOffline }
}
