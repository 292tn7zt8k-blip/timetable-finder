# 시간표 공유 v3

GitHub Pages + Supabase 기반의 학생 시간표 공유 웹앱입니다.

## 핵심 동작

- 최초: 학번 + 이름 입력 → Microsoft 계정 로그인 → 학생 계정 1회 연결
- 이후: 같은 Microsoft 계정으로 로그인해야 자기 시간표 수정 가능
- AI 시간표 분석: 학생당 유료 분석 요청 최대 2회
- 1회차 성공 후 2회차 분석까지 10분 대기
- AI 실패/파싱 실패는 횟수 차감하지 않음
- 과목은 직접 타이핑하지 않고 서버의 표준 과목 목록에서 선택
- `미확인` 칸이 남아 있으면 저장 불가
- 시간표 저장을 완료한 학생만 다른 학생 시간표 / 공강 / 같은 수업 조회 가능
- 같은 이름 학생은 학번으로 구분

## GitHub에 올려도 되는 파일

- `index.html`
- `style.css`
- `app.js`
- `core.js`
- `README.md`

Supabase Project URL과 Publishable Key는 브라우저 앱에서 사용하는 공개용 값입니다.

## GitHub에 올리면 안 되는 것

- `OPENAI_API_KEY`
- Supabase Service Role Key
- 학생 명단 SQL
- `SUPABASE_SETUP_ALL.sql`

학생 명단과 비밀키는 Supabase 쪽에만 둡니다.

## 별도 서버 설정

Microsoft 로그인, DB/RLS, 학생 명단, Edge Function 설정이 필요합니다. 자세한 순서는 비공개 설정 패키지의 `SETUP.md`를 참고하세요.
