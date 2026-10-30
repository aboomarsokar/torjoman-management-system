-- حذفُ رسالةٍ في المحادثات (طلب المستخدم 2026-10-29): المرسِلُ وحده يحذف رسالتَه للجميع، فيُمحى نصُّها من القاعدة
-- (لا يُخفى فقط) ويبقى مكانُها «حُذفت هذه الرسالة» عند الطرفين لحظياً، وإن كانت آخرَ رسالةٍ تتبعها معاينةُ القائمة.

alter table public.chat_messages add column deleted_at timestamptz;
alter table public.chat_messages drop constraint chat_messages_body_check;
alter table public.chat_messages add constraint chat_messages_body_check check (
  (deleted_at is null and char_length(btrim(body)) between 1 and 2000)
  or (deleted_at is not null and body = '')
);

create or replace function public.delete_chat_message(p_message uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  m public.chat_messages%rowtype;
begin
  perform private.assert_session_writable();
  select * into m from public.chat_messages where id = p_message for update;
  if not found or m.sender_id is distinct from auth.uid() then
    raise exception 'تحذف رسائلَك أنت فقط.' using errcode = '42501';
  end if;
  if m.deleted_at is not null then
    return;
  end if;
  update public.chat_messages set body = '', deleted_at = now() where id = p_message;
  -- معاينةُ القائمة إن كانت هي الأخيرة
  update public.chat_conversations c set last_message = '🚫 حُذفت رسالة'
   where c.id = m.conversation_id and c.last_message_at = m.created_at and c.last_sender_id = m.sender_id;
end;
$$;
revoke all on function public.delete_chat_message(uuid) from public, anon;
grant execute on function public.delete_chat_message(uuid) to authenticated;
