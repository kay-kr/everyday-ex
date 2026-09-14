/* 운동 기록 저장소. 브라우저의 localStorage 한 곳에 모으고, 모든 페이지가 이것만 쓴다.
   DASHBOARD.html 은 읽기만, log.html 이 읽고 쓴다.
   저장 구조:
     sessions : { "2026-09-14": {done, rpe, nrsPre, nrsPost, nrsAm, km, hr, note} }
     weights  : { "2026-09-14": 73.5 }
     tests    : { t1, t2, t3, t4, at }
   브라우저 저장이 막혀 있으면 ok:false 를 돌려주고 화면은 계획만 보여 준다. */
window.EXLOG = (function () {
  'use strict';
  var KEY = 'ex-log-v1';

  function blank() { return { sessions: {}, weights: {}, tests: {}, updated: null }; }

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
        sessions: d.sessions || {}, weights: d.weights || {},
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
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return p;
  }

  var num = function (v) { return v === '' || v == null || isNaN(+v) ? null : +v; };

  /* 계획(plan)과 기록(d)을 합쳐 대시보드가 쓸 숫자를 만든다 */
  function stats(d, plan) {
    var days = plan.days, s = d.sessions, out = {};
    var done = days.filter(function (x) { return s[x.date] && s[x.date].done; });

    out.doneCount = done.length;
    out.totalCount = days.length;
    out.donePct = Math.round(done.length / days.length * 100);
    out.kcalSum = done.reduce(function (a, x) { return a + x.kcal; }, 0);
    out.kcalPlan = days.reduce(function (a, x) { return a + x.kcal; }, 0);

    /* 거리는 실제 기록이 있으면 그것을, 없으면 계획값을 쓴다 */
    out.kmSum = done.reduce(function (a, x) {
      var r = num(s[x.date].km); return a + (r == null ? x.km : r);
    }, 0);

    /* 무릎 통증: 운동 후 값이 있는 날만 평균 */
    var nrs = days.map(function (x) {
      var r = s[x.date]; if (!r) return null;
      var v = num(r.nrsPost); return v == null ? null : { x: ms(x.date), y: v, am: num(r.nrsAm) };
    }).filter(Boolean);
    out.nrsSeries = nrs;
    out.nrsAvg = nrs.length ? nrs.reduce(function (a, p) { return a + p.y; }, 0) / nrs.length : null;
    out.nrsLast = nrs.length ? nrs[nrs.length - 1].y : null;
    out.nrsAmSeries = nrs.filter(function (p) { return p.am != null; }).map(function (p) { return { x: p.x, y: p.am }; });

    /* 주차별 평균 통증 — 증량 판단의 근거 */
    out.nrsByWeek = [1, 2, 3].map(function (w) {
      var v = days.filter(function (x) { return x.week === w; })
        .map(function (x) { var r = s[x.date]; return r ? num(r.nrsPost) : null; })
        .filter(function (x) { return x != null; });
      return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null;
    });

    /* RPE 평균 */
    var rpe = days.map(function (x) { var r = s[x.date]; return r ? num(r.rpe) : null; }).filter(function (x) { return x != null; });
    out.rpeAvg = rpe.length ? rpe.reduce(function (a, b) { return a + b; }, 0) / rpe.length : null;

    /* 체중 */
    var wk = Object.keys(d.weights).filter(function (k) { return num(d.weights[k]) != null; }).sort();
    out.weightSeries = wk.map(function (k) { return { x: ms(k), y: +d.weights[k] }; });
    out.weightLast = wk.length ? +d.weights[wk[wk.length - 1]] : null;
    out.weightFirst = wk.length ? +d.weights[wk[0]] : null;
    out.weightDelta = wk.length > 1 ? out.weightLast - out.weightFirst : null;
    out.bmi = out.weightLast ? out.weightLast / Math.pow(plan.profile.height / 100, 2) : null;

    /* 연속 수행 — 계획된 날짜만 세고, 아직 안 온 날은 끊긴 것으로 보지 않는다 */
    var today = todayKey(), streak = 0;
    for (var i = days.length - 1; i >= 0; i--) {
      if (days[i].date > today) continue;
      if (s[days[i].date] && s[days[i].date].done) streak++; else break;
    }
    out.streak = streak;

    /* 이번 주(진행 중인 주차)와 오늘 */
    out.today = today;
    out.todayDay = days.find(function (x) { return x.date === today; }) || null;
    out.nextDay = days.find(function (x) { return x.date >= today && !(s[x.date] && s[x.date].done); }) || null;
    var cur = days.find(function (x) { return x.date >= today; });
    out.currentWeek = cur ? cur.week : 3;
    out.weekDone = days.filter(function (x) { return x.week === out.currentWeek && s[x.date] && s[x.date].done; }).length;

    out.tests = d.tests || {};
    out.hasData = out.doneCount > 0 || wk.length > 0;
    return out;
  }

  return { KEY: KEY, blank: blank, load: load, save: save, stats: stats, todayKey: todayKey, ms: ms, available: available };
})();
