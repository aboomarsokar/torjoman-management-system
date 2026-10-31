<script setup lang="ts">
/** سؤالا الالتزام في نموذج الالتحاق (جمعُ 15 طالباً، والتفرّغُ ساعتين يومياً) والإقرارُ بالشروط. */
const gather = defineModel<boolean | null>('gather', { required: true })
const daily = defineModel<boolean | null>('daily', { required: true })
const terms = defineModel<boolean>('terms', { required: true })
</script>

<template>
  <fieldset class="jc">
    <legend>الالتزام</legend>
    <CandidatesYesNo
      v-model="gather"
      label="هل تستطيع جمع 15 طالباً ضمن شروط المشروع؟"
    />
    <CandidatesYesNo
      v-model="daily"
      label="هل تستطيع تفريغ ساعتين يومياً للحلقة؟"
    />
  </fieldset>
  <UCheckbox
    v-model="terms"
    label="قرأتُ الشروط وأقرّ بانطباقها عليّ، وبالتزامي بعدم ازدواجية الحلقة."
    required
    class="jc-terms"
  />
</template>

<style scoped>
.jc { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.jc legend { font-size: 15px; font-weight: 700; color: var(--ink); margin-bottom: 12px; padding: 0; }
.jc-terms { padding: 14px 16px; border-radius: 12px; background: var(--surface-3); }
</style>
