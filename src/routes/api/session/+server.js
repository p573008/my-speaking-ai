import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export async function POST({ locals }) {
	if (!locals.user) {
		return json({ error: '로그인이 필요합니다.' }, { status: 401 });
	}

	const apiKey = env.OPENAI_API_KEY;

	if (!apiKey) {
		return json(
			{ error: 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다. 프로젝트 루트에 .env 파일을 만들고 API 키를 설정해주세요.' },
			{ status: 500 }
		);
	}
	try {
		const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${apiKey}`,
				'Content-Type': 'application/json',
				'OpenAI-Safety-Identifier': 'my-speaking-ai'
			},
			body: JSON.stringify({
				session: {
					type: 'realtime',
					model: 'gpt-realtime-2.1',
					//instructions: 'You are a friendly, encouraging English conversation partner. Speak in English, keep your responses concise, and encourage the user to speak. Speak naturally.',
					instructions: `당신은 친근하고 도움이 되는 영어 회화 선생님입니다. 
사용자와 자연스러운 영어 대화를 나누며, 필요시 발음이나 문법에 대한 피드백을 제공해주세요.
대화는 영어로 진행하되, 사용자가 이해하기 어려워하면 한국어로도 설명해주세요.`,

					audio: {
						output: {
							voice: 'alloy'
						},
						input: {
							transcription: {
								model: 'whisper-1'
							}
						}
					}
				}
			})
		});
		if (!response.ok) {
			const errText = await response.text();
			return json({ error: `OpenAI API 오류: ${errText}` }, { status: response.status });
		}
		const data = await response.json();
		const ephemeralKey = data.client_secret?.value || data.value;
		if (!ephemeralKey) {
			return json({ error: '임시 토큰을 찾을 수 없습니다. OpenAI API 응답을 확인해주세요.' }, { status: 500 });
		}
		return json({
			client_secret: {
				value: ephemeralKey
			}
		});
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : String(err);
		return json({ error: `세션 생성 중 서버 오류 발생: ${errMsg}` }, { status: 500 });
	}
}
