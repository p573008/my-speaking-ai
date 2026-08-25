# My Speaking AI

OpenAI Realtime API와 WebRTC를 이용한 영어회화 연습 앱입니다. Supabase로 회원 인증과 대화 기록을 관리합니다.

## 주요 기능

- 이메일 회원가입, 로그인, 로그아웃
- 로그인 사용자만 음성 영어회화 사용
- OpenAI Realtime WebRTC 음성 대화
- 사용자와 AI의 대화 내용 저장
- 대화 기록 조회 및 삭제
- 비밀번호 변경
- 사용자별 데이터 접근을 제한하는 Supabase Row Level Security(RLS)

## 기술 스택

- SvelteKit 2
- Svelte 5
- Tailwind CSS
- Supabase Auth, PostgreSQL, RLS
- OpenAI Realtime API
- Vercel adapter

## 사전 준비

- Node.js와 npm
- Supabase 프로젝트
- OpenAI API 키
- 마이크를 사용할 수 있는 브라우저

## 설치

```bash
npm install
```

## 환경변수 설정

프로젝트 루트에 `.env` 파일을 만들고 다음 값을 설정합니다.

```env
OPENAI_API_KEY=your_openai_api_key
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

`PUBLIC_SUPABASE_URL`과 `PUBLIC_SUPABASE_PUBLISHABLE_KEY`는 브라우저에서 사용할 수 있는 공개 설정입니다. `OPENAI_API_KEY`는 서버에서만 사용되므로 브라우저 코드에 직접 넣지 않습니다.

`.env` 파일은 절대로 Git에 커밋하거나 공개 저장소에 업로드하지 않습니다. API 키가 노출된 경우 해당 키를 폐기하고 새 키를 발급하세요.

## Supabase 데이터베이스 설정

1. Supabase Dashboard에서 프로젝트를 엽니다.
2. `SQL Editor`로 이동합니다.
3. 프로젝트의 `supabase/schema.sql` 전체 내용을 붙여넣습니다.
4. SQL을 실행합니다.
5. `Table Editor`에서 `public` 스키마를 선택합니다.
6. 다음 테이블이 생성되었는지 확인합니다.

- `conversations`: 대화 세션 정보
- `conversation_messages`: 대화별 사용자·AI 메시지

`schema.sql`은 두 테이블에 RLS를 활성화하고, 로그인한 사용자가 본인의 데이터만 조회·생성·수정·삭제할 수 있도록 정책을 설정합니다.

## Supabase 인증 설정

Supabase Dashboard의 `Authentication`에서 Email provider를 활성화합니다.

이메일 확인을 사용하는 경우 개발 환경의 기본 주소는 다음과 같습니다.

```text
http://localhost:5173
```

확인 메일 링크가 다른 주소로 이동한다면 Supabase의 `URL Configuration`에서 실제 개발·배포 주소를 설정하세요.

## 실행

```bash
npm run dev
```

기본 주소는 `http://localhost:5173`입니다. 마이크 권한을 허용한 뒤 로그인하고 영어회화를 시작합니다.

## 사용자 흐름

1. `/login`에서 회원가입 또는 로그인
2. 메인 화면에서 영어회화 시작
3. 대화 시작 시 `conversations`에 세션 생성
4. 사용자와 AI의 전사 완료 메시지를 `conversation_messages`에 저장
5. 대화 종료 시 세션 상태와 대화 시간을 저장
6. 상단의 `기록` 메뉴에서 저장된 대화 확인

## 주요 경로

### 화면

- `/`: 영어회화 메인 화면
- `/login`: 로그인·회원가입
- `/history`: 대화 기록 조회·삭제
- `/account`: 비밀번호 변경

### API

- `POST /api/session`: 인증된 사용자의 OpenAI 임시 세션 토큰 발급
- `GET /api/conversations`: 내 대화 목록과 메시지 조회
- `POST /api/conversations`: 새 대화 생성
- `POST /api/conversations/:id/messages`: 메시지 저장
- `PATCH /api/conversations/:id`: 대화 상태와 시간 수정
- `DELETE /api/conversations/:id`: 대화 삭제

모든 대화 API는 서버에서 로그인 세션을 확인합니다.

## 검증 명령

```bash
npm run lint
npm test
npm run build
```

현재 저장소의 일부 기존 음성 녹음기 파일에는 린트 오류가 남아 있을 수 있습니다. 배포 빌드는 `npm run build`로 확인합니다.

## 배포 시 설정

배포 플랫폼에 다음 환경변수를 등록합니다.

- `OPENAI_API_KEY`
- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Supabase Authentication의 허용 URL과 이메일 확인 링크도 배포 도메인에 맞게 변경해야 합니다. `OPENAI_API_KEY`를 `PUBLIC_` 접두사가 붙은 변수로 만들지 마세요.
