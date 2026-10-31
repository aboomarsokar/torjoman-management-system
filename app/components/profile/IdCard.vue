<script setup lang="ts">
/**
 * «صورة الهوية» في صفحة حسابي (طلب المستخدم 2026-10-31) — للعاملين لا للطلاب: صورةٌ واحدةٌ تُلتقط بالكاميرا أو تُختار
 * (أو PDF)، وتُصغَّر على الجهاز قبل الرفع، وتُستبدل متى شاء صاحبُها. لا يراها إلا هو والمديرُ الإداريّ (والمديرةُ
 * الإدارية لعاملات قسم البنات).
 */
const props = defineProps<{ profileId: string }>()

const id = computed(() => props.profileId)
const { card, busy, load, upload, view } = useIdCard(id)
onMounted(load)
const picker = ref<HTMLInputElement | null>(null)
async function onPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await upload(file)
}
const uploadedOn = computed(() => card.value
  ? new Date(card.value.uploaded_at).toLocaleDateString('ar-EG-u-nu-latn', { day: '2-digit', month: '2-digit', year: 'numeric' })
  : '')
</script>

<template>
  <section
    class="idc"
    :class="{ done: !!card }"
    aria-labelledby="idc-title"
  >
    <span class="idc-ico"><UIcon
      :name="card ? 'i-lucide-badge-check' : 'i-lucide-id-card'"
      class="size-6"
    /></span>
    <div class="idc-body">
      <h3 id="idc-title">
        صورة الهوية
      </h3>
      <p v-if="card">
        رُفعت في <bdi dir="ltr">{{ uploadedOn }}</bdi> — لا يراها إلا الإدارة.
      </p>
      <p v-else>
        ارفع صورةً واضحةً لهويتك (الوجه الذي فيه الصورة والرقم). لا يراها إلا الإدارة.
      </p>
    </div>
    <div class="idc-acts">
      <input
        ref="picker"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        class="sr-only"
        aria-label="اختر صورة الهوية"
        @change="onPicked"
      >
      <UButton
        v-if="card"
        label="اعرضها"
        icon="i-lucide-eye"
        color="neutral"
        variant="soft"
        :ui="{ base: 'rounded-[12px] min-h-11' }"
        @click="view"
      />
      <UButton
        :label="card ? 'استبدلها' : 'ارفع صورة الهوية'"
        :icon="card ? 'i-lucide-replace' : 'i-lucide-camera'"
        :color="card ? 'neutral' : 'primary'"
        :variant="card ? 'ghost' : 'solid'"
        :loading="busy"
        :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
        @click="picker?.click()"
      />
    </div>
  </section>
</template>

<style scoped>
.idc { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; padding: 16px 18px; border-radius: 18px; background: var(--surface); box-shadow: var(--shadow-sm); border-inline-start: 4px solid var(--warn, var(--ui-warning)); }
.idc.done { border-inline-start-color: var(--ui-success); }
.idc-ico { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; background: var(--surface-2); color: var(--blue-ink); flex: none; }
.idc.done .idc-ico { color: var(--green-ink); }
.idc-body { flex: 1 1 220px; min-width: 0; }
.idc-body h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--ink); }
.idc-body p { margin: 2px 0 0; color: var(--ink-2); font-size: 14px; line-height: 1.7; }
.idc-acts { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
