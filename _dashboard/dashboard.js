/* dashboard 공용 스크립트.
   자동: 테마 토글 · 페이지 내비(요약 툴팁) · 용어/문서코드 자동 툴팁 · 용어집 · 단계 진행률
   헬퍼 (window.DB): fmt · kst · bind · table · log · lineChart · barChart · poll · conversations · md */
window.DB=(function(){
  'use strict';
  const root=document.documentElement, rootPrefix=root.dataset.root||'.';
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const pad=n=>String(n).padStart(2,'0');
  const charts=new Map();
  function redrawAll(){for(const [,fn] of charts)fn();}

  /* ── 테마: 시스템 → 라이트 → 다크 순환 ── */
  const KEY='db-theme',ORDER=['system','light','dark'],LABEL={system:'시스템',light:'라이트',dark:'다크'},ICON={system:'◐',light:'○',dark:'●'};
  const getTheme=()=>{try{return localStorage.getItem(KEY)||'system';}catch(e){return 'system';}};
  function applyTheme(t){
    if(t==='system')delete root.dataset.theme;else root.dataset.theme=t;
    const b=$('themeBtn');if(b){b.querySelector('.ico').textContent=ICON[t];b.querySelector('.txt').textContent='테마: '+LABEL[t];}
    redrawAll();
  }
  applyTheme(getTheme());
  $('themeBtn')?.addEventListener('click',()=>{const n=ORDER[(ORDER.indexOf(getTheme())+1)%ORDER.length];try{localStorage.setItem(KEY,n);}catch(e){}applyTheme(n);});
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',redrawAll);

  /* ── KST 시각. 입력에 시간대가 없으면 KST 로 간주한다. ── */
  const KST=new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  function parseKst(v){if(typeof v==='number')return new Date(v);let s=String(v).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(s))s+='T00:00';if(!/([zZ]|[+-]\d{2}:?\d{2})$/.test(s))s=s.replace(' ','T')+'+09:00';return new Date(s);}
  function kst(v,withSec=false){
    const d=parseKst(v);if(isNaN(d))return '—';
    const p=Object.fromEntries(KST.formatToParts(d).map(x=>[x.type,x.value]));
    return `${p.year}-${p.month}-${p.day} ${p.hour==='24'?'00':p.hour}:${p.minute}${withSec?':'+p.second:''} KST`;
  }
  const kstDate=v=>kst(v).slice(0,10), kstTime=v=>kst(v,true).slice(11,19);

  /* ── 페이지 목록: 내비 + 본문 [data-page] 링크. 둘 다 요약 툴팁. ── */
  const PAGES=Array.isArray(window.DB_PAGES)?window.DB_PAGES:[];
  const here=location.pathname.split('/').pop();
  const pageOf=name=>PAGES.find(p=>p.href.split('/').pop()===name||p.href===name);
  const nav=$('dbPages');
  if(nav){
    for(const p of PAGES){
      const li=document.createElement('li'),a=document.createElement('a');
      a.href=rootPrefix+'/'+p.href;a.textContent=p.title;if(p.summary)a.dataset.def=p.summary;
      if(p.href.split('/').pop()===here)a.setAttribute('aria-current','page');
      li.appendChild(a);nav.appendChild(li);
    }
  }
  const pn=$('dbProject');if(pn&&window.DB_PROJECT)pn.textContent=window.DB_PROJECT;
  function wirePageLinks(scope=document){
    scope.querySelectorAll('a[data-page]').forEach(a=>{
      const [name,hash]=a.dataset.page.split('#'),p=pageOf(name);if(!p)return;
      a.href=rootPrefix+'/'+p.href+(hash?'#'+hash:'');if(!a.textContent.trim())a.textContent=p.title;
      if(p.summary&&!a.dataset.def)a.dataset.def=p.summary;a.classList.add('plink');
    });
  }

  /* ── 용어 · 문서 코드 자동 툴팁 ──
     terms.js 의 DB_TERMS {용어:{def,en}} / DB_REFS {코드:{def,href}} 를 본문 텍스트에서 찾아 모든 등장에 감싼다.
     제외: script/style/code/pre, 이미 툴팁이 있는 요소, 링크 안, 헤더 h1, 내비. */
  const TERMS=window.DB_TERMS||{}, REFS=window.DB_REFS||{};
  const SKIP=new Set(['SCRIPT','STYLE','CODE','PRE','TEXTAREA','A','BUTTON','H1','CANVAS','svg']);
  function autoWrap(scope=document.body){
    const keys=[...Object.keys(TERMS).map(k=>({k,type:'term'})),...Object.keys(REFS).map(k=>({k,type:'ref'}))].filter(x=>x.k).sort((a,b)=>b.k.length-a.k.length);
    if(!keys.length)return;
    const re=new RegExp(keys.map(({k,type})=>type==='ref'?`(?<![A-Za-z0-9_])${escRe(k)}(?![A-Za-z0-9_])`:escRe(k)).join('|'),'g');
    const walker=document.createTreeWalker(scope,NodeFilter.SHOW_TEXT,{acceptNode(n){
      if(!n.nodeValue.trim())return NodeFilter.FILTER_REJECT;
      for(let e=n.parentElement;e&&e!==scope;e=e.parentElement){
        if(SKIP.has(e.tagName)||e.dataset.def!=null||e.classList.contains('pages')||e.classList.contains('no-tip')||e.classList.contains('glossary'))return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;}});
    const nodes=[];let n;while(n=walker.nextNode())nodes.push(n);
    for(const node of nodes){
      const text=node.nodeValue;if(!re.test(text)){re.lastIndex=0;continue;}re.lastIndex=0;
      const frag=document.createDocumentFragment();let last=0,m;
      while((m=re.exec(text))){
        if(m.index>last)frag.appendChild(document.createTextNode(text.slice(last,m.index)));
        const k=m[0];
        if(REFS[k]){const r=REFS[k],el=document.createElement(r.href?'a':'span');el.className='ref';el.dataset.def=r.def||'';if(r.href)el.href=r.href.startsWith('#')?r.href:rootPrefix+'/'+r.href;el.textContent=k;frag.appendChild(el);}
        else{const t=TERMS[k],el=document.createElement('span');el.className='term';el.dataset.def=t.def||'';if(t.en)el.dataset.en=t.en;el.textContent=k;frag.appendChild(el);}
        last=m.index+k.length;
      }
      if(last<text.length)frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag,node);
    }
  }
  const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  /* ── 용어집: 페이지에 실제 등장한 용어·코드를 모아 생성 ── */
  function buildGlossary(){
    const list=$('glossaryList'),sec=$('glossary');
    const terms=new Map(),refs=new Map();
    document.querySelectorAll('.term').forEach(t=>{const k=t.textContent.trim();if(!terms.has(k))terms.set(k,{def:t.dataset.def||'',en:t.dataset.en||''});});
    document.querySelectorAll('.ref').forEach(t=>{const k=t.textContent.trim();if(!refs.has(k))refs.set(k,{def:t.dataset.def||'',href:t.getAttribute('href')||''});});
    /* 아직 용어가 없을 때는 숨기기만 한다. 지워 버리면 나중에 동적으로 그린 내용에 용어가 생겨도 되살릴 수 없다. */
    if(sec&&!terms.size&&!refs.size){sec.style.display='none';if(list)list.innerHTML='';return;}
    if(sec)sec.style.display='';
    if(!list)return;list.innerHTML='';
    const group=(title,map,isRef)=>{
      if(!map.size)return;
      const h=document.createElement('div');h.className='ghead';h.textContent=title;list.appendChild(h);
      [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ko')).forEach(([k,v])=>{
        const d=document.createElement('div');
        d.innerHTML=`<dt>${isRef?`<span class="ref no-tip">${esc(k)}</span>`:esc(k)}${v.en?`<small>${esc(v.en)}</small>`:''}${isRef&&v.href?`<small><a href="${esc(v.href)}">이동 →</a></small>`:''}</dt><dd>${esc(v.def)}</dd>`;
        list.appendChild(d);});
    };
    group('용어',terms,false);group('문서 코드',refs,true);
  }
  /* 툴팁이 화면 밖으로 나가면 정렬 변경 + 키보드 접근 */
  function wireTips(scope=document){
    scope.querySelectorAll('[data-def]').forEach(t=>{
      if(t.dataset.fx)return;t.dataset.fx=1;if(!t.hasAttribute('tabindex')&&t.tagName!=='A'&&t.tagName!=='BUTTON')t.setAttribute('tabindex','0');
      const fix=()=>{t.classList.remove('edge-l','edge-r');const r=t.getBoundingClientRect(),half=Math.min(24*19.5,innerWidth*.8)/2,cx=r.left+r.width/2;if(cx-half<12)t.classList.add('edge-l');else if(cx+half>innerWidth-12)t.classList.add('edge-r');};
      t.addEventListener('mouseenter',fix);t.addEventListener('focus',fix);
    });
  }
  function refresh(scope=document.body){autoWrap(scope);wirePageLinks(scope);wireTips(document);buildGlossary();}

  /* ── 단계 진행률 ── */
  document.querySelectorAll('.steps').forEach(list=>{
    const steps=[...list.querySelectorAll('.step')],prog=list.parentElement.querySelector('.progress');if(!steps.length||!prog)return;
    const done=steps.filter(s=>s.dataset.status==='done').length,active=steps.filter(s=>s.dataset.status==='active').length;
    const p=Math.round((done+active*.5)/steps.length*100);
    prog.querySelector('.bar i').style.width=p+'%';prog.querySelector('.pct').textContent=`${done} / ${steps.length} 단계 · ${p}%`;
  });

  /* ── 포맷 ──  "num:2" | "int" | "pct:1" | "sign:2" | "signpct:1" | "kst" | "kstsec" | "kstdate" | "ksttime" | "text" */
  function fmt(v,spec='text'){
    if(v==null||v==='')return '—';
    const [k,dRaw]=spec.split(':'),d=dRaw==null?2:+dRaw,n=+v,loc=x=>x.toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
    switch(k){
      case 'num':return loc(n);case 'int':return Math.round(n).toLocaleString('en-US');
      case 'pct':return loc(n)+'%';case 'sign':return (n>0?'+':n<0?'−':'')+loc(Math.abs(n));
      case 'signpct':return (n>0?'+':n<0?'−':'')+loc(Math.abs(n))+'%';
      case 'kst':return kst(v);case 'kstsec':return kst(v,true);case 'kstdate':return kstDate(v);case 'ksttime':return kstTime(v);
      case 'date':return kstDate(v);case 'datetime':return kst(v).slice(5,16);case 'time':return kstTime(v);
      default:return String(v);
    }
  }
  const get=(o,path)=>path.split('.').reduce((a,k)=>a==null?a:a[k],o);

  function bind(data,scope=document){
    scope.querySelectorAll('[data-bind]').forEach(el=>{
      const v=get(data,el.dataset.bind);el.textContent=fmt(v,el.dataset.fmt||'text');
      if('sign' in el.dataset){el.classList.remove('up','down','flat');el.classList.add(v>0?'up':v<0?'down':'flat');}
      if('width' in el.dataset)el.style.width=Math.max(0,Math.min(100,+v))+'%';
    });
  }
  function table(el,rows,cols){
    if(typeof el==='string')el=$(el);
    if(!rows||!rows.length){el.innerHTML=`<div class="empty">데이터가 없습니다</div>`;return;}
    const th=cols.map(c=>`<th${c.num?' class="num"':''}>${esc(c.label)}</th>`).join('');
    const body=rows.map(r=>'<tr>'+cols.map(c=>{const v=get(r,c.key);let s;
      if(c.chip){s=`<span class="chip ${c.chip[v]||'mute'}">${esc(v)}</span>`;}else if(c.render)s=c.render(v,r);
      else{s=esc(fmt(v,c.fmt||'text'));if(c.sign)s=`<span class="${v>0?'up':v<0?'down':'flat'}">${s}</span>`;}
      return `<td${c.num?' class="num"':''}>${s}</td>`;}).join('')+'</tr>').join('');
    el.innerHTML=`<div class="tbl-wrap"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
  }
  function log(el,lines){
    if(typeof el==='string')el=$(el);
    el.innerHTML=(lines||[]).slice(-200).map(line=>{const m=String(line).match(/^(\S+(?: \S+)?)\s+(INFO|WARN|ERROR|DEBUG|OK)\s+(.*)$/);
      return m?`<div><span class="ts">${esc(m[1])}</span> <span class="lv ${m[2]}">${m[2]}</span> ${esc(m[3])}</div>`:`<div>${esc(line)}</div>`;}).join('');
    el.scrollTop=el.scrollHeight;
  }

  /* ── 차트 ── */
  new ResizeObserver(redrawAll).observe(document.body);
  const tok=n=>getComputedStyle(root).getPropertyValue(n).trim();
  function setup(cv){const box=cv.parentElement,W=box.clientWidth,H=box.clientHeight,dpr=devicePixelRatio||1;cv.width=W*dpr;cv.height=H*dpr;const ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);return {ctx,W,H};}
  function niceStep(range,n){const raw=range/n,p=Math.pow(10,Math.floor(Math.log10(raw))),r=raw/p;return (r<1.5?1:r<3?2:r<7?5:10)*p;}
  function lineChart(cv,opt){
    if(typeof cv==='string')cv=$(cv);
    const draw=()=>{
      const {ctx,W,H}=setup(cv);if(!W)return;
      const mono='11.5px '+tok('--mono'),muted=tok('--muted'),grid=tok('--grid'),ink=tok('--ink'),accent=tok('--accent');
      const all=opt.series.flatMap(s=>s.points);if(all.length<2){ctx.fillStyle=muted;ctx.font=mono;ctx.fillText(opt.empty||'데이터가 쌓이면 그려집니다',14,H/2);return;}
      const P={l:58,r:64,t:14,b:26},x0=P.l,x1=W-P.r,y0=P.t,y1=H-P.b;
      const xs=all.map(p=>p.x),ys=all.map(p=>p.y);let xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
      if(opt.baseline!=null){ymin=Math.min(ymin,opt.baseline);ymax=Math.max(ymax,opt.baseline);}
      const sp=Math.max(ymax-ymin,1e-9);ymin-=sp*.12;ymax+=sp*.12;const step=niceStep(ymax-ymin,4);ymin=Math.floor(ymin/step)*step;ymax=Math.ceil(ymax/step)*step;
      const X=x=>x0+(x-xmin)/(xmax-xmin||1)*(x1-x0),Y=y=>y1-(y-ymin)/(ymax-ymin)*(y1-y0);
      ctx.font=mono;ctx.textBaseline='middle';
      for(let v=ymin;v<=ymax+1e-9;v+=step){const y=Y(v);ctx.strokeStyle=grid;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();ctx.fillStyle=muted;ctx.textAlign='right';ctx.fillText(fmt(v,opt.yfmt||'int'),x0-8,y);}
      if(opt.baseline!=null){const yb=Y(opt.baseline);ctx.setLineDash([3,4]);ctx.strokeStyle=muted;ctx.beginPath();ctx.moveTo(x0,yb);ctx.lineTo(x1,yb);ctx.stroke();ctx.setLineDash([]);}
      ctx.textBaseline='top';ctx.textAlign='center';ctx.fillStyle=muted;const nt=opt.xTicks||5;
      for(let i=0;i<nt;i++){const x=xmin+(xmax-xmin)*i/(nt-1);ctx.fillText(fmt(x,opt.xfmt||'kstdate'),X(x),y1+8);}
      opt.series.forEach((s,si)=>{
        const col=s.color?tok(s.color)||s.color:(si===0?accent:tok('--good'));const pts=[...s.points].sort((a,b)=>a.x-b.x);
        if(s.area!==false&&si===0){ctx.beginPath();const yb=Y(opt.baseline!=null?opt.baseline:ymin);ctx.moveTo(X(pts[0].x),yb);pts.forEach(p=>ctx.lineTo(X(p.x),Y(p.y)));ctx.lineTo(X(pts[pts.length-1].x),yb);ctx.closePath();ctx.globalAlpha=.13;ctx.fillStyle=col;ctx.fill();ctx.globalAlpha=1;}
        ctx.beginPath();ctx.lineJoin='round';ctx.lineWidth=1.8;ctx.strokeStyle=col;pts.forEach((p,i)=>i?ctx.lineTo(X(p.x),Y(p.y)):ctx.moveTo(X(p.x),Y(p.y)));ctx.stroke();
        if(s.dots){for(let i=1;i<pts.length;i++){const d=pts[i].y-pts[i-1].y;ctx.fillStyle=d>=0?tok('--good'):tok('--bad');ctx.beginPath();ctx.arc(X(pts[i].x),Y(pts[i].y),2.6,0,7);ctx.fill();}}
        const last=pts[pts.length-1];ctx.fillStyle=col;ctx.beginPath();ctx.arc(X(last.x),Y(last.y),4,0,7);ctx.fill();
        ctx.fillStyle=ink;ctx.font='500 12px '+tok('--mono');ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(fmt(last.y,opt.yfmt||'num:2'),X(last.x)+9,Y(last.y));
      });
    };
    charts.set(cv,draw);draw();
  }
  function barChart(cv,opt){
    if(typeof cv==='string')cv=$(cv);
    const draw=()=>{
      const {ctx,W,H}=setup(cv);if(!W)return;
      const mono='11.5px '+tok('--mono'),muted=tok('--muted'),grid=tok('--grid'),accent=opt.color?tok(opt.color)||opt.color:tok('--accent'),bad=tok('--bad');
      const P={l:58,r:16,t:14,b:26},x0=P.l,x1=W-P.r,y0=P.t,y1=H-P.b,n=opt.values.length;if(!n)return;
      let ymin=Math.min(0,...opt.values),ymax=Math.max(0,...opt.values);const sp=Math.max(ymax-ymin,1e-9);ymax+=sp*.1;if(ymin<0)ymin-=sp*.1;
      const step=niceStep(ymax-ymin,4);ymin=Math.floor(ymin/step)*step;ymax=Math.ceil(ymax/step)*step;
      const Y=y=>y1-(y-ymin)/(ymax-ymin)*(y1-y0),bw=(x1-x0)/n,gap=Math.min(bw*.3,10);
      ctx.font=mono;ctx.textBaseline='middle';
      for(let v=ymin;v<=ymax+1e-9;v+=step){const y=Y(v);ctx.strokeStyle=grid;ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();ctx.fillStyle=muted;ctx.textAlign='right';ctx.fillText(fmt(v,opt.yfmt||'int'),x0-8,y);}
      ctx.strokeStyle=muted;ctx.beginPath();ctx.moveTo(x0,Y(0));ctx.lineTo(x1,Y(0));ctx.stroke();
      opt.values.forEach((v,i)=>{const x=x0+i*bw+gap/2,w=bw-gap;ctx.fillStyle=v<0?bad:accent;ctx.fillRect(x,Math.min(Y(v),Y(0)),w,Math.abs(Y(v)-Y(0)));});
      ctx.textBaseline='top';ctx.textAlign='center';ctx.fillStyle=muted;const every=Math.ceil(n/8);
      opt.labels.forEach((l,i)=>{if(i%every===0)ctx.fillText(String(l),x0+i*bw+bw/2,y1+8);});
    };
    charts.set(cv,draw);draw();
  }

  /* ── 폴링 ── */
  function poll(url,ms,onData){
    const src=$('dbSource');const setSrc=(state,text)=>{if(src){src.dataset.state=state;src.querySelector('.txt').textContent=text;}};
    let ok=false;
    const tick=async()=>{
      try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(r.status);const d=await r.json();ok=true;onData(d);setSrc('live',`${url} · ${kstTime(Date.now())}`);}
      catch(e){setSrc(ok?'error':'static',ok?`${url} 응답 없음 — 마지막 데이터 표시 중`:'정적 · 서버 없음');}
      setTimeout(tick,ms);
    };
    tick();
  }

  /* ── 간단 마크다운 (대화 기록 본문용): ## 소제목, - 목록, 1. 목록, > 인용, `code`, **굵게**, 빈 줄 = 문단 ── */
  function md(src){
    const lines=String(src||'').replace(/\r/g,'').split('\n');let out='',list=null,para=[];
    const inline=s=>esc(s).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    const flushP=()=>{if(para.length){out+=`<p>${inline(para.join(' '))}</p>`;para=[];}};
    const flushL=()=>{if(list){out+=`</${list}>`;list=null;}};
    for(const raw of lines){
      const l=raw.trimEnd();
      if(!l.trim()){flushP();flushL();continue;}
      let m;
      if((m=l.match(/^(#{2,4})\s+(.*)/))){flushP();flushL();out+=`<h${Math.min(m[1].length+1,5)}>${inline(m[2])}</h${Math.min(m[1].length+1,5)}>`;}
      else if((m=l.match(/^[-*]\s+(.*)/))){flushP();if(list!=='ul'){flushL();list='ul';out+='<ul>';}out+=`<li>${inline(m[1])}</li>`;}
      else if((m=l.match(/^\d+[.)]\s+(.*)/))){flushP();if(list!=='ol'){flushL();list='ol';out+='<ol>';}out+=`<li>${inline(m[1])}</li>`;}
      else if((m=l.match(/^>\s?(.*)/))){flushP();flushL();out+=`<blockquote>${inline(m[1])}</blockquote>`;}
      else{flushL();para.push(l.trim());}
    }
    flushP();flushL();return out;
  }

  /* ── 대화 기록: 목록(제목만) → 클릭 → 상세. items=[{id,at,title,tags,summary,body}] ──
     detailEl 이 없으면(메인 패널) 항목을 대화 기록 페이지 링크로 만든다. */
  function conversations(listEl,detailEl,items,opt={}){
    if(typeof listEl==='string')listEl=$(listEl);if(typeof detailEl==='string')detailEl=$(detailEl);
    const all=[...(items||[])].sort((a,b)=>parseKst(b.at)-parseKst(a.at));
    const page=opt.page||'_dashboard/conversations.html';
    let filter='';
    const render=()=>{
      const rows=all.filter(c=>!filter||(c.title+' '+(c.tags||[]).join(' ')+' '+(c.summary||'')).toLowerCase().includes(filter));
      const shown=opt.limit?rows.slice(0,opt.limit):rows;
      if(!shown.length){listEl.innerHTML=`<div class="empty">기록이 없습니다</div>`;return;}
      listEl.innerHTML=shown.map(c=>{
        const href=detailEl?`#${esc(c.id)}`:`${rootPrefix}/${page}#${esc(c.id)}`;
        return `<li><a href="${href}" data-cid="${esc(c.id)}"${c.summary?` data-def="${esc(c.summary)}"`:''}><time class="num">${kst(c.at)}</time><span class="t">${esc(c.title)}</span><span class="tags">${(c.tags||[]).map(t=>`<span class="chip mute">${esc(t)}</span>`).join('')}</span></a></li>`;}).join('');
      if(opt.limit&&rows.length>shown.length)listEl.insertAdjacentHTML('beforeend',`<li class="more"><a href="${rootPrefix}/${page}">전체 ${rows.length}건 보기 →</a></li>`);
      wireTips(listEl);
    };
    const show=id=>{
      if(!detailEl)return;const c=all.find(x=>x.id===id)||all[0];if(!c){detailEl.innerHTML=`<div class="empty">기록을 선택하세요</div>`;return;}
      detailEl.innerHTML=`<div class="chead"><time class="num">${kst(c.at,true)}</time><h2>${esc(c.title)}</h2>${(c.tags||[]).map(t=>`<span class="chip accent">${esc(t)}</span>`).join('')}${c.summary?`<p class="csum">${esc(c.summary)}</p>`:''}</div><div class="cbody prose">${md(c.body)}</div>`;
      listEl.querySelectorAll('a[data-cid]').forEach(a=>a.toggleAttribute('aria-current',a.dataset.cid===c.id));
      autoWrap(detailEl);wireTips(detailEl);buildGlossary();
    };
    render();
    if(detailEl){
      listEl.addEventListener('click',e=>{const a=e.target.closest('a[data-cid]');if(!a)return;e.preventDefault();history.replaceState(null,'','#'+a.dataset.cid);show(a.dataset.cid);});
      addEventListener('hashchange',()=>show(location.hash.slice(1)));
      show(location.hash.slice(1));
      if(opt.searchEl){const s=typeof opt.searchEl==='string'?$(opt.searchEl):opt.searchEl;s.addEventListener('input',()=>{filter=s.value.trim().toLowerCase();render();listEl.querySelectorAll('a[data-cid]').forEach(a=>a.toggleAttribute('aria-current',a.dataset.cid===location.hash.slice(1)));});}
    }
    const cnt=opt.countEl?(typeof opt.countEl==='string'?$(opt.countEl):opt.countEl):null;if(cnt)cnt.textContent=`${all.length}건`;
  }

  /* 초기화: 자동 툴팁 → 페이지 링크 → 용어집 */
  refresh();

  return {fmt,kst,kstDate,kstTime,parseKst,bind,table,log,lineChart,barChart,poll,conversations,md,refresh,glossary:buildGlossary,esc};
})();
