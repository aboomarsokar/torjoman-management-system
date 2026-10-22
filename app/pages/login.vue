<script setup lang="ts">
/**
 * شاشة تسجيل الدخول (§4.1) — حقلٌ واحد: الرقم الوظيفي (4 أرقام) للموظف أو رقم الهوية (9 أرقام) للطالب.
 * مبنيّة بمكوّنات Nuxt UI (UForm/UInput/UButton) + تخطيط مخصّص للوحَين.
 * التسجيل مغلق — الحسابات تُنشأ من الإدارة، ولا استعادة ذاتية: كلمة المرور يعيد تعيينها المدير الإداري.
 * حقولٌ أكبر (56) بخطٍّ أوضح، وزرُّ إظهار الكلمة بمساحة لمس، والملاحظتان سطران هادئان بأيقونتيهما، والوضعُ زرٌّ
 * يدور بين ثلاث حالات (`UiThemeToggle`) — طلب المستخدم 2026-10-22.
 */
import { classifyLoginId, LOGIN_ID_ERROR } from '~/constants/identity'

definePageMeta({ layout: false })

const { user, signInWithIdentifier } = useAuth()
const { handle } = useErrorHandler()

useSeoMeta({
  title: 'تسجيل الدخول — ترجمان',
  description: 'سجّل دخولك للوصول إلى لوحتك في منصّة ترجمان القرآني.'
})

// لو كان المستخدم مسجّلاً مسبقاً، انتقل للوحة مباشرةً
onMounted(() => {
  if (user.value) navigateTo('/dashboard')
})

/** حقولٌ أكبر بخطٍّ أوضح (طلب المستخدم 2026-10-22). */
const FIELD_UI = { label: 'text-[15px] font-semibold text-(--ink)', error: 'text-[14px]' }
const INPUT_UI = { base: 'rounded-[14px] min-h-14 text-[17px] ps-12 bg-(--surface)', leading: 'ps-4', leadingIcon: 'size-[22px] text-(--ink-3)' }

const state = reactive({ identifier: '', password: '' })
const showPassword = ref(false)
const loading = ref(false)

function validate(s: typeof state) {
  const errors: { name: string, message: string }[] = []
  if (classifyLoginId(s.identifier).kind === 'invalid') errors.push({ name: 'identifier', message: LOGIN_ID_ERROR })
  if (!s.password) errors.push({ name: 'password', message: 'كلمة المرور مطلوبة.' })
  return errors
}

async function onSubmit() {
  loading.value = true
  try {
    await signInWithIdentifier(state.identifier, state.password)
    await navigateTo('/dashboard')
  } catch (err) {
    handle(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login">
    <!-- FORM SIDE -->
    <div class="form-side">
      <div class="theme-toggle">
        <UiThemeToggle />
      </div>

      <div class="form-box">
        <div class="brand-head">
          <img
            src="/brand/turjuman-mark.png"
            alt="ترجمان"
            class="mark"
          >
          <h1>تسجيل الدخول</h1>
          <p>أدخل بياناتك للوصول إلى لوحتك في ترجمان</p>
        </div>

        <UForm
          :state="state"
          :validate="validate"
          class="form"
          @submit="onSubmit"
        >
          <UFormField
            label="الرقم الوظيفي أو رقم الهوية"
            name="identifier"
            :ui="FIELD_UI"
          >
            <UInput
              v-model="state.identifier"
              type="text"
              inputmode="numeric"
              autocomplete="username"
              enterkeyhint="next"
              dir="ltr"
              icon="i-lucide-id-card"
              placeholder="1001"
              size="xl"
              class="w-full"
              :ui="INPUT_UI"
            />
          </UFormField>

          <UFormField
            label="كلمة المرور"
            name="password"
            :ui="FIELD_UI"
          >
            <UInput
              v-model="state.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              enterkeyhint="go"
              icon="i-lucide-lock"
              placeholder="••••••••"
              size="xl"
              class="w-full"
              :ui="{ ...INPUT_UI, trailing: 'pe-1.5' }"
            >
              <template #trailing>
                <UButton
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  color="neutral"
                  variant="ghost"
                  size="lg"
                  square
                  :aria-label="showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'"
                  :ui="{ base: 'rounded-[10px] size-11 justify-center', leadingIcon: 'size-5' }"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
          </UFormField>

          <UButton
            type="submit"
            label="دخول"
            color="primary"
            size="xl"
            block
            :loading="loading"
            class="submit"
            :ui="{ base: 'rounded-[14px] font-semibold min-h-14 text-[17px]' }"
          />
        </UForm>

        <!-- ملاحظتان هادئتان بأيقونتيهما (كانت الأولى سطراً عائماً والثانية صندوقاً) -->
        <ul class="notes">
          <li>
            <UIcon
              name="i-lucide-key-round"
              class="size-4"
            />نسيت كلمة المرور؟ تواصل مع المدير الإداري.
          </li>
          <li>
            <UIcon
              name="i-lucide-lock-keyhole"
              class="size-4"
            />التسجيل مغلق — الحسابات تُنشأ من قِبل الإدارة.
          </li>
        </ul>

        <NuxtLink
          to="/"
          class="back-link"
        >
          <UIcon
            name="i-lucide-chevron-right"
            class="size-4"
          />
          العودة إلى الصفحة الرئيسية
        </NuxtLink>
      </div>
    </div>

    <!-- BRAND SIDE -->
    <div class="brand-side">
      <img
        src="/brand/turjuman-logo.png"
        alt="ترجمان — حفظ وفهم وعمل"
        class="brand-logo"
      >
      <p>أهلاً بك في ترجمان — منظومة قرآنية تربوية ترافق رحلتك في الحفظ والفهم والعمل.</p>
    </div>
  </div>
</template>

<style scoped>
.login { min-height: 100vh; display: grid; grid-template-columns: 1.05fr 0.95fr; background: var(--bg); color: var(--ink); }

/* FORM SIDE */
.form-side { display: flex; align-items: center; justify-content: center; padding: 88px 24px 40px; position: relative; }
.theme-toggle { position: absolute; top: 26px; left: 26px; }
.form-box { width: 100%; max-width: 420px; }
.brand-head { text-align: center; margin-bottom: 34px; }
.brand-head .mark { height: 72px; width: auto; margin: 0 auto 14px; display: block; filter: var(--logo-filter); }
.brand-head h1 { margin: 0; font-size: 30px; font-weight: 700; color: var(--ink); }
.brand-head p { margin: 10px 0 0; font-size: 16px; color: var(--ink-2); font-weight: 300; }
.form { display: flex; flex-direction: column; gap: 20px; }
.submit { margin-top: 6px; }
.notes { list-style: none; margin: 22px 0 0; padding: 14px 16px; border-radius: 14px; background: var(--surface-2); display: flex; flex-direction: column; gap: 10px; }
.notes li { display: flex; align-items: flex-start; gap: 9px; font-size: 14px; line-height: 1.7; color: var(--ink-2); }
.notes li :deep(svg), .notes li .iconify { flex: none; margin-top: 4px; color: var(--ink-3); }
.back-link { display: flex; align-items: center; justify-content: center; gap: 7px; margin-top: 22px; font-size: 15px; font-weight: 500; color: var(--ink-2); transition: color .2s; }
.back-link:hover { color: var(--ink); }

/* BRAND SIDE */
.brand-side { background: var(--band); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px; text-align: center; }
.brand-side .brand-logo { height: 280px; width: auto; filter: brightness(0) invert(1); opacity: .97; }
.brand-side p { margin: 30px auto 0; max-width: 380px; font-size: 19px; line-height: 2; color: var(--band-sub); font-weight: 300; }

/* RESPONSIVE — تُخفى لوحة العلامة على الجوال */
@media (max-width: 980px) {
  .login { grid-template-columns: 1fr; }
  .brand-side { display: none; }
}
</style>
