import { db } from './firebase.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js';
import { esc, timeLabel, dateLabel, normalize } from './common.js';
const state={tournaments:{},tid:new URLSearchParams(location.search).get('t')||'',teams:{},matches:{},events:{},unsub:[],dateFilter:'all',eventsReady:false,seenEvents:new Set(),liveTimer:null};

function normalizePublicUrl(){const params=new URLSearchParams(location.search);const tid=params.get('t');if(location.pathname.endsWith('/index.html')){const q=tid?`?t=${encodeURIComponent(tid)}`:'';history.replaceState({},'',`./${q}`);}}
normalizePublicUrl();
const $=s=>document.querySelector(s);
function publicTournaments(){return Object.entries(state.tournaments).filter(([,t])=>t&&t.public!==false&&t.status!=='archived').sort((a,b)=>String(a[1].name||a[0]).localeCompare(String(b[1].name||b[0]),'es'));}
onValue(ref(db,'tournaments'),snap=>{state.tournaments=snap.val()||{};renderCatalog();loadSelected();});
function loadSelected(){state.eventsReady=false;state.seenEvents.clear();if(state.liveTimer){clearInterval(state.liveTimer);state.liveTimer=null;}state.unsub.forEach(fn=>{try{fn();}catch{}});state.unsub=[];const list=publicTournaments();if(!list.length){$('#featured').innerHTML='<div class="empty">Todavía no hay torneos publicados.</div>';$('#matchesGrid').innerHTML='';$('#standings').innerHTML='';$('#stats').innerHTML='';$('#scorers').innerHTML='';$('#discipline').innerHTML='';return;}const allowed=state.tid&&list.some(([id])=>id===state.tid);if(!allowed)state.tid=list[0][0];const t=state.tournaments[state.tid];renderTournamentPicker();document.title=`${t.name||'Torneo'} ${t.season||''}`.trim();state.unsub.push(onValue(ref(db,`equipos/${state.tid}`),s=>{state.teams=s.val()||{};renderAll();}));state.unsub.push(onValue(ref(db,`partidos/${state.tid}`),s=>{state.matches=s.val()||{};renderAll();}));state.unsub.push(onValue(ref(db,`eventos/${state.tid}`),s=>{const next=s.val()||{}; if(!state.eventsReady){state.events=next;state.eventsReady=true;Object.entries(next).forEach(([mid,evs])=>Object.keys(evs||{}).forEach(eid=>state.seenEvents.add(`${mid}/${eid}`)));renderAll();return;} state.events=next;renderAll();detectNewEvents(next); })); startLiveClock();}
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
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTournamentPicker();});
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
  if(state.dateFilter!=='all'&&!seen.has(state.dateFilter))state.dateFilter='all';
  wrap.innerHTML=`<button class="date-filter ${state.dateFilter==='all'?'active':''}" data-date="all">TODAS</button>${dates.map(([k,n])=>`<button class="date-filter ${state.dateFilter===k?'active':''}" data-date="${esc(k)}">${esc(n)}</button>`).join('')}`;
  wrap.querySelectorAll('.date-filter').forEach(b=>b.addEventListener('click',()=>{state.dateFilter=b.dataset.date;renderMatches();}));
}
function renderMatches(){
  const rows=Object.entries(state.matches).map(([id,m])=>({id,...m})).sort((a,b)=>String(a.dateValue||'').localeCompare(String(b.dateValue||''))||Number(a.roundNumber||0)-Number(b.roundNumber||0)||String(a.time||'').localeCompare(String(b.time||'')));
  renderDateFilters(rows);
  const filtered=state.dateFilter==='all'?rows:rows.filter(m=>dateKey(m)===state.dateFilter);
  const phase=rows.length?phaseLabel(rows[0]):'FASE DE GRUPOS'; if($('#phaseBadge'))$('#phaseBadge').textContent=phase;
  $('#matchesGrid').innerHTML=filtered.length?filtered.map(m=>{
    const st=String(m.status||'programado').toLowerCase();
    const dateText=m.dateValue?dateLabel(m.dateValue):'';
    const group=m.group?`<span class="match-group-badge group-${String(m.group).toLowerCase()}">${esc(m.group)}</span>`:'';
    return `<article class="match-card ${['en juego','descanso'].includes(st)?'is-live':st==='finalizado'?'is-finished':''}"><div class="match-meta rich"><span>${esc(dateName(m))}</span><span>▦ ${esc(dateText)}</span><span>◉ ${esc(timeLabel(m.time))}</span>${group}</div><div class="match-teams"><div class="team-block home"><div class="team-row">${teamLogo(m.local,'team-logo')}<b>${esc(teamName(m.local))}</b></div><small>LOCAL</small></div><strong class="score-mid">${['en juego','descanso'].includes(st)?`<span class="calendar-live-minute" data-live-minute data-match-id="${esc(m.id)}">${liveMinuteLabel(m)}</span>`:''}${st==='programado'?'VS':`${Number(m.homeScore||0)} — ${Number(m.awayScore||0)}`}</strong><div class="team-block visitor"><div class="team-row"><b>${esc(teamName(m.visitor))}</b>${teamLogo(m.visitor,'team-logo')}</div><small>VISITANTE</small></div></div><div class="match-footer">${st==='finalizado'?'<span class="finished-status">● FINALIZADO</span>':st==='programado'?'<span>○ PROGRAMADO</span>':st==='descanso'?'<span class="live-status">⏸ DESCANSO</span>':'<span class="live-status">● EN JUEGO</span>'}<span>${esc(phaseLabel(m))}</span></div></article>`;
  }).join(''):'<div class="empty">No hay partidos para esta fecha.</div>';
}
function firstGroupStage(){const f=state.tournaments[state.tid]?.format||{};return (f.stages||[]).find(s=>s.type==='round_robin');}
function standingsFor(group,stageId){const out={};Object.entries(state.teams).filter(([,t])=>String(t.group||'')===String(group)).forEach(([id,t])=>out[id]={id,name:t.name||id,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0});const f=state.tournaments[state.tid]?.format||{};const win=Number(f.points?.win??3),draw=Number(f.points?.draw??1);Object.values(state.matches).filter(m=>{const ms=String(m.stageId||'').trim();const mn=String(m.phase||'').trim().toLowerCase();const target=String(stageId||'').trim();const st=state.tournaments[state.tid]?.format?.stages||[];const targetStage=Array.isArray(st)?st.find(x=>String(x.id||'')===target):null;const targetName=String(targetStage?.name||'').trim().toLowerCase();const stageOk=!target||!ms||ms===target||!!targetName&&mn===targetName;const groupOk=String(m.group||'').trim().toUpperCase()===String(group||'').trim().toUpperCase();const status=String(m.status||'').trim().toLowerCase().replace(/_/g,' ');return stageOk&&groupOk&&status==='finalizado';}).forEach(m=>{if(!out[m.local]||!out[m.visitor])return;const a=Number(m.homeScore||0),b=Number(m.awayScore||0);out[m.local].pj++;out[m.visitor].pj++;out[m.local].gf+=a;out[m.local].gc+=b;out[m.visitor].gf+=b;out[m.visitor].gc+=a;if(a>b){out[m.local].pg++;out[m.local].pts+=win;out[m.visitor].pp++;}else if(a<b){out[m.visitor].pg++;out[m.visitor].pts+=win;out[m.local].pp++;}else{out[m.local].pe++;out[m.visitor].pe++;out[m.local].pts+=draw;out[m.visitor].pts+=draw;}});return Object.values(out).map(x=>(x.dg=x.gf-x.gc,x)).sort((a,b)=>b.pts-a.pts||b.dg-a.dg||b.gf-a.gf||a.name.localeCompare(b.name,'es'));}
function renderStandings(){const stage=firstGroupStage();if(!stage){$('#standings').innerHTML='<div class="empty">Este torneo no tiene una fase de grupos publicada.</div>';return;}const groups=[...new Set(Object.values(state.teams).map(t=>t.group).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es'));$('#standings').innerHTML=groups.length?groups.map(g=>`<div class="standings-card"><div class="card-title"><div><span class="group-badge ${String(g).toUpperCase()==='B'?'group-b':''}">${esc(g)}</span><div><b>GRUPO ${esc(g)}</b><small>Todos contra todos</small></div></div><span>${esc(stage.name||'Fase de grupos')}</span></div><div class="table-wrap"><table><colgroup><col class="col-pos"><col class="col-team"><col><col><col><col><col><col></colgroup><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>DG</th><th>PTS</th></tr></thead><tbody>${standingsFor(g,stage.id).map((x,i)=>`<tr><td><span class="pos ${i<2?'qualified':''}">${i+1}</span></td><td><div class="table-team">${teamLogo(x.id,'team-logo tiny')}<b>${esc(x.name)}</b></div></td><td>${x.pj}</td><td>${x.pg}</td><td>${x.pe}</td><td>${x.pp}</td><td class="${x.dg>=0?'positive':'negative'}">${x.dg>0?'+':''}${x.dg}</td><td><strong>${x.pts}</strong></td></tr>`).join('')}</tbody></table></div></div>`).join(''):'<div class="empty">Asigna grupos a los equipos para mostrar posiciones.</div>';}
function renderStats(){let goals=0,yellow=0,red=0,played=0;const players={};for(const evs of Object.values(state.events)){for(const e of Object.values(evs||{})){const type=String(e.type||'').toLowerCase();const raw=e.player||e.playerName||e.jugador;if(type==='gol')goals++;if(type==='amarilla')yellow++;if(type==='roja')red++;if(raw){const teamId=e.team||e.equipo||'';const k=normalize(raw)+'|'+teamId;if(!players[k])players[k]={name:String(raw).trim(),team:teamName(teamId),goals:0,yellow:0,red:0};if(type==='gol')players[k].goals++;if(type==='amarilla')players[k].yellow++;if(type==='roja')players[k].red++;}}}for(const m of Object.values(state.matches))if(String(m.status||'').toLowerCase()==='finalizado')played++;const list=Object.values(players);const top=list.filter(p=>p.goals>0).sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name,'es')).slice(0,8);const disc=list.filter(p=>p.yellow||p.red).sort((a,b)=>(b.red+b.yellow)-(a.red+a.yellow)||a.name.localeCompare(b.name,'es')).slice(0,8);$('#stats').innerHTML=`<div class="stat-card"><span>⚽</span><b>${goals}</b><small>Goles</small></div><div class="stat-card"><span>🟨</span><b>${yellow}</b><small>Amarillas</small></div><div class="stat-card"><span>🟥</span><b>${red}</b><small>Rojas</small></div><div class="stat-card"><span>🏟️</span><b>${played}</b><small>Partidos jugados</small></div>`;$('#scorers').innerHTML=`<div class="list-card"><div class="card-title"><b>⚽ Goleadores</b><span>Acumulado</span></div><div class="leader-list">${top.length?top.map((p,i)=>`<div class="leader-row"><span class="leader-rank">${i+1}</span><div class="leader-person"><b>${esc(p.name)}</b><small>${esc(p.team)}</small></div><strong>${p.goals} ⚽</strong></div>`).join(''):'<div class="empty">Aún no hay goles registrados.</div>'}</div></div>`;$('#discipline').innerHTML=`<div class="list-card"><div class="card-title"><b>🟨 / 🟥 Disciplina</b><span>Acumulado</span></div><div class="leader-list">${disc.length?disc.map(p=>`<div class="leader-row"><div class="leader-person"><b>${esc(p.name)}</b><small>${esc(p.team)}</small></div><strong>🟨 ${p.yellow} &nbsp; 🟥 ${p.red}</strong></div>`).join(''):'<div class="empty">Aún no hay tarjetas registradas.</div>'}</div></div>`;}
function renderFormat(t){const f=t.format||{};const list=Array.isArray(f.stages)?f.stages:[];$('#formatInfo').innerHTML=`<div><span class="kicker">FORMATO DEL TORNEO</span><h2>${esc(t.name||'Torneo')}</h2><p>${esc(t.description||'Formato configurable por torneo.')}</p></div><div class="format-list">${list.length?list.map((s,i)=>`<div class="format-step"><b>${i+1}. ${esc(s.name||'Fase')}</b><span>${s.type==='round_robin'?'Liga / grupos':s.type==='final'?'Final':'Eliminatoria'} · ${s.matchMode==='home_away'?'Ida y vuelta':'Partido único'}${s.qualifiersPerGroup?` · ${s.qualifiersPerGroup} clasificados/grupo`:''}</span></div>`).join(''):'<div class="format-step"><b>Formato aún no publicado</b><span>El administrador puede configurarlo.</span></div>'}</div>`;}
