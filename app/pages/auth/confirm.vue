<script setup lang="ts">
/**
 * ضبط كلمة المرور بعد رابط الاستعادة (§4.1) — وجهة `resetPasswordForEmail`.
 * يصل المستخدم برابط البريد فيُنشئ Supabase جلسة استعادة مؤقّتة، فيضبط كلمته
 * الجديدة هنا ثم يُحوَّل للوحة. صفحة عامّة (ضمن /auth) بلا هيكل.
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: false })
useSeoMeta({ title: 'ضبط كلمة المرور — ترجمان', robots: 'noindex' })

const supabase = useSupabaseClient<Database>()
const user = useSupabaseUser()
const toast = useToast()
const { handle } = useErrorHandler()

const colorMode = useColorMode()
const isDark = computed(() => colorMode.value === 'dark')
function toggleTheme() {
  colorMode.preference = isDark.value ? 'light' : 'dark'
}

const next = ref('')
const confirm = ref('')
const saving = ref(false)
const done = ref(false)

// تُنشئ Supabase جلسة الاستعادة من رابط البريد تلقائيّاً (detectSessionInUrl)
const ready = computed(() => !!user.value)

async function submit() {
  if (next.value.length < 8) {
    toast.add({ title: 'كلمة المرور 8 أحرف على الأقل.', color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  if (next.value !== confirm.value) {
    toast.add({ title: 'الكلمتان غير متطابقتين.', color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  saving.value = true
  try {
    const { error } = await supabase.auth.updateUser({ password: next.value })
    if (error) throw error
    if (user.value?.sub) {
      const { error: flagErr } = await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.value.sub)
      if (flagErr) throw flagErr
    }
    done.value = true
    toast.add({ title: 'تم ضبط كلمة المرور.', color: 'success', icon: 'i-lucide-circle-check' })
    setTimeout(() => navigateTo('/dashboard'), 1200)
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="auth">
    <header class="top">
      <img
        src="/brand/turjuman-full.svg"
        alt="ترجمان"
        class="logo"
      >
      <UButton
        :icon="isDark ? 'i-lucide-sun' : 'i-lucide-moon'"
        color="neutral"
        variant="subtle"
        size="lg"
        square
        aria-label="تبديل الوضع"
        :ui="{ base: 'rounded-xl' }"
        @click="toggleTheme"
      />
    </header>

    <main class="wrap">
      <div class="card">
        <h1>ضبط كلمة المرور</h1>

        <div
          v-if="done"
          class="state ok"
        >
          <UIcon
            name="i-lucide-circle-check"
            class="size-9"
          />
          <p>تم ضبط كلمة المرور بنجاح. يجري تحويلك…</p>
        </div>

        <div
          v-else-if="!ready"
          class="state"
        >
          <UIcon
            name="i-lucide-link-2-off"
            class="size-9"
          />
          <p>هذا الرابط غير صالح أو منتهٍ. اطلب رابط استعادة جديداً من صفحة الدخول.</p>
          <UButton
            to="/login"
            label="إلى تسجيل الدخول"
            color="primary"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
          />
        </div>

        <form
          v-else
          class="form"
          @submit.prevent="submit"
        >
          <p class="hint">
            أدخل كلمة مرور جديدة لحسابك.
          </p>
          <UFormField
            label="كلمة المرور الجديدة"
            hint="8 أحرف على الأقل"
          >
            <UInput
              v-model="next"
              type="password"
              dir="ltr"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField label="تأكيد كلمة المرور">
            <UInput
              v-model="confirm"
              type="password"
              dir="ltr"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UButton
            type="submit"
            label="حفظ كلمة المرور"
            color="primary"
            size="lg"
            block
            :loading="saving"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
          />
        </form>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth { min-height: 100vh; background: var(--bg); color: var(--ink); }
.top { max-width: 440px; margin: 0 auto; padding: 22px 20px; display: flex; align-items: center; justify-content: space-between; }
.logo { height: 52px; width: auto; filter: var(--logo-filter); }
.wrap { max-width: 440px; margin: 0 auto; padding: 20px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; box-shadow: var(--shadow-lg); padding: 30px; }
.card h1 { margin: 0 0 22px; font-size: 23px; font-weight: 700; color: var(--ink); }
.form { display: flex; flex-direction: column; gap: 16px; }
.hint { margin: 0; font-size: 14.5px; color: var(--ink-2); }
.state { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 16px 0; color: var(--ink-2); }
.state.ok { color: var(--green-ink); }
.state p { margin: 0; font-size: 15px; line-height: 1.8; }
</style>
