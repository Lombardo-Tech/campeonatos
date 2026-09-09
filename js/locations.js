const DATA_URL='https://raw.githubusercontent.com/GAumala/geografia.ec/main/provincias.json';
const FALLBACK=['Azuay','Bolívar','Cañar','Carchi','Chimborazo','Cotopaxi','El Oro','Esmeraldas','Galápagos','Guayas','Imbabura','Loja','Los Ríos','Manabí','Morona Santiago','Napo','Orellana','Pastaza','Pichincha','Santa Elena','Santo Domingo de los Tsáchilas','Sucumbíos','Tungurahua','Zamora Chinchipe'].map(nombre=>({nombre,cantones:[]}));
export let ECUADOR=[];
export async function loadEcuador(){if(ECUADOR.length)return ECUADOR;try{const r=await fetch(DATA_URL,{cache:'force-cache'});if(!r.ok)throw new Error('geo');const d=await r.json();if(Array.isArray(d))ECUADOR=d;}catch{ECUADOR=FALLBACK;}return ECUADOR;}
export function provinceNames(){return ECUADOR.map(x=>x.nombre).sort((a,b)=>a.localeCompare(b,'es'));}
export function findProvince(name){return ECUADOR.find(p=>norm(p.nombre)===norm(name));}
export function findCanton(prov,name){return findProvince(prov)?.cantones?.find(c=>norm(c.nombre)===norm(name));}
export function norm(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();}
export function fillSelect(select, items, placeholder='Seleccionar'){select.innerHTML=`<option value="">${placeholder}</option>`+items.map(x=>`<option value="${escLocal(x)}">${escLocal(x)}</option>`).join('');}
function escLocal(v){return String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
