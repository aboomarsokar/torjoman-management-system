<script setup lang="ts">
/**
 * «غيّر كلمة مرورك أولاً» — الشاشة الوحيدة المتاحة (مع الخروج) ما دام علَم must_change_password قائماً:
 * الحساب الجديد أو المُعاد تعيينه يدخل بكلمةٍ مؤقّتة، ووسيط المسارات يحوّل كلَّ مسارٍ محميّ إلى هنا.
 * بعد النجاح يُنزَل العلَم (useChangePassword) ويُكمَل إلى صفحة الدور (/dashboard توجّه كلَّ دورٍ إلى بدايته).
 * تُفتح كذلك طوعاً لمن لا علَم عليه — نافذة الملف تبقى الطريق المعتاد.
 */
import { PASSWORD_MIN_LENGTH } from '~/constants/auth'
import { passwordChangeError } from '~/composables/useChangePassword'

definePageMeta({ layout: false })
useSeoMeta({ title: 'تغيير كلمة المرور — ترجمان', robots: 'noindex' })

const { profile, fullName } = useProfile()
const { changeOwnPassword } = useChangePassword()
const { signOut } = useAuth()
const { handle } = useErrorHandler()
const toast = useToast()

const mustChange = computed(() => profile.value?.must_change_password === true)
const pw = reactive({ next: '', confirm: '' })
const showPassword = ref(false)
const saving = ref(false)

async function submit() {
  if (!profile.value) return
  const invalid = passwordChangeError(pw.next, pw.confirm)
  if (invalid) {
    toast.add({ title: invalid, color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  saving.value = true
  try {
    await changeOwnPassword(profile.value.id, pw.next)
    toast.add({ title: 'تم تغيير كلمة المرور.', color: 'success', icon: 'i-lucide-circle-check' })
    await navigateTo('/dashboard', { replace: true })
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="cp">
    <div class="card">
      <img
        src="/brand/turjuman-mark.png"
        alt="ترجمان"
        class="mark"
      >
      <h1>تغيير كلمة المرور</h1>
      <p class="lead">
        <template v-if="mustChange">
          أهلاً{{ fullName ? ` ${fullName}` : '' }}. كلمة مرورك الحالية مؤقّتة سلّمك إيّاها المدير الإداري —
          اختر كلمةً جديدة تعرفها وحدك لتتابع إلى لوحتك.
        </template>
        <template v-else>
          اختر كلمة مرورٍ جديدة لحسابك.
        </template>
      </p>

      <form
        class="form"
        @submit.prevent="submit"
      >
        <UFormField
          label="كلمة المرور الجديدة"
          :hint="`${PASSWORD_MIN_LENGTH} أحرف على الأقل`"
        >
          <UInput
            v-model="pw.next"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            dir="ltr"
            icon="i-lucide-lock"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          >
            <template #trailing>
              <UButton
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                color="neutral"
                variant="link"
                size="sm"
                :aria-label="showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
        </UFormField>
        <UFormField label="تأكيد كلمة المرور">
          <UInput
            v-model="pw.confirm"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            dir="ltr"
            icon="i-lucide-lock"
            size="xl"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <UButton
          type="submit"
          label="حفظ والمتابعة"
          color="primary"
          size="xl"
          block
          :loading="saving"
          :disabled="!profile"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
        />
      </form>

      <UButton
        label="تسجيل الخروج"
        color="neutral"
        variant="ghost"
        size="lg"
        icon="i-lucide-log-out"
        block
        class="logout"
        :ui="{ base: 'rounded-[13px] min-h-11' }"
        @click="signOut"
      />
    </div>
  </main>
</template>

<style scoped>
.cp { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 32px 16px; background: var(--bg); color: var(--ink); }
.card { width: 100%; max-width: 420px; background: var(--surface); border: 1px solid var(--line); border-radius: 22px; box-shadow: var(--shadow-lg); padding: 32px 28px; }
.mark { height: 60px; width: auto; margin: 0 auto 14px; display: block; filter: var(--logo-filter); }
h1 { margin: 0; text-align: center; font-size: 26px; font-weight: 700; color: var(--ink); }
.lead { margin: 12px 0 24px; text-align: center; font-size: 15px; line-height: 1.8; color: var(--ink-2); }
.form { display: flex; flex-direction: column; gap: 16px; }
.logout { margin-top: 14px; }
</style>
