import { json } from '@sveltejs/kit';

export async function DELETE({ locals, params }) {
	if (!locals.user) return json({ error: '로그인이 필요합니다.' }, { status: 401 });

	const { error } = await locals.supabase
		.from('conversations')
		.delete()
		.eq('id', params.id)
		.eq('user_id', locals.user.id);

	if (error) return json({ error: '대화를 삭제하지 못했습니다.' }, { status: 500 });
	return json({ ok: true });
}

export async function PATCH({ locals, params, request }) {
	if (!locals.user) return json({ error: '로그인이 필요합니다.' }, { status: 401 });

	const body = await request.json();
	const status = ['active', 'completed', 'failed'].includes(body.status) ? body.status : null;
	if (!status || !Number.isInteger(body.durationSeconds) || body.durationSeconds < 0) {
		return json({ error: '유효하지 않은 대화 상태입니다.' }, { status: 400 });
	}

	const { error } = await locals.supabase
		.from('conversations')
		.update({ status, duration_seconds: body.durationSeconds, ended_at: new Date().toISOString() })
		.eq('id', params.id)
		.eq('user_id', locals.user.id);

	if (error) return json({ error: '대화 상태를 저장하지 못했습니다.' }, { status: 500 });
	return json({ ok: true });
}