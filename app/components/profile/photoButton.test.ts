/**
 * زرُّ الصورة على الحرف الأول — فحصٌ على نصّ المكوّن بحراسات حقل الصورة نفسها:
 * لا زرَّ لحساب أنثى، والمخبأُ يُبطل ثم يُعاد توقيعُه بعد الرفع، والشارةُ تقول «تُغيَّر من هنا».
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync('app/components/profile/PhotoButton.vue', 'utf8')

describe('زرّ الصورة الشخصية', () => {
  it('يقبل أنواعَ المستودع وحدَها ويعرض الوجهَ بـProfileAvatar', () => {
    expect(SRC).toContain(':accept="PHOTO_ACCEPT"')
    expect(SRC).toContain('<ProfileAvatar')
  })

  it('لا زرَّ لحساب أنثى — الحرفُ ساكناً', () => {
    expect(SRC).toContain('canHavePhoto(props.gender)')
    expect(SRC).toContain('v-if="!allowed"')
  })

  it('يُبطل المخبأَ بعد الرفع والإزالة ثم يُعلم الصفحة، ويعيد التوقيعَ بعد الرفع', () => {
    expect(SRC.match(/invalidate\(photoPathOf\(props\.profileId\)\)/g)?.length).toBe(2)
    expect(SRC.match(/emit\('changed'\)/g)?.length).toBe(2)
    const afterInvalidate = SRC.split('invalidate(photoPathOf(props.profileId))')[1] ?? ''
    expect(afterInvalidate).toContain('await prime([photoPathOf(props.profileId)])')
  })

  it('يُفرّغ حقلَ الملف بعد الاختيار — وإلا لا يقع change للملف نفسِه', () => {
    expect(SRC).toContain('fileInput.value.value = \'\'')
  })

  it('له اسمٌ يُقرأ وشارةُ كاميرا دائمة (الجوال بلا مرور)', () => {
    expect(SRC).toContain('aria-label="أضف صورة شخصية"')
    expect(SRC).toContain('aria-label="تغيير الصورة الشخصية"')
    expect(SRC).toContain('class="pb-badge"')
  })
})
