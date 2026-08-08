적용 순서

1) Supabase > SQL Editor > New query
   supabase-group-dm-upgrade.sql 전체 붙여넣고 Run
   - 기존 1:1 메시지/시간표/PIN 데이터 삭제 없음
   - 그룹채팅 테이블/RPC 추가
   - 1:1 메시지 증분 조회 및 전송 제한 완화 RPC 추가

2) Supabase > Edge Functions > chat-media
   기존 index.ts 전체를 chat-media-index.ts 내용으로 교체 후 Deploy updates
   - 기존 1:1 사진 경로 지원 유지
   - 그룹 사진 경로(g/{group_id}/...) 추가

3) GitHub Pages 저장소
   index.html, app.js, style.css 3개를 각각 통째로 덮어쓰기
   커밋 후 사이트 새로고침

주요 변경
- 단체 DM: 방 생성 -> 초대장 -> 상대 수락 후 입장
- 그룹 멤버 누구나 방 이름 변경/추가 초대 가능
- 그룹 나가기 지원
- 1:1 + 그룹 텍스트/사진/입력중/읽음
- 최근 메시지 이후 증분 로딩으로 폴링 비용 감소
- 전송 후 입력창 focus 복구(모바일 키보드 유지)
- 전송 제한: 5초 8개 / 1분 90개 수준으로 완화
- 시간표 조회: 학생 이름 옆 교실 제거, 과목 아래 교실 1회 표시
