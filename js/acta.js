const escActa = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeName = v => String(v||'Equipo').replace(/[^a-z0-9áéíóúñü\s_-]/gi,'').trim().replace(/\s+/g,'-').slice(0,50)||'partido';

function actaData({tournament={},match={},teams={},events={}}){
  const home=teams?.[match.local]?.name||match.local||'Local';
  const away=teams?.[match.visitor]?.name||match.visitor||'Visitante';
  const evs=Object.values(events||{}).sort((a,b)=>Number(a.minute||0)-Number(b.minute||0));
  return {home,away,evs,match,goals:evs.filter(e=>String(e.type||'').toLowerCase()==='gol').length,yellow:evs.filter(e=>String(e.type||'').toLowerCase()==='amarilla').length,red:evs.filter(e=>String(e.type||'').toLowerCase()==='roja').length,tournament,teams};
}

function teamsLogo(data,id){const src=data.teams?.[id]?.logoUrl;return src?`<img class="team-logo" crossorigin="anonymous" src="${escActa(src)}" alt="">`:'<div class="team-logo fallback">⚽</div>';}

function buildActaElement(data){
  const {home,away,evs,goals,yellow,red,tournament:t,match:m}=data;
  const logo=t.logoUrl?`<img class="tlogo" crossorigin="anonymous" src="${escActa(t.logoUrl)}" alt="">`:'<div class="tlogo fallback">⚽</div>';
  const events=evs.length?evs.map(e=>{const type=String(e.type||'').toLowerCase();const icon=type==='gol'?'⚽':type==='roja'?'🟥':type==='amarilla'?'🟨':'•';return `<div class="event"><b>${e.minute!=null?escActa(e.minute)+"'":'—'}</b><span>${icon}</span><div><strong>${escActa(type==='gol'?'Gol':type==='roja'?'Tarjeta roja':type==='amarilla'?'Tarjeta amarilla':'Evento')}</strong><small>${escActa(e.player||'Jugador no indicado')} · ${escActa(e.team===m.visitor?away:home)}</small></div></div>`;}).join(''):'<div class="empty">Sin incidencias registradas.</div>';
  const el=document.createElement('div');
  el.className='acta-pdf-root';
  el.innerHTML=`<style>
  .acta-pdf-root{width:794px;background:#fff;color:#132534;font-family:Arial,Helvetica,sans-serif;padding:0;box-sizing:border-box}.acta-page{border:1px solid #d8e1e7;background:#fff}.acta-head{background:#071725;color:#edf5fa;padding:26px 30px}.brand{display:flex;align-items:center;gap:14px}.tlogo{width:58px;height:58px;border-radius:14px;object-fit:contain;background:#102638;border:1px solid #29445a;padding:6px;box-sizing:border-box}.tlogo.fallback{display:grid;place-items:center;font-size:28px}.eyebrow{font-size:10px;letter-spacing:2px;font-weight:800;color:#79c82a;text-transform:uppercase}.brand h1{font-size:24px;margin:4px 0 0}.brand p{font-size:10px;color:#9eb3c2;margin:4px 0 0}.head-row{display:flex;justify-content:space-between;align-items:end;margin-top:25px}.head-row h2{font-size:27px;margin:5px 0}.badge{font-size:9px;font-weight:900;letter-spacing:1px;color:#79c82a;border:1px solid #41622a;background:#102513;padding:8px 11px;border-radius:20px}.meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.meta span{font-size:9px;color:#bed0db;background:#102638;padding:7px 9px;border-radius:7px}.score{margin:22px 26px 0;border:1px solid #d9e2e7;border-radius:15px;overflow:hidden}.score-title{background:#f3f6f8;padding:10px 14px;font-size:9px;font-weight:900;color:#718696;display:flex;justify-content:space-between;text-transform:uppercase}.teams{display:grid;grid-template-columns:1fr 150px 1fr;align-items:center;padding:28px}.team{text-align:center}.team-logo{width:72px;height:72px;margin:auto auto 10px;border-radius:17px;background:#eef2f5;border:1px solid #d9e2e7;object-fit:contain;padding:8px;box-sizing:border-box}.team-logo.fallback{display:grid;place-items:center;font-size:34px}.team b{display:block;font-size:15px}.team small{display:block;margin-top:4px;color:#8094a2;font-size:8px;font-weight:900;letter-spacing:1px}.score-main{text-align:center;font-size:39px;font-weight:900}.score-main small{display:block;font-size:8px;color:#8193a0;letter-spacing:1px;margin-top:5px}.stats{display:grid;grid-template-columns:repeat(3,1fr);margin:18px 26px;border:1px solid #d9e2e7;border-radius:12px;overflow:hidden}.stat{text-align:center;padding:13px;background:#f8fafb;border-right:1px solid #e0e7eb}.stat:last-child{border:0}.stat b{display:block;font-size:20px}.stat span{font-size:8px;color:#8295a3;font-weight:900;text-transform:uppercase}.body{padding:0 26px 28px}.section{border-bottom:2px solid #10283a;padding-bottom:9px;margin-top:8px}.section h3{margin:0;font-size:15px}.section p{margin:3px 0 0;font-size:9px;color:#8093a0}.event{display:grid;grid-template-columns:42px 30px 1fr;gap:8px;align-items:center;border-bottom:1px solid #e6ecef;padding:11px 3px}.event>b{font-size:10px}.event>span{font-size:15px}.event strong{display:block;font-size:10px}.event small{display:block;color:#7890a0;font-size:8px;margin-top:2px}.empty{padding:20px;background:#f8fafb;border:1px dashed #cfdbe2;border-radius:10px;color:#7b8f9c;font-size:10px;margin-top:10px}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:25px;margin-top:40px}.sign{border-top:1px solid #9caeb9;text-align:center;padding-top:38px;font-size:9px;font-weight:800}.sign small{display:block;color:#8495a1;font-size:8px;margin-top:3px}.foot{background:#071725;color:#91a8b7;padding:12px 26px;font-size:8px;display:flex;justify-content:space-between}.foot b{color:#79c82a}
  </style><div class="acta-page"><header class="acta-head"><div class="brand">${logo}<div><div class="eyebrow">${escActa(t.season||'Temporada')} · Documento oficial</div><h1>${escActa(t.name||'Campeonato')}</h1><p>Acta oficial de partido · Plataforma de campeonatos</p></div></div><div class="head-row"><div><div class="eyebrow">Acta de partido</div><h2>${escActa(m.phase||m.roundLabel||'Partido oficial')}</h2></div><span class="badge">● FINALIZADO</span></div><div class="meta">${m.dateValue?`<span>▦ ${escActa(m.dateValue)}</span>`:''}${m.time?`<span>◷ ${escActa(m.time)}</span>`:''}${m.group?`<span>GRUPO ${escActa(m.group)}</span>`:''}${(m.venue||m.location||t.location)?`<span>📍 ${escActa(m.venue||m.location||t.location)}</span>`:''}</div></header><section class="score"><div class="score-title"><span>Resultado oficial</span><span>${escActa(m.roundLabel||'Jornada')}</span></div><div class="teams"><div class="team">${teamsLogo(data,m.local)}<b>${escActa(home)}</b><small>LOCAL</small></div><div class="score-main">${Number(m.homeScore||0)} — ${Number(m.awayScore||0)}<small>MARCADOR FINAL</small></div><div class="team">${teamsLogo(data,m.visitor)}<b>${escActa(away)}</b><small>VISITANTE</small></div></div></section><div class="stats"><div class="stat"><b>${goals}</b><span>Goles registrados</span></div><div class="stat"><b>${yellow}</b><span>Amarillas</span></div><div class="stat"><b>${red}</b><span>Rojas</span></div></div><main class="body"><div class="section"><h3>⚡ Cronología del partido</h3><p>Registro oficial de incidencias y acciones del encuentro.</p></div>${events}<div class="signatures"><div class="sign">Delegado / representante local<small>Firma</small></div><div class="sign">Árbitro / autoridad del partido<small>Firma</small></div><div class="sign">Delegado / representante visitante<small>Firma</small></div></div></main><footer class="foot"><span>${escActa(t.name||'Campeonato')} · ${escActa(t.season||'')}</span><span>Documento generado por <b>Campeonatos</b></span></footer></div>`;
  return el;
}

async function waitForActaRender(el){
  if(document.fonts?.ready) try{await document.fonts.ready;}catch{}
  const imgs=[...el.querySelectorAll('img')];
  await Promise.all(imgs.map(img=>new Promise(resolve=>{
    if(img.complete){resolve();return;}
    img.onload=resolve;img.onerror=resolve;setTimeout(resolve,3000);
  })));
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
}

export async function downloadMatchActPDF({tournament,match,teams,events}){
  if(!match || String(match.status||'').toLowerCase()!=='finalizado')
    throw new Error('El acta solo puede descargarse cuando el partido está finalizado.');

  const data=actaData({tournament,match,teams,events});
  const el=buildActaElement(data);
  const css=[...el.querySelectorAll('style')].map(x=>x.textContent).join('\n');
  const content=el.querySelector('.acta-page')?.outerHTML || el.innerHTML;
  const title=`Acta-${safeName(data.home)}-vs-${safeName(data.away)}`;

  // No abrimos una ventana nueva: usamos un iframe oculto para evitar
  // bloqueadores de pop-ups. El navegador muestra su diálogo nativo de
  // impresión y desde allí se puede seleccionar "Guardar como PDF".
  const iframe=document.createElement('iframe');
  iframe.setAttribute('aria-hidden','true');
  iframe.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;top:-10000px;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escActa(title)}</title><style>${css}
  html,body{margin:0;padding:0;background:#fff}
  @page{size:A4 portrait;margin:7mm}
  body{display:flex;justify-content:center}
  .acta-pdf-root{margin:0!important}
  @media print{body{display:block}.acta-pdf-root{width:794px!important}}
  </style></head><body><div class="acta-pdf-root">${content}</div></body></html>`;

  try{
    const doc=iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();

    await new Promise(resolve=>{
      const finish=()=>setTimeout(resolve,250);
      if(doc.readyState==='complete') finish();
      else iframe.addEventListener('load',finish,{once:true});
    });

    const imgs=[...doc.images];
    await Promise.all(imgs.map(img=>new Promise(resolve=>{
      if(img.complete){resolve();return;}
      img.onload=resolve; img.onerror=resolve; setTimeout(resolve,3000);
    })));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    return `${title}.pdf`;
  } finally {
    // Se elimina después de dar tiempo al navegador a abrir el diálogo.
    setTimeout(()=>iframe.remove(),1500);
  }
}
