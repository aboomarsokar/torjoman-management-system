/**
 * حقلُ الصورة الشخصية — فحصٌ على نصّ المكوّن (منقولٌ من الصحابة photoField.test.ts ومكيَّف):
 * الصورةُ اختياريّةٌ دائماً، ولا حقلَ لحساب أنثى، والمخبأُ يُبطل ثم يُعاد توقيعُه بعد الرفع.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync('app/components/profile/PhotoField.vue', 'utf8')

describe('حقل الصورة الشخصية', () => {
  it('يعرض المعاينةَ بـProfileAvatar ويقبل أنواعَ المستودع وحدَها', () => {
    expect(SRC).toContain('<ProfileAvatar')
    expect(SRC).toContain(':accept="PHOTO_ACCEPT"')
  })

  it('يقول إنّها اختياريّة، ولا يلوّن الفارغَ تنبيهاً', () => {
    expect(SRC).toContain('اختياريّة')
    expect(SRC).not.toMatch(/color="(warning|error)"/)
  })

  it('لا يُعرض لحساب أنثى — الحارسُ canHavePhoto على الجذر', () => {
    expect(SRC).toContain('canHavePhoto(props.gender)')
    expect(SRC).toContain('v-if="allowed"')
  })

  it('يُبطل المخبأَ بعد الرفع والإزالة ثم يُعلم الصفحة', () => {
    // الاستيرادُ ملقَّبٌ photoPathOf — الاسمُ الأصليّ يصطدم بخاصّية props.photoPath (vue/no-dupe-keys).
    expect(SRC.match(/invalidate\(photoPathOf\(props\.profileId\)\)/g)?.length).toBe(2)
    expect(SRC.match(/emit\('changed'\)/g)?.length).toBe(2)
  })

  it('ويعيد توقيع المسار بعد الرفع — الإبطالُ وحده لا يملأ المخبأ من جديد', () => {
    const afterInvalidate = SRC.split('invalidate(photoPathOf(props.profileId))')[1] ?? ''
    expect(afterInvalidate).toContain('await prime([photoPathOf(props.profileId)])')
  })

  it('ويُفرّغ حقلَ الملف بعد الاختيار — وإلا لا يقع change للملف نفسِه', () => {
    expect(SRC).toContain('fileInput.value.value = \'\'')
  })

  it('وزرّا الرفع والإزالة بلمسٍ ≥ 44px', () => {
    expect(SRC.match(/class="min-h-11"/g)?.length).toBe(2)
  })
})
