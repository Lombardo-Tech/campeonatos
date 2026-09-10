import { db, auth } from './firebase.js';
import { guardAdmin, signOut } from './auth.js';
import { ref, get, set, update, remove, onValue } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js';
import { esc, slug, now, timeLabel, imageFileToDataUrl } from './common.js';

const S={user:null,global:false,accessLoaded:false,globalListenersStarted:false,allowedTids:new Set(),tournaments:{},tid:'',isNew:false,paymentsOpen:false,teams:{},matches:{},events:{},admins:{},stageUnsub:[],moduleUnsub:[],dateFilter:'all',paymentRequests:{},paymentPublic:{},paymentPayphone:{}};
const $=s=>document.querySelector(s);
const key=(prefix='id')=>`${slug(prefix)||'id'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const stages=()=>Array.isArray(S.tournaments[S.tid]?.format?.stages)?S.tournaments[S.tid].format.stages:[];
const currentTournament=()=>S.tournaments[S.tid]||{};
const isAllowed=()=>S.global||!!S.admins[S.user?.uid]||currentTournament()?.ownerUid===S.user?.uid;

function initSelect2(scope=document){
  if(!window.jQuery || !jQuery.fn.select2)return;
  const $scope=jQuery(scope);
  $scope.find('select').addBack('select').filter(':not([aria-hidden="true"])').each(function(){
    const $el=jQuery(this);
    const nativeValue=this.value;
    if($el.hasClass('select2-hidden-accessible'))$el.select2('destroy');
    if(nativeValue!==undefined)$el.val(nativeValue);
    $el.select2({
      width:'100%',
      minimumResultsForSearch:0,
      dropdownAutoWidth:false,
      language:{noResults:()=> 'Sin resultados',searching:()=> 'Buscando...'}
    });
    // Select2 mantiene una representación propia del valor seleccionado.
    // Sincronizamos explícitamente para evitar que muestre el valor anterior.
    $el.val(this.value).trigger('change.select2');
  });
}

function setSelectValue(selector,value){
  const el=typeof selector==='string'?$(selector):selector;
  if(!el)return;
  el.value=value==null?'':String(value);
  if(window.jQuery && jQuery.fn.select2){
    const $el=jQuery(el);
    if($el.hasClass('select2-hidden-accessible'))$el.val(el.value).trigger('change.select2');
  }
}

function init(){
  $('#adminLogout').addEventListener('click',()=>signOut(auth));
  $('#newTournament').addEventListener('click',newTournament);
  $('#globalPayments')?.addEventListener('click',toggleGlobalPayments);
  $('#addStage').addEventListener('click',()=>addStageRow());
  $('#tournamentForm').addEventListener('submit',saveTournament);
  $('#teamForm').addEventListener('submit',saveTeam);
  $('#tLogoFile').addEventListener('change',()=>previewFile('#tLogoFile','#tLogoPreview'));
  $('#teamLogoFile').addEventListener('change',()=>previewFile('#teamLogoFile','#teamLogoPreview'));
  $('#removeTournamentLogo').addEventListener('click',()=>{ $('#tLogo').value=''; $('#tLogoStored').value=''; $('#tLogoFile').value=''; setLogoPreview('#tLogoPreview',''); });
  $('#removeTeamLogo').addEventListener('click',()=>{ $('#teamLogo').value=''; $('#teamLogoStored').value=''; $('#teamLogoFile').value=''; setLogoPreview('#teamLogoPreview',''); });
  $('#matchForm').addEventListener('submit',saveMatch);
  $('#clearMatch').addEventListener('click',clearMatch);
  $('#generateStage').addEventListener('click',generateNextStage);
  $('#generateNextDate')?.addEventListener('click',generateNextRoundRobinDate);
  $('#generateAllDates')?.addEventListener('click',generateAllRoundRobinDates);
  $('#resetDateBtn').addEventListener('click',resetSelectedDate);
  initResetDatePicker();
  $('#deleteTournament').addEventListener('click',deleteTournament);
  $('#adminListForm').addEventListener('submit',assignAdmin);
  $('#closeResult').addEventListener('click',closeResult);
  $('#resultModal').addEventListener('click',e=>{if(e.target.id==='resultModal')closeResult();});
  $('#resultForm').addEventListener('submit',saveResult);
  $('#resultStatus').addEventListener('change',toggleLiveStartField);
  $('#livePeriod')?.addEventListener('change',toggleLiveStartField);
  $('#finishFirstHalf')?.addEventListener('click',finishFirstHalf);
  $('#startSecondHalf')?.addEventListener('click',startSecondHalf);
  $('#finishMatch')?.addEventListener('click',finishLiveMatch);
  $('#addEvent').addEventListener('click',addEventRow);
  $('#paymentConfigForm')?.addEventListener('submit',savePaymentConfig);
  document.querySelectorAll('[data-payment-tab]').forEach(btn=>btn.addEventListener('click',()=>switchPaymentTab(btn.dataset.paymentTab)));
  // Los listeners globales de pagos se inicializan después de verificar S.global.
  // Esto evita que init() intente decidir permisos antes de que Firebase Auth haya resuelto al usuario.
}

initModules();

function boot(user){S.user=user;onValue(ref(db,'tournaments'),snap=>{S.tournaments=snap.val()||{};renderTournamentList();if(!S.tid)selectFirst();else if(S.tournaments[S.tid])renderTournamentDetails();});loadAccess();}
async function loadAccess(){
  const uid=S.user.uid;
  const a=await get(ref(db,`globalAdmins/${uid}`));
  S.global=a.val()===true;
  S.allowedTids=new Set();

  if(S.global && !S.globalListenersStarted){
    S.globalListenersStarted=true;
    onValue(ref(db,'paymentRequests'),snap=>{S.paymentRequests=snap.val()||{};renderPaymentRequests();});
    onValue(ref(db,'paymentConfig/public'),snap=>{S.paymentPublic=snap.val()||{};renderPaymentConfig();});
    onValue(ref(db,'paymentConfig/payphone'),snap=>{S.paymentPayphone=snap.val()||{};renderPaymentConfig();});
  }

  // El Global Admin puede leer todas las asignaciones.
  // Un usuario normal solo consulta su propia entrada por torneo.
  if(S.global){
    const all=(await get(ref(db,'tournamentAdmins'))).val()||{};
    Object.keys(all).forEach(tid=>S.allowedTids.add(tid));
  }else{
    const ts=await get(ref(db,'tournaments'));
    S.tournaments=ts.val()||S.tournaments||{};
    const tids=Object.keys(S.tournaments);
    const checks=await Promise.all(tids.map(tid=>get(ref(db,`tournamentAdmins/${tid}/${uid}`)).catch(()=>null)));
    checks.forEach((snap,i)=>{if(snap?.exists())S.allowedTids.add(tids[i]);});
  }
  S.tournaments=S.tournaments||{};Object.entries(S.tournaments).forEach(([tid,t])=>{if(t?.ownerUid===uid)S.allowedTids.add(tid);});S.accessLoaded=true;
  document.querySelectorAll('.global-only-section').forEach(el=>{if(el.id!=='pagos')el.style.display=S.global?'':'none';});
  if($('#globalPayments'))$('#globalPayments').style.display=S.global?'flex':'none';
  if($('#pagos'))$('#pagos').style.display='none';
  renderTournamentList();
  if(S.global){renderPaymentConfig();renderPaymentRequests();}
  if(!S.tid||!canViewTournament(S.tid))selectFirst();else selectTournament(S.tid);}
function canViewTournament(tid){return S.global||S.allowedTids.has(tid)||S.tournaments[tid]?.ownerUid===S.user?.uid;}
function visibleTournamentEntries(){return Object.entries(S.tournaments).filter(([id])=>canViewTournament(id));}
function selectFirst(){const ids=visibleTournamentEntries().map(([id])=>id);if(ids.length)selectTournament(ids[0]);else newTournament();}
function clearSubs(){S.stageUnsub.forEach(fn=>{try{fn();}catch{}});S.stageUnsub=[];S.moduleUnsub.forEach(fn=>{try{fn();}catch{}});S.moduleUnsub=[];}
function selectTournament(tid){if(!canViewTournament(tid))return msg('Este torneo no está asignado a tu usuario.');clearSubs();S.tid=tid;S.isNew=false;setGlobalPayments(false);const t=currentTournament();if(!t)return;
  if(S.global){onValue(ref(db,`tournamentAdmins/${tid}`),s=>{S.admins=s.val()||{};renderAdmins();});}
  else{get(ref(db,`tournamentAdmins/${tid}/${S.user.uid}`)).then(s=>{if(s.exists())S.admins[S.user.uid]=s.val();}).catch(()=>{});}
  onValue(ref(db,`equipos/${tid}`),s=>{S.teams=s.val()||{};renderTeams();refreshMatchTeams();renderDashboard();renderPlayerTeamOptions();renderActMatches();initSelect2('#tournamentWorkspace');});onValue(ref(db,`partidos/${tid}`),async s=>{S.matches=s.val()||{};const first=stages()[0];if(first){const fixes={};Object.entries(S.matches).forEach(([id,m])=>{if(!m.stageId){fixes[`partidos/${tid}/${id}/stageId`]=first.id;fixes[`partidos/${tid}/${id}/phase`]=first.name;}});if(Object.keys(fixes).length&&isAllowed())await update(ref(db),fixes);}renderMatches();renderDashboard();renderStageOverview();});onValue(ref(db,`eventos/${tid}`),s=>{S.events=s.val()||{};});renderTournamentDetails();renderTournamentList();}

function setLogoPreview(sel,url){const box=$(sel);if(!box)return;box.innerHTML=url?`<img src="${esc(url)}" alt="Vista previa" onerror="this.parentElement.innerHTML='<span>⚽</span>'">`:'<span>⚽</span>';}
function previewFile(inputSel,previewSel){const file=$(inputSel)?.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>setLogoPreview(previewSel,reader.result);reader.readAsDataURL(file);}
function renderTournamentList(){const box=$('#tournamentList');if(!box)return;const entries=visibleTournamentEntries();box.innerHTML=entries.map(([id,t])=>`<button class="side-tournament ${id===S.tid?'active':''}" data-id="${esc(id)}">${t.logoUrl?`<span class="mini-logo"><img src="${esc(t.logoUrl)}" alt=""></span>`:'<span class="mini-logo fallback">⚽</span>'}<div><b>${esc(t.name||id)}</b><small>${esc(t.season||'')}</small></div>${t.paymentStatus==='paid'?'<em class="side-paid-badge">PAGADO</em>':''}</button>`).join('')||'<div class="empty">No hay torneos asignados.</div>';box.querySelectorAll('[data-id]').forEach(b=>b.addEventListener('click',()=>selectTournament(b.dataset.id)));if($('#newTournament'))$('#newTournament').style.display=S.global?'inline-flex':'none';if($('#deleteTournament'))$('#deleteTournament').style.display=S.global?'inline-flex':'none';}
function renderTournamentDetails(){const t=currentTournament();if(!t){$('#selectedName').textContent='Nuevo torneo';return;}$('#selectedName').textContent=`${t.name||'Torneo'} ${t.season||''}`.trim();if(t.paymentStatus==='paid')$('#selectedName').textContent+=' · PAGADO';$('#pageTitle').textContent=t.name||'Administración';$('#tId').value=S.tid;$('#tName').value=t.name||'';$('#tSeason').value=t.season||'';$('#tLocation').value=t.location||'';setSelectValue('#tStatus',t.status||'active');$('#tLogo').value=t.logoUrl&&/^https?:\/\//i.test(t.logoUrl)?t.logoUrl:'';$('#tLogoStored').value=t.logoUrl||'';setLogoPreview('#tLogoPreview',t.logoUrl||'');$('#tLogoFile').value='';$('#tDescription').value=t.description||'';const f=t.format||{};$('#fGroups').value=f.groups||1;$('#fHalfMinutes').value=f.halfMinutes??25;$('#fTeams').value=f.teamsPerGroup||8;$('#fWin').value=f.points?.win??3;$('#fDraw').value=f.points?.draw??1;renderStageBuilder(f.stages||[]);renderStageSelect();renderStageOverview();loadModules();renderPlayerTeamOptions();initSelect2('#tournamentWorkspace');}
function defaultStages(){return [
{id:'grupos',name:'Fase de grupos',type:'round_robin',matchMode:'single',legs:1,qualifiersPerGroup:2},
{id:'r8',name:'Ronda de 8',type:'knockout',matchMode:'home_away',legs:2,qualifiersPerGroup:0},
{id:'r4',name:'Ronda de 4',type:'knockout',matchMode:'single',legs:1,qualifiersPerGroup:0},
{id:'r2',name:'Ronda de 2',type:'knockout',matchMode:'single',legs:1,qualifiersPerGroup:0},
{id:'final',name:'Final',type:'final',matchMode:'single',legs:1,qualifiersPerGroup:0}
];}
function newTournament(){
  clearSubs();
  S.tid='';S.isNew=true;S.teams={};S.matches={};S.events={};S.admins={};S.dateFilter='all';
  setGlobalPayments(false);
  $('#selectedName').textContent='Nuevo torneo';
  $('#pageTitle').textContent='Crear nuevo torneo';
  $('#tournamentForm').reset();
  $('#teamForm').reset();
  $('#matchForm').reset();
  $('#tId').value='';$('#teamId').value='';$('#matchId').value='';
  $('#tLogoStored').value='';$('#tLogoFile').value='';setLogoPreview('#tLogoPreview','');
  $('#teamLogoStored').value='';$('#teamLogoFile').value='';setLogoPreview('#teamLogoPreview','');
  setSelectValue('#tStatus','draft');
  $('#fGroups').value='';$('#fHalfMinutes').value='';$('#fTeams').value='';$('#fWin').value='';$('#fDraw').value='';
  renderStageBuilder([]);renderStageSelect();
  renderTeams();renderMatches();renderDashboard();renderStageOverview();renderAdmins();
  if($('#playerTeam'))$('#playerTeam').innerHTML='<option value="">Selecciona un equipo</option>';
  initSelect2('#tournamentWorkspace');
  if($('#adminDateFilters'))$('#adminDateFilters').innerHTML='';
  if($('#resetDateOptions'))$('#resetDateOptions').innerHTML='';
  if($('#resetDateCurrent'))$('#resetDateCurrent').innerHTML='<b>Selecciona una fecha...</b><small>Elige la jornada que deseas reiniciar</small>';
  $('#tournamentWorkspace').style.display='block';
  $('.hero-actions').style.display=S.global?'flex':'';
  window.scrollTo({top:0,behavior:'smooth'});
}
function stageRowHtml(s,i){return `<div class="stage-row" data-index="${i}"><div class="stage-number">${i+1}</div><div class="stage-fields"><label>Nombre<input class="stage-name" value="${esc(s.name||`Fase ${i+1}`)}"></label><label>Tipo<select class="stage-type"><option value="round_robin" ${s.type==='round_robin'?'selected':''}>Liga / grupos</option><option value="knockout" ${s.type==='knockout'?'selected':''}>Eliminatoria</option><option value="final" ${s.type==='final'?'selected':''}>Final</option></select></label><label>Modalidad<select class="stage-mode"><option value="single" ${s.matchMode==='single'?'selected':''}>Partido único</option><option value="home_away" ${s.matchMode==='home_away'?'selected':''}>Ida y vuelta</option></select></label><label>Partidos por cruce<input class="stage-legs" type="number" min="1" max="2" value="${Number(s.legs||1)}"></label><label>Clasificados por grupo<input class="stage-qualifiers" type="number" min="0" max="50" value="${Number(s.qualifiersPerGroup||0)}" ${s.type==='round_robin'?'':'disabled'}></label></div><button type="button" class="small-btn danger remove-stage">×</button></div>`;}
function renderStageBuilder(list){const box=$('#stageBuilder');box.innerHTML=(list.length?list:defaultStages()).map(stageRowHtml).join('');box.querySelectorAll('.stage-type').forEach(sel=>sel.addEventListener('change',()=>{const row=sel.closest('.stage-row');const q=row.querySelector('.stage-qualifiers');q.disabled=sel.value!=='round_robin';if(sel.value!=='round_robin')q.value=0;}));box.querySelectorAll('.remove-stage').forEach(b=>b.addEventListener('click',()=>{b.closest('.stage-row').remove();renumberStages();}));}
function addStageRow(){const box=$('#stageBuilder');const i=box.querySelectorAll('.stage-row').length;box.insertAdjacentHTML('beforeend',stageRowHtml({name:`Fase ${i+1}`,type:'knockout',matchMode:'single',legs:1,qualifiersPerGroup:0},i));const row=box.lastElementChild;row.querySelector('.remove-stage').addEventListener('click',()=>{row.remove();renumberStages();});row.querySelector('.stage-type').addEventListener('change',()=>{const q=row.querySelector('.stage-qualifiers');q.disabled=row.querySelector('.stage-type').value!=='round_robin';if(q.disabled)q.value=0;});}
function renumberStages(){document.querySelectorAll('.stage-row').forEach((r,i)=>r.querySelector('.stage-number').textContent=i+1);}
function readStages(){return [...document.querySelectorAll('.stage-row')].map((row,i)=>({id:slug(row.querySelector('.stage-name').value)||`fase-${i+1}`,name:row.querySelector('.stage-name').value.trim()||`Fase ${i+1}`,type:row.querySelector('.stage-type').value,matchMode:row.querySelector('.stage-mode').value,legs:Math.max(1,Math.min(2,Number(row.querySelector('.stage-legs').value||1))),qualifiersPerGroup:Math.max(0,Number(row.querySelector('.stage-qualifiers').value||0))}));}
async function saveTournament(e){e.preventDefault();if(!S.global)return msg('Solo un administrador global puede crear o modificar torneos.');const name=$('#tName').value.trim();if(!name)return msg('Escribe el nombre del torneo.');const id=S.tid||slug(name)||key('torneo');const st=readStages();if(!st.length)return msg('Agrega al menos una fase.');let logo=$('#tLogo').value.trim()||$('#tLogoStored').value||'';const file=$('#tLogoFile').files[0];if(file)logo=await imageFileToDataUrl(file);$('#tLogoStored').value=logo;const data={name,season:$('#tSeason').value.trim(),location:$('#tLocation').value.trim(),status:$('#tStatus').value,public:true,logoUrl:logo,description:$('#tDescription').value.trim(),format:{groups:Math.max(1,Number($('#fGroups').value||1)),halfMinutes:Math.max(1,Math.min(60,Number($('#fHalfMinutes').value||25))),teamsPerGroup:Math.max(2,Number($('#fTeams').value||8)),points:{win:Number($('#fWin').value||3),draw:Number($('#fDraw').value||1),loss:0},stages:st},updatedAt:now()};await update(ref(db,`tournaments/${id}`),data);if(!S.tid){await set(ref(db,`tournamentAdmins/${id}/${S.user.uid}`),{role:'owner',email:S.user.email||'',createdAt:now()});S.allowedTids.add(id);}S.tid=id;selectTournament(id);msg('Torneo y formato guardados.');}
async function deleteTournament(){if(!S.global||!S.tid)return;if(!confirm('¿Eliminar este torneo y todos sus datos? Esta acción no se puede deshacer.'))return;const tid=S.tid;await Promise.all([remove(ref(db,`tournaments/${tid}`)),remove(ref(db,`equipos/${tid}`)),remove(ref(db,`partidos/${tid}`)),remove(ref(db,`eventos/${tid}`)),remove(ref(db,`tournamentAdmins/${tid}`))]);S.tid='';location.reload();}

function refreshMatchTeams(){if($('#mLocal'))$('#mLocal').innerHTML=teamOptions($('#mLocal').value);if($('#mVisitor'))$('#mVisitor').innerHTML=teamOptions($('#mVisitor').value);initSelect2('#matchForm');}
function teamOptions(sel){return Object.entries(S.teams).map(([id,t])=>`<option value="${esc(id)}" ${id===sel?'selected':''}>${esc(t.name||id)}${t.group?` · Grupo ${esc(t.group)}`:''}</option>`).join('');}
async function saveTeam(e){e.preventDefault();if(!isAllowed())return msg('No tienes permisos para este torneo.');const id=$('#teamId').value||key('equipo');let logo=$('#teamLogo').value.trim()||$('#teamLogoStored').value||'';const file=$('#teamLogoFile').files[0];if(file)logo=await imageFileToDataUrl(file);$('#teamLogoStored').value=logo;await set(ref(db,`equipos/${S.tid}/${id}`),{name:$('#teamName').value.trim(),group:$('#teamGroup').value.trim().toUpperCase(),logoUrl:logo,updatedAt:now()});e.target.reset();$('#teamId').value='';$('#teamLogoStored').value='';setLogoPreview('#teamLogoPreview','');msg('Equipo guardado.');}
function renderTeams(){const box=$('#teamsTable');if(!box)return;refreshMatchTeams();box.innerHTML=Object.entries(S.teams).map(([id,t])=>`<tr><td>${t.logoUrl?`<span class="mini-logo"><img src="${esc(t.logoUrl)}" alt=""></span>`:'<span class="mini-logo fallback">⚽</span>'}</td><td><b>${esc(t.name||id)}</b></td><td>${esc(t.group||'-')}</td><td><button class="small-btn edit-team" data-id="${esc(id)}">Editar</button> <button class="small-btn danger del-team" data-id="${esc(id)}">Eliminar</button></td></tr>`).join('')||'<tr><td colspan="4">No hay equipos.</td></tr>';box.querySelectorAll('.edit-team').forEach(b=>b.addEventListener('click',()=>{const t=S.teams[b.dataset.id];$('#teamId').value=b.dataset.id;$('#teamName').value=t.name||'';$('#teamGroup').value=t.group||'';$('#teamLogo').value=t.logoUrl&&/^https?:\/\//i.test(t.logoUrl)?t.logoUrl:'';$('#teamLogoStored').value=t.logoUrl||'';$('#teamLogoFile').value='';setLogoPreview('#teamLogoPreview',t.logoUrl||'');window.scrollTo({top:$('#equipos').offsetTop,behavior:'smooth'});}));box.querySelectorAll('.del-team').forEach(b=>b.addEventListener('click',async()=>{if(confirm('¿Eliminar equipo?'))await remove(ref(db,`equipos/${S.tid}/${b.dataset.id}`));}));}

function renderStageSelect(){const sel=$('#mStage');if(!sel)return;const list=stages();sel.innerHTML=list.map((s,i)=>`<option value="${esc(s.id)}">${i+1}. ${esc(s.name)}</option>`).join('');}
function stageById(id){return stages().find(s=>s.id===id)||stages()[0]||{};}
async function saveMatch(e){e.preventDefault();if(!isAllowed())return msg('No tienes permisos para este torneo.');const id=$('#matchId').value||key('partido');const previous=S.matches[id]||{};const status=$('#mStatus').value;const data={stageId:$('#mStage').value,phase:stageById($('#mStage').value).name||'Fase',roundLabel:$('#mRound').value.trim()||'Jornada',roundNumber:Number($('#mRound').dataset.round||0),dateValue:$('#mDateValue').value||'',time:$('#mTime').value||'',group:$('#mGroup').value.trim().toUpperCase(),local:$('#mLocal').value,visitor:$('#mVisitor').value,status,homeScore:Number($('#mHome').value||0),awayScore:Number($('#mAway').value||0),updatedAt:now()};if(status==='en juego'){data.liveStartedAt=String(previous.status||'').toLowerCase()==='en juego'&&previous.liveStartedAt?previous.liveStartedAt:now();data.liveStartMinute=Number(previous.liveStartMinute??0);data.liveHalfMinutes=Number(previous.liveHalfMinutes??currentTournament().format?.halfMinutes??25)||25;}else{data.liveStartedAt=null;data.liveStartMinute=null;}await set(ref(db,`partidos/${S.tid}/${id}`),data);clearMatch();msg('Partido guardado.');}
function clearMatch(){$('#matchForm').reset();$('#matchId').value='';renderStageSelect();refreshMatchTeams();}
function dateKeyForMatch(m){return `${m.stageId||''}::${m.dateId||m.roundNumber||m.roundLabel||''}`;}
function dateLabelForMatch(m){return (m.roundLabel||m.dateId||`Jornada ${m.roundNumber||''}`).toString().trim()||'Jornada';}
function initResetDatePicker(){const picker=$('#resetDatePicker');if(!picker)return;const button=$('#resetDatePickerButton');const search=$('#resetDateSearch');button?.addEventListener('click',()=>toggleResetDatePicker());search?.addEventListener('input',()=>filterResetDateOptions());search?.addEventListener('keydown',e=>{if(e.key==='Escape')closeResetDatePicker();});document.addEventListener('click',e=>{if(picker&&!picker.contains(e.target))closeResetDatePicker();});}
function toggleResetDatePicker(force){const picker=$('#resetDatePicker');if(!picker)return;const open=typeof force==='boolean'?force:picker.dataset.open!=='true';picker.dataset.open=open?'true':'false';$('#resetDatePickerButton')?.setAttribute('aria-expanded',open?'true':'false');if(open){const search=$('#resetDateSearch');filterResetDateOptions();setTimeout(()=>search?.focus(),0);}}
function closeResetDatePicker(){toggleResetDatePicker(false);}
function filterResetDateOptions(){const options=$$('#resetDateOptions .reset-date-option');const q=($('#resetDateSearch')?.value||'').trim().toLowerCase();options.forEach(o=>{o.style.display=!q||o.dataset.search.includes(q)?'grid':'none';});const empty=$('#resetDateNoResults');if(empty)empty.style.display=options.some(o=>o.style.display!=='none')?'none':'block';}
const $$=s=>[...document.querySelectorAll(s)];
function selectResetDate(key,label){const sel=$('#resetDateSelect');if(!sel)return;sel.value=key;const current=$('#resetDateCurrent');if(current)current.innerHTML=`<b>${esc(label)}</b><small>Fecha seleccionada para reiniciar</small>`;$$('#resetDateOptions .reset-date-option').forEach(o=>o.classList.toggle('selected',o.dataset.value===key));const search=$('#resetDateSearch');if(search)search.value='';closeResetDatePicker();}
function renderResetDateOptions(){const sel=$('#resetDateSelect'),box=$('#resetDateOptions');if(!sel||!box)return;const groups=new Map();Object.entries(S.matches).forEach(([id,m])=>{const key=dateKeyForMatch(m);if(!key||key==='::')return;const stage=stageById(m.stageId);const label=`${stage?.name?stage.name+' · ':''}${dateLabelForMatch(m)}`;if(!groups.has(key))groups.set(key,{label,stageId:m.stageId||'',dateId:m.dateId||'',roundNumber:m.roundNumber||0,roundLabel:m.roundLabel||''});});const current=sel.value;const sorted=[...groups.entries()].sort((a,b)=>String(a[1].stageId).localeCompare(String(b[1].stageId))||Number(a[1].roundNumber||0)-Number(b[1].roundNumber||0)||a[1].label.localeCompare(b[1].label));sel.innerHTML='<option value="">Selecciona una fecha...</option>'+sorted.map(([key,x])=>`<option value="${esc(key)}">${esc(x.label)}</option>`).join('');box.innerHTML=sorted.map(([key,x])=>`<button type="button" class="reset-date-option ${key===current?'selected':''}" data-value="${esc(key)}" data-search="${esc(`${x.label} ${x.roundLabel||''} ${x.dateId||''}`).toLowerCase()}"><span class="reset-date-icon">📅</span><span><b>${esc(x.label)}</b><small>${esc(x.roundLabel||'Jornada programada')}</small></span><i>✓</i></button>`).join('')+'<div class="reset-date-no-results" id="resetDateNoResults">No se encontraron fechas.</div>';if(sorted.length){box.querySelectorAll('.reset-date-option').forEach(o=>o.addEventListener('click',()=>selectResetDate(o.dataset.value,o.querySelector('b')?.textContent||'Fecha seleccionada')));if(!current){const c=$('#resetDateCurrent');if(c)c.innerHTML='<b>Selecciona una fecha...</b><small>Elige la jornada que deseas reiniciar</small>';}}else{$('#resetDateNoResults')?.style.setProperty('display','block');}filterResetDateOptions();}
async function resetSelectedDate(){if(!isAllowed())return msg('No tienes permisos para reiniciar resultados.');const sel=$('#resetDateSelect');const keySel=sel?.value||'';if(!keySel)return msg('Selecciona una fecha para reiniciar.');const matches=Object.entries(S.matches).filter(([,m])=>dateKeyForMatch(m)===keySel);if(!matches.length)return msg('No hay partidos en la fecha seleccionada.');const label=sel.options[sel.selectedIndex]?.textContent||'la fecha seleccionada';if(!confirm(`¿Reiniciar ${label}?\n\nSe eliminarán los marcadores y eventos de ${matches.length} partido(s) y todos volverán a PROGRAMADO 0 - 0.\n\nLa programación NO será eliminada.`))return;const writes={};matches.forEach(([id])=>{writes[`partidos/${S.tid}/${id}/status`]='programado';writes[`partidos/${S.tid}/${id}/homeScore`]=0;writes[`partidos/${S.tid}/${id}/awayScore`]=0;writes[`partidos/${S.tid}/${id}/liveStartedAt`]=null;writes[`partidos/${S.tid}/${id}/liveStartMinute`]=null;writes[`partidos/${S.tid}/${id}/livePeriod`]=null;writes[`partidos/${S.tid}/${id}/liveAddedTime`]=null;writes[`partidos/${S.tid}/${id}/periodStartedAt`]=null;writes[`partidos/${S.tid}/${id}/updatedAt`]=now();writes[`eventos/${S.tid}/${id}`]=null;});await update(ref(db),writes);msg(`${label}: resultados reiniciados correctamente.`);}
function renderAdminDateFilters(){
  const box=$('#adminDateFilters');if(!box)return;
  const groups=new Map();
  Object.values(S.matches).forEach(m=>{const key=dateKeyForMatch(m);if(!key||key==='::')return;const stage=stageById(m.stageId);const label=dateLabelForMatch(m);const sort=Number(m.roundNumber||0);if(!groups.has(key))groups.set(key,{label,stageId:m.stageId||'',roundNumber:sort});});
  const dates=[...groups.entries()].sort((a,b)=>String(a[1].stageId).localeCompare(String(b[1].stageId))||b[1].roundNumber-a[1].roundNumber||b[1].label.localeCompare(a[1].label));
  if(S.dateFilter!=='all'&&!groups.has(S.dateFilter))S.dateFilter='all';
  box.innerHTML=`<button type="button" class="date-filter ${S.dateFilter==='all'?'active':''}" data-date="all">TODAS</button>${dates.map(([key,x])=>`<button type="button" class="date-filter ${S.dateFilter===key?'active':''}" data-date="${esc(key)}">${esc(x.label)}</button>`).join('')}`;
  box.querySelectorAll('.date-filter').forEach(b=>b.addEventListener('click',()=>{S.dateFilter=b.dataset.date;renderMatches();}));
}
function renderMatches(){
  const box=$('#matchesTable');if(!box)return;
  renderAdminDateFilters();
  let rows=Object.entries(S.matches).map(([id,m])=>({id,...m}));
  if(S.dateFilter!=='all')rows=rows.filter(m=>dateKeyForMatch(m)===S.dateFilter);
  rows.sort((a,b)=>String(a.stageId||'').localeCompare(String(b.stageId||''))||Number(b.roundNumber||0)-Number(a.roundNumber||0)||String(b.dateValue||'').localeCompare(String(a.dateValue||''))||String(a.time||'').localeCompare(String(b.time||'')));
  box.innerHTML=rows.map(m=>{const st=String(m.status||'programado').toLowerCase();const live=st==='en juego',rest=st==='descanso',fin=st==='finalizado';return `<tr class="${live?'row-live':fin?'row-finished':''}"><td>${esc(m.phase||m.stageId||'-')}</td><td>${esc(m.roundLabel||m.dateId||'-')}</td><td>${esc(timeLabel(m.time))}</td><td>${esc(S.teams[m.local]?.name||m.local||'Por definir')}</td><td>${esc(S.teams[m.visitor]?.name||m.visitor||'Por definir')}</td><td><b>${live||rest||fin?`${Number(m.homeScore||0)} - ${Number(m.awayScore||0)}`:'VS'}</b></td><td><span class="status-badge ${live?'live':fin?'finished':''}">${live?'● EN JUEGO':rest?'⏸ DESCANSO':fin?'● FINALIZADO':'PROGRAMADO'}</span></td><td><button class="small-btn edit-match" data-id="${esc(m.id)}">Editar</button> <button class="small-btn primary result-match" data-id="${esc(m.id)}">Resultado</button></td></tr>`;}).join('')||'<tr><td colspan="8">No hay partidos en esta fecha.</td></tr>';
  box.querySelectorAll('.edit-match').forEach(b=>b.addEventListener('click',()=>editMatch(b.dataset.id)));
  box.querySelectorAll('.result-match').forEach(b=>b.addEventListener('click',()=>openResult(b.dataset.id)));
  renderResetDateOptions();
}
function editMatch(id){const m=S.matches[id];if(!m)return;$('#matchId').value=id;renderStageSelect();setSelectValue('#mStage',m.stageId||stages()[0]?.id||'');$('#mRound').value=m.roundLabel||'';$('#mDateValue').value=m.dateValue||'';$('#mTime').value=/^\d{2}:\d{2}$/.test(m.time||'')?m.time:'';$('#mGroup').value=m.group||'';$('#mLocal').innerHTML=teamOptions(m.local);$('#mVisitor').innerHTML=teamOptions(m.visitor);setSelectValue('#mStatus',m.status||'programado');$('#mHome').value=m.homeScore||0;$('#mAway').value=m.awayScore||0;window.scrollTo({top:$('#partidos').offsetTop,behavior:'smooth'});}

function renderDashboard(){const ms=Object.values(S.matches);$('#dashTeams').textContent=Object.keys(S.teams).length;$('#dashMatches').textContent=ms.length;$('#dashLive').textContent=ms.filter(m=>m.status==='en juego').length;$('#dashFinished').textContent=ms.filter(m=>m.status==='finalizado').length;}
function renderStageOverview(){const box=$('#stageOverview');if(!box)return;const list=stages();box.innerHTML=list.length?list.map((s,i)=>{const ms=Object.values(S.matches).filter(m=>m.stageId===s.id);const done=ms.length&&ms.every(m=>m.status==='finalizado');return `<div class="stage-card ${done?'done':''}"><div><span>${i+1}</span><div><b>${esc(s.name)}</b><small>${s.type==='round_robin'?'Liga / grupos':s.type==='final'?'Final':'Eliminatoria'} · ${s.matchMode==='home_away'?'Ida y vuelta':'Partido único'}</small></div></div><strong>${ms.length?`${ms.length} partido(s)`:'Pendiente de generar'}</strong></div>`;}).join(''):'<div class="empty">Configura las fases del torneo.</div>';}

function groupedTeams(){const f=currentTournament().format||{};let entries=Object.entries(S.teams);const groups={};const wanted=Math.max(1,Number(f.groups||1));const labels=Array.from({length:wanted},(_,i)=>String.fromCharCode(65+i));let hasGroups=entries.some(([,t])=>t.group);if(!hasGroups){entries.forEach(([id],i)=>{const g=labels[i%wanted];groups[g]??=[];groups[g].push(id);});return groups;}entries.forEach(([id,t],idx)=>{const g=(t.group||labels[idx%wanted]).toUpperCase();groups[g]??=[];groups[g].push(id);});return groups;}
function rrSchedule(ids){const arr=ids.slice();if(arr.length%2)arr.push(null);const n=arr.length,rounds=n-1,half=n/2,out=[];for(let r=0;r<rounds;r++){const games=[];for(let i=0;i<half;i++){const a=arr[i],b=arr[n-1-i];if(a&&b)games.push([a,b]);}out.push(games);const fixed=arr[0],rot=arr.slice(1);rot.unshift(rot.pop());arr=[fixed,...rot];}return out;}
function rrScheduleWithExistingDateOne(ids,existingDateOne){if(ids.length%2||ids.length<2||!existingDateOne?.length)return rrSchedule(ids);const pairs=[];const used=new Set();for(const m of existingDateOne){const a=m.local,b=m.visitor;if(!a||!b||a===b||!ids.includes(a)||!ids.includes(b)||used.has(a)||used.has(b))continue;pairs.push([a,b]);used.add(a);used.add(b);}let rest=ids.filter(id=>!used.has(id));const late=lateJoinTeamsForGroup('B',ids).filter(id=>rest.includes(id));if(late.length===2){for(const team of late){const oi=rest.findIndex(id=>id!==team&&!late.includes(id));if(oi<0)return rrSchedule(ids);const opponent=rest.splice(oi,1)[0];rest.splice(rest.indexOf(team),1);pairs.push([team,opponent]);}}while(rest.length>=2){pairs.push([rest.shift(),rest.shift()]);}if(pairs.length!==ids.length/2)return rrSchedule(ids);const arranged=pairs.map(p=>p[0]);for(let i=pairs.length-1;i>=0;i--)arranged.push(pairs[i][1]);return rrSchedule(arranged);}
function pairKey(a,b){return [String(a),String(b)].sort().join('::');}
function roundRobinStage(){return stages().find(s=>s.type==='round_robin')||null;}
function existingPairKeys(stageId){const set=new Set();Object.values(S.matches).filter(m=>m.stageId===stageId&&m.local&&m.visitor).forEach(m=>set.add(pairKey(m.local,m.visitor)));return set;}
function existingRounds(stageId){const map=new Map();Object.values(S.matches).filter(m=>m.stageId===stageId).forEach(m=>{const r=Number(m.roundNumber||0);if(r>0){if(!map.has(r))map.set(r,[]);map.get(r).push(m);}});return map;}
function lateJoinTeamsForGroup(group,ids){if(String(group||'').toUpperCase()!=='B')return [];const wanted=['Servi-Inter','Municipio'];return wanted.map(name=>ids.find(id=>String(S.teams[id]?.name||'').trim().toLowerCase()===name.toLowerCase())).filter(Boolean);}
function buildRoundMatches(stage,roundNumber,groups,preserveExistingRound=false){const writes={};let count=0;const usedPairs=existingPairKeys(stage.id);for(const [g,ids] of Object.entries(groups)){if(ids.length<2)continue;const existingRound=Object.values(S.matches).filter(m=>m.stageId===stage.id&&String(m.group||'')===String(g)&&Number(m.roundNumber||0)===roundNumber);const existingDateOne=Object.values(S.matches).filter(m=>m.stageId===stage.id&&String(m.group||'')===String(g)&&Number(m.roundNumber||0)===1);const schedule=rrScheduleWithExistingDateOne(ids,existingDateOne);const games=schedule[roundNumber-1]||[];if(preserveExistingRound&&existingRound.length)continue;const usedTeams=new Set(existingRound.flatMap(m=>[m.local,m.visitor]).filter(Boolean));const roundCounts={};existingRound.forEach(m=>{if(m.local)roundCounts[m.local]=(roundCounts[m.local]||0)+1;if(m.visitor)roundCounts[m.visitor]=(roundCounts[m.visitor]||0)+1;});let n=existingRound.length;const addGame=(a,b,extra=false)=>{const pk=pairKey(a,b);const ca=roundCounts[a]||0,cb=roundCounts[b]||0;if(!a||!b||a===b||usedPairs.has(pk)||(!extra&&(usedTeams.has(a)||usedTeams.has(b)))||(extra&&(ca>=2||cb>=2)))return false;const id=key('partido');writes[`partidos/${S.tid}/${id}`]={stageId:stage.id,phase:stage.name,roundNumber,roundLabel:`Jornada ${roundNumber}`,dateId:`${stage.id}_j${roundNumber}`,dateValue:'',time:'',group:g,local:a,visitor:b,status:'programado',homeScore:0,awayScore:0,number:++n,catchUp:!!extra,createdAt:now()};usedPairs.add(pk);usedTeams.add(a);usedTeams.add(b);roundCounts[a]=(roundCounts[a]||0)+1;roundCounts[b]=(roundCounts[b]||0)+1;count++;return true;};for(const [a,b] of games)addGame(a,b,false);
    // Servi-Inter y Municipio ingresan después de la Fecha 1. Durante las tres
    // primeras fechas juegan normalmente una vez; en la Fecha 5 recuperan el
    // enfrentamiento que les correspondía en la Fecha 1. Así llegan al mismo PJ.
    if(roundNumber===5){const late=lateJoinTeamsForGroup(g,ids);if(late.length===2){const r1=schedule[0]||[];for(const team of late){const missing=r1.find(([a,b])=>a===team||b===team);if(missing){const opponent=missing[0]===team?missing[1]:missing[0];addGame(team,opponent,true);}}}}
  }return {writes,count};}
async function generateNextRoundRobinDate(){if(!isAllowed())return msg('No tienes permisos para generar fechas.');const stage=roundRobinStage();if(!stage)return msg('No hay una fase de grupos configurada como liga / grupos.');const groups=groupedTeams();const validGroups=Object.values(groups).filter(ids=>ids.length>=2);if(!validGroups.length)return msg('No hay suficientes equipos. Registra y asigna grupos primero.');const maxRounds=Math.max(...validGroups.map(ids=>rrSchedule(ids).length));const existing=existingRounds(stage.id);const target=existing.size?Math.max(...existing.keys())+1:1;if(target>maxRounds)return msg(`${stage.name}: todas las jornadas ya están generadas.`);const {writes,count}=buildRoundMatches(stage,target,groups,false);if(!count)return msg(`La Jornada ${target} no pudo generar nuevos cruces porque ya existen o hay equipos repetidos en esa fecha.`);await update(ref(db,writes));msg(`${stage.name}: Jornada ${target} generada con ${count} partido(s), sin repetir cruces.`);}
async function generateAllRoundRobinDates(){if(!isAllowed())return msg('No tienes permisos para generar fechas.');const stage=roundRobinStage();if(!stage)return msg('No hay una fase de grupos configurada como liga / grupos.');const groups=groupedTeams();const validGroups=Object.values(groups).filter(ids=>ids.length>=2);if(!validGroups.length)return msg('No hay suficientes equipos. Registra y asigna grupos primero.');const maxRounds=Math.max(...validGroups.map(ids=>rrSchedule(ids).length));const existingAtStart=existingRounds(stage.id);const startRound=existingAtStart.size?Math.max(...existingAtStart.keys())+1:1;const remaining=Math.max(0,maxRounds-startRound+1);if(!confirm(`¿Generar todas las fechas restantes de ${stage.name}?\n\nSe crearán las jornadas que falten hasta completar ${maxRounds} jornadas por grupo.\nLos partidos existentes se respetarán y nunca se repetirá un cruce.`))return;const writes={};let count=0,roundsCreated=0;for(let r=startRound;r<=maxRounds;r++){const result=buildRoundMatches(stage,r,groups,false);if(result.count){Object.assign(writes,result.writes);count+=result.count;roundsCreated++;Object.entries(result.writes).forEach(([path,data])=>{const id=path.split('/').pop();S.matches[id]=data;});}}if(!count)return msg(`${stage.name}: no hay fechas nuevas por generar. Los cruces existentes fueron respetados.`);await update(ref(db,writes));msg(`${stage.name}: ${count} partidos generados en ${roundsCreated} jornada(s), sin repetir cruces.`);}
async function generateNextStage(){if(!isAllowed())return msg('No tienes permisos para generar fases.');const list=stages();if(!list.length)return msg('Configura al menos una fase.');let idx=list.findIndex(s=>!Object.values(S.matches).some(m=>m.stageId===s.id));if(idx<0)return msg('Todas las fases ya tienen partidos generados.');const stage=list[idx];if(idx>0){const prev=list[idx-1];const prevMatches=Object.values(S.matches).filter(m=>m.stageId===prev.id);if(!prevMatches.length)return msg(`Primero genera ${prev.name}.`);if(!prevMatches.every(m=>m.status==='finalizado'))return msg(`Finaliza todos los partidos de ${prev.name} antes de generar la siguiente fase.`);}if(stage.type==='round_robin')return generateNextRoundRobinDate();return generateKnockout(stage,idx>0?list[idx-1]:null);}
async function generateRoundRobin(stage){const groups=groupedTeams();const writes={};let count=0;for(const [g,ids] of Object.entries(groups)){if(ids.length<2)continue;const rounds=rrSchedule(ids);rounds.forEach((games,r)=>games.forEach((pair,n)=>{const id=key('partido');writes[`partidos/${S.tid}/${id}`]={stageId:stage.id,phase:stage.name,roundNumber:r+1,roundLabel:`Jornada ${r+1}`,dateId:`${stage.id}_j${r+1}`,dateValue:'',time:'',group:g,local:pair[0],visitor:pair[1],status:'programado',homeScore:0,awayScore:0,number:n+1,createdAt:now()};count++;}));}if(!count)return msg('No hay suficientes equipos. Registra y asigna grupos primero.');await update(ref(db,writes));msg(`${stage.name}: ${count} partidos generados.`);}
function previousQualifiers(stage,prev){const ms=Object.values(S.matches).filter(m=>m.stageId===prev.id);if(prev.type==='round_robin'){const groups=[...new Set(ms.map(m=>m.group).filter(Boolean))];const q=Math.max(1,Number(prev.qualifiersPerGroup||stage.qualifiersPerGroup||2));let out=[];for(const g of groups){const rows=standingsForStage(prev.id,g);out.push(...rows.slice(0,q).map(x=>x.id));}return out;}const series={};ms.forEach(m=>{const keyS=m.seriesId||m.id;series[keyS]??=[];series[keyS].push(m);});const winners=[];for(const games of Object.values(series)){const fin=games.filter(m=>m.status==='finalizado');if(!fin.length)continue;let a=0,b=0;const home=games[0].local,away=games[0].visitor;games.forEach(m=>{a+=Number(m.homeScore||0);b+=Number(m.awayScore||0);});if(a===b){const last=fin[fin.length-1];if(Number(last.homeScore||0)!==Number(last.awayScore||0))winners.push(Number(last.homeScore)>Number(last.awayScore)?last.local:last.visitor);}else winners.push(a>b?home:away);}return winners;}
function standingsForStage(stageId,group){const out={};Object.entries(S.teams).filter(([,t])=>String(t.group||'')===String(group)).forEach(([id,t])=>out[id]={id,name:t.name||id,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0});Object.values(S.matches).filter(m=>m.stageId===stageId&&String(m.group||'')===String(group)&&m.status==='finalizado').forEach(m=>{if(!out[m.local]||!out[m.visitor])return;const a=Number(m.homeScore||0),b=Number(m.awayScore||0);out[m.local].pj++;out[m.visitor].pj++;out[m.local].gf+=a;out[m.local].gc+=b;out[m.visitor].gf+=b;out[m.visitor].gc+=a;if(a>b){out[m.local].pg++;out[m.local].pts+=Number(currentTournament().format?.points?.win??3);out[m.visitor].pp++;}else if(a<b){out[m.visitor].pg++;out[m.visitor].pts+=Number(currentTournament().format?.points?.win??3);out[m.local].pp++;}else{out[m.local].pe++;out[m.visitor].pe++;out[m.local].pts+=Number(currentTournament().format?.points?.draw??1);out[m.visitor].pts+=Number(currentTournament().format?.points?.draw??1);}});return Object.values(out).map(x=>(x.dg=x.gf-x.gc,x)).sort((a,b)=>b.pts-a.pts||b.dg-a.dg||b.gf-a.gf||a.name.localeCompare(b.name));}
function standingsForGroupFromPrev(prev){const groups=[...new Set(Object.values(S.matches).filter(m=>m.stageId===prev.id).map(m=>m.group).filter(Boolean))];return groups.flatMap(g=>standingsForStage(prev.id,g));}
function shuffle(a){return a.map(v=>({v,r:Math.random()})).sort((x,y)=>x.r-y.r).map(x=>x.v);}
async function generateKnockout(stage,prev){let teams=prev?previousQualifiers(stage,prev):Object.keys(S.teams);if(teams.length<2)return msg('No hay suficientes clasificados para esta fase.');teams=shuffle([...new Set(teams)]);if(teams.length%2)teams.pop();const writes={};let count=0;for(let i=0;i<teams.length;i+=2){const a=teams[i],b=teams[i+1],seriesId=key('serie');const legs=stage.matchMode==='home_away'?2:1;for(let leg=1;leg<=legs;leg++){const id=key('partido');writes[`partidos/${S.tid}/${id}`]={stageId:stage.id,phase:stage.name,roundNumber:1,roundLabel:stage.matchMode==='home_away'?(leg===1?'Ida':'Vuelta'):'Ronda 1',dateId:`${stage.id}_r1_${seriesId}`,dateValue:'',time:'',group:'',local:leg===1?a:b,visitor:leg===1?b:a,status:'programado',homeScore:0,awayScore:0,seriesId,leg,createdAt:now()};count++;}}if(count)await update(ref(db),writes);msg(`${stage.name}: sorteo realizado, ${count} partido(s) generados.`);}

function toggleLiveStartField(){
  const status=$('#resultStatus')?.value||'programado';
  const live=status==='en juego';
  const rest=status==='descanso';
  $('#liveStartField')?.classList.toggle('hidden',!live);
  $('#livePeriodField')?.classList.toggle('hidden',!(live||rest));
  $('#addedTimeField')?.classList.toggle('hidden',!(live||rest));
  $('#liveActions')?.classList.toggle('hidden',!(live||rest));
  const period=$('#livePeriod');
  if(rest && period) period.value='second';
  const firstBtn=$('#finishFirstHalf');
  const secondBtn=$('#startSecondHalf');
  const finishBtn=$('#finishMatch');
  const isSecond=period?.value==='second' || rest;
  if(firstBtn) firstBtn.classList.toggle('hidden',!live || isSecond);
  if(secondBtn) secondBtn.classList.toggle('hidden',!rest);
  if(finishBtn) finishBtn.classList.toggle('hidden',!live);
}
function openResult(id){const m=S.matches[id];if(!m)return;$('#resultMatch').value=id;$('#resultTitle').textContent=`${S.teams[m.local]?.name||m.local} vs ${S.teams[m.visitor]?.name||m.visitor}`;$('#resultHome').value=m.homeScore||0;$('#resultAway').value=m.awayScore||0;setSelectValue('#resultStatus',m.status||'programado');$('#liveStartMinute').value=m.liveStartMinute??'';setSelectValue('#livePeriod',m.livePeriod||'first');$('#addedTime').value=m.liveAddedTime??'';renderEvents(id);toggleLiveStartField();$('#resultModal').classList.add('open');}
function resetResultModal(){const form=$('#resultForm');if(form)form.reset();$('#resultMatch').value='';$('#resultTitle').textContent='Resultado';$('#eventEditor').innerHTML='';if($('#livePeriod'))setSelectValue('#livePeriod','first');if($('#addedTime'))$('#addedTime').value='';toggleLiveStartField();}
function closeResult(reset=true){$('#resultModal').classList.remove('open');if(reset)resetResultModal();}
async function saveResult(e){e.preventDefault();if(!isAllowed())return msg('No tienes permisos para actualizar resultados.');const id=$('#resultMatch').value;if(!id)return msg('Selecciona un partido.');const previous=S.matches[id]||{};const status=$('#resultStatus').value;const patch={homeScore:Number($('#resultHome').value||0),awayScore:Number($('#resultAway').value||0),status,updatedAt:now()};const period=$('#livePeriod')?.value||previous.livePeriod||'first';const added=Math.max(0,Math.min(30,Number($('#addedTime')?.value||0)||0));if(status==='en juego'){const wasLive=String(previous.status||'').toLowerCase()==='en juego'&&previous.liveStartedAt;patch.liveStartedAt=wasLive?previous.liveStartedAt:now();const raw=$('#liveStartMinute').value.trim();const halfMinutes=Math.max(1,Math.min(60,Number(previous.liveHalfMinutes??currentTournament().format?.halfMinutes??25)||25));patch.liveHalfMinutes=halfMinutes;patch.liveStartMinute=raw===''?(period==='second'?halfMinutes+1:0):Math.max(0,Math.min(130,Number(raw)||0));patch.livePeriod=period;patch.liveAddedTime=added;patch.periodStartedAt=wasLive?(previous.periodStartedAt||previous.liveStartedAt):now();}else if(status==='descanso'){patch.liveStartedAt=null;patch.periodStartedAt=null;patch.livePeriod='second';patch.liveStartMinute=Math.max(1,Number(previous.liveHalfMinutes??currentTournament().format?.halfMinutes??25)||25);patch.liveAddedTime=added;patch.firstHalfFinishedAt=previous.firstHalfFinishedAt||now();}else{patch.liveStartedAt=null;patch.periodStartedAt=null;patch.liveStartMinute=null;patch.liveAddedTime=null;}await update(ref(db,`partidos/${S.tid}/${id}`),patch);if(status==='finalizado'){const m=previous;const finalStage=stages().find(s=>s.type==='final'||String(s.id||'').toLowerCase()==='final');if(finalStage&&m.stageId===finalStage.id){await update(ref(db,`tournaments/${S.tid}`),{status:'finished',finishedAt:now(),championTeamId:Number(patch.homeScore||0)>Number(patch.awayScore||0)?m.local:Number(patch.awayScore||0)>Number(patch.homeScore||0)?m.visitor:null});}}closeResult(true);msg('Resultado actualizado.');}

async function finishFirstHalf(){const id=$('#resultMatch').value;if(!id)return;const m=S.matches[id]||{};if(String(m.status||'').toLowerCase()!=='en juego')return msg('El partido no está en juego.');if(($('#livePeriod')?.value||m.livePeriod||'first')!=='first')return msg('El partido ya está en el segundo tiempo.');const added=Math.max(0,Math.min(30,Number($('#addedTime')?.value||0)||0));const minute=liveMinuteLabelForAdmin({...m,liveAddedTime:added});if(!confirm(`¿Terminar el primer tiempo en ${minute}${added?` con +${added}`:''}?`))return;await update(ref(db,`partidos/${S.tid}/${id}`),{status:'descanso',liveStartedAt:null,periodStartedAt:null,livePeriod:'second',liveStartMinute:Math.max(1,Number(m.liveHalfMinutes??currentTournament().format?.halfMinutes??25)||25)+1,liveHalfMinutes:Math.max(1,Number(m.liveHalfMinutes??currentTournament().format?.halfMinutes??25)||25),firstHalfMinute:minute,firstHalfAddedTime:added,firstHalfFinishedAt:now(),liveAddedTime:0,updatedAt:now()});$('#resultStatus').value='descanso';$('#livePeriod').value='second';$('#addedTime').value='';toggleLiveStartField();msg('Primer tiempo terminado. Partido en descanso.');}
async function startSecondHalf(){const id=$('#resultMatch').value;if(!id)return;const m=S.matches[id]||{};if(String(m.status||'').toLowerCase()!=='descanso')return msg('El partido no está en descanso.');await update(ref(db,`partidos/${S.tid}/${id}`),{status:'en juego',liveStartedAt:now(),periodStartedAt:now(),livePeriod:'second',liveStartMinute:Math.max(1,Number(m.liveHalfMinutes??currentTournament().format?.halfMinutes??25)||25)+1,liveHalfMinutes:Math.max(1,Number(m.liveHalfMinutes??currentTournament().format?.halfMinutes??25)||25),liveAddedTime:0,updatedAt:now()});$('#resultStatus').value='en juego';$('#livePeriod').value='second';$('#liveStartMinute').value=Math.max(1,Number(m.liveHalfMinutes??currentTournament().format?.halfMinutes??25)||25)+1;$('#addedTime').value='';toggleLiveStartField();msg('Segundo tiempo iniciado.');}
async function finishLiveMatch(){const id=$('#resultMatch').value;if(!id)return;const m=S.matches[id]||{};if(String(m.status||'').toLowerCase()!=='en juego')return msg('El partido no está en juego.');const added=Math.max(0,Math.min(30,Number($('#addedTime')?.value||0)||0));const minute=liveMinuteLabelForAdmin({...m,liveAddedTime:added});if(!confirm(`¿Finalizar el partido en ${minute}${added?` con +${added}`:''}?`))return;await update(ref(db,`partidos/${S.tid}/${id}`),{status:'finalizado',liveStartedAt:null,periodStartedAt:null,liveAddedTime:null,secondHalfMinute:minute,secondHalfAddedTime:added,finishedAt:now(),updatedAt:now()});const finalStage=stages().find(s=>s.type==='final'||String(s.id||'').toLowerCase()==='final');if(finalStage&&m.stageId===finalStage.id){const hs=Number(m.homeScore||0),as=Number(m.awayScore||0);await update(ref(db,`tournaments/${S.tid}`),{status:'finished',finishedAt:now(),championTeamId:hs>as?m.local:as>hs?m.visitor:null});}closeResult(true);msg('Partido finalizado.');}
function liveMinuteForAdmin(m){if(!m)return 0;const base=Math.max(0,Number(m.liveStartMinute??0));const started=Date.parse(m.periodStartedAt||m.liveStartedAt||'');const elapsed=Number.isFinite(started)?Math.max(0,Math.floor((Date.now()-started)/60000)):0;return base+elapsed;}
function liveMinuteLabelForAdmin(m){if(!m)return '0′';const n=liveMinuteForAdmin(m);const half=Math.max(1,Number(m.liveHalfMinutes??currentTournament().format?.halfMinutes??25)||25);const period=String(m.livePeriod||'first').toLowerCase();const added=Math.max(0,Number(m.liveAddedTime||0));const threshold=period==='second'?half*2:half;if(n>threshold && added>0)return `${threshold}+${Math.min(n-threshold,added)}′`;return `${Math.min(n,threshold+added)}′`;}
function addEventRow(){const id=$('#resultMatch').value;const row=document.createElement('div');row.className='event-edit-row';row.dataset.eid='';row.innerHTML='<select class="ev-type"><option value="gol">⚽ Gol</option><option value="amarilla">🟨 Amarilla</option><option value="roja">🟥 Roja</option></select><select class="ev-team"></select><input class="ev-player" placeholder="Jugador"><input class="ev-minute" type="number" min="0" max="130" placeholder="Min"><button type="button" class="small-btn danger">×</button>';$('#eventEditor').appendChild(row);row.querySelector('.ev-team').innerHTML=teamOptionsForMatch(id);row.querySelector('button').addEventListener('click',()=>row.remove());if($('#resultStatus').value==='en juego' && !row.querySelector('.ev-minute').value){row.querySelector('.ev-minute').value=liveMinuteForAdmin(S.matches[id]);}row.querySelector('.ev-player').focus();}
function teamOptionsForMatch(id){const m=S.matches[id];return [`<option value="${esc(m.local)}">${esc(S.teams[m.local]?.name||m.local)}</option>`,`<option value="${esc(m.visitor)}">${esc(S.teams[m.visitor]?.name||m.visitor)}</option>`].join('');}
async function renderEvents(id){const box=$('#eventEditor');box.innerHTML='';const evs=S.events[id]||{};Object.entries(evs).forEach(([eid,e])=>addEventExisting(eid,e));}
function addEventExisting(eid,e){const row=document.createElement('div');row.className='event-edit-row';row.dataset.eid=eid;row.innerHTML=`<select class="ev-type"><option value="gol">⚽ Gol</option><option value="amarilla">🟨 Amarilla</option><option value="roja">🟥 Roja</option></select><select class="ev-team">${teamOptionsForMatch($('#resultMatch').value)}</select><input class="ev-player" placeholder="Jugador" value="${esc(e.player||'')}"><input class="ev-minute" type="number" min="0" max="130" value="${Number(e.minute||0)}"><button type="button" class="small-btn danger">×</button>`;setSelectValue(row.querySelector('.ev-type'),e.type||'gol');setSelectValue(row.querySelector('.ev-team'),e.team||e.equipo||S.matches[$('#resultMatch').value].local);row.querySelector('button').addEventListener('click',async()=>{await remove(ref(db,`eventos/${S.tid}/${$('#resultMatch').value}/${eid}`));row.remove();});$('#eventEditor').appendChild(row);}
$('#saveEvents')?.addEventListener('click',async()=>{if(!isAllowed())return msg('No tienes permisos.');const id=$('#resultMatch').value;if(!id)return msg('Selecciona un partido.');const writes={};const rows=[...document.querySelectorAll('#eventEditor .event-edit-row')];rows.forEach(row=>{let eid=row.dataset.eid||'';if(!eid)eid=key('evento');row.dataset.eid=eid;writes[`eventos/${S.tid}/${id}/${eid}`]={type:row.querySelector('.ev-type').value,team:row.querySelector('.ev-team').value,player:row.querySelector('.ev-player').value.trim(),minute:Number(row.querySelector('.ev-minute').value||0),createdAt:S.events[id]?.[eid]?.createdAt||now(),updatedAt:now()};});if(Object.keys(writes).length)await update(ref(db),writes);msg('Eventos guardados correctamente. El partido sigue abierto.');});

async function assignAdmin(e){e.preventDefault();if(!S.global)return msg('Solo el administrador global puede asignar accesos.');const uid=$('#adminUid').value.trim();if(!uid)return;await set(ref(db,`tournamentAdmins/${S.tid}/${uid}`),{role:$('#adminRole').value,email:$('#adminEmail').value.trim(),updatedAt:now()});e.target.reset();msg('Acceso asignado al torneo.');}
function renderAdmins(){const box=$('#adminsTable');if(!box)return;box.innerHTML=Object.entries(S.admins).map(([uid,a])=>`<tr><td>${esc(uid)}</td><td>${esc(a.email||'-')}</td><td>${esc(a.role||'editor')}</td><td><button class="small-btn danger remove-admin" data-id="${esc(uid)}">Quitar</button></td></tr>`).join('')||'<tr><td colspan="4">No hay administradores asignados.</td></tr>';box.querySelectorAll('.remove-admin').forEach(b=>b.addEventListener('click',async()=>{if(S.global&&confirm('¿Quitar administrador?'))await remove(ref(db,`tournamentAdmins/${S.tid}/${b.dataset.id}`));}));}

function switchPaymentTab(tab){
  document.querySelectorAll('[data-payment-tab]').forEach(btn=>{const active=btn.dataset.paymentTab===tab;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',active?'true':'false');});
  document.querySelectorAll('[data-payment-panel]').forEach(panel=>{const active=panel.dataset.paymentPanel===tab;panel.classList.toggle('active',active);panel.hidden=!active;});
}

function setGlobalPayments(open){
  const show=!!open&&S.global;
  S.paymentsOpen=show;
  const panel=$('#pagos'),workspace=$('#tournamentWorkspace'),actions=$('.hero-actions');
  if(panel)panel.style.display=show?'block':'none';
  if(workspace)workspace.style.display=show?'none':'block';
  if(actions)actions.style.display=show?'none':(S.global?'flex':'');
  if(show){
    $('#selectedName').textContent='Centro de pagos';
    $('#pageTitle').textContent='Pagos de la plataforma';
    window.scrollTo({top:0,behavior:'smooth'});
  }else if(S.tid&&!S.isNew){
    renderTournamentDetails();
  }else if(S.isNew){
    $('#selectedName').textContent='Nuevo torneo';
    $('#pageTitle').textContent='Crear nuevo torneo';
  }
}
function toggleGlobalPayments(){if(!S.global)return;setGlobalPayments(!S.paymentsOpen);}
function renderPaymentConfig(){if(!S.global)return;const tr=S.paymentPublic?.transfer||{};const pp=S.paymentPayphone||{};if($('#payBankName'))$('#payBankName').value=tr.bankName||'';if($('#payAccountType'))$('#payAccountType').value=tr.accountType||'';if($('#payAccountNumber'))$('#payAccountNumber').value=tr.accountNumber||'';if($('#payAccountHolder'))$('#payAccountHolder').value=tr.accountHolder||'';if($('#payIdentification'))$('#payIdentification').value=tr.identification||'';if($('#payContact'))$('#payContact').value=tr.contact||'';if($('#payInstructions'))$('#payInstructions').value=tr.instructions||'';if($('#payTransferEnabled'))$('#payTransferEnabled').checked=tr.enabled!==false;if($('#payPayphoneEnabled'))$('#payPayphoneEnabled').checked=pp.enabled===true;if($('#payPayphoneToken'))$('#payPayphoneToken').value=pp.token||'';if($('#payPayphoneStoreId'))$('#payPayphoneStoreId').value=pp.storeId||'';}
async function savePaymentConfig(e){e.preventDefault();if(!S.global)return msg('Solo el administrador global puede configurar los pagos.');const transfer={enabled:$('#payTransferEnabled').checked,bankName:$('#payBankName').value.trim(),accountType:$('#payAccountType').value.trim(),accountNumber:$('#payAccountNumber').value.trim(),accountHolder:$('#payAccountHolder').value.trim(),identification:$('#payIdentification').value.trim(),contact:$('#payContact').value.trim(),instructions:$('#payInstructions').value.trim(),updatedAt:now()};const enabled=$('#payPayphoneEnabled').checked;const token=$('#payPayphoneToken').value.trim();const storeId=$('#payPayphoneStoreId').value.trim();if(enabled&&(!token||!storeId))return msg('Para habilitar Payphone debes ingresar Token y Store ID.');try{await update(ref(db),{'paymentConfig/public/transfer':transfer,'paymentConfig/public/payphone':{enabled,updatedAt:now()},'paymentConfig/payphone':{enabled,token,storeId,updatedAt:now()}});S.paymentPublic={...(S.paymentPublic||{}),transfer,payphone:{enabled}};S.paymentPayphone={...(S.paymentPayphone||{}),enabled,token,storeId};renderPaymentConfig();msg('Configuración de pagos guardada correctamente.');}catch(err){msg(err?.message||'No se pudo guardar la configuración de pagos.');console.error(err);}}
function renderPaymentRequests(){
  if(!S.global)return;
  const box=$('#paymentRequestsTable');
  if(!box)return;
  const rows=Object.values(S.paymentRequests||{})
    .filter(x=>x&&(['pending','pending_transfer'].includes(x.status)))
    .sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  box.innerHTML=rows.map(r=>{
    const t=S.tournaments[r.tournamentId];
    const status=r.status==='pending_transfer'?'COMPROBANTE EN REVISIÓN':'PENDIENTE DE APROBACIÓN';
    const proof=r.proofUrl||r.receiptUrl||r.comprobanteUrl||r.proof||'';
    return `<tr>
      <td>${r.createdAt?new Date(r.createdAt).toLocaleString('es-EC'):''}</td>
      <td><b>${esc(t?.name||r.tournamentId||'')}</b><small class="payment-sub">${esc([t?.province,t?.canton,t?.parish].filter(Boolean).join(' · '))}</small></td>
      <td>${esc(r.userEmail||r.uid||'')}</td>
      <td><b>${esc(r.reference||'Sin referencia')}</b>${r.note?`<small class="payment-sub">${esc(r.note)}</small>`:''}${proof?`<a class="payment-proof" href="${esc(proof)}" target="_blank" rel="noopener">📎 Ver comprobante</a>`:''}</td>
      <td><span class="account-status pending">${status}</span></td>
      <td><button class="small-btn primary approve-payment" data-id="${esc(r.id)}">Aprobar $20</button></td>
    </tr>`;
  }).join('')||'<tr><td colspan="6"><div class="payment-empty">No hay transferencias pendientes de aprobación.</div></td></tr>';
  box.querySelectorAll('.approve-payment').forEach(b=>b.addEventListener('click',()=>approveTransfer(b.dataset.id)));
}
async function approveTransfer(id){if(!S.global)return;if(!confirm('¿Confirmas que recibiste los $20 y deseas activar este torneo?'))return;const r=S.paymentRequests[id];if(!r)return;await update(ref(db),{[`paymentRequests/${id}/status`]:'approved',[`paymentRequests/${id}/approvedAt`]:now(),[`paymentRequests/${id}/approvedBy`]:S.user.uid,[`tournaments/${r.tournamentId}/paymentStatus`]:'paid',[`tournaments/${r.tournamentId}/paymentProvider`]:'transfer',[`tournaments/${r.tournamentId}/status`]:'active',[`tournaments/${r.tournamentId}/paidAt`]:now()});msg('Transferencia aprobada y torneo activado.');}
function msg(text){const el=$('#toast');el.textContent=text;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2800);}

init();guardAdmin(boot);


/* V60 · módulos profesionales */
const moduleStore={jugadores:{},inscripciones:{},sedes:{},noticias:{},patrocinadores:{},premios:{}};
const invitationStore={};
const moduleConfig={
 jugadores:['jugadores','playersTable'],inscripciones:['inscripciones','registrationsTable'],sedes:['sedes','venuesTable'],noticias:['noticias','newsTable'],patrocinadores:['patrocinadores','sponsorsTable'],premios:['premios','awardsTable']
};
function modulePath(k){return `${k}/${S.tid}`;}
function moduleRef(k){return ref(db,modulePath(k));}
function allowedModule(){return !!S.tid&&isAllowed();}
function moduleEsc(v){return esc(v??'');}
function teamNameForModule(id){return S.teams?.[id]?.name||id||'-';}
function switchModuleTab(k){document.querySelectorAll('[data-module-tab]').forEach(b=>b.classList.toggle('active',b.dataset.moduleTab===k));document.querySelectorAll('[data-module-panel]').forEach(p=>{const a=p.dataset.modulePanel===k;p.classList.toggle('active',a);p.hidden=!a;});if(k==='actas')renderActMatches();}
function initModules(){document.querySelectorAll('[data-module-tab]').forEach(b=>b.addEventListener('click',()=>switchModuleTab(b.dataset.moduleTab)));$('#playerForm')?.addEventListener('submit',savePlayer);$('#clearPlayer')?.addEventListener('click',clearPlayer);$('#registrationForm')?.addEventListener('submit',saveRegistration);$('#venueForm')?.addEventListener('submit',saveVenue);$('#newsForm')?.addEventListener('submit',saveNews);$('#sponsorForm')?.addEventListener('submit',saveSponsor);$('#awardForm')?.addEventListener('submit',saveAward);$('#printMatchAct')?.addEventListener('click',printMatchAct);}
async function loadModules(){if(!S.tid)return;S.moduleUnsub.forEach(fn=>{try{fn();}catch{}});S.moduleUnsub=[];Object.keys(moduleStore).forEach(k=>S.moduleUnsub.push(onValue(moduleRef(k),snap=>{moduleStore[k]=snap.val()||{};renderModule(k);initSelect2('#tournamentWorkspace');})));renderPlayerTeamOptions();renderActMatches();initSelect2('#tournamentWorkspace');}
function renderPlayerTeamOptions(){const el=$('#playerTeam');if(!el)return;const current=el.value;const options=Object.entries(S.teams||{}).sort((a,b)=>String(a[1]?.name||a[0]).localeCompare(String(b[1]?.name||b[0]),'es',{sensitivity:'base'})).map(([id,t])=>`<option value="${moduleEsc(id)}">${moduleEsc(t.name||id)}</option>`).join('');el.innerHTML='<option value="">Selecciona un equipo</option>'+options;if(current&&S.teams?.[current])el.value=current;initSelect2(el.parentElement||el);}
function renderModule(k){const box=$(`#${moduleConfig[k][1]}`);if(!box)return;const data=moduleStore[k];if(k==='jugadores')box.innerHTML=Object.entries(data).map(([id,x])=>`<tr><td><b>${moduleEsc(x.name)}</b>${x.photo?`<small class="module-muted">${moduleEsc(x.position||'')}</small>`:''}</td><td>${moduleEsc(teamNameForModule(x.teamId))}</td><td>${moduleEsc(x.number||'-')}</td><td>${moduleEsc(x.position||'-')}</td><td>${x.status==='inactive'?'Inactivo':'Activo'}</td><td><button class="small-btn edit-module" data-k="jugadores" data-id="${moduleEsc(id)}">Editar</button> <button class="small-btn danger del-module" data-k="jugadores" data-id="${moduleEsc(id)}">×</button></td></tr>`).join('')||'<tr><td colspan="6">No hay jugadores registrados.</td></tr>';
if(k==='inscripciones')box.innerHTML=Object.entries(data).sort((a,b)=>String(b[1]?.createdAt||'').localeCompare(String(a[1]?.createdAt||''))).map(([id,x])=>`<tr><td>${moduleEsc(x.team)}</td><td>${moduleEsc(x.delegate||'-')}</td><td>${moduleEsc(x.contact||'-')}</td><td>${moduleEsc(x.email||'-')}</td><td>${x.source==='public'?'🌐 Pública':'🛠️ Manual'}</td><td><select class="registration-status" data-id="${moduleEsc(id)}"><option value="pending" ${x.status==='pending'?'selected':''}>Pendiente</option><option value="approved" ${x.status==='approved'?'selected':''}>Aprobada</option><option value="rejected" ${x.status==='rejected'?'selected':''}>Rechazada</option></select></td><td><button class="small-btn danger del-module" data-k="inscripciones" data-id="${moduleEsc(id)}">×</button></td></tr>`).join('')||'<tr><td colspan="7">No hay solicitudes.</td></tr>';

if(k==='sedes')box.innerHTML=Object.entries(data).map(([id,x])=>`<tr><td><b>${moduleEsc(x.name)}</b></td><td>${moduleEsc(x.address||'-')}</td><td>${moduleEsc(x.city||'-')}</td><td>${x.mapUrl?`<a class="small-btn" href="${moduleEsc(x.mapUrl)}" target="_blank">Mapa</a>`:''} <button class="small-btn danger del-module" data-k="sedes" data-id="${moduleEsc(id)}">×</button></td></tr>`).join('')||'<tr><td colspan="4">No hay sedes.</td></tr>';
if(k==='noticias')box.innerHTML=Object.entries(data).sort((a,b)=>String(b[1].date||'').localeCompare(String(a[1].date||''))).map(([id,x])=>`<tr><td>${moduleEsc(x.date||'-')}</td><td><b>${moduleEsc(x.title)}</b></td><td>${x.published!==false?'Publicada':'Borrador'}</td><td><button class="small-btn edit-module" data-k="noticias" data-id="${moduleEsc(id)}">Editar</button> <button class="small-btn danger del-module" data-k="noticias" data-id="${moduleEsc(id)}">×</button></td></tr>`).join('')||'<tr><td colspan="4">No hay noticias.</td></tr>';
if(k==='patrocinadores')box.innerHTML=Object.entries(data).map(([id,x])=>`<tr><td>${x.logo?`<img class="module-logo" src="${moduleEsc(x.logo)}" alt="">`:'🤝'}</td><td><b>${moduleEsc(x.name)}</b></td><td>${moduleEsc(x.level||'-')}</td><td>${x.url?`<a class="small-btn" href="${moduleEsc(x.url)}" target="_blank">Web</a>`:''} <button class="small-btn danger del-module" data-k="patrocinadores" data-id="${moduleEsc(id)}">×</button></td></tr>`).join('')||'<tr><td colspan="4">No hay patrocinadores.</td></tr>';
if(k==='premios')box.innerHTML=Object.entries(data).map(([id,x])=>`<tr><td>${moduleEsc(x.name)}</td><td><b>${moduleEsc(x.winner)}</b></td><td>${moduleEsc(x.team||'-')}</td><td><button class="small-btn danger del-module" data-k="premios" data-id="${moduleEsc(id)}">×</button></td></tr>`).join('')||'<tr><td colspan="4">No hay premios.</td></tr>';
box.querySelectorAll('.del-module').forEach(b=>b.addEventListener('click',async()=>{if(!allowedModule()||!confirm('¿Eliminar este registro?'))return;await remove(ref(db,`${b.dataset.k}/${S.tid}/${b.dataset.id}`));}));box.querySelectorAll('.edit-module').forEach(b=>b.addEventListener('click',()=>editModule(b.dataset.k,b.dataset.id)));box.querySelectorAll('.registration-status').forEach(sel=>sel.addEventListener('change',()=>update(ref(db,`${sel.dataset.k||'inscripciones'}/${S.tid}/${sel.dataset.id}`),{status:sel.value,updatedAt:now()})));
}
function editModule(k,id){const x=moduleStore[k]?.[id];if(!x)return;if(k==='jugadores'){['playerTeam','playerName','playerNumber','playerPosition','playerPhoto','playerStatus'].forEach((id,i)=>{});$('#playerId').value=id;$('#playerTeam').value=x.teamId||'';$('#playerName').value=x.name||'';$('#playerNumber').value=x.number||'';$('#playerPosition').value=x.position||'Arquero';$('#playerPhoto').value=x.photo||'';$('#playerStatus').value=x.status||'active';}
if(k==='noticias'){$('#newsId').value=id;$('#newsTitle').value=x.title||'';$('#newsDate').value=x.date||'';$('#newsBody').value=x.body||'';$('#newsImage').value=x.image||'';$('#newsPublished').value=String(x.published!==false);}}
function clearPlayer(){$('#playerId').value='';$('#playerForm')?.reset();renderPlayerTeamOptions();}
async function savePlayer(e){e.preventDefault();if(!allowedModule())return msg('No tienes permisos para este torneo.');const id=$('#playerId').value||key('jugador');await set(ref(db,`jugadores/${S.tid}/${id}`),{id,teamId:$('#playerTeam').value,name:$('#playerName').value.trim(),number:Number($('#playerNumber').value||0),position:$('#playerPosition').value,photo:$('#playerPhoto').value.trim(),status:$('#playerStatus').value,updatedAt:now()});clearPlayer();msg('Jugador guardado.');}
async function saveRegistration(e){e.preventDefault();if(!allowedModule())return;const id=$('#registrationId').value||key('inscripcion');await set(ref(db,`inscripciones/${S.tid}/${id}`),{id,team:$('#registrationTeam').value.trim(),delegate:$('#registrationDelegate').value.trim(),contact:$('#registrationContact').value.trim(),email:$('#registrationEmail').value.trim(),notes:$('#registrationNotes').value.trim(),status:'pending',createdAt:now()});e.target.reset();msg('Inscripción registrada como pendiente.');}
async function saveVenue(e){e.preventDefault();if(!allowedModule())return;const id=$('#venueId').value||key('sede');await set(ref(db,`sedes/${S.tid}/${id}`),{id,name:$('#venueName').value.trim(),address:$('#venueAddress').value.trim(),city:$('#venueCity').value.trim(),mapUrl:$('#venueMap').value.trim(),description:$('#venueDescription').value.trim(),updatedAt:now()});e.target.reset();msg('Sede guardada.');}
async function saveNews(e){e.preventDefault();if(!allowedModule())return;const id=$('#newsId').value||key('noticia');await set(ref(db,`noticias/${S.tid}/${id}`),{id,title:$('#newsTitle').value.trim(),date:$('#newsDate').value||new Date().toISOString().slice(0,10),body:$('#newsBody').value.trim(),image:$('#newsImage').value.trim(),published:$('#newsPublished').value==='true',updatedAt:now()});e.target.reset();msg('Noticia guardada.');}
async function saveSponsor(e){e.preventDefault();if(!allowedModule())return;const id=$('#sponsorId').value||key('patrocinador');await set(ref(db,`patrocinadores/${S.tid}/${id}`),{id,name:$('#sponsorName').value.trim(),level:$('#sponsorLevel').value,logo:$('#sponsorLogo').value.trim(),url:$('#sponsorUrl').value.trim(),updatedAt:now()});e.target.reset();msg('Patrocinador guardado.');}
async function saveAward(e){e.preventDefault();if(!allowedModule())return;const id=$('#awardId').value||key('premio');await set(ref(db,`premios/${S.tid}/${id}`),{id,name:$('#awardName').value.trim(),winner:$('#awardWinner').value.trim(),team:$('#awardTeam').value.trim(),season:$('#awardSeason').value.trim(),description:$('#awardDescription').value.trim(),updatedAt:now()});e.target.reset();msg('Premio guardado.');}
function renderActMatches(){const el=$('#minutesMatch');if(!el)return;const arr=Object.entries(S.matches||{}).filter(([,m])=>String(m.status||'').toLowerCase()==='finalizado');el.innerHTML=arr.map(([id,m])=>`<option value="${moduleEsc(id)}">${moduleEsc(teamNameForModule(m.local))} ${Number(m.homeScore||0)} - ${Number(m.awayScore||0)} ${moduleEsc(teamNameForModule(m.visitor))} · ${moduleEsc(m.dateValue||m.roundLabel||'')}</option>`).join('')||'<option value="">No hay partidos finalizados</option>';}
function printMatchAct(){
  const id=$('#minutesMatch').value;
  if(!id)return msg('No hay partido finalizado seleccionado.');

  const m=S.matches[id];
  const t=currentTournament()||{};
  const evs=Object.values(S.events?.[id]||{}).sort((a,b)=>Number(a.minute||0)-Number(b.minute||0));
  const home=S.teams?.[m.local]||{};
  const away=S.teams?.[m.visitor]||{};

  const escAct=v=>moduleEsc(v??'');
  const logo=(team,side)=>team?.logoUrl
    ? `<div class="team-logo"><img src="${escAct(team.logoUrl)}" alt=""></div>`
    : `<div class="team-logo fallback">⚽</div>`;

  const typeInfo={
    gol:{icon:'⚽',label:'Gol',cls:'goal'},
    amarilla:{icon:'🟨',label:'Tarjeta amarilla',cls:'yellow'},
    roja:{icon:'🟥',label:'Tarjeta roja',cls:'red'}
  };

  const eventRows=evs.length
    ? evs.map(e=>{
        const info=typeInfo[e.type]||{icon:'•',label:e.type||'Evento',cls:'other'};
        return `<div class="event-row">
          <div class="event-minute">${Number(e.minute||0)}'</div>
          <div class="event-icon ${info.cls}">${info.icon}</div>
          <div class="event-main"><strong>${escAct(info.label)}</strong><span>${escAct(e.player||'Jugador no indicado')}</span></div>
          <div class="event-team">${escAct(teamNameForModule(e.team))}</div>
        </div>`;
      }).join('')
    : `<div class="empty-events"><span>✓</span><div><strong>Sin incidencias registradas</strong><small>No se registraron eventos disciplinarios o goles.</small></div></div>`;

  const goals=evs.filter(e=>e.type==='gol').length;
  const yellows=evs.filter(e=>e.type==='amarilla').length;
  const reds=evs.filter(e=>e.type==='roja').length;
  const matchDate=m.dateValue||m.date||'';
  const matchTime=m.time||'';
  const location=m.venue||m.location||t.location||'';
  const group=m.group?`GRUPO ${escAct(m.group)}`:'';
  const phase=escAct(m.phase||m.roundLabel||'Partido oficial');
  const tournamentLogo=t.logoUrl
    ? `<img class="brand-logo" src="${escAct(t.logoUrl)}" alt="">`
    : `<div class="brand-logo-fallback">⚽</div>`;

  const html=`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Acta · ${escAct(t.name||'Torneo')} · ${escAct(teamNameForModule(m.local))} vs ${escAct(teamNameForModule(m.visitor))}</title>
<style>
:root{--navy:#06111d;--navy2:#0a1b2a;--panel:#102638;--line:#203c52;--muted:#7891a5;--text:#eaf3f8;--accent:#9df72d;--accent2:#c7ff72;--white:#fff}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#dfe5e9;color:#101820;font-family:Inter,Segoe UI,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{padding:28px}
.page{width:100%;max-width:980px;margin:0 auto;background:#fff;box-shadow:0 20px 55px rgba(4,15,25,.18);overflow:hidden}
.hero{background:linear-gradient(135deg,var(--navy),#0c2335 65%,#132f3f);color:var(--text);padding:24px 28px 22px;position:relative;overflow:hidden}
.hero:after{content:"";position:absolute;right:-80px;top:-100px;width:280px;height:280px;border-radius:50%;border:50px solid rgba(157,247,45,.07)}
.brand{display:flex;align-items:center;gap:14px;position:relative;z-index:1}
.brand-logo,.brand-logo-fallback{width:58px;height:58px;border-radius:15px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13);display:grid;place-items:center;object-fit:contain;padding:6px;font-size:28px}
.brand-copy{min-width:0}.eyebrow{font-size:10px;letter-spacing:2px;font-weight:900;color:var(--accent);text-transform:uppercase}.brand h1{margin:3px 0 0;font-size:22px;line-height:1.15}.brand p{margin:4px 0 0;color:#a8bfce;font-size:11px}
.acta-title{margin-top:24px;display:flex;justify-content:space-between;align-items:end;gap:20px;position:relative;z-index:1}.acta-title h2{margin:0;font-size:30px;letter-spacing:.4px}.status{border:1px solid rgba(157,247,45,.4);color:var(--accent);background:rgba(157,247,45,.08);padding:8px 12px;border-radius:999px;font-size:9px;font-weight:1000;letter-spacing:1px}
.meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;position:relative;z-index:1}.meta span{background:rgba(255,255,255,.065);border:1px solid rgba(255,255,255,.09);padding:7px 10px;border-radius:8px;color:#bdd0dc;font-size:10px}
.score-card{margin:22px 28px 0;border:1px solid #d8e1e7;border-radius:18px;overflow:hidden;background:#fff}.score-top{background:#f4f7f9;padding:10px 15px;display:flex;justify-content:space-between;color:#718696;font-size:9px;font-weight:900;letter-spacing:1px;text-transform:uppercase}.scoreboard{display:grid;grid-template-columns:1fr 180px 1fr;align-items:center;padding:25px 28px 28px;gap:20px}.team{text-align:center}.team-logo{width:78px;height:78px;border-radius:20px;margin:0 auto 11px;background:#edf2f5;border:1px solid #d8e1e7;display:grid;place-items:center;overflow:hidden}.team-logo img{width:100%;height:100%;object-fit:contain;padding:9px}.team-logo.fallback{font-size:36px}.team-name{font-size:16px;font-weight:1000;color:#102334;line-height:1.2}.team-role{margin-top:5px;font-size:8px;letter-spacing:1.3px;color:#8295a3;font-weight:900}.score-center{text-align:center}.score{font-size:48px;font-weight:1000;letter-spacing:2px;color:#071826;line-height:1}.vs{display:block;margin-top:7px;color:#91a1ad;font-size:8px;font-weight:900;letter-spacing:2px}.result-label{margin-top:12px;display:inline-block;background:#eaf7dc;color:#50771f;padding:6px 10px;border-radius:999px;font-size:8px;font-weight:1000;letter-spacing:1px}
.stats{display:grid;grid-template-columns:repeat(3,1fr);margin:0 28px 24px;border:1px solid #d8e1e7;border-radius:14px;overflow:hidden}.stat{padding:13px;text-align:center;background:#f8fafb;border-right:1px solid #e0e7eb}.stat:last-child{border-right:0}.stat strong{display:block;font-size:20px;color:#0b2130}.stat span{display:block;margin-top:3px;font-size:8px;color:#8295a3;font-weight:900;letter-spacing:.8px;text-transform:uppercase}
.content{padding:0 28px 28px}.section-head{display:flex;align-items:end;justify-content:space-between;border-bottom:2px solid #0d2535;padding-bottom:10px;margin-bottom:10px}.section-head h3{margin:0;font-size:16px;color:#102334}.section-head p{margin:3px 0 0;font-size:9px;color:#8093a1}.section-count{font-size:9px;font-weight:1000;color:#668093}
.event-row{display:grid;grid-template-columns:48px 34px 1fr 180px;align-items:center;min-height:58px;border-bottom:1px solid #e5ebee;gap:9px}.event-minute{font-size:12px;font-weight:1000;color:#193244}.event-icon{width:27px;height:27px;border-radius:8px;display:grid;place-items:center;font-size:14px;background:#f1f4f5}.event-icon.goal{background:#eaf7dc}.event-icon.yellow{background:#fff5cf}.event-icon.red{background:#ffe1e1}.event-main strong{display:block;font-size:10px;color:#1b3445}.event-main span{display:block;font-size:9px;color:#7890a0;margin-top:2px}.event-team{text-align:right;font-size:9px;font-weight:800;color:#6d8291}.empty-events{display:flex;gap:12px;align-items:center;padding:20px;border:1px dashed #cfdbe2;border-radius:12px;background:#f8fafb}.empty-events>span{width:30px;height:30px;border-radius:50%;background:#eaf7dc;color:#4e761f;display:grid;place-items:center;font-weight:1000}.empty-events strong{display:block;font-size:10px}.empty-events small{display:block;color:#8193a0;margin-top:3px;font-size:9px}
.signatures{display:grid;grid-template-columns:1fr 1fr 1fr;gap:28px;margin-top:30px}.sign{padding-top:38px;border-top:1px solid #9daeb9;text-align:center}.sign strong{display:block;font-size:9px;color:#263f50}.sign span{display:block;margin-top:3px;font-size:8px;color:#8495a1}
.footer{background:#071825;color:#90a7b7;padding:13px 28px;display:flex;justify-content:space-between;gap:15px;font-size:8px}.footer b{color:var(--accent)}
@page{size:A4;margin:10mm}
@media print{body{padding:0;background:#fff}.page{max-width:none;box-shadow:none}.hero{border-radius:0}.score-card{break-inside:avoid}.event-row{break-inside:avoid}.signatures{break-inside:avoid}.footer{break-inside:avoid}}
@media(max-width:700px){body{padding:0}.scoreboard{grid-template-columns:1fr;gap:12px}.score-center{order:-1}.team-logo{width:64px;height:64px}.event-row{grid-template-columns:42px 32px 1fr}.event-team{display:none}.signatures{grid-template-columns:1fr;gap:30px}.acta-title{align-items:start;flex-direction:column}}
</style>
</head>
<body>
<div class="page">
  <header class="hero">
    <div class="brand">${tournamentLogo}<div class="brand-copy"><div class="eyebrow">${escAct(t.season||'Temporada')} · Documento oficial</div><h1>${escAct(t.name||'Campeonato')}</h1><p>Acta oficial de partido · Plataforma de campeonatos</p></div></div>
    <div class="acta-title"><div><div class="eyebrow">Acta de partido</div><h2>${phase}</h2></div><div class="status">● FINALIZADO</div></div>
    <div class="meta">${matchDate?`<span>▦ ${escAct(matchDate)}</span>`:''}${matchTime?`<span>◷ ${escAct(matchTime)}</span>`:''}${group?`<span>${group}</span>`:''}${location?`<span>📍 ${escAct(location)}</span>`:''}</div>
  </header>

  <section class="score-card">
    <div class="score-top"><span>Resultado oficial</span><span>${escAct(m.roundLabel||'Jornada')}</span></div>
    <div class="scoreboard">
      <div class="team">${logo(home,'home')}<div class="team-name">${escAct(teamNameForModule(m.local))}</div><div class="team-role">LOCAL</div></div>
      <div class="score-center"><div class="score">${Number(m.homeScore||0)} — ${Number(m.awayScore||0)}</div><span class="vs">MARCADOR FINAL</span><span class="result-label">PARTIDO CERRADO</span></div>
      <div class="team">${logo(away,'away')}<div class="team-name">${escAct(teamNameForModule(m.visitor))}</div><div class="team-role">VISITANTE</div></div>
    </div>
  </section>

  <div class="stats">
    <div class="stat"><strong>${goals}</strong><span>Goles registrados</span></div>
    <div class="stat"><strong>${yellows}</strong><span>Amarillas</span></div>
    <div class="stat"><strong>${reds}</strong><span>Rojas</span></div>
  </div>

  <main class="content">
    <div class="section-head"><div><h3>⚡ Cronología del partido</h3><p>Registro oficial de incidencias y acciones del encuentro.</p></div><span class="section-count">${evs.length} evento${evs.length===1?'':'s'}</span></div>
    <div>${eventRows}</div>

    <div class="signatures">
      <div class="sign"><strong>Delegado / representante local</strong><span>Firma</span></div>
      <div class="sign"><strong>Árbitro / autoridad del partido</strong><span>Firma</span></div>
      <div class="sign"><strong>Delegado / representante visitante</strong><span>Firma</span></div>
    </div>
  </main>

  <footer class="footer"><span>${escAct(t.name||'Campeonato')} · ${escAct(t.season||'')}</span><span>Documento generado por <b>Campeonatos</b></span></footer>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),350)</script>
</body></html>`;

  const w=window.open('','_blank','width=1050,height=850');
  if(w){
    w.document.open();
    w.document.write(html);
    w.document.close();
  }else{
    msg('El navegador bloqueó la ventana del acta. Permite las ventanas emergentes para este sitio.');
  }
}
