/**
 * رفع الصور إلى Supabase Storage (باكت media العامّ) وإرجاع الرابط العام.
 * يُستخدم لصور الأخبار. يتحقّق من النوع والحجم. (الصور الشخصية انتقلت إلى المستودع الخاص
 * profile-photos عبر useProfilePhoto — Task 6b؛ فرع avatars باقٍ بلا مستدعٍ حتى يُنظَّف.)
 */
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

export function useUpload() {
  const supabase = useSupabaseClient()
  // رفضُ المستودع في نيابة القراءة رسالةٌ إنجليزيةٌ عامّة — فالفحصُ المسبق أوضح (والحارسُ في القاعدة)
  const { blockIfReadOnly } = useImpersonation()

  async function uploadImage(file: File, folder: string): Promise<string> {
    blockIfReadOnly()
    if (!file.type.startsWith('image/')) throw new Error('الملف يجب أن يكون صورة.')
    if (file.size > MAX_BYTES) throw new Error('حجم الصورة يتجاوز 5 ميغابايت.')

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    // سياسة التخزين: غير المدير الإداري يكتب تحت avatars/<معرّفه>/ فقط، فيُضاف المعرّف للصور الشخصية.
    let dir = folder
    if (folder === 'avatars') {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('انتهت الجلسة، سجّل الدخول من جديد.')
      dir = `${folder}/${auth.user.id}`
    }
    const path = `${dir}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('media').upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) throw new Error(error.message)

    return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
  }

  return { uploadImage }
}
