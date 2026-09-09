import { $, guardPage, getOwnedTournaments, logout, esc } from './saas.js';
import { db } from './firebase.js';
import { ref, onValue, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js';

let currentUid='';
guardPage({onUser:u=>{
  currentUid=u.uid;
  $('#welcome').textContent=`Hola, ${u.displayName||u.email}.`;
  onValue(query(ref(db,'tournaments'),orderByChild('ownerUid'),equalTo(u.uid)),snap=>render(snap.val()||{}));
}});
$('#logout').addEventListener('click',logout);

function render(data){
  const entries=Object.entries(data);
  $('#cards').innerHTML=entries.map(([id,t])=>{
    const paid=t.paymentStatus==='paid';
    const submitted=t.paymentStatus==='pending_transfer' || t.paymentStatus==='pending_review';
    const closed=t.status==='finished';
    let paymentLabel='PAGO PENDIENTE';
    let paymentClass='pending';
    if(paid){ paymentLabel='PAGADO'; paymentClass='ok'; }
    else if(submitted){ paymentLabel='PAGO REALIZADO · EN REVISIÓN'; paymentClass='review'; }
    return `<article class="account-card">
      <div class="account-status ${paymentClass}">${paymentLabel}</div>
      <h3>${esc(t.name||'Sin nombre')}</h3>
      <p>${esc([t.province,t.canton,t.parish].filter(Boolean).join(' · '))}</p>
      <div class="account-meta"><span>Temporada <b>${esc(t.season||'')}</b></span><span>Estado <b>${closed?'FINALIZADO':t.status==='active'?'ACTIVO':'BORRADOR'}</b></span></div>
      ${paid?`<div class="pay-box payment-confirmed"><strong>✓</strong><div><small>Publicación de un torneo</small><b>Pago confirmado</b></div></div>`:''}
      ${submitted?`<div class="pay-box payment-review"><strong>✓</strong><div><small>Comprobante enviado</small><b>Tu pago está siendo revisado</b><span>Te notificaremos al confirmar la transferencia.</span></div></div>`:''}
      ${!paid&&!submitted?`<div class="pay-box"><strong>$20</strong><div><small>Publicación de un torneo</small><a class="ghost-btn pay-btn" href="pago.html?tid=${encodeURIComponent(id)}">Opciones de pago</a></div></div>`:''}
    </article>`;
  }).join('')||'<div class="empty">Todavía no tienes torneos. Crea el primero.</div>';
}
