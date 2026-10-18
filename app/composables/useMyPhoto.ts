/**
 * صورةُ صاحب الحساب — للشريط الجانبي والشريط العلوي اللذين يُركَّبان في كلّ شاشة.
 * منقولٌ من الصحابة (`useMyPhoto.ts`) ومكيَّف: هناك طلبٌ خفيفٌ مستقلّ لعمودٍ واحد، وهنا
 * `useProfile()` يجلب صفَّ الحساب كاملاً (ومعه `photo_path`) مرّةً للجلسة، فلا طلبَ زائداً.
 *
 * فشلُه صامت: بلا شبكةٍ يبقى الحرفُ الأول، لا رسالةَ خطأٍ في رأس كلّ صفحة على صورةٍ اختياريّة.
 * والأنثى بلا صورة دائماً (`displayPhotoPath`).
 */
import { displayPhotoPath } from '~/constants/profilePhoto'

/** ما تحتاجه `refreshMyPhoto` — مفصولٌ كي يُختبر الترتيبُ بلا Nuxt. */
export interface MyPhotoRefreshSteps {
  currentPath: () => string | null
  invalidate: (path: string) => void
  reloadProfile: () => Promise<unknown>
  prime: (paths: (string | null)[]) => Promise<void>
}

/**
 * بعد رفعٍ أو إزالة: يُبطل الرابطَ القديم **أوّلاً** (الاسمُ ثابت، فبلا إبطالٍ يظلّ الوجهُ
 * القديم)، ثم يعيد قراءةَ الصفّ، ثم يوقّع المسارَ الجديد.
 */
export async function refreshMyPhoto(steps: MyPhotoRefreshSteps): Promise<void> {
  const before = steps.currentPath()
  if (before) steps.invalidate(before)
  await steps.reloadProfile()
  await steps.prime([steps.currentPath()])
}

export function useMyPhoto() {
  const { profile, fetchProfile } = useProfile()
  const { prime, urlFor, invalidate } = useProfilePhotoUrls()

  const path = computed(() => displayPhotoPath(profile.value))

  // يوقّع المسارَ متى عُرف (بعد جلب الملف) — طلبٌ واحدٌ للجلسة بفضل المخبأ.
  watch(path, (value) => {
    void prime([value])
  }, { immediate: true })

  /** بعد رفعٍ أو إزالة من الملف الشخصي. */
  function refresh(): Promise<void> {
    return refreshMyPhoto({
      currentPath: () => path.value,
      invalidate,
      reloadProfile: fetchProfile,
      prime
    })
  }

  const url = computed(() => urlFor(path.value))

  return { url, refresh }
}
