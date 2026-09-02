import { db } from "./firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const state={teams:{},matches:{},events:{},settings:{name:"CAMPEONATO INSTITUCIONAL | EMPRESARIAL",season:"2026",points:{win:3,draw:1,loss:0}}};

onValue(ref(db),snap=>{const d=snap.val()||{};state.teams=d.equipos||{};state.matches=d.partidos||{};state.events=d.eventos||{};state.settings={...state.settings,...(d.configuracion||{})};render();});
const team=id=>state.teams[id]?.name||id||"TBD";
const teamLogo=id=>state.teams[id]?.logoUrl||"";
function formatMatchDate(iso,dateId="",dateLabel=""){
  // Firebase ya puede tener la fecha descriptiva en dateLabel.
  // Usarla primero evita mostrar "Fecha por definir" cuando dateValue aún no existe.
  if(dateLabel && !/^FECHA\s+\d+$/i.test(String(dateLabel).trim())) return String(dateLabel).trim().toLocaleUpperCase("es-EC");

  // Respaldo oficial para la Fecha 1 del torneo.
  if(!iso && dateId==="fecha_1") iso="2026-09-06";
  if(!iso)return "Fecha por definir";
  const d=new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())?"Fecha por definir":d.toLocaleDateString("es-EC",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).toLocaleUpperCase("es-EC");
}
let selectedDate="all";
function allMatches(){return Object.entries(state.matches).map(([id,m])=>({id,...m})).sort((a,b)=>String(a.dateId).localeCompare(String(b.dateId))||Number(a.number||0)-Number(b.number||0));}
function standings(group){
 const rows=Object.entries(state.teams).filter(([id,t])=>t.active!==false&&t.group===group).map(([id,t])=>({id,name:t.name,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,dg:0,pts:0}));
 const by=Object.fromEntries(rows.map(r=>[r.id,r]));
 for(const m of Object.values(state.matches)){if(m.phase!=="grupos"||m.status!=="finalizado"||m.group!==group)continue;const h=by[m.local],a=by[m.visitor];if(!h||!a)continue;const hg=Number(m.homeScore||0),ag=Number(m.awayScore||0);h.pj++;a.pj++;h.gf+=hg;h.gc+=ag;a.gf+=ag;a.gc+=hg;
 if(hg>ag){h.pg++;h.pts+=Number(state.settings.points?.win??3);a.pp++;}else if(hg<ag){a.pg++;a.pts+=Number(state.settings.points?.win??3);h.pp++;}else{h.pe++;a.pe++;h.pts+=Number(state.settings.points?.draw??1);a.pts+=Number(state.settings.points?.draw??1);}}
 rows.forEach(r=>r.dg=r.gf-r.gc);return rows.sort((a,b)=>b.pts-a.pts||b.dg-a.dg||b.gf-a.gf||a.name.localeCompare(b.name));
}
function render(){ $("#brandName").textContent=state.settings.name||"TORNEO";$("#brandSeason").textContent=`TEMPORADA ${state.settings.season||"2026"}`;renderDateFilter();renderNext();renderMatches();renderTables();renderStats(); }
function renderDateFilter(){const box=$("#dateFilter");if(!box)return;const dates=[...new Set(allMatches().filter(m=>m.phase==="grupos").map(m=>m.dateId))].sort((a,b)=>Number(a.replace("fecha_",""))-Number(b.replace("fecha_","")));box.innerHTML=`<button class="date-filter ${selectedDate==="all"?"active":""}" data-date="all">TODAS</button>`+dates.map(d=>{const n=String(d).replace("fecha_","");return `<button class="date-filter ${selectedDate===d?"active":""}" data-date="${d}">FECHA ${n}</button>`}).join("");box.querySelectorAll(".date-filter").forEach(b=>b.onclick=()=>{selectedDate=b.dataset.date;renderDateFilter();renderNext();renderMatches();});}
function renderNext(){
 const m=allMatches().filter(x=>selectedDate==="all"||x.dateId===selectedDate).find(x=>x.status!=="finalizado")||allMatches().find(x=>x.status!=="finalizado");
 $("#nextDate").textContent=m?(formatMatchDate(m.dateValue,m.dateId,m.dateLabel)):"SIN PARTIDOS PENDIENTES";
 const enJuego=m?.status==="en_juego";
 const tieneMarcador=enJuego||m?.status==="finalizado";
 $("#nextMatch").innerHTML=m?`<div class="match-time">${esc(m.time||"Por definir")}</div><div class="featured-teams"><div><strong>${esc(team(m.local))}</strong><small>LOCAL</small></div><b class="featured-score">${tieneMarcador?`${Number(m.homeScore||0)} <i>—</i> ${Number(m.awayScore||0)}`:"VS"}</b><div><strong>${esc(team(m.visitor))}</strong><small>VISITANTE</small></div></div><div class="match-status">${enJuego?"🔴 EN JUEGO · ":""}${esc(m.group==="A"?"GRUPO A":"GRUPO B")}</div>`:`<div class="empty">Todos los partidos registrados.</div>`;
}
function renderMatches(){
 const list=allMatches().filter(x=>selectedDate==="all"||x.dateId===selectedDate);
 $("#matchesGrid").innerHTML=list.length?list.map(m=>{
   const enJuego=m.status==="en_juego", finalizado=m.status==="finalizado";
   return `<article class="match-card ${finalizado?"played":""} ${enJuego?"live":""}"><div class="match-meta"><span>FECHA ${String(m.dateId||"").replace("fecha_","")}</span><span>📅 ${esc(formatMatchDate(m.dateValue,m.dateId,m.dateLabel))}</span><span>🕐 ${esc(m.time||"Hora por definir")}</span><span class="mini-group">${esc(m.group||"")}</span></div><div class="match-teams"><div><div class="team-visual"><span class="team-logo">${teamLogo(m.local)?`<img src="${esc(teamLogo(m.local))}" alt="">`:"⚽"}</span><span class="team-name">${esc(team(m.local))}</span></div><small>LOCAL</small></div><div class="score">${(enJuego||finalizado)?`${Number(m.homeScore||0)} <i>—</i> ${Number(m.awayScore||0)}`:"VS"}</div><div class="align-right"><div class="team-visual reverse"><span class="team-name">${esc(team(m.visitor))}</span><span class="team-logo">${teamLogo(m.visitor)?`<img src="${esc(teamLogo(m.visitor))}" alt="">`:"⚽"}</span></div><small>VISITANTE</small></div></div><div class="match-footer">${finalizado?'<span class="finished">● FINALIZADO</span>':enJuego?'<span class="live-status">● EN JUEGO</span>':'<span>○ PROGRAMADO</span>'}<span>${m.phase==="grupos"?"FASE DE GRUPOS":esc(m.phase||"")}</span></div></article>`;
 }).join(""): `<div class="empty-card">No hay partidos en esta fecha.</div>`;
}
function renderTables(){for(const g of ["A","B"]){const rows=standings(g);$("#table"+g).innerHTML=rows.length?rows.map((r,i)=>`<tr><td><span class="pos ${i<2?"qualified":""}">${i+1}</span></td><td><div class="table-team"><span class="team-logo tiny">${teamLogo(r.id)?`<img src="${esc(teamLogo(r.id))}" alt="">`:"⚽"}</span><b>${esc(r.name)}</b></div></td><td>${r.pj}</td><td>${r.pg}</td><td>${r.pe}</td><td>${r.pp}</td><td class="${r.dg>=0?"positive":"negative"}">${r.dg>0?"+":""}${r.dg}</td><td><strong>${r.pts}</strong></td></tr>`).join(""):`<tr><td colspan="8">Sin equipos</td></tr>`;}}
function normalizePlayerName(value){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\p{L}\p{N}]+/gu," ").trim().replace(/\s+/g," ").toLocaleLowerCase("es-EC");}
function eventStats(){const players={};let goals=0,yellow=0,red=0;for(const [matchId,evs] of Object.entries(state.events)){const m=state.matches[matchId]||{};for(const e of Object.values(evs||{})){const type=String(e.type||"").trim().toLocaleLowerCase("es-EC");if(type==="gol")goals++;if(type==="amarilla")yellow++;if(type==="roja")red++;const rawPlayer=e.player??e.playerName??e.jugador??"";if(!rawPlayer)continue;const display=String(rawPlayer).trim().replace(/\s+/g," ");const teamId=e.team||"";const teamName=state.teams[teamId]?.name||((teamId===m.local)?state.teams[m.local]?.name:teamId===m.visitor?state.teams[m.visitor]?.name:"")||teamId||"Equipo no indicado";const key=normalizePlayerName(display)+"|"+normalizePlayerName(teamName);if(!players[key])players[key]={name:display,team:teamName,goals:0,yellow:0,red:0};if(type==="gol")players[key].goals++;else if(type==="amarilla")players[key].yellow++;else if(type==="roja")players[key].red++;}}return{players,goals,yellow,red};}
function renderStats(){const s=eventStats(),played=Object.values(state.matches).filter(m=>m.status==="finalizado").length;$("#statGoals").textContent=s.goals;$("#statYellow").textContent=s.yellow;$("#statRed").textContent=s.red;$("#statMatches").textContent=played;const top=Object.values(s.players).filter(p=>p.goals).sort((a,b)=>b.goals-a.goals||a.name.localeCompare(b.name,"es")).slice(0,8);$("#scorersList").innerHTML=top.length?top.map((p,i)=>`<div class="leader-row"><span class="leader-rank">${i+1}</span><div class="leader-person"><b>${esc(p.name)}</b><small>${esc(p.team)}</small></div><strong>${p.goals} ⚽</strong></div>`).join(""):`<div class="empty">Aún no hay goles registrados.</div>`;const disc=Object.values(s.players).filter(p=>p.yellow||p.red).slice(0,8);$("#disciplineList").innerHTML=disc.length?disc.map(p=>`<div class="leader-row"><b>${esc(p.name)}</b><span>🟨 ${p.yellow} &nbsp; 🟥 ${p.red}</span></div>`).join(""):`<div class="empty">Aún no hay tarjetas registradas.</div>`;}
