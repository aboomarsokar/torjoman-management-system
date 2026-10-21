<script setup lang="ts">
/**
 * نافذةُ قراءة المحضر: التاريخُ والحالةُ والحاضرون بأدوارهم، ثم أقسامُ المضمون الأربعة بنوداً مرقّمة
 * (كلُّ سطرٍ بند، فيُشار إليه «القرار ٢»). القسمُ الفارغ لا يُعرض. `canEdit` يُظهر زرَّ «تعديل».
 */
import { roleLabel } from '~/constants/roles'
import type { MinuteRow, MinuteStaff } from '~/utils/minutes'
import { MINUTE_SECTIONS, minuteDate, minuteItems } from '~/utils/minutes'

const props = defineProps<{ minute: MinuteRow | null, staff: MinuteStaff[], canEdit: boolean }>()
const emit = defineEmits<{ close: [], edit: [minute: MinuteRow] }>()

// آخرُ محضرٍ عُرض يبقى أثناء حركة الإغلاق (الأبُ يُفرغ `minute` فور الإغلاق)
const shown = ref<MinuteRow | null>(props.minute)
watch(() => props.minute, (m) => {
  if (m) shown.value = m
})

const attendees = computed(() => {
  const byId = new Map(props.staff.map(s => [s.id, s]))
  return (shown.value?.attendee_ids ?? []).map(id => byId.get(id)).filter(s => !!s)
})
const sections = computed(() => MINUTE_SECTIONS
  .map(s => ({ ...s, items: minuteItems(shown.value?.[s.key]) }))
  .filter(s => s.items.length))
</script>

<template>
  <UModal
    :open="!!minute"
    :title="shown?.title ?? ''"
    :ui="{ content: 'max-w-3xl', body: 'sm:p-7' }"
    @update:open="(v) => { if (!v) emit('close') }"
  >
    <template #body>
      <div
        v-if="shown"
        class="rd"
      >
        <div class="rd-meta">
          <span><UIcon
            name="i-lucide-calendar"
            class="size-[14px]"
          />{{ minuteDate(shown.meeting_date) }}</span>
          <span><UIcon
            name="i-lucide-users"
            class="size-[14px]"
          />{{ shown.attendee_ids.length }} حاضر</span>
          <UBadge
            :label="shown.status === 'final' ? 'معتمَد' : 'مسودّة'"
            :color="shown.status === 'final' ? 'success' : 'neutral'"
            variant="soft"
          />
        </div>

        <section
          v-if="attendees.length"
          class="rd-sec"
        >
          <h3 class="rd-h">
            الحاضرون
          </h3>
          <ul class="rd-att">
            <li
              v-for="a in attendees"
              :key="a.id"
            >
              <span class="rd-att-name">{{ a.full_name }}</span>
              <span class="rd-att-role">{{ roleLabel(a.role, a.gender) }}</span>
            </li>
          </ul>
        </section>

        <section
          v-for="s in sections"
          :key="s.key"
          class="rd-sec"
        >
          <h3 class="rd-h">
            <UIcon
              :name="s.icon"
              class="size-[16px] rd-h-icon"
            />
            {{ s.label }}
            <span class="rd-h-count">{{ s.items.length }}</span>
          </h3>
          <ol
            class="rd-list"
            :aria-label="s.label"
          >
            <li
              v-for="(it, i) in s.items"
              :key="i"
            >
              {{ it }}
            </li>
          </ol>
        </section>

        <p
          v-if="!sections.length"
          class="rd-empty"
        >
          لم يُكتب في هذا المحضر شيءٌ بعد.
        </p>
      </div>
    </template>
    <template
      v-if="canEdit && shown"
      #footer
    >
      <div class="rd-foot">
        <UButton
          label="تعديل"
          color="neutral"
          variant="outline"
          size="lg"
          icon="i-lucide-pencil"
          :ui="{ base: 'rounded-[13px]' }"
          @click="emit('edit', shown)"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.rd { display: flex; flex-direction: column; gap: 26px; }
.rd-meta { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.rd-meta > span { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--ink-2); font-variant-numeric: tabular-nums; }

.rd-sec { display: flex; flex-direction: column; gap: 10px; }
.rd-h { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15.5px; font-weight: 600; color: var(--ink); }
.rd-h-icon { color: var(--blue-ink); }
.rd-h-count {
  min-width: 22px; padding: 0 7px; border-radius: var(--r-pill); background: var(--surface-3);
  font-size: 12px; font-weight: 600; line-height: 20px; text-align: center; color: var(--ink-2); font-variant-numeric: tabular-nums;
}

.rd-att { display: flex; flex-wrap: wrap; gap: 6px 8px; margin: 0; padding: 0; list-style: none; }
.rd-att li { display: inline-flex; align-items: baseline; gap: 6px; padding: 5px 12px; border-radius: var(--r-pill); background: var(--surface-2); }
.rd-att-name { font-size: 13.5px; font-weight: 500; color: var(--ink); }
.rd-att-role { font-size: 12px; color: var(--ink-3); }

/* البنودُ مرقّمة: الرقمُ في دائرةٍ على يمين البند، والسطرُ الطويل ينكسر تحت نصّه لا تحت رقمه */
.rd-list { counter-reset: item; margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; }
.rd-list li {
  counter-increment: item; position: relative; padding-block: 9px; padding-inline: 38px 0;
  font-size: 15px; line-height: 1.9; color: var(--ink); border-top: 1px solid var(--line);
}
.rd-list li:first-child { border-top: 0; }
.rd-list li::before {
  content: counter(item); position: absolute; inset-inline-start: 0; top: 12px;
  width: 24px; height: 24px; border-radius: 50%; background: var(--blue-soft); color: var(--blue-ink);
  font-size: 12.5px; font-weight: 600; line-height: 24px; text-align: center; font-variant-numeric: tabular-nums;
}
.rd-empty { margin: 0; font-size: 14px; color: var(--ink-3); }
.rd-foot { display: flex; justify-content: flex-end; width: 100%; }
</style>
