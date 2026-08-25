import { json } from '@sveltejs/kit';

export async function POST({ locals, params, request }) {
	if (!locals.user) return json({ error: '로그인이 필요합니다.' }, { status: 401 });

	const body = await request.json();
	const { role, content, sequence } = body;
	if (!['user', 'assistant'].includes(role) || typeof content !== 'string' || !content.trim() || !Number.isInteger(sequence)) {
		return json({ error: '유효하지 않은 메시지입니다.' }, { status: 400 });
	}

	const { error } = await locals.supabase.from('conversation_messages').insert({
		conversation_id: params.id,
		user_id: locals.user.id,
		role,
		content: content.trim(),
		sequence
	});

	if (error) {
		console.error('대화 메시지 저장 실패:', error.message);
		return json({ error: '메시지를 저장하지 못했습니다.' }, { status: 500 });
	}
	return json({ ok: true });
}