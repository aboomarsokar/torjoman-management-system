<script setup lang="ts">
/**
 * بطاقة هيكلية (Skeleton) — نائبة عن بطاقة بيانات ريثما يكتمل الجلب غير الحاجز
 * (useLazyAsyncData). الشكل الافتراضي يطابق بطاقات الشبكات الشائعة في اللوحة:
 * أيقونة + عنوانان فرعيّان + شارات + سطر ميتا + زرّ إجراء. `lines` لعدد
 * الأسطر الفرعية تحت العنوان (نسخة مبسّطة بلا أيقونة عبر `icon="false"`).
 */
withDefaults(defineProps<{ lines?: number, icon?: boolean, image?: boolean }>(), {
  lines: 2,
  icon: true,
  image: false
})
</script>

<template>
  <div
    class="scard"
    :class="{ 'no-pad': image }"
    aria-hidden="true"
  >
    <USkeleton
      v-if="image"
      class="simage"
    />
    <div :class="image ? 'sbody' : ''">
      <div class="scard-top">
        <div class="scard-id">
          <USkeleton
            v-if="icon && !image"
            class="sicon"
          />
          <div class="stext">
            <USkeleton class="sline title" />
            <USkeleton
              v-for="i in lines"
              :key="i"
              class="sline"
              :style="{ width: i === lines ? '55%' : '75%' }"
            />
          </div>
        </div>
        <USkeleton
          v-if="!image"
          class="sbadge"
        />
      </div>
      <div class="smeta">
        <USkeleton class="schip" />
        <USkeleton class="schip" />
        <USkeleton class="schip sm" />
      </div>
      <USkeleton class="sbtn" />
    </div>
  </div>
</template>

<style scoped>
.scard { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 24px; box-shadow: var(--shadow); }
.scard.no-pad { padding: 0; overflow: hidden; }
.simage { width: 100%; height: 150px; border-radius: 0; }
.sbody { padding: 18px 20px; }
.scard-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.scard-id { display: flex; align-items: center; gap: 13px; min-width: 0; flex: 1; }
.sicon { width: 50px; height: 50px; border-radius: 14px; flex: none; }
.stext { display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
.sline { height: 13px; border-radius: 6px; width: 65%; }
.sline.title { height: 16px; width: 80%; }
.sbadge { width: 54px; height: 22px; border-radius: 999px; flex: none; }
.smeta { display: flex; align-items: center; gap: 16px; padding-top: 16px; border-top: 1px solid var(--line); margin-bottom: 16px; }
.schip { height: 14px; width: 64px; border-radius: 6px; }
.schip.sm { width: 44px; }
.sbtn { height: 34px; width: 100%; border-radius: 11px; }
</style>
