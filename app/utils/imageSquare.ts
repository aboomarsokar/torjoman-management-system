/**
 * تصغيرُ صورةٍ إلى مربّعٍ في المتصفّح **قبل الرفع** — صورةُ كاميرا 4 ميغا تُحمَّل مع كلّ شاشةٍ
 * تعرضها. منقولٌ من الصحابة (`imageSquare.ts`) بفرع الاقتصاص وحدَه (`cover`): الوجهُ يُقصّ من
 * المركز إلى مربّع؛ فرعُ الاحتواء كان لشعار المدرسة ولا شعار هنا.
 */
import { PHOTO_WEBP_QUALITY } from '~/constants/profilePhoto'

/** المستطيلُ المصدر الذي يُرسم — مربّعٌ بأصغر الضلعين من المركز. */
export function coverCrop(width: number, height: number) {
  if (width <= 0 || height <= 0) {
    return { sx: 0, sy: 0, sw: 0, sh: 0 }
  }

  const side = Math.min(width, height)

  return {
    sx: Math.round((width - side) / 2),
    sy: Math.round((height - side) / 2),
    sw: side,
    sh: side
  }
}

/** يقرأ الملفَّ ويقصّه مربّعاً ضلعُه `side` ثم يُخرجه `webp`. */
export async function shrinkToSquare(file: File, side: number): Promise<Blob> {
  // ملفٌّ ليس صورة يسقط هنا برسالةٍ عربية تقول ما يُفعل — لا «خطأ غير متوقّع» وقد اختار PDF.
  let bitmap: ImageBitmap

  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('هذا الملف ليس صورة يمكن قراءتها. اختر صورة PNG أو JPEG أو WebP.')
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = side
    canvas.height = side

    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('تعذّر تجهيز الصورة في هذا المتصفّح.')
    }

    // خلفيةٌ بيضاءُ صريحة: PNG شفّافةٌ داكنةٌ تختفي على خلفيةٍ داكنة.
    context.fillStyle = 'white'
    context.fillRect(0, 0, side, side)

    const crop = coverCrop(bitmap.width, bitmap.height)
    context.drawImage(bitmap, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, side, side)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('تعذّر تجهيز الصورة.')),
        'image/webp',
        PHOTO_WEBP_QUALITY
      )
    })
  } finally {
    // تحريرٌ صريح: الصورةُ النقطية تبقى في الذاكرة حتى تُغلق.
    bitmap.close()
  }
}
