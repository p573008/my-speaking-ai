import { json } from '@sveltejs/kit';

export async function GET({ locals }) {
	if (!locals.user) return json({ error: '로그인이 필요합니다.' }, { status: 401 });

	const { data: conversations, error: conversationsError } = await locals.supabase
		.from('conversations')
		.select('id, title, status, duration_seconds, created_at, ended_at')
		.eq('user_id', locals.user.id)
		.order('created_at', { ascending: false });

	if (conversationsError) {
		console.error('대화 목록 조회 실패:', conversationsError.message);
		return json({ error: '대화 기록을 불러오지 못했습니다.' }, { status: 500 });
	}

	if (conversations.length === 0) return json({ conversations: [] });

	const conversationIds = conversations.map((conversation) => conversation.id);
	const { data: messages, error: messagesError } = await locals.supabase
		.from('conversation_messages')
		.select('id, conversation_id, role, content, sequence, created_at')
		.in('conversation_id', conversationIds)
		.order('sequence', { ascending: true });

	if (messagesError) {
		console.error('대화 메시지 조회 실패:', messagesError.message);
		return json({ error: '대화 메시지를 불러오지 못했습니다.' }, { status: 500 });
	}

	const messagesByConversation = new Map(conversationIds.map((id) => [id, []]));
	for (const message of messages) messagesByConversation.get(message.conversation_id)?.push(message);

	return json({
		conversations: conversations.map((conversation) => ({
			...conversation,
			conversation_messages: messagesByConversation.get(conversation.id) ?? []
		}))
	});
}

export async function POST({ locals }) {
	if (!locals.user) return json({ error: '로그인이 필요합니다.' }, { status: 401 });

	const { data, error } = await locals.supabase
		.from('conversations')
		.insert({ user_id: locals.user.id })
		.select('id')
		.single();

	if (error) {
		console.error('대화 생성 실패:', error.message);
		return json({ error: '대화를 생성하지 못했습니다.' }, { status: 500 });
	}
	return json({ conversationId: data.id });
}