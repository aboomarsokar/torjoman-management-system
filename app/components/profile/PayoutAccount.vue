<script setup lang="ts">
/**
 * «حساب استلام المكافأة» في الملف الشخصيّ للعامل (طلب المستخدم 2026-11-16): نوعُ الحساب ورقمُه واسمُ صاحبه
 * ورقمُ هويته. يراه صاحبُه والمديرُ الإداريّ (ومشرفُ المشروع قراءةً بهويةٍ مقنّعة)، ويعدّله صاحبُه والمديرُ
 * الإداريّ؛ والتعديلُ يُعتمد فوراً ويصل المديرَ الإداريّ إشعارٌ به. المكافأةُ الأساسية لا تظهر هنا.
 */
import { ACCOUNT_TYPE_LABELS } from '~/constants/dataExport'
import { holderIdFromWorker, PAYOUT_REQUIRED_TYPE, type PayoutAccountInput, type PayoutAccountType } from '~/utils/payoutAccount'

interface Props {
  profileId: string
  /** اسمُ العامل ورقمُ هويته: إن كان الحسابُ باسمه مُلئت هويتُه لصاحب الحساب تلقائياً. */
  workerName: string
  workerNationalId: string | null
  /** صاحبُ الملفّ أو المديرُ الإداريّ (والقاعدةُ هي الحَكَم). */
  canEdit: boolean
  /** يُقنَّع رقمُ الهوية لمن يقرأ ولا يملك (مشرف المشروع). */
  maskId?: boolean
}

const props = withDefaults(defineProps<Props>(), { maskId: false })

const id = computed(() => props.profileId)
const { account, saving, load, save } = usePayoutAccount(id)
onMounted(load)

const hasAccount = computed(() => !!account.value?.account_number)
const shownId = computed(() => {
  const v = account.value?.holder_national_id
  if (!v) return null
  return props.maskId ? `•••• ${v.slice(-4)}` : v
})

const open = ref(false)
const form = reactive<PayoutAccountInput & { type: PayoutAccountType }>({ type: PAYOUT_REQUIRED_TYPE, number: '', holder: '', holderId: '' })
function openEdit() {
  const a = account.value
  // جوال باي وحده (قرار 2026-11-17): من كان على غيره يحفظ رقمَ جوال باي في مكانه
  form.type = PAYOUT_REQUIRED_TYPE
  form.number = a?.account_type === PAYOUT_REQUIRED_TYPE ? (a.account_number ?? '') : ''
  form.holder = a?.account_holder ?? ''
  form.holderId = a?.holder_national_id ?? ''
  autoFilledId.value = null
  open.value = true
}
// الاسمُ اسمُ العامل ← هويتُه (طلب المستخدم 2026-11-16)؛ وما مُلئ تلقائياً يُمسح إن تغيّر الاسم، وما كتبه بيده يبقى
const autoFilledId = ref<string | null>(null)
watch(() => form.holder, (holder) => {
  const workerId = holderIdFromWorker(holder, { name: props.workerName, nationalId: props.workerNationalId })
  if (workerId && (!form.holderId || form.holderId === autoFilledId.value)) {
    form.holderId = workerId
    autoFilledId.value = workerId
  } else if (!workerId && autoFilledId.value && form.holderId === autoFilledId.value) {
    form.holderId = ''
    autoFilledId.value = null
  }
})
const idHint = computed(() => autoFilledId.value && form.holderId === autoFilledId.value ? 'هويةُ العامل نفسُه — مُلئت تلقائياً' : '9 أرقام')
async function submit() {
  if (await save(form)) open.value = false
}
</script>

<template>
  <section
    class="pa"
    :class="{ done: hasAccount }"
    aria-labelledby="pa-title"
  >
    <span class="pa-ico"><UIcon
      :name="hasAccount ? 'i-lucide-wallet' : 'i-lucide-wallet-minimal'"
      class="size-6"
    /></span>
    <div class="pa-body">
      <h3 id="pa-title">
        حساب استلام المكافأة
      </h3>
      <dl
        v-if="hasAccount && account"
        class="pa-facts"
      >
        <div>
          <dt>الحساب</dt>
          <dd>
            {{ account.account_type ? ACCOUNT_TYPE_LABELS[account.account_type] : '—' }}
            <bdi dir="ltr">{{ account.account_number }}</bdi>
          </dd>
        </div>
        <div>
          <dt>صاحبه</dt>
          <dd>{{ account.account_holder || '—' }}</dd>
        </div>
        <div>
          <dt>هويته</dt>
          <dd>
            <bdi
              v-if="shownId"
              dir="ltr"
            >{{ shownId }}</bdi>
            <span
              v-else
              class="pa-missing"
            >لم تُدخَل بعد</span>
          </dd>
        </div>
      </dl>
      <p v-else>
        لم يُسجَّل حسابٌ تُحوَّل إليه المكافأة. أضِفه ليصلك التحويل.
      </p>
    </div>
    <div
      v-if="canEdit"
      class="pa-acts"
    >
      <UButton
        :label="hasAccount ? 'عدّل الحساب' : 'أضف الحساب'"
        :icon="hasAccount ? 'i-lucide-pencil' : 'i-lucide-plus'"
        :color="hasAccount ? 'neutral' : 'primary'"
        :variant="hasAccount ? 'soft' : 'solid'"
        :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
        @click="openEdit"
      />
    </div>

    <UModal
      v-model:open="open"
      title="حساب استلام المكافأة"
      description="يُعتمد التعديلُ فوراً، ويصل الإدارةَ إشعارٌ به."
    >
      <template #body>
        <form
          class="pa-form"
          @submit.prevent="submit"
        >
          <p class="pa-note">
            <UIcon
              name="i-lucide-info"
              class="size-4 shrink-0"
            />
            يلزم حسابُ <strong>جوال باي</strong> — لا تُقبل حساباتٌ أخرى.
          </p>
          <UFormField label="رقم محفظة جوال باي (رقم الجوّال)">
            <UInput
              v-model="form.number"
              dir="ltr"
              size="lg"
              class="w-full"
              inputmode="tel"
              autocomplete="off"
              placeholder="05XXXXXXXX"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField
            label="اسم صاحب الحساب"
            hint="كما هو مسجَّل في المحفظة أو البنك"
          >
            <UInput
              v-model="form.holder"
              size="lg"
              class="w-full"
              autocomplete="off"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField
            label="رقم هوية صاحب الحساب"
            :hint="idHint"
          >
            <UInput
              v-model="form.holderId"
              dir="ltr"
              size="lg"
              class="w-full"
              inputmode="numeric"
              autocomplete="off"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <button
            type="submit"
            class="sr-only"
            tabindex="-1"
          />
        </form>
      </template>
      <template #footer>
        <div class="pa-foot">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            @click="open = false"
          />
          <UButton
            label="حفظ"
            color="primary"
            icon="i-lucide-check"
            :loading="saving"
            :ui="{ base: 'rounded-[13px] font-semibold min-h-11' }"
            @click="submit"
          />
        </div>
      </template>
    </UModal>
  </section>
</template>

<style scoped>
/* بطاقةٌ على مقاس «صورة الهوية» فوقها — والحالةُ في لون الأيقونة */
.pa { display: flex; align-items: center; gap: 14px 18px; flex-wrap: wrap; padding: 20px 24px; margin-bottom: 18px; border-radius: 14px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.pa-ico { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; background: var(--chip-warn-bg); color: var(--chip-warn-ink); flex: none; }
.pa.done .pa-ico { background: var(--green-soft); color: var(--green-ink); }
.pa-body { flex: 1 1 260px; min-width: 0; }
.pa-body h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--ink); }
.pa-body p { margin: 2px 0 0; color: var(--ink-2); font-size: 14px; line-height: 1.7; }
.pa-facts { display: flex; flex-wrap: wrap; gap: 4px 22px; margin: 4px 0 0; font-size: 14px; }
.pa-facts > div { display: flex; gap: 6px; min-width: 0; }
.pa-facts dt { color: var(--ink-3); }
.pa-facts dd { margin: 0; color: var(--ink); font-weight: 600; }
.pa-missing { color: var(--chip-warn-ink); font-weight: 500; }
.pa-acts { display: flex; gap: 8px; }
.pa-form { display: flex; flex-direction: column; gap: 14px; }
.pa-note { display: flex; align-items: center; gap: 8px; margin: 0; padding: 10px 12px; border-radius: 12px; background: var(--chip-warn-bg); color: var(--chip-warn-ink); font-size: 14px; }
.pa-foot { display: flex; justify-content: flex-end; gap: 10px; }
@media (max-width: 640px) {
  .pa { padding: 18px; }
  .pa-acts { width: 100%; }
  .pa-acts > * { flex: 1 1 auto; justify-content: center; }
}
</style>
