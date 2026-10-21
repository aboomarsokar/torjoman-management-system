<script setup lang="ts">
/**
 * إضافةُ كتابٍ إلى كتب البرامج المصاحبة (للمديرَين) — العنوانُ والمؤلّفُ وعددُ الصفحات (يحدّ صفحاتِ المقرّرات).
 */
const open = defineModel<boolean>('open', { required: true })
const { busy, addBook } = useReadingAdmin()

const form = reactive({ title: '', author: '', pages: '' })
watch(open, (o) => {
  if (o) Object.assign(form, { title: '', author: '', pages: '' })
})

async function save() {
  const pages = Number(form.pages)
  if (await addBook({ title: form.title, author: form.author, pages: Number.isInteger(pages) && pages > 0 ? pages : null })) {
    open.value = false
    await refreshNuxtData('reading-books')
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="إضافة كتاب"
  >
    <template #body>
      <div class="form">
        <UFormField label="عنوان الكتاب">
          <UInput
            v-model="form.title"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <UFormField label="المؤلّف">
          <UInput
            v-model="form.author"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
        <UFormField label="عدد الصفحات">
          <UInput
            v-model="form.pages"
            inputmode="numeric"
            size="lg"
            class="w-full"
            :ui="{ base: 'rounded-[13px]' }"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="foot">
        <UButton
          label="إلغاء"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          @click="open = false"
        />
        <UButton
          label="إضافة"
          icon="i-lucide-check"
          color="primary"
          :loading="busy"
          class="min-h-11"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="save"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.form { display: flex; flex-direction: column; gap: 14px; }
.foot { display: flex; justify-content: flex-end; gap: 10px; width: 100%; }
</style>
