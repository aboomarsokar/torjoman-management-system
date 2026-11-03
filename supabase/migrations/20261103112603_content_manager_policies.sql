-- صلاحياتُ مدير المحتوى (طلب المستخدم 2026-11-03):
-- · الأخبار: يكتب وينشر ويحذف كالمدير الإداريّ (`can_manage_news`)، ويقرأ غيرَ المنشور.
-- · خطة القسم: يقرؤها كاملةً (`can_view_full_dept_plan`) بلا تعديل (`can_edit_dept_plan` لا تشمله)،
--   ويُسند إليه نشاطٌ فيحدّث حالتَه (`dept_owner_guard` يقبله مسؤولاً، و`dept_task_guard` يسمح للمسؤول بالحالة).
create or replace function public.can_manage_news()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select public.current_user_role()) in ('admin_manager', 'content_manager'), false)
$$;
revoke all on function public.can_manage_news() from public, anon;
grant execute on function public.can_manage_news() to authenticated;

drop policy news_write on public.news;
create policy news_write on public.news for all to authenticated
  using ((select public.can_manage_news())) with check ((select public.can_manage_news()));
drop policy news_select_staff on public.news;
create policy news_select_staff on public.news for select to authenticated
  using ((select public.can_manage_news()) or (select public.is_project_supervisor()));

create or replace function public.can_view_full_dept_plan()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select public.current_user_role()) in ('admin_manager', 'technical_manager', 'women_admin', 'project_supervisor', 'content_manager'), false)
$$;

create or replace function private.dept_owner_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  t public.dept_plan_tasks%rowtype;
begin
  if not exists (select 1 from public.profiles pr
                  where pr.id = new.profile_id and pr.status::text = 'active'
                    and pr.role::text in ('admin_manager', 'technical_manager', 'women_admin', 'project_supervisor', 'content_manager')) then
    raise exception 'المسؤول عن نشاط الخطة من القيادات: المدير الإداري أو الفني أو المديرة الإدارية أو مشرف المشروع أو مدير المحتوى.' using errcode = '23514';
  end if;
  select * into t from public.dept_plan_tasks where id = new.task_id;
  perform private.notify(new.profile_id, 'plan_task_assigned', 'أُسندت إليك مهمّة في خطة القسم',
    t.title || ' · الموعد ' || to_char(t.due_on, 'DD/MM'), '/plan', 'dept_plan_tasks', t.id);
  return new;
end;
$$;
