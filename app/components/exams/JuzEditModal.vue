<script setup lang="ts">
/**
 * تعديلُ جزءٍ من تقسيمة البرنامج (`program_juz`) — للمدير الإداري وحده (قرار المستخدم 2026-10-22):
 * سورةُ البداية وآيتُها وسورةُ النهاية وآيتُها. والحَكَمُ القاعدة: الآيةُ لا تتجاوز آياتِ سورتها (رسالتُها تُعرض كما هي).
 * يُصدر `saved` بعد الحفظ ليعيد الأبُ تحميلَ المراجع.
 */
import type { Database } from '~/types/database.types'
import type { SurahRef } from '~/composables/useQuranReference'
import type { ProgramJuz } from '~/utils/quran/position'

const props = defineProps<{ juz: ProgramJuz | null, surahs: SurahRef[] }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ saved: [] }>()

const supabase = useSupabaseClient<Database>()
const { handle } = useErrorHandler()
const toast = useToast()

const saving = ref(false)
const form = reactive({ start_surah: 1, start_ayah: 1, end_surah: 1, end_ayah: 1 })
const surahItems = computed(() => props.surahs.map(s => ({ label: `${s.number}. ${s.name}`, value: s.number })))
const maxAyah = (n: number) => props.surahs.find(s => s.number === n)?.ayahCount ?? 1

watch([open, () => props.juz], ([isOpen]) => {
  const j = props.juz
  if (!isOpen || !j) return
  Object.assign(form, { start_surah: j.start.surah, start_ayah: j.start.ayah, end_surah: j.end.surah, end_ayah: j.end.ayah })
}, { immediate: true })

function validate(s: typeof form) {
  const errors: { name: string, message: string }[] = []
  if (!Number.isInteger(s.start_ayah) || s.start_ayah < 1 || s.start_ayah > maxAyah(s.start_surah)) {
    errors.push({ name: 'start_ayah', message: `من 1 إلى ${maxAyah(s.start_surah)}.` })
  }
  if (!Number.isInteger(s.end_ayah) || s.end_ayah < 1 || s.end_ayah > maxAyah(s.end_surah)) {
    errors.push({ name: 'end_ayah', message: `من 1 إلى ${maxAyah(s.end_surah)}.` })
  }
  return errors
}

async function save() {
  if (!props.juz) return
  saving.value = true
  try {
    const { data, error } = await supabase.from('program_juz')
      .update({ ...form })
      .eq('number', props.juz.number)
      .select('number')
    if (error) throw error
    // تحديثٌ لم يمسّ صفّاً (تصفيةُ RLS) ليس نجاحاً
    if (!data?.length) throw new Error('لم يُحفظ التعديل — تعديلُ التقسيمة للمدير الإداري.')
    toast.add({ title: `حُفظ الجزء ${props.juz.number}.`, color: 'success', icon: 'i-lucide-circle-check' })
    open.value = false
    emit('saved')
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`تعديل الجزء ${juz?.number ?? ''}`"
  >
    <template #body>
      <UForm
        :state="form"
        :validate="validate"
        class="jf"
        @submit="save"
      >
        <div class="jf-row">
          <UFormField
            label="سورة البداية"
            class="jf-surah"
          >
            <UiSelect
              v-model="form.start_surah"
              :items="surahItems"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField
            label="آية البداية"
            name="start_ayah"
            class="jf-ayah"
          >
            <UInputNumber
              v-model="form.start_ayah"
              :min="1"
              :max="maxAyah(form.start_surah)"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>
        <div class="jf-row">
          <UFormField
            label="سورة النهاية"
            class="jf-surah"
          >
            <UiSelect
              v-model="form.end_surah"
              :items="surahItems"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <UFormField
            label="آية النهاية"
            name="end_ayah"
            class="jf-ayah"
          >
            <UInputNumber
              v-model="form.end_ayah"
              :min="1"
              :max="maxAyah(form.end_surah)"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>
        <p class="jf-hint">
          تتغيّر حدودُ الدورات وحسابُ الأجزاء المنجزة بتغيّر التقسيمة.
        </p>
        <div class="jf-actions">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            size="lg"
            @click="open = false"
          />
          <UButton
            type="submit"
            label="حفظ"
            color="primary"
            size="lg"
            :loading="saving"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
          />
        </div>
      </UForm>
    </template>
  </UModal>
</template>

<style scoped>
.jf { display: flex; flex-direction: column; gap: 16px; }
.jf-row { display: flex; gap: 14px; flex-wrap: wrap; }
.jf-surah { flex: 2; min-width: 180px; }
.jf-ayah { flex: 1; min-width: 110px; }
.jf-hint { margin: 0; font-size: 13.5px; color: var(--ink-2); }
.jf-actions { display: flex; justify-content: flex-end; gap: 10px; }
</style>
