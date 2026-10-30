<script setup lang="ts">
/**
 * نموذجُ رسالةٍ للكادر (طلب المستخدم 2026-10-25): لمجموعةٍ (فئاتٌ × قسمٌ في نطاق المرسِل) أو لشخصٍ بعينه،
 * بعنوانٍ ونصٍّ ورابطٍ اختياريٍّ لصفحةٍ في المنصّة. يُفرَّغ بعد الإرسال الناجح.
 */
import {
  MAX_MESSAGE_BODY, MAX_MESSAGE_TITLE, MESSAGE_LINKS, SECTION_LABELS, STAFF_ROLE_LABELS, STAFF_ROLES, type Section
} from '~/constants/announcements'
import { roleLabel } from '~/constants/roles'
import type { MessageDraft, StaffPerson } from '~/composables/useStaffMessages'
import { rewriteAudience } from '~/composables/useAiRewrite'
import type { SegmentTab } from '~/components/ui/SegmentTabs.vue'

const props = defineProps<{ sections: Section[], people: StaffPerson[], busy: boolean }>()
const emit = defineEmits<{ send: [draft: MessageDraft, reset: () => void] }>()

const blank = (): MessageDraft => ({
  mode: 'group', title: '', body: '', link: undefined, roles: ['teacher'],
  section: props.sections.length === 1 ? props.sections[0] : undefined, target: undefined
})
const form = reactive<MessageDraft>(blank())
const reset = () => Object.assign(form, blank())
watch(() => props.sections, reset)

const female = computed(() => form.section === 'female')
const modeTabs: SegmentTab<MessageDraft['mode']>[] = [
  { key: 'group', label: 'مجموعة', icon: 'i-lucide-users-round' },
  { key: 'person', label: 'شخصٌ بعينه', icon: 'i-lucide-user' }
]
const sectionItems = computed(() => props.sections.map(s => ({ label: SECTION_LABELS[s], value: s })))
const roleItems = computed(() => STAFF_ROLES.map(r => ({ label: STAFF_ROLE_LABELS[r][female.value ? 'f' : 'm'], value: r })))
const personItems = computed(() => props.people.map(p => ({
  label: p.full_name, value: p.id, description: roleLabel(p.role as never, p.gender as never)
})))
const linkItems = MESSAGE_LINKS.map(l => ({ label: l.label, value: l.to }))

const ai = useAiRewrite(() => ({ title: form.title, body: form.body }), (d) => {
  form.title = d.title.slice(0, MAX_MESSAGE_TITLE)
  form.body = d.body.slice(0, MAX_MESSAGE_BODY)
})
const audience = computed(() => form.mode === 'group'
  ? rewriteAudience(form.section)
  : rewriteAudience(null, props.people.find(p => p.id === form.target)?.gender))
</script>

<template>
  <section
    class="cf"
    aria-label="رسالةٌ جديدة"
  >
    <UiSegmentTabs
      v-model="form.mode"
      :tabs="modeTabs"
      label="المستلمون"
    />
    <div
      v-if="form.mode === 'group'"
      id="panel-group"
      role="tabpanel"
      aria-labelledby="tab-group"
      class="cf-row"
    >
      <UFormField label="الفئات">
        <div class="cf-roles">
          <UCheckbox
            v-for="r in roleItems"
            :key="r.value"
            :model-value="form.roles.includes(r.value)"
            :label="r.label"
            @update:model-value="(on) => form.roles = on ? [...form.roles, r.value] : form.roles.filter(x => x !== r.value)"
          />
        </div>
      </UFormField>
      <UFormField label="القسم">
        <UiSelect
          v-model="form.section"
          :items="sectionItems"
          :disabled="sectionItems.length === 1"
          placeholder="اختر القسم"
          size="xl"
          class="w-full"
          :ui="{ base: 'rounded-[12px] min-h-12' }"
        />
      </UFormField>
    </div>
    <UFormField
      v-else
      id="panel-person"
      role="tabpanel"
      aria-labelledby="tab-person"
      label="إلى"
    >
      <USelectMenu
        v-model="form.target"
        :items="personItems"
        value-key="value"
        aria-label="اختر المستلم"
        placeholder="ابحث بالاسم"
        :search-input="{ placeholder: 'اكتب الاسم…' }"
        size="xl"
        class="w-full"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
    </UFormField>
    <UFormField
      label="العنوان"
      :hint="`${form.title.trim().length}/${MAX_MESSAGE_TITLE}`"
    >
      <UInput
        v-model="form.title"
        size="xl"
        class="w-full"
        :maxlength="MAX_MESSAGE_TITLE"
        placeholder="مثلاً: أُضيف زرُّ «تغيير الموعد» في لوحتك"
        :ui="{ base: 'rounded-[12px] min-h-12' }"
      />
    </UFormField>
    <div class="cf-body">
      <UFormField
        label="التفاصيل (اختياريّة)"
        :hint="`${form.body.trim().length}/${MAX_MESSAGE_BODY}`"
      >
        <UTextarea
          v-model="form.body"
          :rows="4"
          autoresize
          class="w-full"
          :maxlength="MAX_MESSAGE_BODY"
          :ui="{ base: 'rounded-[12px]' }"
        />
      </UFormField>
      <MessagesRewriteActions
        :busy="ai.busy.value"
        :can-undo="ai.canUndo.value"
        :disabled="(!form.title.trim() && !form.body.trim()) || busy"
        @rewrite="ai.rewrite('announcement', audience)"
        @undo="ai.undo"
      />
    </div>
    <div class="cf-row cf-foot">
      <UFormField label="زرٌّ يفتح صفحة (اختياريّ)">
        <UiSelect
          v-model="form.link"
          :items="linkItems"
          placeholder="بلا زرّ"
          size="xl"
          class="w-full"
          :ui="{ base: 'rounded-[12px] min-h-12' }"
        />
      </UFormField>
      <div class="cf-actions">
        <UButton
          v-if="form.link"
          label="بلا زرّ"
          color="neutral"
          variant="ghost"
          :ui="{ base: 'rounded-[12px] min-h-11' }"
          @click="form.link = undefined"
        />
        <UButton
          label="أرسل الرسالة"
          icon="i-lucide-send"
          color="primary"
          :loading="busy"
          :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
          @click="emit('send', { ...form, roles: [...form.roles] }, reset)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.cf {
  display: flex; flex-direction: column; gap: 16px; padding: 20px 22px; border-radius: 16px;
  background: var(--surface); box-shadow: var(--shadow); container: cf / inline-size;
}
.cf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; align-items: end; }
.cf-body { display: flex; flex-direction: column; gap: 8px; }
.cf-foot { padding-top: 16px; border-top: 1px solid var(--line); }
/* في عمودٍ ضيّق (الشاشة العريضة بعمودين، أو الجوال) تتراصّ الحقول */
@container cf (max-width: 560px) {
  .cf-row { grid-template-columns: 1fr; }
  .cf-actions { justify-content: stretch; }
  .cf-actions > * { flex: 1; justify-content: center; }
}
.cf-roles { display: flex; flex-wrap: wrap; gap: 10px 18px; min-height: 48px; align-items: center; }
.cf-actions { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 640px) {
  .cf { padding: 16px; }
  .cf-row { grid-template-columns: 1fr; }
}
</style>
