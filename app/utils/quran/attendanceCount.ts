/**
 * عدُّ حضور طالبٍ في أيام حلقته: الأيامُ المحسوبة هي ما انعقد منذ التحاقه، والحضورُ هو الأصل
 * وكلُّ غيابٍ (بعذرٍ أو بلا) يُطرح منه. مشتركٌ بين صفوف شهر الحلقة وبطاقة «حضوري» للطالب.
 */

export interface AttendanceCount { held: number, attended: number }

/**
 * @param days أيامُ الحلقة `YYYY-MM-DD` · @param absentDays أيامُ غياب الطالب · @param enrollmentDate تاريخ الالتحاق (null ← كلُّ الأيام)
 */
export function countAttendance(days: string[], absentDays: ReadonlySet<string> | undefined, enrollmentDate: string | null): AttendanceCount {
  const held = days.filter(d => !enrollmentDate || d >= enrollmentDate)
  const missed = held.filter(d => absentDays?.has(d)).length
  return { held: held.length, attended: held.length - missed }
}
