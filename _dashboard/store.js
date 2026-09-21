/* 운동 기록 저장소. 브라우저의 localStorage 한 곳에 모으고, 모든 페이지가 이것만 쓴다.
   DASHBOARD.html 은 읽기만, log.html 이 읽고 쓴다.

   저장 구조:
     sessions : { "2026-09-21": {done, steps, nrsPre, nrsPost, nrsAm, note} }
                날짜로 매기는 기록이다 — 매일 하는 집 근력 루틴과 그날의 무릎 통증이 여기 들어간다.
     field    : { "f1a": {done, at, steps, rpe, km, hr, note} }
                운동장 세션은 요일이 정해져 있지 않다. 그래서 날짜가 아니라 슬롯 id 로 매긴다.
                실제로 나간 날짜는 at 에 적는다.
     weights  : { "2026-09-21": 73.5 }
     tests    : { t1, t2, t3, t4, at }

   2026-09-21 개편 전의 기록(sessions 안의 9/14~9/18)은 지우지 않고 그대로 둔다.
   체중과 통증 차트는 계획이 아니라 "기록이 있는 모든 날짜"를 그리므로 그 값들도 계속 보인다.

   브라우저 저장이 막혀 있으면 available() 이 false 를 돌려주고 화면은 계획만 보여 준다. */
window.EXLOG = (function () {
  'use strict';
  var KEY = 'ex-log-v1';

  function blank() { return { sessions: {}, field: {}, weights: {}, tests: {}, updated: null }; }

  function available() {
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; }
    catch (e) { return false; }
  }

  function load() {
    try {
      var s = localStorage.getItem(KEY);
      if (!s) return blank();
      var d = JSON.parse(s);
      return {
        sessions: d.sessions || {}, field: d.field || {}, weights: d.weights || {},
        tests: d.tests || {}, updated: d.updated || null,
      };
    } catch (e) { return blank(); }
  }

  function save(d) {
    try { d.updated = Date.now(); localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch (e) { return false; }
  }

  /* 날짜 문자열 → 밀리초 (KST 자정 기준) */
  function ms(dateStr) { return new Date(dateStr + 'T00:00+09:00').getTime(); }

  /* 오늘 날짜를 KST 기준 "YYYY-MM-DD" 로 */
  function todayKey() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  /* n일 전/후 날짜 */
  function shift(dateStr, n) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date(ms(dateStr) + n * 86400000));
  }

  var num = function (v) { return v === '' || v == null || isNaN(+v) ? null : +v; };
  var avg = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; };

  /* 계획(plan)과 기록(d)을 합쳐 대시보드가 쓸 숫자를 만든다 */
  function stats(d, plan) {
    var s = d.sessions, fr = d.field, out = {};
    var today = todayKey();
    var N = plan.days;                       // 21

    /* 3주의 날짜 목록. 집 루틴은 이 21일이 전부다. */
    var dates = [];
    for (var i = 1; i <= N; i++) dates.push(window.DB_DATE_OF(i));
    out.dates = dates;

    out.today = today;
    out.dayNo = window.DB_DAY_NO(today);                    // 1~21. 범위를 벗어날 수 있다
    out.inPlan = out.dayNo >= 1 && out.dayNo <= N;
    out.currentWeek = Math.min(Math.max(window.DB_WEEK_NO(today), 1), 3);
    out.beforeStart = out.dayNo < 1;
    out.afterEnd = out.dayNo > N;

    /* ── 집 근력 루틴 ── */
    var homeDone = dates.filter(function (k) { return s[k] && s[k].done; });
    out.homeDone = homeDone.length;
    out.homeTotal = N;
    out.homePct = Math.round(homeDone.length / N * 100);
    out.homeToday = !!(s[today] && s[today].done);
    out.homeWeekDates = dates.filter(function (k) { return window.DB_WEEK_NO(k) === out.currentWeek; });
    out.homeWeekDone = out.homeWeekDates.filter(function (k) { return s[k] && s[k].done; }).length;

    /* 연속 수행 — 오늘부터 거슬러 센다.
       오늘 것을 아직 안 했더라도 연속이 끊긴 것으로 보지 않는다 (아직 밤이 남았다).
       그래서 오늘이 비어 있으면 어제부터 센다. */
    var cur = out.homeToday ? today : shift(today, -1);
    var streak = 0;
    for (var g = 0; g < 400; g++) {
      if (!(s[cur] && s[cur].done)) break;
      streak++; cur = shift(cur, -1);
    }
    out.streak = streak;

    /* ── 운동장 세션 ── */
    var F = plan.field;
    out.fieldTotal = F.length;
    out.fieldDone = F.filter(function (x) { return fr[x.id] && fr[x.id].done; }).length;
    out.fieldWeek = window.DB_FIELD_OF(out.currentWeek);
    out.fieldWeekDone = out.fieldWeek.filter(function (x) { return fr[x.id] && fr[x.id].done; }).length;
    out.fieldNext = out.fieldWeek.find(function (x) { return !(fr[x.id] && fr[x.id].done); }) || null;

    /* 거리 — 실제 기록이 있으면 그것을, 없으면 계획값을 쓴다 */
    out.kmSum = F.reduce(function (a, x) {
      var r = fr[x.id];
      if (!r || !r.done) return a;
      var v = num(r.km);
      return a + (v == null ? x.km : v);
    }, 0);

    /* 예상 소모 — 운동장(완료분) + 집 루틴(완료일 × 그 주 루틴 추정치) */
    var HOME_KCAL = [55, 65, 70];
    out.kcalSum = F.reduce(function (a, x) { return a + ((fr[x.id] && fr[x.id].done) ? x.kcal : 0); }, 0) +
      homeDone.reduce(function (a, k) { return a + HOME_KCAL[Math.min(Math.max(window.DB_WEEK_NO(k), 1), 3) - 1]; }, 0);

    /* RPE 평균 — 운동장 세션에서만 적는다 */
    out.rpeAvg = avg(F.map(function (x) { var r = fr[x.id]; return r ? num(r.rpe) : null; })
      .filter(function (v) { return v != null; }));

    /* ── 무릎 통증 ──
       계획된 21일만이 아니라 기록이 있는 모든 날짜를 그린다.
       개편 전(9/14~9/18)의 값도 그대로 이어 보이게 하기 위해서다. */
    var keys = Object.keys(s).sort();
    var nrs = keys.map(function (k) {
      var v = num(s[k].nrsPost);
      return v == null ? null : { x: ms(k), y: v, am: num(s[k].nrsAm), k: k };
    }).filter(Boolean);
    out.nrsSeries = nrs.map(function (p) { return { x: p.x, y: p.y }; });
    out.nrsAmSeries = nrs.filter(function (p) { return p.am != null; }).map(function (p) { return { x: p.x, y: p.am }; });
    out.nrsAvg = avg(nrs.filter(function (p) { return window.DB_DAY_NO(p.k) >= 1; }).map(function (p) { return p.y; }));
    out.nrsLast = nrs.length ? nrs[nrs.length - 1].y : null;
    out.nrsByWeek = [1, 2, 3].map(function (w) {
      return avg(nrs.filter(function (p) { return window.DB_WEEK_NO(p.k) === w; }).map(function (p) { return p.y; }));
    });

    /* ── 체중 ── */
    var wk = Object.keys(d.weights).filter(function (k) { return num(d.weights[k]) != null; }).sort();
    out.weightSeries = wk.map(function (k) { return { x: ms(k), y: +d.weights[k] }; });
    out.weightLast = wk.length ? +d.weights[wk[wk.length - 1]] : null;
    out.weightFirst = wk.length ? +d.weights[wk[0]] : null;
    out.weightDelta = wk.length > 1 ? out.weightLast - out.weightFirst : null;
    out.bmi = out.weightLast ? out.weightLast / Math.pow(plan.profile.height / 100, 2) : null;

    out.tests = d.tests || {};
    out.hasData = out.homeDone > 0 || out.fieldDone > 0 || wk.length > 0 || nrs.length > 0;
    return out;
  }

  return {
    KEY: KEY, blank: blank, load: load, save: save, stats: stats,
    todayKey: todayKey, shift: shift, ms: ms, available: available,
  };
})();
