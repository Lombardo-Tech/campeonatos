import { auth } from "./auth.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

let authenticated = false;
onAuthStateChanged(auth, user => {
  if (!user) {
    location.replace("login.html");
    return;
  }
  authenticated = true;
});

document.addEventListener("click", async e => {
  if (e.target.id === "logoutBtn") {
    await signOut(auth);
    location.replace("login.html");
  }
});
import { db } from "./firebase.js";
import { ref,onValue,set,remove } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";
import { teamsSeed,firstDateMatches,tournamentSeed } from "./seed.js";

const $=s=>document.querySelector(s),esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const state={teams:{},matches:{},events:{},config:{}};
onValue(ref(db),snap=>{const d=snap.val()||{};state.teams=d.equipos||{};state.matches=d.partidos||{};state.events=d.eventos||{};state.config=d.configuracion||{};renderAll();});

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{document.querySelectorAll(".tab,.tab-panel").forEach(x=>x.classList.remove("active"));b.classList.add("active");$("#tab-"+b.dataset.tab).classList.add("active");});
document.querySelectorAll("[data-close]").forEach(x=>x.onclick=closeModal);
$("#newTeamBtn").onclick=()=>teamModal();$("#newMatchBtn").onclick=()=>matchModal();$("#seedBtn").onclick=seedFirstDate;$("#generateDatesBtn").onclick=()=>{if(confirm("Se generarán las Fechas 2–7 sin modificar la Fecha 1. ¿Continuar?"))generateRemainingDates().catch(err=>{console.error(err);alert("No se pudo generar el calendario: "+err.message);});};$("#settingsForm").onsubmit=saveSettings;
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function openModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden")}function closeModal(){$("#modal").classList.add("hidden")}
function renderAll(){renderStats();renderTeams();renderMatches();renderCalendarProgress();renderDateManager();fillSettings()}
function renderStats(){
  $("#aTeams").textContent=Object.keys(state.teams).length;
  $("#aMatches").textContent=Object.keys(state.matches).length;
  $("#aPlayed").textContent=Object.values(state.matches).filter(m=>m.status==="finalizado").length;
  let goals=0;
  for(const m of Object.values(state.matches)){
    if(m.status==="finalizado") goals+=Number(m.homeScore||0)+Number(m.awayScore||0);
  }
  $("#aGoals").textContent=goals;
  const list=Object.entries(state.matches).sort((a,b)=>Number(b[1].number||0)-Number(a[1].number||0)).slice(0,10);
  $("#adminMatchFeed").innerHTML=list.length?list.map(([id,m])=>{
    const live=m.status==="en_juego";
    const finished=m.status==="finalizado";
    const score=(live||finished)?(Number(m.homeScore||0)+" — "+Number(m.awayScore||0)):"vs";
    const statusText=live?"● EN JUEGO":finished?"● FINALIZADO":"○ PROGRAMADO";
    const statusClass=live?"is-live":finished?"is-finished":"is-scheduled";
    const feedClass=(live?" feed-live ":"")+(finished?" feed-finished ":"");
    return '<div class="feed-row'+feedClass+'"><span>F'+esc(String(m.dateId||"").replace("fecha_",""))+' · '+esc(m.time||"")+'</span><b>'+esc(state.teams[m.local]?.name||m.local)+' '+score+' '+esc(state.teams[m.visitor]?.name||m.visitor)+'</b><span class="feed-status '+statusClass+'">'+statusText+'</span><button class="btn btn-small btn-ghost" onclick="window.editMatch(\''+id+'\')">'+(finished?"Editar":"Registrar")+'</button></div>';
  }).join(""): '<div class="empty">No hay partidos. Usa “Cargar Fecha 1”.</div>';
}
function renderTeams(){const rows=Object.entries(state.teams).sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}));$("#teamsTable").innerHTML=rows.length?`<table><thead><tr><th>ID</th><th>Equipo</th><th>Grupo</th><th>Estado</th><th></th></tr></thead><tbody>${rows.map(([id,t])=>`<tr><td><code>${esc(id)}</code></td><td><b>${esc(t.name)}</b></td><td><span class="mini-group">${esc(t.group)}</span></td><td>${t.active!==false?'<span class="status-on">ACTIVO</span>':'<span class="status-off">INACTIVO</span>'}</td><td class="actions"><button class="icon-btn" onclick="window.editTeam('${id}')">✎</button><button class="icon-btn danger" onclick="window.deleteTeam('${id}')">×</button></td></tr>`).join("")}</tbody></table>`:`<div class="empty">No hay equipos registrados.</div>`}
function renderMatches(){
  const rows=Object.entries(state.matches).sort((a,b)=>String(a[1].dateId).localeCompare(String(b[1].dateId))||Number(a[1].number||0)-Number(b[1].number||0));
  $("#matchesAdmin").innerHTML=rows.length?rows.map(([id,m])=>{
    const live=m.status==="en_juego";
    const finished=m.status==="finalizado";
    const score=(live||finished)?(Number(m.homeScore||0)+" — "+Number(m.awayScore||0)):"VS";
    const statusText=live?("● EN JUEGO · "+Number(m.homeScore||0)+" — "+Number(m.awayScore||0)):finished?("● FINALIZADO · "+Number(m.homeScore||0)+" — "+Number(m.awayScore||0)):"○ PROGRAMADO";
    const statusClass=live?"is-live":finished?"is-finished":"is-scheduled";
    const wrapperClass=(live?" admin-live":"")+(finished?" admin-finished":"");
    const buttonClass=live?"btn-live":finished?"btn-finished":"btn-primary";
    const buttonText=finished?"Editar":"Registrar resultado";
    return '<div class="admin-match'+wrapperClass+'"><div class="admin-match-main"><div class="match-meta"><span>'+esc(m.dateId||"")+'</span><span>'+esc(m.time||"")+'</span><span class="mini-group">'+esc(m.group||"")+'</span></div><h3>'+esc(state.teams[m.local]?.name||m.local)+' <strong>'+score+'</strong> '+esc(state.teams[m.visitor]?.name||m.visitor)+'</h3><small class="admin-status '+statusClass+'">'+statusText+'</small></div><div class="actions"><button class="btn btn-small '+buttonClass+'" onclick="window.editMatch(\''+id+'\')">'+buttonText+'</button><button class="icon-btn danger" onclick="window.deleteMatch(\''+id+'\')">×</button></div></div>';
  }).join(""): '<div class="empty">No hay partidos.</div>';
}
function teamOptions(selected=""){return Object.entries(state.teams).sort((a,b)=>a[1].name.localeCompare(b[1].name)).map(([id,t])=>`<option value="${esc(id)}" ${id===selected?"selected":""}>${esc(t.name)} · Grupo ${esc(t.group)}</option>`).join("")}
async function nextTeamId(){const nums=Object.keys(state.teams).map(x=>Number(x.replace(/\D/g,""))).filter(Boolean);return "EQ"+String(Math.max(0,...nums)+1).padStart(2,"0")}
function teamModal(id=""){
  const t=state.teams[id]||{name:"",group:"A",active:true,logoUrl:""};
  openModal(`<div class="modal-kicker">${id?"EDITAR EQUIPO":"NUEVO EQUIPO"}</div><h2>${id?"Editar":"Registrar"} equipo</h2>
  <form id="teamForm" class="form-grid">
    <label>Nombre del equipo<input id="tmName" value="${esc(t.name)}" required maxlength="80"></label>
    <label>Grupo<select id="tmGroup"><option ${t.group==="A"?"selected":""}>A</option><option ${t.group==="B"?"selected":""}>B</option></select></label>
    <div class="logo-upload">
      <div class="logo-preview">${t.logoUrl?`<img id="tmLogoPreview" src="${esc(t.logoUrl)}" alt="Escudo">`:'<span id="tmLogoPreview" class="logo-placeholder">⚽</span>'}</div>
      <div class="logo-upload-copy">
        <b>Escudo del equipo</b>
        <small>Sin Firebase Storage · pega la URL pública de la imagen.</small>
        <input id="tmLogoUrl" type="url" value="${esc(t.logoUrl||"")}" placeholder="https://ejemplo.com/escudo.png">
      </div>
      ${t.logoUrl?'<button type="button" id="removeLogoBtn" class="btn btn-small btn-ghost">Quitar escudo</button>':""}
    </div>
    <label class="check-label"><input id="tmActive" type="checkbox" ${t.active!==false?"checked":""}> Equipo activo</label>
    <div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Guardar equipo</button></div>
  </form>`);
  $("#tmLogoUrl").oninput=e=>{
    const url=e.target.value.trim();
    $(".logo-preview").innerHTML=url?`<img id="tmLogoPreview" src="${esc(url)}" alt="Vista previa" onerror="this.style.opacity='.25'">`:'<span id="tmLogoPreview" class="logo-placeholder">⚽</span>';
  };
  if($("#removeLogoBtn")) $("#removeLogoBtn").onclick=()=>{$("#tmLogoUrl").value="";$(".logo-preview").innerHTML='<span id="tmLogoPreview" class="logo-placeholder">⚽</span>';$("#removeLogoBtn").remove();};
  $("#teamForm").onsubmit=async e=>{
    e.preventDefault();
    const key=id||await nextTeamId();
    const logoUrl=$("#tmLogoUrl").value.trim();
    if(logoUrl && !/^https?:\/\//i.test(logoUrl)){alert("La URL del escudo debe comenzar con http:// o https://");return;}
    await set(ref(db,`equipos/${key}`),{name:$("#tmName").value.trim(),group:$("#tmGroup").value,active:$("#tmActive").checked,logoUrl});
    closeModal();toast("Equipo guardado.");
  };
}
window.editTeam=id=>teamModal(id);
window.deleteTeam=async id=>{
  if(confirm(`¿Eliminar ${state.teams[id]?.name||id}?`)){
    await remove(ref(db,`equipos/${id}`));
    toast("Equipo eliminado.")
  }
};

function matchModal(id=""){const m=state.matches[id]||{dateId:"fecha_1",number:Object.keys(state.matches).length+1,time:"",local:"",visitor:"",group:"A",phase:"grupos",status:"programado",homeScore:0,awayScore:0};const events=Object.values(state.events[id]||{});
openModal(`<div class="modal-kicker">${id?"GESTIONAR PARTIDO":"NUEVO PARTIDO"}</div><h2>${id?"Registrar resultado":"Crear partido"}</h2><form id="matchForm" class="form-grid"><div class="two-col"><label>Fecha<input id="mDate" value="${esc(m.dateId)}" required></label><label>N.º partido<input id="mNum" type="number" min="1" value="${m.number||1}" required></label></div><div class="two-col"><label>Hora<input id="mTime" type="time" value="${esc(toTimeInput(m.time||""))}"></label><label>Grupo<select id="mGroup"><option ${m.group==="A"?"selected":""}>A</option><option ${m.group==="B"?"selected":""}>B</option><option value="N/A" ${m.group==="N/A"?"selected":""}>N/A</option></select></label></div><label>Local<select id="mLocal" required><option value="">Seleccionar...</option>${teamOptions(m.local)}</select></label><label>Visitante<select id="mVisitor" required><option value="">Seleccionar...</option>${teamOptions(m.visitor)}</select></label><div class="score-inputs"><label>Goles local<input id="mHomeScore" type="number" min="0" value="${Number(m.homeScore||0)}"></label><span>—</span><label>Goles visitante<input id="mAwayScore" type="number" min="0" value="${Number(m.awayScore||0)}"></label></div><label>Estado<select id="mStatus"><option value="programado" ${m.status==="programado"?"selected":""}>Programado</option><option value="en_juego" ${m.status==="en_juego"?"selected":""}>En juego</option><option value="finalizado" ${m.status==="finalizado"?"selected":""}>Finalizado</option></select></label><div class="event-editor"><div class="event-head"><b>Eventos del partido</b><button type="button" id="addEvent" class="btn btn-small btn-ghost">+ Agregar evento</button></div><div id="eventsBox">${eventRows(events)}</div></div><div class="form-actions"><button type="button" class="btn btn-ghost" data-close>Cancelar</button><button class="btn btn-primary">Guardar partido</button></div></form>`);
$("#addEvent").onclick=()=>$("#eventsBox").insertAdjacentHTML("beforeend",eventRows([]));
$("#matchForm").onsubmit=async e=>{e.preventDefault();const data={dateId:$("#mDate").value.trim(),number:Number($("#mNum").value),time:formatStoredTime($("#mTime").value.trim()),local:$("#mLocal").value,visitor:$("#mVisitor").value,group:$("#mGroup").value,phase:m.phase||"grupos",status:$("#mStatus").value,homeScore:Number($("#mHomeScore").value||0),awayScore:Number($("#mAwayScore").value||0)};if(data.local===data.visitor){alert("El local y visitante deben ser diferentes.");return}const key=id||("P"+String(Date.now()).slice(-8));await set(ref(db,`partidos/${key}`),data);await saveEvents(key);closeModal();toast("Partido guardado.")}}
function eventRows(events){const arr=events.length?events:[{type:"gol",team:"",player:"",minute:""}];return arr.map(e=>`<div class="event-row"><select class="ev-type"><option value="gol" ${e.type==="gol"?"selected":""}>⚽ Gol</option><option value="amarilla" ${e.type==="amarilla"?"selected":""}>🟨 Amarilla</option><option value="roja" ${e.type==="roja"?"selected":""}>🟥 Roja</option></select><select class="ev-team"><option value="">Equipo...</option>${teamOptions(e.team)}</select><input class="ev-player" value="${esc(e.player||"")}" placeholder="Jugador"><input class="ev-minute" value="${esc(e.minute||"")}" placeholder="Min."><button type="button" class="remove-event" onclick="this.parentElement.remove()">×</button></div>`).join("")}
async function saveEvents(matchId){const rows=[...document.querySelectorAll("#eventsBox .event-row")],out={};let n=0;for(const r of rows){const player=r.querySelector(".ev-player").value.trim(),team=r.querySelector(".ev-team").value,type=r.querySelector(".ev-type").value,minute=r.querySelector(".ev-minute").value.trim();if(!team&&!player)continue;out["E"+(++n)]={type,team,player,minute}}if(Object.keys(out).length)await set(ref(db,`eventos/${matchId}`),out);else await remove(ref(db,`eventos/${matchId}`))}
window.editMatch=id=>matchModal(id);window.deleteMatch=async id=>{if(confirm("¿Eliminar este partido y sus eventos?")){await remove(ref(db,`partidos/${id}`));await remove(ref(db,`eventos/${id}`));toast("Partido eliminado.")}};

function dateLabel(iso){
  if(!iso) return "Fecha por definir";
  const d=new Date(`${iso}T12:00:00`);
  if(Number.isNaN(d.getTime())) return "Fecha por definir";
  return d.toLocaleDateString("es-EC",{weekday:"long",day:"2-digit",month:"long",year:"numeric"}).toLocaleUpperCase("es-EC");
}
function storedDateForJornada(id,rows){
  const explicit=rows.find(m=>m.dateValue)?.dateValue;
  if(explicit) return explicit;
  if(id==="fecha_1") return "2026-09-06";
  return "";
}
function toTimeInput(value){const v=String(value||"").trim(); if(!v||v.toLowerCase()==="por definir") return ""; const m=v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i); if(!m)return ""; let h=Number(m[1]),min=m[2],ap=(m[3]||"").toUpperCase(); if(ap){if(ap==="AM"&&h===12)h=0;if(ap==="PM"&&h<12)h+=12;} return `${String(h).padStart(2,"0")}:${min}`;}
function formatStoredTime(value){const v=String(value||"").trim(); if(!v)return "Por definir"; const m=v.match(/^(\d{1,2}):(\d{2})$/); if(!m)return v; let h=Number(m[1]),min=m[2],ap=h>=12?"PM":"AM"; h=h%12||12; return `${h}:${min} ${ap}`;}

function ordenarPartidosJornada(partidosJornada){
  const arr = Object.entries(partidosJornada || {}).map(([id,p]) => ({id, ...(p||{})}));

  // When a time exists, sort chronologically. Untimed matches stay after timed ones.
  const tieneHora = p => {
    const t = String(p.time || p.hora || '').trim();
    if (!t || /por definir/i.test(t)) return false;
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!m) return false;
    let h = Number(m[1]), min = Number(m[2]);
    const ap = (m[3] || '').toUpperCase();
    if (ap === 'AM' && h === 12) h = 0;
    if (ap === 'PM' && h !== 12) h += 12;
    return h * 60 + min;
  };

  arr.sort((a,b) => {
    const ta = tieneHora(a), tb = tieneHora(b);
    if (ta && tb) return tieneHora(a) - tieneHora(b);
    if (ta !== tb) return ta ? -1 : 1;
    // Preserve Firebase/object insertion order for matches without a time.
    return 0;
  });

  return arr.map((item, index) => ({
    ...item,
    numeroJornada: index + 1
  }));
}

function buildDateManagerRow(n){
  const id=`fecha_${n}`;
  const rows=Object.entries(state.matches).filter(([_,m])=>m.phase==="grupos"&&m.dateId===id);
  const value=storedDateForJornada(id,rows.map(([_,m])=>m));
  const times=rows.filter(([_,m])=>m.time&&m.time!=="Por definir").length;
  const orderedGames=ordenarPartidosJornada(Object.fromEntries(rows));
  const games=orderedGames.map(item=>{
    const mid=item.id, m=item;
    return `<div class="date-game-row"><div><b>${esc(state.teams[m.local]?.name||m.local)} <span>vs</span> ${esc(state.teams[m.visitor]?.name||m.visitor)}</b><small>Partido ${item.numeroJornada}</small></div><label>Hora<input type="time" class="match-time-input" data-match-time="${mid}" value="${toTimeInput(m.time||"")}"></label><button type="button" class="btn btn-small btn-ghost save-time-btn" data-match="${mid}">Guardar</button></div>`;
  }).join("");
  const openAttr = n===1 ? " open" : "";
  return `<details class="date-manager-row" data-date-row="${id}"${openAttr}>
    <summary class="date-manager-title">
      <div class="date-summary-main"><span class="accordion-chevron" aria-hidden="true"></span><div><b>FECHA ${n}</b><span>${dateLabel(value)}</span></div></div>
      <span class="date-count">${rows.length} partidos</span>
    </summary>
    <div class="date-manager-content">
      <div class="date-manager-controls"><label>Día de juego<input type="date" class="date-input" data-date="${id}" value="${value}"></label><span class="schedule-note">${times}/${rows.length} horarios asignados</span><button type="button" class="btn btn-small btn-primary save-date-btn" data-date="${id}">Guardar fecha</button></div>
      <div class="date-games"><div class="date-games-head"><b>HORARIOS DE PARTIDOS</b><span>Asigna la hora de cada encuentro</span></div>${games}</div>
    </div>
  </details>`;
}

function bindDateManagerRow(row){
  if(!row)return;
  row.querySelectorAll(".save-date-btn").forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.date;
    const input=row.querySelector(`.date-input[data-date="${id}"]`);
    const value=input.value||(id==="fecha_1"?"2026-09-06":null);
    const rows=Object.entries(state.matches).filter(([_,m])=>m.phase==="grupos"&&m.dateId===id);
    const finished=rows.some(([_,m])=>m.status==="finalizado");
    if(finished){alert("Esta jornada tiene partidos finalizados. Su fecha queda protegida.");return;}
    for(const [mid,m] of rows){
      state.matches[mid]={...m,dateValue:value};
      await set(ref(db,`partidos/${mid}`),{...state.matches[mid]});
    }
    toast(value?`Jornada programada: ${dateLabel(value)}.`:"Jornada guardada como fecha por definir.");
    const currentOpen=row.open;
    row.outerHTML=buildDateManagerRow(Number(id.replace("fecha_","")));
    const newRow=document.querySelector(`[data-date-row="${id}"]`);
    if(newRow) newRow.open=currentOpen;
    bindDateManagerRow(newRow);
  });

  row.querySelectorAll(".save-time-btn").forEach(btn=>btn.onclick=async()=>{
    const mid=btn.dataset.match;
    const input=row.querySelector(`.match-time-input[data-match-time="${mid}"]`);
    const value=formatStoredTime(input.value);
    const m=state.matches[mid];
    if(!m)return;

    // Actualiza solo este partido en Firebase y en el estado local.
    state.matches[mid]={...m,time:value};
    await set(ref(db,`partidos/${mid}`),{...state.matches[mid]});
    toast(value==="Por definir"?"Hora guardada como por definir.":`Hora guardada: ${value}.`);

    // IMPORTANTE: no se vuelve a renderizar toda la pantalla ni todas las jornadas.
    // Solo se reconstruye la jornada que contiene el partido editado.
    const jornadaId=String(state.matches[mid].dateId||"");
    const jornadaNum=Number(jornadaId.replace("fecha_",""));
    const currentOpen=row.open;
    row.outerHTML=buildDateManagerRow(jornadaNum);
    const newRow=document.querySelector(`[data-date-row="${jornadaId}"]`);
    if(newRow) newRow.open=currentOpen;
    bindDateManagerRow(newRow);
  });
}

function renderDateManager(){
  const box=$("#dateManagerList"); if(!box)return;
  const entries=Object.entries(state.matches).filter(([_,m])=>m.phase==="grupos"&&m.dateId);
  const nums=[...new Set(entries.map(([_,m])=>Number(String(m.dateId).replace("fecha_",""))))].filter(Boolean).sort((a,b)=>a-b);
  if(!nums.length){box.innerHTML='<div class="empty-card">No hay jornadas generadas.</div>';return;}

  // Render inicial completo. Después, cada guardado de hora/fecha solo reemplaza su jornada.
  box.innerHTML=nums.map(n=>buildDateManagerRow(n)).join("");
  box.querySelectorAll(".date-manager-row").forEach(bindDateManagerRow);
}

function renderCalendarProgress(){
  const box=$("#calendarProgress"); if(!box)return;
  box.innerHTML=Array.from({length:7},(_,i)=>{
    const n=i+1, id=`fecha_${n}`;
    const ms=Object.values(state.matches).filter(m=>m.phase==="grupos"&&String(m.dateId)===id);
    const played=ms.filter(m=>m.status==="finalizado").length;
    return `<div class="calendar-date ${ms.length?"loaded":""}"><span>FECHA ${n}</span><b>${ms.length}/8</b><small>${played?`${played} finalizados`:ms.length?"Programada":"Pendiente"}</small></div>`;
  }).join("");
}

function buildRoundsFromFirstPairs(firstPairs){
  if(firstPairs.length!==4) throw new Error("La Fecha 1 debe tener 4 partidos por grupo.");
  const ids=firstPairs.flat();
  if(new Set(ids).size!==8) throw new Error("La Fecha 1 contiene equipos repetidos dentro del grupo.");
  // Circle method: the first round is fixed to the exact 4 pairs already played.
  let a=[ids[0],ids[2],ids[4],ids[6],ids[7],ids[5],ids[3],ids[1]];
  const rounds=[];
  for(let r=0;r<7;r++){
    rounds.push([0,1,2,3].map(i=>[a[i],a[7-i]]));
    a=[a[0],a[7],a[1],a[2],a[3],a[4],a[5],a[6]];
  }
  return rounds;
}

function roundRobinDynamic(teamIds){
  let arr=teamIds.slice();
  if(arr.length%2===1) arr.push(null);
  const n=arr.length, rounds=n-1, result=[];
  for(let r=0;r<rounds;r++){
    const pairs=[];
    for(let i=0;i<n/2;i++){
      const a=arr[i],b=arr[n-1-i];
      if(a!==null&&b!==null)pairs.push([a,b]);
    }
    result.push(pairs);
    arr=[arr[0],arr[n-1],...arr.slice(1,n-1)];
  }
  return result;
}
function pairKey(a,b){return [a,b].sort().join("|");}
function scheduleRespectingFirst(teamIds,firstMatches){
  const fixed=firstMatches.map(m=>[m.local,m.visitor]);
  if(fixed.length===0)return roundRobinDynamic(teamIds);
  const fixedSet=new Set(fixed.map(p=>pairKey(...p)));
  if(teamIds.length%2===0){
    const circle=[...fixed.map(p=>p[0]),...fixed.map(p=>p[1]).reverse()];
    let arr=circle.slice(), rounds=[], n=arr.length;
    for(let r=0;r<n-1;r++){
      const pairs=[]; for(let i=0;i<n/2;i++)pairs.push([arr[i],arr[n-1-i]]);
      rounds.push(pairs); arr=[arr[0],arr[n-1],...arr.slice(1,n-1)];
    }
    if(rounds[0].every(p=>fixedSet.has(pairKey(...p)))) return rounds;
  }
  // If the existing first date is valid, find a circle arrangement by backtracking.
  // This supports odd groups too by including a bye.
  const base=roundRobinDynamic(teamIds);
  if(base[0] && base[0].length===fixed.length && base[0].every(p=>fixedSet.has(pairKey(...p)))) return base;
  // For odd groups, use a simple exhaustive permutation only for the small
  // tournament sizes expected here (<=10). Stop at the first valid arrangement.
  const target=fixedSet, ids=teamIds.slice();
  const search=(prefix,rest)=>{
    if(prefix.length===ids.length){
      const rounds=roundRobinDynamic(prefix);
      return rounds[0].length===fixed.length && rounds[0].every(p=>target.has(pairKey(...p)))?rounds:null;
    }
    for(let i=0;i<rest.length;i++){
      const x=rest[i],res=search(prefix.concat(x),rest.slice(0,i).concat(rest.slice(i+1)));
      if(res)return res;
    }
    return null;
  };
  const found=search([],ids);
  return found||base;
}
async function generateRemainingDates(){
  const active=Object.entries(state.teams).filter(([_,t])=>t.active!==false);
  const groups={A:active.filter(([_,t])=>t.group==="A").map(([id])=>id),B:active.filter(([_,t])=>t.group==="B").map(([id])=>id)};
  if(groups.A.length<2||groups.B.length<2){alert("Cada grupo debe tener al menos 2 equipos activos.");return;}
  const all=Object.values(state.matches), first=all.filter(m=>m.phase==="grupos"&&m.dateId==="fecha_1");
  if(!first.length){alert("Primero debes cargar la Fecha 1.");return;}
  if(all.some(m=>m.phase==="grupos"&&m.status==="finalizado")){alert("Ya hay partidos finalizados. El calendario queda protegido para no alterar resultados.");return;}
  const output={...state.matches};
  let number=Math.max(0,...Object.values(output).map(m=>Number(m.number||0)).filter(Boolean))+1;
  for(const g of ["A","B"]){
    const firstG=first.filter(m=>m.group===g);
    const schedule=scheduleRespectingFirst(groups[g],firstG);
    for(let r=1;r<schedule.length;r++){
      const dateNo=r+1,id=`fecha_${dateNo}`, existing=Object.values(output).filter(m=>m.phase==="grupos"&&m.group===g&&m.dateId===id);
      if(existing.length===schedule[r].length)continue;
      if(existing.length){alert(`La Fecha ${dateNo} del Grupo ${g} está incompleta. Corrígela antes de generar.`);return;}
      schedule[r].forEach(([local,visitor],idx)=>{
        const key=`F${dateNo}${g}${idx+1}`;
        output[key]={dateId:id,dateLabel:`FECHA ${dateNo}`,number:number++,time:"Por definir",dateValue:null,local,visitor,group:g,phase:"grupos",status:"programado",homeScore:0,awayScore:0,generated:true,localNom:state.teams[local]?.name||local,visitanteNom:state.teams[visitor]?.name||visitor};
      });
    }
  }
  await set(ref(db,"partidos"),output);
  toast("Calendario generado correctamente.");
}

async function seedFirstDate(){if(Object.keys(state.teams).length&&!confirm("Esto cargará/reemplazará los equipos iniciales y la Fecha 1. ¿Continuar?"))return;await set(ref(db,"configuracion"),tournamentSeed);await set(ref(db,"equipos"),teamsSeed);const matches={};Object.entries(firstDateMatches).forEach(([id,m])=>matches[id]={...m,dateLabel:"DOMINGO 6 DE SEPTIEMBRE DE 2026"});await set(ref(db,"partidos"),matches);await remove(ref(db,"eventos"));toast("Fecha 1 cargada correctamente.")}
function fillSettings(){$("#setName").value=state.config.name||"TORNEO DE FÚTBOL";$("#setSeason").value=state.config.season||"2026";$("#setWin").value=state.config.points?.win??3;$("#setDraw").value=state.config.points?.draw??1;$("#setLoss").value=state.config.points?.loss??0}
async function saveSettings(e){e.preventDefault();await set(ref(db,"configuracion"),{name:$("#setName").value.trim(),season:$("#setSeason").value.trim(),points:{win:Number($("#setWin").value),draw:Number($("#setDraw").value),loss:Number($("#setLoss").value)}});toast("Configuración guardada.")}
