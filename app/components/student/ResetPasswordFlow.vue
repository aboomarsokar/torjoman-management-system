<script setup lang="ts">
/**
 * إعادةُ تعيين كلمة مرور طالبٍ من قائمة الطلاب (طلب المستخدم 2026-10-25 — كي لا يُفتح ملفُّ كلّ طالب): تأكيدٌ قصير،
 * ثم الكلمةُ المؤقّتة مرّةً واحدة في `AccountCredentialsModal` — الإجراءُ نفسُه الذي في ملفّ الطالب (`AccountActions`).
 * نسخةٌ واحدة في الصفحة يُمرَّر إليها الطالبُ المختار (`v-model:student`)؛ وللمدير الإداريّ وحده (الخادمُ يتحقّق).
 */
import { studentCredentials, type AccountCredentials } from '~/composables/useAccountAdmin'

export type ResetTarget = { full_name: string, national_id: string | null, user_id: string | null }

const student = defineModel<ResetTarget | null>('student', { required: true })
const { handle } = useErrorHandler()
const { resetPassword } = useAccountAdmin()

const resetting = ref(false)
const credentials = ref<AccountCredentials | null>(null)

async function doReset() {
  const s = student.value
  if (!s?.user_id) return
  resetting.value = true
  try {
    const password = await resetPassword(s.user_id)
    credentials.value = studentCredentials(s.full_name, s.national_id ?? '—', password, 'reset')
    student.value = null
  } catch (err) {
    handle(err, 'تعذّرت إعادة التعيين.')
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <UiConfirmModal
    :open="!!student"
    title="إعادة تعيين كلمة المرور"
    :message="`ستُولَّد لـ«${student?.full_name ?? ''}» كلمة مرورٍ مؤقّتة جديدة تظهر لك مرّةً واحدة، وتبطل كلمته الحالية، ويُطلب منه تغييرها عند الدخول.`"
    confirm-label="إعادة التعيين"
    confirm-color="primary"
    confirm-icon="i-lucide-key-round"
    :loading="resetting"
    @confirm="doReset"
    @update:open="(v) => { if (!v) student = null }"
  />
  <AccountCredentialsModal
    :credentials="credentials"
    @close="credentials = null"
  />
</template>
