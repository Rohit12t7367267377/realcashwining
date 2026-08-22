create extension if not exists vector;

create table if not exists public.guru_ai_sources (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'school',
  kind text not null default 'lesson',
  title text not null,
  content text not null,
  topic_id uuid references public.guru_topics(id) on delete cascade,
  lesson_id uuid references public.guru_lessons(id) on delete cascade,
  board text,
  class_name text,
  subject text,
  language text not null default 'en',
  embedding vector(1536),
  model_version text,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.guru_ai_sources to authenticated;
grant all on public.guru_ai_sources to service_role;
alter table public.guru_ai_sources enable row level security;

drop policy if exists "guru_ai_sources_read_active" on public.guru_ai_sources;
create policy "guru_ai_sources_read_active" on public.guru_ai_sources
  for select to authenticated using (active = true);

drop policy if exists "guru_ai_sources_admin_all" on public.guru_ai_sources;
create policy "guru_ai_sources_admin_all" on public.guru_ai_sources
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create index if not exists guru_ai_sources_embedding_idx
  on public.guru_ai_sources using hnsw (embedding vector_cosine_ops);
create index if not exists guru_ai_sources_fts_idx
  on public.guru_ai_sources using gin (to_tsvector('english', title || ' ' || content));
create index if not exists guru_ai_sources_topic_idx on public.guru_ai_sources(topic_id);

drop trigger if exists guru_ai_sources_touch on public.guru_ai_sources;
create trigger guru_ai_sources_touch before update on public.guru_ai_sources
  for each row execute function public.touch_updated_at();

create or replace function public.match_guru_sources(
  query_embedding vector(1536),
  match_count int default 5,
  _topic_id uuid default null,
  _scope text default null
)
returns table (id uuid, title text, content text, scope text, kind text, topic_id uuid, similarity float)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.title, s.content, s.scope, s.kind, s.topic_id,
         1 - (s.embedding <=> query_embedding) as similarity
  from public.guru_ai_sources s
  where s.active = true
    and s.embedding is not null
    and (_topic_id is null or s.topic_id = _topic_id or s.topic_id is null)
    and (_scope is null or s.scope = _scope)
  order by s.embedding <=> query_embedding
  limit greatest(1, match_count);
$$;

revoke all on function public.match_guru_sources(vector, int, uuid, text) from public, anon;
grant execute on function public.match_guru_sources(vector, int, uuid, text) to authenticated, service_role;

create or replace function public.search_guru_sources(
  _query text,
  match_count int default 5,
  _topic_id uuid default null,
  _scope text default null
)
returns table (id uuid, title text, content text, scope text, kind text, topic_id uuid, similarity float)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.title, s.content, s.scope, s.kind, s.topic_id,
         ts_rank(to_tsvector('english', s.title || ' ' || s.content),
                 websearch_to_tsquery('english', _query))::float as similarity
  from public.guru_ai_sources s
  where s.active = true
    and (_topic_id is null or s.topic_id = _topic_id or s.topic_id is null)
    and (_scope is null or s.scope = _scope)
    and to_tsvector('english', s.title || ' ' || s.content) @@ websearch_to_tsquery('english', _query)
  order by similarity desc
  limit greatest(1, match_count);
$$;

revoke all on function public.search_guru_sources(text, int, uuid, text) from public, anon;
grant execute on function public.search_guru_sources(text, int, uuid, text) to authenticated, service_role;