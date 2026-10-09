-- Entitlement scenarios. Each records 'allow' or 'reject' into results(fn, case).
-- :fn is the label of the function version currently installed.
create temp table if not exists results (fn text, name text, outcome text);
create or replace function pg_temp.try(fn text, name text, stmt text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
    insert into results values (fn, name, 'allow');
  exception when sqlstate 'P0001' then
    insert into results values (fn, name, 'reject');
  end;
end $$;

truncate public.profiles, public.tips, public.live_tips, public.paid_sessions;
-- u1 free, 3 platforms in tips (mixed case)
insert into public.profiles values ('00000000-0000-0000-0000-000000000001','free');
insert into public.tips (user_id, platform) values
 ('00000000-0000-0000-0000-000000000001','Chaturbate'),('00000000-0000-0000-0000-000000000001','BongaCams'),('00000000-0000-0000-0000-000000000001','MyFreeCams');
-- u2 free, 2 platforms in tips + 1 only in live_tips (= 3)
insert into public.profiles values ('00000000-0000-0000-0000-000000000002','free');
insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000002','Chaturbate'),('00000000-0000-0000-0000-000000000002','BongaCams');
insert into public.live_tips (user_id, platform) values ('00000000-0000-0000-0000-000000000002','myfreecams');
-- u3 pro, 3 platforms
insert into public.profiles values ('00000000-0000-0000-0000-000000000003','pro');
insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000003','A'),('00000000-0000-0000-0000-000000000003','B'),('00000000-0000-0000-0000-000000000003','C');
-- u4 free, 2 platforms
insert into public.profiles values ('00000000-0000-0000-0000-000000000004','free');
insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000004','Chaturbate'),('00000000-0000-0000-0000-000000000004','BongaCams');
-- u5 no profile row (plan null → treated as free), 3 platforms
insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000005','A'),('00000000-0000-0000-0000-000000000005','B'),('00000000-0000-0000-0000-000000000005','C');
-- u6 free, empty history
insert into public.profiles values ('00000000-0000-0000-0000-000000000006','free');

select pg_temp.try(:'fn','free at limit, existing platform, same case',      $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000001','Chaturbate')$q$);
select pg_temp.try(:'fn','free at limit, existing platform, different case', $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000001','CHATURBATE')$q$);
select pg_temp.try(:'fn','free at exactly limit, new 4th platform',          $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000001','Stripchat')$q$);
select pg_temp.try(:'fn','platform only in live_tips, insert into tips',     $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000002','MyFreeCams')$q$);
select pg_temp.try(:'fn','live_tips-counted user at limit, new platform',    $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000002','Stripchat')$q$);
select pg_temp.try(:'fn','paid plan bypass, 4th platform',                   $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000003','D')$q$);
select pg_temp.try(:'fn','free below limit, new 3rd platform',               $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000004','MyFreeCams')$q$);
select pg_temp.try(:'fn','no profile row at limit, new platform',            $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000005','D')$q$);
select pg_temp.try(:'fn','no profile row, existing platform',                $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000005','a')$q$);
select pg_temp.try(:'fn','empty platform always allowed',                    $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000001','')$q$);
select pg_temp.try(:'fn','null platform always allowed',                     $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000001',null)$q$);
select pg_temp.try(:'fn','live_tips insert, at limit, new platform',         $q$insert into public.live_tips (user_id, platform) values ('00000000-0000-0000-0000-000000000001','Stripchat')$q$);
select pg_temp.try(:'fn','live_tips insert, existing platform',              $q$insert into public.live_tips (user_id, platform) values ('00000000-0000-0000-0000-000000000001','bongacams')$q$);
select pg_temp.try(:'fn','paid_sessions insert, at limit, new platform',     $q$insert into public.paid_sessions (user_id, platform) values ('00000000-0000-0000-0000-000000000001','Stripchat')$q$);
select pg_temp.try(:'fn','paid_sessions insert, existing platform',          $q$insert into public.paid_sessions (user_id, platform) values ('00000000-0000-0000-0000-000000000001','BongaCams')$q$);
-- one multi-row statement from empty history: 4 platforms → 4th row blocks the whole statement
select pg_temp.try(:'fn','one statement adds 4 new platforms from empty',    $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000006','A'),('00000000-0000-0000-0000-000000000006','B'),('00000000-0000-0000-0000-000000000006','C'),('00000000-0000-0000-0000-000000000006','D')$q$);
select pg_temp.try(:'fn','one statement adds 3 new platforms from empty',    $q$insert into public.tips (user_id, platform) values ('00000000-0000-0000-0000-000000000006','A'),('00000000-0000-0000-0000-000000000006','a'),('00000000-0000-0000-0000-000000000006','B'),('00000000-0000-0000-0000-000000000006','C')$q$);
