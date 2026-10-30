-- خطةُ القسم للقيادات وحدها (طلب المستخدم 2026-10-30): المدير الإداريّ والفنيّ والمديرة الإدارية ومشرف المشروع —
-- فالمسؤولُ عن نشاطٍ منهم وحدهم، ولا يُسند نشاطٌ لغيرهم.
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
                    and pr.role::text in ('admin_manager', 'technical_manager', 'women_admin', 'project_supervisor')) then
    raise exception 'المسؤول عن نشاط الخطة من القيادات: المدير الإداري أو الفني أو المديرة الإدارية أو مشرف المشروع.' using errcode = '23514';
  end if;
  select * into t from public.dept_plan_tasks where id = new.task_id;
  perform private.notify(new.profile_id, 'plan_task_assigned', 'أُسندت إليك مهمّة في خطة القسم',
    t.title || ' · الموعد ' || to_char(t.due_on, 'DD/MM'), '/plan', 'dept_plan_tasks', t.id);
  return new;
end;
$$;
revoke all on function private.dept_owner_guard() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from public.dept_plan_task_owners o join public.profiles p on p.id = o.profile_id
              where p.role::text not in ('admin_manager', 'technical_manager', 'women_admin', 'project_supervisor')) then
    raise exception 'يوجد مسؤولٌ من غير القيادات — راجعه قبل التطبيق';
  end if;
end $$;
