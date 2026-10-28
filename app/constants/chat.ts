/** ثوابتُ المحادثات الفورية (طلب المستخدم 2026-10-27). */

/** أطولُ رسالة — يطابق قيدَ `chat_messages.body`. */
export const CHAT_MAX_BODY = 2000
/** كم رسالةً تُحمَّل عند فتح المحادثة. */
export const CHAT_PAGE_SIZE = 100
/** نبضُ «آخر ظهور» ما دامت المنصّة مفتوحة. */
export const CHAT_HEARTBEAT_MS = 60_000
/** «متصلٌ الآن» من كان آخرُ ظهوره في هذه المدّة (نبضتان وهامش). */
export const CHAT_ONLINE_WINDOW_MS = 150_000
/** إعادةُ قراءة القائمة لتحديث الحالات (متصل / آخر ظهور). */
export const CHAT_LIST_REFRESH_MS = 60_000
/** المنطقةُ الزمنية لعرض الأوقات. */
export const CHAT_TIME_ZONE = 'Asia/Gaza'
