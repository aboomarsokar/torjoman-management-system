/**
 * خانةُ التحقّق في رقم الهوية (تسع خانات): الأوزانُ 1،2 بالتناوب، ومجموعُ أرقام النواتج من مضاعفات العشرة.
 * المرآةُ في القاعدة `private.valid_national_id` (حارسُ طلب إضافة الطالب) — هذه لتُعرض الرسالةُ قبل الإرسال.
 */
export function hasValidCheckDigit(id: string): boolean {
  if (!/^\d{9}$/.test(id)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) {
    const product = Number(id[i]) * (i % 2 === 0 ? 1 : 2)
    sum += Math.floor(product / 10) + (product % 10)
  }
  return sum % 10 === 0
}
