/**
 * تصغيرُ صورةٍ في المتصفّح **قبل الرفع** بلا قصّ — أطولُ ضلعٍ لا يتجاوز `maxSide`، والنسبةُ كما هي (لصورة الهوية:
 * صورةُ كاميرا 5–10 ميغا تصير مئات الكيلوبايتات وتبقى أرقامُها مقروءة).
 */

/** أبعادُ الصورة بعد التصغير — لا تُكبَّر الصورةُ الصغيرة. */
export function fitSize(width: number, height: number, maxSide: number) {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 }
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** يقرأ الصورة ويصغّرها ثم يُخرجها JPEG. */
export async function shrinkToFit(file: File, maxSide: number, quality: number): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('تعذّرت قراءة الصورة. اختر صورة JPEG أو PNG أو WebP.')
  }
  try {
    const { width, height } = fitSize(bitmap.width, bitmap.height, maxSide)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('تعذّر تجهيز الصورة في هذا المتصفّح.')
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob) throw new Error('تعذّر تجهيز الصورة في هذا المتصفّح.')
    return blob
  } finally {
    bitmap.close()
  }
}
