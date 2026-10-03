-- 출석·숙제 스티커용 (Supabase > SQL Editor 에 붙여넣고 Run)
create table if not exists attendance (
  app_id uuid not null references applications(id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  primary key (app_id, day)
);
create table if not exists homework (
  app_id uuid not null references applications(id) on delete cascade,
  day date not null,
  photo_path text not null,
  created_at timestamptz not null default now(),
  primary key (app_id, day)
);
alter table attendance enable row level security;
alter table homework enable row level security;
grant select, insert, update, delete on attendance, homework to service_role;

-- 숙제 사진 보관함 (비공개)
insert into storage.buckets (id, name, public) values ('homework', 'homework', false)
on conflict (id) do nothing;
