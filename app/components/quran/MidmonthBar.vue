<script setup lang="ts">
/**
 * بطاقةُ «رصد منتصف الشهر» للمعلّم (طلب المستخدم 2026-11-21): هل سُلّم ومتى، وزرُّ التسليم (أو إعادته) بتأكيد،
 * ومعطَّلٌ بسببه (قبل يوم 15، أو بلا اتصال، أو قبل رفع الرصد). تظهر في الشهر الجاري ما دام مسوّدة.
 */
import { formatDay } from '~/utils/reportWindow'

const props = defineProps<{
  submittedAt: string | null
  block: string | null
  busy: boolean
  submit: () => Promise<boolean>
}>()

const confirmOpen = ref(false)
const when = computed(() => props.submittedAt ? formatDay(props.submittedAt) : null)
async function onConfirm() {
  if (await props.submit()) confirmOpen.value = false
}
</script>

<template>
  <section
    class="mid"
    :class="{ done: !!submittedAt }"
    aria-label="رصد منتصف الشهر"
  >
    <UIcon
      :name="submittedAt ? 'i-lucide-flag' : 'i-lucide-flag-triangle-right'"
      class="mid-ic"
      aria-hidden="true"
    />
    <div class="mid-txt">
      <b>رصدُ منتصف الشهر</b>
      <span v-if="when">سُلّم في <bdi dir="ltr">{{ when }}</bdi> — تستطيع متابعةَ الرصد وإعادةَ التسليم.</span>
      <span v-else>{{ block ?? 'ارصد أين وصل كلُّ طالب ثم سلّمه ليتابعه المشرفُ والإدارة.' }}</span>
    </div>
    <UButton
      :label="submittedAt ? 'إعادة التسليم' : 'تسليم رصد المنتصف'"
      icon="i-lucide-flag"
      :color="submittedAt ? 'neutral' : 'primary'"
      :variant="submittedAt ? 'outline' : 'solid'"
      :disabled="!!block"
      :loading="busy"
      :ui="{ base: 'rounded-[13px] min-h-11 justify-center font-semibold' }"
      @click="confirmOpen = true"
    />
    <UiConfirmModal
      v-model:open="confirmOpen"
      title="تسليم رصد المنتصف"
      message="تُحفظ صورةٌ من رصدك الحاليّ ليتابعها المشرفُ والإدارة. تبقى المسوّدةُ مفتوحة، ويُرسَل رصدُ الشهر للاعتماد آخرَ يومٍ منه."
      confirm-label="تسليم"
      confirm-color="primary"
      confirm-icon="i-lucide-flag"
      :loading="busy"
      @confirm="onConfirm"
    />
  </section>
</template>

<style scoped>
.mid { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-radius: 16px; background: var(--blue-soft); border: 1px solid var(--line); }
.mid.done { background: var(--green-soft); }
.mid-ic { width: 22px; height: 22px; flex-shrink: 0; color: var(--blue-ink); }
.mid.done .mid-ic { color: var(--green-ink); }
.mid-txt { flex: 1 1 220px; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.mid-txt b { font-size: 15px; color: var(--ink); }
.mid-txt span { font-size: 13.5px; color: var(--ink-2); line-height: 1.7; }
</style>
