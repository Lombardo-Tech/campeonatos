const CACHE = 'campeonatos-v96';
const ASSETS = ['index.html','inicio.html','registro.html','cuenta.html','crear-torneo.html','pago.html','css/style.css','js/firebase.js','js/saas.js','js/locations.js','manifest.webmanifest','img/favicon-192.png','img/favicon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.protocol!=='http:'&&url.protocol!=='https:') return;
  const isAppAsset=url.origin===self.location.origin && (url.pathname.endsWith('.js')||url.pathname.endsWith('.css')||url.pathname.endsWith('.html'));
  if(isAppAsset){e.respondWith(fetch(e.request,{cache:'no-store'}).then(response=>{if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy).catch(()=>{}));}return response;}).catch(()=>caches.match(e.request)));return;}
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(response=>{if(response&&response.status===200){const copy=response.clone();caches.open(CACHE).then(c=>c.put(e.request,copy).catch(()=>{}));}return response;}).catch(()=>caches.match('inicio.html'))));
});
