create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '영어회화 대화',
  status text not null default 'active' check (status in ('active', 'completed', 'failed')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(trim(content)) > 0),
  sequence integer not null check (sequence >= 0),
  created_at timestamptz not null default now(),
  unique (conversation_id, sequence)
);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

create policy "Users can manage their conversations"
on public.conversations for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage their messages"
on public.conversation_messages for all
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.conversations
    where conversations.id = conversation_id
      and conversations.user_id = auth.uid()
  )
);

create index conversations_user_created_idx on public.conversations(user_id, created_at desc);
create index conversation_messages_conversation_sequence_idx on public.conversation_messages(conversation_id, sequence);