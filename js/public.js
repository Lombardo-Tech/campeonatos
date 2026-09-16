import { downloadMatchActPDF } from './acta.js';
import { db } from './firebase.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js';
import { esc, timeLabel, dateLabel, normalize } from './common.js';
const state={tournaments:{},tid:new URLSearchParams(location.search).get('t')||'',teams:{},matches:{},events:{},players:{},news:{},sponsors:{},venues:{},awards:{},unsub:[],dateFilter:'all',eventsReady:false,seenEvents:new Set(),liveTimer:null,selectedMatchId:null};

function normalizePublicUrl(){const params=new URLSearchParams(location.search);const tid=params.get('t');if(location.pathname.endsWith('/index.html')){const q=tid?`?t=${encodeURIComponent(tid)}`:'';history.replaceState({},'',`./${q}`);}}
normalizePublicUrl();
const $=s=>document.querySelector(s);
function publicTournaments(){return Object.entries(state.tournaments).filter(([,t])=>{if(!t||t.public===false||t.status==='archived')return false;/* Los torneos creados por organizadores solo son públicos después del pago. Los torneos legacy/global sin ownerUid conservan su publicación normal. */return t.ownerUid ? (t.status==='active'&&t.paymentStatus==='paid') : t.status==='active';}).sort((a,b)=>String(a[1].name||a[0]).localeCompare(String(b[1].name||b[0]),'es'));}
onValue(ref(db,'tournaments'),snap=>{state.tournaments=snap.val()||{};renderCatalog();loadSelected();});
function loadSelected(){state.eventsReady=false;state.seenEvents.clear();if(state.liveTimer){clearInterval(state.liveTimer);state.liveTimer=null;}state.unsub.forEach(fn=>{try{fn();}catch{}});state.unsub=[];const list=publicTournaments();if(!list.length){$('#featured').innerHTML='<div class="empty">Todavía no hay torneos publicados.</div>';$('#matchesGrid').innerHTML='';$('#standings').innerHTML='';$('#stats').innerHTML='';$('#scorers').innerHTML='';$('#discipline').innerHTML='';return;}const allowed=state.tid&&list.some(([id])=>id===state.tid);if(!allowed)state.tid=list[0][0];const t=state.tournaments[state.tid];renderTournamentPicker();document.title=`${t.name||'Torneo'} ${t.season||''}`.trim();state.unsub.push(onValue(ref(db,`equipos/${state.tid}`),s=>{state.teams=s.val()||{};renderAll();}));state.unsub.push(onValue(ref(db,`partidos/${state.tid}`),s=>{state.matches=s.val()||{};renderAll();}));state.unsub.push(onValue(ref(db,`jugadores/${state.tid}`),s=>{state.players=s.val()||{};renderProPublic();}));state.unsub.push(onValue(ref(db,`noticias/${state.tid}`),s=>{state.news=s.val()||{};renderProPublic();}));state.unsub.push(onValue(ref(db,`patrocinadores/${state.tid}`),s=>{state.sponsors=s.val()||{};renderProPublic();}));state.unsub.push(onValue(ref(db,`sedes/${state.tid}`),s=>{state.venues=s.val()||{};renderProPublic();}));state.unsub.push(onValue(ref(db,`premios/${state.tid}`),s=>{state.awards=s.val()||{};renderProPublic();}));state.unsub.push(onValue(ref(db,`eventos/${state.tid}`),s=>{const next=s.val()||{}; if(!state.eventsReady){state.events=next;state.eventsReady=true;Object.entries(next).forEach(([mid,evs])=>Object.keys(evs||{}).forEach(eid=>state.seenEvents.add(`${mid}/${eid}`)));renderAll();return;} state.events=next;renderAll();detectNewEvents(next); })); startLiveClock();}
function selectPublicTournament(tid){
  tid=String(tid||'');
  const list=publicTournaments();
  if(!tid||!list.some(([id])=>String(id)===tid))return;
  state.tid=tid;
  history.replaceState({},'',`./?t=${encodeURIComponent(tid)}`);
  renderTournamentPicker();
  closeTournamentPicker();
  loadSelected();
}
function tournamentPickerLogo(t, cls='picker-logo'){
  return t?.logoUrl?`<span class="${cls}"><img src="${esc(t.logoUrl)}" alt=""></span>`:`<span class="${cls} fallback">⚽</span>`;
}
function renderTournamentPicker(filter=''){
  const list=publicTournaments();
  const picker=$('#tournamentPicker');
  const button=$('#tournamentPickerButton');
  const options=$('#tournamentPickerOptions');
  const search=$('#tournamentPickerSearch');
  if(!picker||!button||!options)return;
  const selected=list.find(([id])=>String(id)===String(state.tid)) || list[0];
  if(selected && String(selected[0])!==String(state.tid)) state.tid=selected[0];
  if(selected){
    const [id,t]=selected;
    const logo=tournamentPickerLogo(t,'picker-current-logo');
    button.querySelector('.picker-current-logo').outerHTML=logo;
    button.querySelector('.picker-current-text').innerHTML=`<b>${esc(t.name||id)}</b><small>${esc([t.season,t.location].filter(Boolean).join(' · ')||'Torneo')}</small>`;
  }else{
    button.querySelector('.picker-current-logo').outerHTML='<span class="picker-current-logo fallback">⚽</span>';
    button.querySelector('.picker-current-text').innerHTML='<b>Sin torneos</b><small>No hay torneos publicados</small>';
  }
  const q=normalize(filter||'');
  const filtered=list.filter(([id,t])=>normalize([t.name,id,t.season,t.location,t.description].filter(Boolean).join(' ')).includes(q));
  options.innerHTML=filtered.length?filtered.map(([id,t])=>`<button type="button" class="tournament-picker-option ${String(id)===String(state.tid)?'selected':''}" data-id="${esc(id)}" role="option" aria-selected="${String(id)===String(state.tid)}">${tournamentPickerLogo(t)}<span><b>${esc(t.name||id)}</b><small>${esc([t.season,t.location].filter(Boolean).join(' · ')||'')}</small></span><i>${String(id)===String(state.tid)?'✓':''}</i></button>`).join(''):'<div class="picker-no-results">No se encontraron torneos.</div>';
  options.querySelectorAll('.tournament-picker-option').forEach(b=>b.addEventListener('click',()=>selectPublicTournament(b.dataset.id)));
  if(search && search.value!==filter) search.value=filter;
}
function openTournamentPicker(){
  const picker=$('#tournamentPicker'),button=$('#tournamentPickerButton'),search=$('#tournamentPickerSearch');
  if(!picker||!button)return;
  picker.dataset.open='true'; button.setAttribute('aria-expanded','true');
  renderTournamentPicker(search?.value||'');
  setTimeout(()=>search?.focus(),0);
}
function closeTournamentPicker(){
  const picker=$('#tournamentPicker'),button=$('#tournamentPickerButton');
  if(!picker||!button)return;
  picker.dataset.open='false'; button.setAttribute('aria-expanded','false');
}
function toggleTournamentPicker(){
  const picker=$('#tournamentPicker');
  if(picker?.dataset.open==='true') closeTournamentPicker(); else openTournamentPicker();
}
$('#tournamentPickerButton')?.addEventListener('click',toggleTournamentPicker);
$('#tournamentPickerSearch')?.addEventListener('input',e=>renderTournamentPicker(e.target.value));
document.addEventListener('click',e=>{const picker=$('#tournamentPicker');if(picker&&!picker.contains(e.target))closeTournamentPicker();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeTournamentPicker();closeMatchDetail();}});
function renderCatalog(){ renderTournamentPicker($('#tournamentPickerSearch')?.value||''); }
function team(id){return state.teams[id]||{};}
function teamName(id){return team(id).name||id||'Por definir';}
function teamLogo(id,cls='team-logo'){const u=team(id).logoUrl;return u?`<span class="${cls}"><img src="${esc(u)}" alt=""></span>`:`<span class="${cls}">⚽</span>`;}
function tournamentLogo(t,cls='tournament-logo'){return t?.logoUrl?`<span class="${cls}"><img src="${esc(t.logoUrl)}" alt=""></span>`:`<span class="${cls}">⚽</span>`;}
function renderAll(){if(!state.tid)return;const t=state.tournaments[state.tid]||{};$('.brand small').textContent=`${String(t.name||'PLATAFORMA MULTI-TORNEOS').toUpperCase()} · ${t.season||''}`;renderFeatured(t);renderMatches();renderStandings();renderStats();renderFormat(t);}
function liveMinute(m){
  if(!m || String(m.status||'').toLowerCase()!=='en juego') return null;
  const base=Math.max(0,Number(m.liveStartMinute??m.initialMinute??0));
  const started=Date.parse(m.periodStartedAt||m.liveStartedAt||'');
  if(!Number.isFinite(started)) return base;
  return base+Math.max(0,Math.floor((Date.now()-started)/60000));
}
function liveMinuteLabel(m){
  if(!m)return '';
  const st=String(m.status||'').toLowerCase();
  if(st==='descanso')return 'DESCANSO';
  const n=liveMinute(m);
  if(n==null)return '';
  const half=Math.max(1,Number(m.liveHalfMinutes??state.tournaments[state.tid]?.format?.halfMinutes??25)||25);
  const period=String(m.livePeriod||'first').toLowerCase();
  const added=Math.max(0,Number(m.liveAddedTime||0));
  const threshold=period==='second'?half*2:half;
  if(n>threshold && added>0)return `${threshold}+${Math.min(n-threshold,added)}'`;
  return `${Math.min(n,threshold+added)}'`;
}
function liveStateLabel(m){const st=String(m?.status||'').toLowerCase();return st==='descanso'?'⏸ DESCANSO':st==='en juego'?'● EN JUEGO':st==='finalizado'?'● FINALIZADO':'PRÓXIMA FECHA';}
function startLiveClock(){if(state.liveTimer)clearInterval(state.liveTimer);state.liveTimer=setInterval(()=>{if(!state.tid)return;const live=Object.values(state.matches).some(m=>['en juego','descanso'].includes(String(m.status||'').toLowerCase()));if(live){document.querySelectorAll('[data-live-minute]').forEach(el=>{const m=state.matches[el.dataset.matchId];if(m)el.textContent=liveMinuteLabel(m);});}},1000);}
function renderFeatured(t){
  const games=Object.entries(state.matches).map(([id,m])=>({id,...m})).sort((a,b)=>String(a.dateValue||'9999').localeCompare(String(b.dateValue||'9999'))||String(a.time||'').localeCompare(String(b.time||'')));
  const live=games.find(m=>['en juego','descanso'].includes(String(m.status||'').toLowerCase()));
  const next=live||games.find(m=>String(m.status||'').toLowerCase()!=='finalizado');
  if(!next){$('#featured').innerHTML='<div class="empty">No hay partidos programados.</div>';return;}
  const st=String(next.status||'programado').toLowerCase();
  const dateText=next.dateValue?dateLabel(next.dateValue):String(next.roundLabel||'JORNADA POR DEFINIR').toUpperCase();
  const group=next.group?`<span class="featured-group">GRUPO ${esc(next.group)}</span>`:'';
  const minute=['en juego','descanso'].includes(st)?`<span class="live-minute" data-live-minute data-match-id="${esc(next.id)}">${liveMinuteLabel(next)}</span>`:'';
  $('#featured').innerHTML=`<div class="scoreboard-head"><span>${liveStateLabel(next)}</span><b>${esc(dateText)}</b></div><div class="featured-match featured-clean" data-featured-match="${esc(next.id)}"><div class="team-side home-side"><b>${esc(teamName(next.local))}</b><small>LOCAL</small></div><div class="score-center"><span>${['en juego','descanso'].includes(st)?minute:esc(timeLabel(next.time))}</span><strong>${st==='en juego'||st==='finalizado'||st==='descanso'?`${Number(next.homeScore||0)} — ${Number(next.awayScore||0)}`:'VS'}</strong>${st==='en juego'||st==='descanso'?'<i>VS</i>':''}</div><div class="team-side visitor-side"><b>${esc(teamName(next.visitor))}</b><small>VISITANTE</small></div></div>${group}`;
}
function detectNewEvents(next){
  const candidates=[];
  Object.entries(next||{}).forEach(([mid,evs])=>Object.entries(evs||{}).forEach(([eid,e])=>{const key=`${mid}/${eid}`;if(!state.seenEvents.has(key)){state.seenEvents.add(key);candidates.push({mid,eid,e});}}));
  if(!candidates.length)return;
  const item=candidates[candidates.length-1];
  const match=state.matches[item.mid];
  if(!match || String(match.status||'').toLowerCase()!=='en juego')return;
  showLiveEvent(match,item.e);
}
function showLiveEvent(match,e){
  const host=$('#featured'); if(!host)return;
  const type=String(e?.type||'').toLowerCase();
  const cls=type==='gol'?'goal':type==='roja'?'red':'yellow';
  const icon=type==='gol'?'⚽':type==='roja'?'🟥':'🟨';
  const label=type==='gol'?'GOOOOOL':type==='roja'?'TARJETA ROJA':'TARJETA AMARILLA';
  const side=e?.team===match.visitor?'visitor':'home';
  const player=e?.player?`<small>${esc(e.player)}</small>`:'';
  const old=host.querySelector('.live-event-burst');old?.remove();
  const burst=document.createElement('div');burst.className=`live-event-burst ${cls} ${side}`;burst.innerHTML=`${type==='gol'?'<div class="goal-balls" aria-hidden="true"><span>⚽</span><span>⚽</span><span>⚽</span></div>':''}<span class="event-icon">${icon}</span><b>${label}</b>${player}<em>${esc(e?.minute!=null?`${e.minute}'`:liveMinuteLabel(match))}</em>`;
  host.appendChild(burst);
  setTimeout(()=>burst.remove(),5000);
}

function phaseLabel(m){
  const v=String(m.phase||m.stageName||'fase de grupos').replace(/_/g,' ').trim();
  return v? v.toUpperCase() : 'FASE DE GRUPOS';
}
function dateKey(m){return String(m.dateId||m.roundLabel||m.dateValue||'sin_fecha');}
function dateName(m){return String(m.roundLabel||m.dateId||'FECHA').replace(/_/g,' ').toUpperCase();}
function renderDateFilters(rows){
  const dates=[]; const seen=new Set();
  rows.forEach(m=>{const k=dateKey(m);if(!seen.has(k)){seen.add(k);dates.push([k,dateName(m)]);}});
  const wrap=$('#dateFilters'); if(!wrap)return;
  if(state.dateFilter!=='all'&&state.dateFilter!=='__byes__'&&!seen.has(state.dateFilter))state.dateFilter='all';
  wrap.innerHTML=`<button class="date-filter ${state.dateFilter==='all'?'active':''}" data-date="all">TODAS</button>${dates.map(([k,n])=>`<button class="date-filter ${state.dateFilter===k?'active':''}" data-date="${esc(k)}">${esc(n)}</button>`).join('')}<button class="date-filter bye-tab ${state.dateFilter==='__byes__'?'active':''}" data-date="__byes__">💤 EQUIPOS LIBRES</button>`;
  wrap.querySelectorAll('.date-filter').forEach(b=>b.addEventListener('click',()=>{state.dateFilter=b.dataset.date;renderMatches();}));
}
function byeTeamsForRows(rows){
  const byDate=new Map();
  rows.forEach(m=>{const k=dateKey(m);if(!byDate.has(k))byDate.set(k,{label:dateName(m),round:Number(m.roundNumber||0),groups:new Set()});if(m.group)byDate.get(k).groups.add(String(m.group).toUpperCase());});
  const allTeams=Object.entries(state.teams||{});
  return [...byDate.entries()].map(([key,x])=>{const free=[];x.groups.forEach(g=>{const ids=allTeams.filter(([,t])=>String(t.group||'').toUpperCase()===g).map(([id])=>id);const played=new Set();rows.filter(m=>dateKey(m)===key&&String(m.group||'').toUpperCase()===g).forEach(m=>{if(m.local)played.add(m.local);if(m.visitor)played.add(m.visitor);});ids.filter(id=>!played.has(id)).forEach(id=>free.push({id,name:teamName(id),group:g}));});return {key,...x,free};}).filter(x=>x.free.length);
}
function renderByeInfo(rows){
 const box=$('#byeInfo');if(!box)return;
 if(state.dateFilter!=='__byes__'){box.innerHTML='';box.hidden=true;return;}
 const all=byeTeamsForRows(rows);
 if(!all.length){box.innerHTML='<div class="bye-info-head"><span>💤</span><div><b>Equipos libres</b><small>No hay equipos libres registrados.</small></div></div>';box.hidden=false;return;}
 box.hidden=false;
 box.innerHTML=`<div class="bye-info-head"><span>💤</span><div><b>Equipos libres</b><small>Descansos registrados por fecha</small></div></div><div class="bye-info-list">${all.map(x=>`<div class="bye-date"><strong>${esc(x.label)}</strong><div class="bye-names">${x.free.map(f=>`<div>${esc(f.name)} · Grupo ${esc(f.group)}</div>`).join('')}</div></div>`).join('')}</div>`;
}
function renderMatches(){
  const rows=Object.entries(state.matches).map(([id,m])=>({id,...m})).sort((a,b)=>{
    // En TODAS las fechas se muestran de la jornada más reciente a la más antigua.
    // Ej.: Fecha 3 → Fecha 2 → Fecha 1. Dentro de cada fecha se conserva el orden cronológico.
    const ra=Number(a.roundNumber||0), rb=Number(b.roundNumber||0);
    if(ra!==rb) return rb-ra;
    const ka=String(a.roundLabel||a.dateId||'').toLowerCase(), kb=String(b.roundLabel||b.dateId||'').toLowerCase();
    const na=(ka.match(/\d+/)||['0'])[0], nb=(kb.match(/\d+/)||['0'])[0];
    if(Number(na)!==Number(nb)) return Number(nb)-Number(na);
    const da=String(a.dateValue||'9999-99-99'), db=String(b.dateValue||'9999-99-99');
    return da.localeCompare(db)||String(a.time||'').localeCompare(String(b.time||''));
  });
  renderDateFilters(rows);
  renderByeInfo(rows);
  const byeMode=state.dateFilter==='__byes__';
  const filtered=state.dateFilter==='all'?rows:(byeMode?[]:rows.filter(m=>dateKey(m)===state.dateFilter));
  const phase=rows.length?phaseLabel(rows[0]):'FASE DE GRUPOS'; if($('#phaseBadge'))$('#phaseBadge').textContent=phase;
  if(byeMode){ $('#matchesGrid').innerHTML=''; bindMatchInteractions(); if(state.selectedMatchId && state.matches[state.selectedMatchId]) refreshOpenMatchDetail(); return; }
  $('#matchesGrid').innerHTML=filtered.length?filtered.map(m=>{
    const st=String(m.status||'programado').toLowerCase();
    const dateText=m.dateValue?dateLabel(m.dateValue):'';
    const group=m.group?`<span class="match-group-badge group-${String(m.group).toLowerCase()}">${esc(m.group)}</span>`:'';
    return `<article class="match-card ${['en juego','descanso'].includes(st)?'is-live':st==='finalizado'?'is-finished':''}" data-match-id="${esc(m.id)}" role="button" tabindex="0" aria-label="Ver detalles de ${esc(teamName(m.local))} vs ${esc(teamName(m.visitor))}"><div class="match-meta rich"><span>${esc(dateName(m))}</span><span>▦ ${esc(dateText)}</span><span>◉ ${esc(timeLabel(m.time))}</span>${group}</div><div class="match-teams"><div class="team-block home"><div class="team-row">${teamLogo(m.local,'team-logo')}<b>${esc(teamName(m.local))}</b></div><small>LOCAL</small></div><strong class="score-mid">${['en juego','descanso'].includes(st)?`<span class="calendar-live-minute" data-live-minute data-match-id="${esc(m.id)}">${liveMinuteLabel(m)}</span>`:''}${st==='programado'?'VS':`${Number(m.homeScore||0)} — ${Number(m.awayScore||0)}`}</strong><div class="team-block visitor"><div class="team-row"><b>${esc(teamName(m.visitor))}</b>${teamLogo(m.visitor,'team-logo')}</div><small>VISITANTE</small></div></div><div class="match-footer">${st==='finalizado'?'<span class="finished-status">● FINALIZADO</span>':st==='programado'?'<span>○ PROGRAMADO</span>':st==='descanso'?'<span class="live-status">⏸ DESCANSO</span>':'<span class="live-status">● EN JUEGO</span>'}<span>${esc(phaseLabel(m))}</span></div></article>`;
  }).join(''):'<div class="empty">No hay partidos para esta fecha.</div>';
  bindMatchInteractions();
  if(state.selectedMatchId && state.matches[state.selectedMatchId]) refreshOpenMatchDetail();
}
function matchEvents(matchId){
  return Object.entries(state.events?.[matchId]||{}).map(([id,e])=>({id,...e})).sort((a,b)=>Number(a.minute||0)-Number(b.minute||0));
}
function matchEventType(e){return String(e?.type||'').toLowerCase();}
function matchEventIcon(e){const t=matchEventType(e);return t==='gol'?'⚽':t==='roja'?'🟥':t==='amarilla'?'🟨':'•';}
function matchEventLabel(e){const t=matchEventType(e);return t==='gol'?'Gol':t==='roja'?'Tarjeta roja':t==='amarilla'?'Tarjeta amarilla':String(e?.type||'Evento');}
function renderMatchDetail(matchId){
  const modal=$('#matchDetailModal'); if(!modal)return;
  const match=state.matches?.[matchId]; if(!match)return;
  state.selectedMatchId=matchId;
  const st=String(match.status||'programado').toLowerCase();
  const home=teamName(match.local), away=teamName(match.visitor);
  const events=matchEvents(matchId);
  const goals=events.filter(e=>matchEventType(e)==='gol').length;
  const yellows=events.filter(e=>matchEventType(e)==='amarilla').length;
  const reds=events.filter(e=>matchEventType(e)==='roja').length;
  const statusHtml=st==='finalizado'?'<span class="detail-status finished">● FINALIZADO</span>':st==='en juego'?'<span class="detail-status live">● EN JUEGO</span>':st==='descanso'?'<span class="detail-status break">⏸ DESCANSO</span>':'<span class="detail-status scheduled">○ PROGRAMADO</span>';
  const score=st==='programado'?'VS':`${Number(match.homeScore||0)} — ${Number(match.awayScore||0)}`;
  const time=st==='en juego'||st==='descanso'?liveMinuteLabel(match):timeLabel(match.time);
  const date=match.dateValue?dateLabel(match.dateValue):String(match.roundLabel||'Fecha por definir');
  const group=match.group?`<span class="detail-pill">GRUPO ${esc(match.group)}</span>`:'';
  const eventHtml=events.length?events.map(e=>{
    const side=e.team===match.visitor?'away':'home';
    const minute=e.minute!=null?`${esc(e.minute)}'`:'';
    return `<div class="detail-event ${side} ${matchEventType(e)}"><div class="detail-event-time">${minute}</div><div class="detail-event-icon">${matchEventIcon(e)}</div><div class="detail-event-info"><b>${esc(matchEventLabel(e))}</b>${e.player?`<span>${esc(e.player)}</span>`:''}<small>${side==='home'?esc(home):esc(away)}</small></div></div>`;
  }).join(''):'<div class="detail-empty"><span>⚽</span><b>Sin eventos registrados</b><small>Los goles y tarjetas aparecerán aquí durante el partido.</small></div>';
  modal.innerHTML=`<div class="modal-backdrop" data-close-match></div><div class="match-detail-box" role="dialog" aria-modal="true" aria-labelledby="matchDetailTitle"><button class="modal-close public-modal-close" type="button" aria-label="Cerrar" data-close-match>×</button><div class="detail-top"><div><span class="kicker">${esc(phaseLabel(match))}</span><h2 id="matchDetailTitle">${esc(date)}</h2></div>${statusHtml}</div><div class="detail-meta"><span>▦ ${esc(date)}</span><span>◷ ${esc(time)}</span>${group}</div><div class="detail-scoreboard"><div class="detail-team home"><div class="detail-logo">${teamLogo(match.local,'team-logo')}</div><b>${esc(home)}</b><small>LOCAL</small></div><div class="detail-score"><strong>${score}</strong>${st==='en juego'||st==='descanso'?`<span data-live-minute data-match-id="${esc(matchId)}">${esc(liveMinuteLabel(match))}</span>`:''}</div><div class="detail-team away"><div class="detail-logo">${teamLogo(match.visitor,'team-logo')}</div><b>${esc(away)}</b><small>VISITANTE</small></div></div><div class="detail-summary"><div><b>${goals}</b><span>⚽ Goles</span></div><div><b>${yellows}</b><span>🟨 Amarillas</span></div><div><b>${reds}</b><span>🟥 Rojas</span></div></div><section class="detail-section"><div class="detail-section-head"><div><span class="kicker">CRONOLOGÍA</span><h3>Eventos del partido</h3></div><span>${events.length} evento${events.length===1?'':'s'}</span></div><div class="detail-events">${eventHtml}</div></section><div class="detail-footer"><span>${st==='programado'?'El partido todavía no ha comenzado.':st==='finalizado'?'Partido finalizado.':'Información actualizada en tiempo real.'}</span><div class="detail-footer-actions">${st==='finalizado'?'<button class="btn primary" type="button" data-download-acta>📄 Descargar acta PDF</button>':''}<button class="btn ghost" type="button" data-close-match>Cerrar</button></div></div></div>`;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}
function closeMatchDetail(){const modal=$('#matchDetailModal');if(!modal)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true');state.selectedMatchId=null;document.body.classList.remove('modal-open');}
function bindMatchInteractions(){
  const grid=$('#matchesGrid'); if(grid&&!grid.dataset.bound){
    grid.dataset.bound='1';
    grid.addEventListener('click',e=>{const card=e.target.closest('[data-match-id]');if(card)renderMatchDetail(card.dataset.matchId);});
    grid.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.closest('[data-match-id]')){e.preventDefault();renderMatchDetail(e.target.closest('[data-match-id]').dataset.matchId);}});
  }
  const modal=$('#matchDetailModal'); if(modal&&!modal.dataset.bound){
    modal.dataset.bound='1';
    modal.addEventListener('click',async e=>{if(e.target.closest('[data-close-match]'))return closeMatchDetail();const btn=e.target.closest('[data-download-acta]');if(!btn)return;const id=state.selectedMatchId;const match=state.matches?.[id];if(!match)return;btn.disabled=true;btn.textContent='Generando PDF...';try{await downloadMatchActPDF({tournament:state.tournaments[state.tid]||{},match,teams:state.teams,events:state.events?.[id]||{}});btn.textContent='✓ PDF descargado';setTimeout(()=>{if(btn.isConnected){btn.disabled=false;btn.textContent='📄 Descargar acta PDF';}},1800);}catch(err){console.error(err);btn.disabled=false;btn.textContent='📄 Descargar acta PDF';alert(err?.message||'No se pudo generar el PDF.');}});
  }
}
function refreshOpenMatchDetail(){if(state.selectedMatchId)renderMatchDetail(state.selectedMatchId);}

function firstGroupStage(){const f=state.tournaments[state.tid]?.format||{};return (f.stages||[]).find(s=>s.type==='round_robin');}
function standingsFor(group,stageId){const out={};Object.entries(state.teams).filter(([,t])=>String(t.group||'')===String(group)).forEach(([id,t])=>out[id]={id,name:t.name||id,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0});const f=state.tournaments[state.tid]?.format||{};const win=Number(f.points?.win??3),draw=Number(f.points?.draw??1);Object.values(state.matches).filter(m=>{const ms=String(m.stageId||'').trim();const mn=String(m.phase||'').trim().toLowerCase();const target=String(stageId||'').trim();const st=state.tournaments[state.tid]?.format?.stages||[];const targetStage=Array.isArray(st)?st.find(x=>String(x.id||'')===target):null;const targetName=String(targetStage?.name||'').trim().toLowerCase();const stageOk=!target||!ms||ms===target||!!targetName&&mn===targetName;const groupOk=String(m.group||'').trim().toUpperCase()===String(group||'').trim().toUpperCase();const status=String(m.status||'').trim().toLowerCase().replace(/_/g,' ');return stageOk&&groupOk&&status==='finalizado';}).forEach(m=>{if(!out[m.local]||!out[m.visitor])return;const a=Number(m.homeScore||0),b=Number(m.awayScore||0);out[m.local].pj++;out[m.visitor].pj++;out[m.local].gf+=a;out[m.local].gc+=b;out[m.visitor].gf+=b;out[m.visitor].gc+=a;if(a>b){out[m.local].pg++;out[m.local].pts+=win;out[m.visitor].pp++;}else if(a<b){out[m.visitor].pg++;out[m.visitor].pts+=win;out[m.local].pp++;}else{out[m.local].pe++;out[m.visitor].pe++;out[m.local].pts+=draw;out[m.visitor].pts+=draw;}});return Object.values(out).map(x=>(x.dg=x.gf-x.gc,x)).sort((a,b)=>b.pts-a.pts||b.dg-a.dg||b.gf-a.gf||a.name.localeCompare(b.name,'es'));}
function renderStandings(){const stage=firstGroupStage();if(!stage){$('#standings').innerHTML='<div class="empty">Este torneo no tiene una fase de grupos publicada.</div>';return;}const groups=[...new Set(Object.values(state.teams).map(t=>t.group).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es'));$('#standings').innerHTML=groups.length?groups.map(g=>`<div class="standings-card"><div class="card-title"><div><span class="group-badge ${String(g).toUpperCase()==='B'?'group-b':''}">${esc(g)}</span><div><b>GRUPO ${esc(g)}</b><small>Todos contra todos</small></div></div><span>${esc(stage.name||'Fase de grupos')}</span></div><div class="table-wrap"><table><colgroup><col class="col-pos"><col class="col-team"><col><col><col><col><col><col></colgroup><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>DG</th><th>PTS</th></tr></thead><tbody>${standingsFor(g,stage.id).map((x,i)=>`<tr><td><span class="pos ${i<2?'qualified':''}">${i+1}</span></td><td><div class="table-team">${teamLogo(x.id,'team-logo tiny')}<b>${esc(x.name)}</b></div></td><td>${x.pj}</td><td>${x.pg}</td><td>${x.pe}</td><td>${x.pp}</td><td class="${x.dg>=0?'positive':'negative'}">${x.dg>0?'+':''}${x.dg}</td><td><strong>${x.pts}</strong></td></tr>`).join('')}</tbody></table></div></div>`).join(''):'<div class="empty">Asigna grupos a los equipos para mostrar posiciones.</div>';}
function renderStats(){let goals=0,yellow=0,red=0,played=0;const players={};for(const evs of Object.values(state.events)){for(const e of Object.values(evs||{})){const type=String(e.type||'').toLowerCase();const raw=e.player||e.playerName||e.jugador;if(type==='gol')goals++;if(type==='amarilla')yellow++;if(type==='roja')red++;if(raw){const teamId=e.team||e.equipo||'';const k=normalize(raw)+'|'+teamId;if(!players[k])players[k]={name:String(raw).trim(),team:teamName(teamId),goals:0,yellow:0,red:0};if(type==='gol')players[k].goals++;if(type==='amarilla')players[k].yellow++;if(type==='roja')players[k].red++;}}}for(const m of Object.values(state.matches))if(String(m.status||'').toLowerCase()==='finalizado')played++;const list=Object.values(players);const top=list.filter(p=>p.goals>0).sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name,'es')).slice(0,8);const disc=list.filter(p=>p.yellow||p.red).sort((a,b)=>(b.red+b.yellow)-(a.red+a.yellow)||a.name.localeCompare(b.name,'es')).slice(0,8);$('#stats').innerHTML=`<div class="stat-card"><span>⚽</span><b>${goals}</b><small>Goles</small></div><div class="stat-card"><span>🟨</span><b>${yellow}</b><small>Amarillas</small></div><div class="stat-card"><span>🟥</span><b>${red}</b><small>Rojas</small></div><div class="stat-card"><span>🏟️</span><b>${played}</b><small>Partidos jugados</small></div>`;$('#scorers').innerHTML=`<div class="list-card"><div class="card-title"><b>⚽ Goleadores</b><span>Acumulado</span></div><div class="leader-list">${top.length?top.map((p,i)=>`<div class="leader-row"><span class="leader-rank">${i+1}</span><div class="leader-person"><b>${esc(p.name)}</b><small>${esc(p.team)}</small></div><strong>${p.goals} ⚽</strong></div>`).join(''):'<div class="empty">Aún no hay goles registrados.</div>'}</div></div>`;$('#discipline').innerHTML=`<div class="list-card"><div class="card-title"><b>🟨 / 🟥 Disciplina</b><span>Acumulado</span></div><div class="leader-list">${disc.length?disc.map(p=>`<div class="leader-row"><div class="leader-person"><b>${esc(p.name)}</b><small>${esc(p.team)}</small></div><strong>🟨 ${p.yellow} &nbsp; 🟥 ${p.red}</strong></div>`).join(''):'<div class="empty">Aún no hay tarjetas registradas.</div>'}</div></div>`;}
function renderFormat(t){const f=t.format||{};const list=Array.isArray(f.stages)?f.stages:[];$('#formatInfo').innerHTML=`<div><span class="kicker">FORMATO DEL TORNEO</span><h2>${esc(t.name||'Torneo')}</h2><p>${esc(t.description||'Formato configurable por torneo.')}</p></div><div class="format-list">${list.length?list.map((s,i)=>`<div class="format-step"><b>${i+1}. ${esc(s.name||'Fase')}</b><span>${s.type==='round_robin'?'Liga / grupos':s.type==='final'?'Final':'Eliminatoria'} · ${s.matchMode==='home_away'?'Ida y vuelta':'Partido único'}${s.qualifiersPerGroup?` · ${s.qualifiersPerGroup} clasificados/grupo`:''}</span></div>`).join(''):'<div class="format-step"><b>Formato aún no publicado</b><span>El administrador puede configurarlo.</span></div>'}</div>`;}

function renderProPublic(){
 const news=Object.values(state.news||{}).filter(x=>x&&x.published!==false).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).slice(0,5);const awards=Object.values(state.awards||{}).slice(0,6);const sponsors=Object.values(state.sponsors||{}).slice(0,8);const venues=Object.values(state.venues||{}).slice(0,6);
 const n=$('#publicNews'),a=$('#publicAwards'),sp=$('#publicSponsors'),v=$('#publicVenues');
 if(n)n.innerHTML=news.length?news.map(x=>`<article class="public-news"><small>${esc(x.date||'')}</small><b>${esc(x.title||'')}</b><p>${esc(x.body||'').slice(0,180)}${String(x.body||'').length>180?'…':''}</p></article>`).join(''):'<div class="empty-mini">No hay noticias publicadas.</div>';
 if(a)a.innerHTML=awards.length?awards.map(x=>`<div class="public-row"><span>🏅</span><div><b>${esc(x.name||'')}</b><small>${esc(x.winner||'')}${x.team?' · '+esc(teamName(x.team)):''}</small></div></div>`).join(''):'<div class="empty-mini">Premios aún no definidos.</div>';
 if(sp)sp.innerHTML=sponsors.length?sponsors.map(x=>`<a class="sponsor-chip" href="${esc(x.url||'#')}" target="_blank" rel="noopener">${x.logo?`<img src="${esc(x.logo)}" alt="">`:'🤝'}<span><b>${esc(x.name||'')}</b><small>${esc(x.level||'')}</small></span></a>`).join(''):'<div class="empty-mini">Sin patrocinadores.</div>';
 if(v)v.innerHTML=venues.length?venues.map(x=>`<div class="public-row"><span>🏟️</span><div><b>${esc(x.name||'')}</b><small>${esc([x.address,x.city].filter(Boolean).join(' · '))}</small></div>${x.mapUrl?`<a href="${esc(x.mapUrl)}" target="_blank" rel="noopener">Mapa</a>`:''}</div>`).join(''):'<div class="empty-mini">No hay sedes registradas.</div>';
}


async function submitPublicRegistration(e){
  e.preventDefault();
  const form=e.currentTarget;
  const out=$('#publicRegistrationMsg');
  const tournament=state.tournaments[state.tid]||{};
  const team=$('#publicRegistrationTeam')?.value.trim()||'';
  const delegate=$('#publicRegistrationDelegate')?.value.trim()||'';
  const contact=$('#publicRegistrationContact')?.value.trim()||'';
  const email=$('#publicRegistrationEmail')?.value.trim()||'';
  const notes=$('#publicRegistrationNotes')?.value.trim()||'';
  if(!state.tid || !tournament || tournament.status!=='active'){
    if(out) out.textContent='Este campeonato no está disponible para recibir solicitudes.';
    return;
  }
  if(!team){
    if(out) out.textContent='Escribe el nombre del equipo.';
    return;
  }
  if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    if(out) out.textContent='El correo electrónico no es válido.';
    return;
  }
  const id=`solicitud-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
  const data={id,team,delegate,contact,email,notes,status:'pending',source:'public',tournamentId:state.tid,createdAt:new Date().toISOString()};
  const btn=form.querySelector('button[type="submit"]');
  if(btn){btn.disabled=true;btn.textContent='Enviando...';}
  try{
    await set(ref(db,`inscripciones/${state.tid}/${id}`),data);
    form.reset();
    if(out) out.textContent='✅ Solicitud enviada. El organizador la revisará.';
  }catch(err){
    console.error(err);
    if(out) out.textContent='No se pudo enviar la solicitud. Intenta nuevamente.';
  }finally{
    if(btn){btn.disabled=false;btn.textContent='📝 Enviar solicitud';}
  }
}

$('#publicRegistrationForm')?.addEventListener('submit',submitPublicRegistration);
