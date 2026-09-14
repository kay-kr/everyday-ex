# 평일 저녁 축구 트레이닝 · 3주

2026-09-14 ~ 10-02 (15세션) 플랜과 기록 대시보드.
월 · 화 · 목 · 금은 광명시민운동장에서 혼자 50분, **수요일은 클럽 축구 레슨**(약 115분)이다.

**`DASHBOARD.html` 을 브라우저로 열면 된다.**

| 파일 | 내용 |
|---|---|
| `DASHBOARD.html` | 오늘 할 세션, 지표, 3주 단계, 결정·리스크, 체중·통증 추세 |
| `_dashboard/plan.html` | 15세션 전체 루틴 |
| `_dashboard/moves.html` | 동작 사전 57가지 — 하는 순서, 자세 요령, 무릎 주의 (수요일 레슨 동작 포함) |
| `_dashboard/knee.html` | 왼쪽 무릎 안전선, 통증 신호등, 재활 동작 |
| `_dashboard/log.html` | 세션·체중·테스트 입력 (브라우저 저장 + JSON 내보내기) |
| `_dashboard/conversations.html` | 클로드와의 세션 기록 |
| `_dashboard/plandata.js` | 플랜 원본 데이터 — 루틴을 고치려면 여기만 고친다 |
| `_dashboard/moves.js` | 동작 정의 — 설명을 고치려면 여기만 고친다 |
| `_dashboard/store.js` | 기록 저장소 |

## 고칠 때

- 루틴·주차·심박 구간·준비물 → `_dashboard/plandata.js`
- 동작 설명 → `_dashboard/moves.js` (용어 툴팁에도 자동 등록된다)
- 그 밖의 용어 툴팁 → `_dashboard/terms.js`
- 페이지 추가 → `_dashboard/page.html` 복사 후 `_dashboard/pages.js` 에 한 줄
- `dashboard.css` · `dashboard.js` 는 건드리지 않는다

각 날의 블록은 세 가지로 나뉜다. 고칠 때 어디에 적을지 헷갈리지 않도록 구분을 지킨다.

| 필드 | 무엇 | 화면 |
|---|---|---|
| `items` | 하나 끝내면 하나 지우는 실제 수행 항목 | 체크박스가 붙는다 |
| `notes` | 세트 수·속도·주의 같은 설명 | 체크박스 없이 회색 줄 |
| `rest` | 그 블록에서 어떻게 쉬는지 | "쉬는 법" 상자. 모든 블록에 하나씩 |

세션 시간(50분 / 115분)은 적는 것이 아니라 블록 `min` 의 합으로 계산된다.

심박 구간은 1973년생 · 만 53세(HRmax 171) 기준이다. 해가 바뀌어 나이가 오르면 `plandata.js` 의 `profile.age` 와 `profile.hrmax`(208 − 0.7 × 나이), `zones[].bpm` 을 같이 고친다.
