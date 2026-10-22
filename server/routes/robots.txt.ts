/**
 * robots.txt — يسمح بفهرسة الصفحات العامّة ويشير إلى الـsitemap.
 * المسارات الخاصّة (اللوحة/المصادقة/الروابط العامّة للطلاب) لا تُفهرَس:
 * محميّة بالدور، وصفحاتها تحمل robots: noindex أصلاً.
 * ملاحظة: `/news$` (بعلامة $) يحجب صفحة إدارة الأخبار فقط دون `/news/[id]`
 * العامّة القابلة للفهرسة (شاشة قراءة الخبر، §4.26).
 */
export default defineEventHandler((event) => {
  const site = useRuntimeConfig().public.siteUrl.replace(/\/$/, '')
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return [
    'User-agent: *',
    'Allow: /$',
    'Disallow: /dashboard',
    'Disallow: /users',
    'Disallow: /students',
    'Disallow: /halqat',
    'Disallow: /visits',
    'Disallow: /exams',
    'Disallow: /reports',
    'Disallow: /finance',
    'Disallow: /incentives',
    'Disallow: /minutes',
    'Disallow: /alerts',
    'Disallow: /news$',
    'Disallow: /supervisors',
    'Disallow: /profile',
    'Disallow: /exam-plan',
    'Disallow: /auth',
    'Disallow: /s/',
    '',
    `Sitemap: ${site}/sitemap.xml`,
    ''
  ].join('\n')
})
