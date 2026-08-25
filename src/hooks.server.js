import { createSupabaseServerClient } from '$lib/supabase/server';

export async function handle({ event, resolve }) {
	event.locals.supabase = createSupabaseServerClient({ cookies: event.cookies });

	const {
		data: { user }
	} = await event.locals.supabase.auth.getUser();

	event.locals.user = user;
	return resolve(event);
}