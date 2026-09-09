# QuizLive

QuizLive는 출제자가 PIN과 QR 코드를 공유하고, 참가자가 스마트폰으로 동시에 접속해 문제를 푸는 실시간 퀴즈 웹앱입니다.

## 기술 스택

- Next.js App Router, React, TypeScript, Tailwind CSS
- Supabase PostgreSQL, Supabase Realtime
- OpenAI JavaScript SDK Responses API
- Zod, qrcode, lucide-react

## 설치

```bash
npm install
```

## 환경변수

`.env.example`을 참고해 `.env.local`을 만드세요. 실제 비밀번호와 API 키는 Git에 올리지 마세요.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
```

`ADMIN_SESSION_SECRET`은 긴 난수 문자열을 사용하세요. 개발 환경에서는 아래처럼 만들 수 있습니다.

터미널에서 실행:

```bash
node -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

OpenAI 키가 없어도 직접 퀴즈 생성과 라이브 게임 기능은 동작합니다. AI 생성 버튼만 서버에서 설정 오류를 보여줍니다.

## Supabase 설정

1. Supabase 프로젝트를 만듭니다.
2. SQL Editor에서 `supabase/schema.sql` 내용을 실행합니다.
3. Project Settings에서 URL, anon key, service role key를 `.env.local`에 입력합니다.
4. Realtime 메뉴에서 `games`, `participants`, `participant_answers` 테이블이 publication에 포함되어 있는지 확인합니다.

참가자 화면은 Realtime 구독에 anon key만 사용합니다. 관리자 CRUD, 정답 판정, 점수 계산, OpenAI 호출은 서버 API에서 service role key로 처리합니다.

## 실행

```bash
npm run dev
```

브라우저에서 확인:

```text
http://localhost:3000
```

같은 Wi-Fi에서 스마트폰으로 테스트하려면 QR의 `localhost`가 스마트폰 자신을 가리키지 않도록 PC의 LAN IP 주소로 접속하세요.

## 관리자 로그인

첫 화면 우측 상단의 `관리자` 버튼을 누르고 `.env.local`의 `ADMIN_PASSWORD` 값을 입력합니다. 비밀번호는 클라이언트 번들, README, API 응답에 포함하지 않습니다.

## 검증

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

