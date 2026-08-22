create or replace function public.match_guru_sources(
  query_embedding vector(1536),
  match_count int default 5,
  _topic_id uuid default null,
  _scope text default null
)
returns table (id uuid, title text, content text, scope text, kind text, topic_id uuid, similarity float)
language sql
stable
security invoker
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

create or replace function public.search_guru_sources(
  _query text,
  match_count int default 5,
  _topic_id uuid default null,
  _scope text default null
)
returns table (id uuid, title text, content text, scope text, kind text, topic_id uuid, similarity float)
language sql
stable
security invoker
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