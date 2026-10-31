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
/* بطاقةٌ بمقاس ترويسة الملفّ وتباعدِها (حدٌّ وظلٌّ وهامشٌ سفليّ 18px) — والحالةُ في لون الأيقونة لا في حافّةٍ جانبية */
.idc { display: flex; align-items: center; gap: 14px 18px; flex-wrap: wrap; padding: 20px 24px; margin-bottom: 18px; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.idc-ico { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; background: var(--chip-warn-bg); color: var(--chip-warn-ink); flex: none; }
.idc.done .idc-ico { background: var(--green-soft); color: var(--green-ink); }
.idc-body { flex: 1 1 260px; min-width: 0; }
.idc-body h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--ink); }
.idc-body p { margin: 2px 0 0; color: var(--ink-2); font-size: 14px; line-height: 1.7; }
.idc-acts { display: flex; gap: 8px; flex-wrap: wrap; }
@media (max-width: 640px) {
  .idc { padding: 18px; }
  .idc-acts { width: 100%; }
  .idc-acts > * { flex: 1 1 auto; justify-content: center; }
}
</style>
