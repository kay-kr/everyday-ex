/* 대시보드 페이지 목록. 페이지를 추가하면 여기 한 줄만 넣는다 — 모든 페이지의 상단 내비에 자동 반영된다. */
window.DB_PROJECT = "평일 저녁 축구 트레이닝";
window.DB_PAGES = [
  { title: "대시보드",  href: "DASHBOARD.html",                summary: "오늘 할 세션, 3주 단계, 핵심 지표와 결정·리스크 요약. 운동 나가기 전에 여기서 시작한다." },
  { title: "3주 루틴",  href: "_dashboard/plan.html",          summary: "9월 14일부터 10월 2일까지 15개 세션의 전체 루틴. 요일별 성격, 워밍업·메인·쿨다운 구성과 세트 수까지." },
  { title: "동작 사전", href: "_dashboard/moves.html",          summary: "레그스윙부터 인스텝 슛까지, 이 플랜에 나오는 모든 동작의 하는 순서와 자세 요령. 이름만 보고 모르겠을 때 찾는 곳이다." },
  { title: "무릎 관리", href: "_dashboard/knee.html",          summary: "왼쪽 무릎 안전 규칙, 통증 신호등, 매일 하는 재활 5종과 동작별 주의점. 통증이 생기면 여기부터 본다." },
  { title: "기록",      href: "_dashboard/log.html",           summary: "세션별 완료·RPE·무릎 통증·거리·심박과 체중을 직접 입력한다. 입력한 값이 대시보드의 지표와 차트에 바로 반영된다." },
  { title: "대화 기록", href: "_dashboard/conversations.html", summary: "클로드와의 세션별 기록. 무엇을 요청했고 어떤 근거로 플랜이 이렇게 정해졌는지 남긴다." },
];
