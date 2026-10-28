-- علامةُ «قُرئت» في قائمة المحادثات (طلب المستخدم 2026-10-27): `my_chats` تُرجع هل قرأ الآخرون آخرَ رسالة.
drop function public.my_chats();
create function public.my_chats()
returns table (
  id uuid, kind text, group_key text, title text,
  other_id uuid, other_name text, other_role text, other_gender text, other_avatar text, other_last_seen timestamptz,
  last_message text, last_message_at timestamptz, last_sender_id uuid, unread integer, members integer, last_read_by_others boolean
)
language sql stable security definer
set search_path = ''
as $$
  select c.id, c.kind, c.group_key, c.title,
         o.id, o.full_name, o.role::text, o.gender::text, o.avatar_url, pr.last_seen_at,
         c.last_message, c.last_message_at, c.last_sender_id,
         (select count(*)::int from public.chat_messages m
           where m.conversation_id = c.id and m.created_at > me.last_read_at and m.sender_id is distinct from me.profile_id),
         (select count(*)::int from public.chat_members x where x.conversation_id = c.id),
         c.last_message_at is not null and not exists (
           select 1 from public.chat_members x
            where x.conversation_id = c.id and x.profile_id <> me.profile_id and x.last_read_at < c.last_message_at)
    from public.chat_members me
    join public.chat_conversations c on c.id = me.conversation_id
    left join lateral (
      select p.* from public.chat_members x join public.profiles p on p.id = x.profile_id
       where c.kind = 'direct' and x.conversation_id = c.id and x.profile_id <> me.profile_id limit 1
    ) o on true
    left join public.user_presence pr on pr.profile_id = o.id
   where me.profile_id = auth.uid()
     and (c.kind = 'group' or c.last_message_at is not null)
   order by coalesce(c.last_message_at, c.created_at) desc
$$;
revoke all on function public.my_chats() from public, anon;
grant execute on function public.my_chats() to authenticated;
