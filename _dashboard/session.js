/* 세션을 하나씩 체크해 가며 수행하기 위한 부품.
   대시보드의 오늘 카드(집 루틴)와 plan.html 의 카드들이 같은 것을 쓴다.

   저장 위치는 기록과 같은 곳이다 — steps = { "블록-항목": true }
   예) "1-0" 은 두 번째 블록의 첫 항목.
   집 루틴은 sessions[날짜].steps 에, 운동장 세션은 field[슬롯id].steps 에 들어간다.

   완료 처리 규칙: 마지막 항목을 체크하면 그 세션이 자동으로 완료된다.
   체크를 풀어도 완료는 유지한다 — 실수로 하나 눌렀다고 완료가 취소되면 곤란하기 때문이다.
   완료를 되돌리려면 카드 제목 옆의 상태 버튼을 직접 누른다. */

window.DB_SESSION = (function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const key = (bi, ii) => bi + '-' + ii;
  /* 초록 세로줄이 붙는 블록. 워밍업 · 준비 · 마무리 · 쿨다운을 뺀 나머지가 그날의 본론이다. */
  const isMain = name => /메인|테스트|밀기|당기기|코어|둔근/.test(name);

  const total = day => day.blocks.reduce((a, b) => a + b.items.length, 0);

  function progress(day, rec) {
    const s = (rec && rec.steps) || {};
    let n = 0;
    day.blocks.forEach((b, bi) => b.items.forEach((_, ii) => { if (s[key(bi, ii)]) n++; }));
    const t = total(day);
    return { done: n, total: t, pct: t ? Math.round(n / t * 100) : 0, all: t > 0 && n === t };
  }

  /* 진행바. 카드 맨 위에 둔다. */
  function progressHTML(day, rec, opts) {
    const p = progress(day, rec);
    const ro = opts && opts.readonly;
    return '<div class="sprog"' + (p.all ? ' data-all="1"' : '') + '>' +
      '<div class="sbar"><i style="width:' + p.pct + '%"></i></div>' +
      '<span class="spct">' + p.done + ' / ' + p.total + '</span>' +
      (ro ? '' : '<button type="button" class="sreset" title="이 세션의 체크를 모두 지운다">지우기</button>') +
      '</div>';
  }

  /* 준비물. 매일 챙기는 것은 회색, 그날만 챙기는 것은 초록으로 구분한다. */
  function gearHTML(day, fixed) {
    const always = (fixed && fixed.gearAlways) || [];
    const extra = day.gear || [];
    if (!always.length && !extra.length) return '';
    return '<div class="gearbox"><span class="label">준비물</span>' +
      always.map(g => '<span class="chip mute">' + esc(g) + '</span>').join('') +
      extra.map(g => '<span class="chip accent">' + esc(g) + '</span>').join('') +
      '</div>';
  }

  /* 체크박스가 달린 블록 목록.
     items 만 체크 대상이다. notes(설명·규칙)와 rest(쉬는 법)에는 체크박스를 달지 않는다 —
     "3개 중 실제로 할 것은 1개" 같은 혼동을 없애기 위해서다. */
  function blocksHTML(day, rec, opts) {
    const s = (rec && rec.steps) || {};
    const ro = opts && opts.readonly;
    return day.blocks.map((b, bi) => {
      const dn = b.items.filter((_, ii) => s[key(bi, ii)]).length;
      const full = dn === b.items.length;
      const notes = (b.notes || []).map(n => '<li>' + esc(n) + '</li>').join('');
      return '<div class="blk' + (isMain(b.name) ? ' main' : '') + (full ? ' bdone' : '') + '">' +
        '<b><span class="bname">' + esc(b.name) + '</span><span class="m">' + b.min + '분</span>' +
        '<span class="bn">' + dn + '/' + b.items.length + '</span></b>' +
        '<ul class="checklist">' + b.items.map((it, ii) => {
          const k = key(bi, ii), on = !!s[k];
          return '<li class="ck' + (on ? ' on' : '') + '">' +
            '<input type="checkbox" data-k="' + k + '"' + (on ? ' checked' : '') + (ro ? ' disabled' : '') +
            ' aria-label="' + esc(it).slice(0, 60) + '">' +
            '<span class="tx">' + esc(it) + '</span></li>';
        }).join('') + '</ul>' +
        (notes ? '<ul class="blknotes">' + notes + '</ul>' : '') +
        (b.rest ? '<p class="blkrest"><b>쉬는 법</b>' + esc(b.rest) + '</p>' : '') +
        '</div>';
    }).join('');
  }

  /* 클릭 처리. root 안의 체크박스와 '지우기' 버튼을 맡는다.
     getRec() 은 그 날짜의 기록 객체를, onChange(rec, p) 는 저장과 다시 그리기를 담당한다. */
  function wire(root, day, getRec, onChange) {
    root.addEventListener('click', e => {
      if (e.target.closest('.sreset')) {
        const rec = getRec();
        rec.steps = {};
        onChange(rec, progress(day, rec));
        return;
      }
      const li = e.target.closest('li.ck');
      if (!li || !root.contains(li)) return;
      /* 용어 툴팁이나 링크를 누른 것은 체크로 치지 않는다 (휴대폰에서 특히 중요) */
      if (e.target.closest('.term, .ref, a')) return;
      const box = li.querySelector('input[type=checkbox]');
      if (!box || box.disabled) return;
      if (e.target !== box) box.checked = !box.checked;   // 글자를 눌러도 토글된다

      const rec = getRec();
      rec.steps = rec.steps || {};
      if (box.checked) rec.steps[box.dataset.k] = true; else delete rec.steps[box.dataset.k];

      const p = progress(day, rec);
      if (p.all) rec.done = true;    // 다 끝내면 자동 완료. 푸는 것은 상태 버튼으로.
      onChange(rec, p);
    });
  }

  /* 저장 후 화면의 체크 상태 · 진행바 · 블록 수를 다시 맞춘다 (전체를 다시 그리지 않는다) */
  function sync(root, day, rec) {
    const s = (rec && rec.steps) || {};
    root.querySelectorAll('li.ck').forEach(li => {
      const box = li.querySelector('input[type=checkbox]');
      if (!box) return;
      const on = !!s[box.dataset.k];
      box.checked = on;
      li.classList.toggle('on', on);
    });
    root.querySelectorAll('.blk').forEach((blk, bi) => {
      const b = day.blocks[bi]; if (!b) return;
      const dn = b.items.filter((_, ii) => s[key(bi, ii)]).length;
      const n = blk.querySelector('.bn'); if (n) n.textContent = dn + '/' + b.items.length;
      blk.classList.toggle('bdone', dn === b.items.length);
    });
    const p = progress(day, rec);
    const bar = root.querySelector('.sbar i'); if (bar) bar.style.width = p.pct + '%';
    const pct = root.querySelector('.spct'); if (pct) pct.textContent = p.done + ' / ' + p.total;
    const sp = root.querySelector('.sprog'); if (sp) { if (p.all) sp.dataset.all = '1'; else delete sp.dataset.all; }
    return p;
  }

  /* 운동장 세션 맨 아래에 붙는 "집에 와서 할 것" 한 줄.
     바닥 동작이 전부 집 루틴으로 옮겨 갔기 때문에, 운동장에서 끝났다고 하루가 끝난 것이 아니다. */
  function afterHTML(day, href) {
    if (!day.after) return '';
    return '<p class="afterbox"><b>집에 와서</b>' + esc(day.after) +
      (href ? ' <a href="' + href + '">오늘의 집 루틴 →</a>' : '') + '</p>';
  }

  return { key, total, progress, progressHTML, blocksHTML, gearHTML, afterHTML, wire, sync };
})();
