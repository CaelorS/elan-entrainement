// Replaced with a content hash and an exhaustive asset list by the build script.
const CACHE='elan-static-dev';
const CORE=[];
const BASE=new URL('./',self.location.href).pathname;
const PREFIX='elan-static-'+BASE+'-';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));
let updateRequest;
self.addEventListener('message',event=>{
 if(event.data?.type==='REQUEST_UPDATE')event.waitUntil((async()=>{
  const clients=(await self.clients.matchAll({type:'window',includeUncontrolled:true})).filter(c=>new URL(c.url).pathname.startsWith(BASE));
  const requestId=crypto.randomUUID();updateRequest={requestId,pending:new Set(clients.map(c=>c.id)),safe:true};
  if(!clients.length)return self.skipWaiting();
  clients.forEach(c=>c.postMessage({type:'PREPARE_UPDATE',requestId}));
 })());
 if(event.data?.type==='UPDATE_READY'&&updateRequest?.requestId===event.data.requestId&&updateRequest.pending.has(event.source?.id)){
  updateRequest.pending.delete(event.source.id);updateRequest.safe=updateRequest.safe&&event.data.safe===true;
  if(!updateRequest.pending.size&&updateRequest.safe)event.waitUntil(self.skipWaiting());
 }
});
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(BASE))return;
 if(event.request.mode==='navigate'){
  // Keep the document and assets on the same release until a safe activation.
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(BASE))??fetch(event.request)));return;
 }
 if(!CORE.includes(url.pathname))return;
 event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))??fetch(event.request)));
});
