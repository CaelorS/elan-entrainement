import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/',import.meta.url),base='/elan-entrainement/';
async function walk(dir=''){let out=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+e.name;if(e.isDirectory())out.push(...await walk(p+'/'));else if(!['sw.js','version.json','.nojekyll'].includes(p)&&!/^app-shell-[a-f0-9]+\.html$/.test(p))out.push(p)}return out.sort()}
const files=await walk(),hash=createHash('sha256');
for(const file of files){hash.update(file);hash.update(await readFile(new URL(file,root)))}
const template=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');hash.update(template);
// A mutable index URL can briefly return the previous deployment through a CDN.
// Cache an immutable HTML URL together with the assets from that exact build.
const version=hash.digest('hex').slice(0,16),shell='app-shell-'+version+'.html';
await writeFile(new URL(shell,root),await readFile(new URL('index.html',root)));
const assets=[base+shell,...files.filter(f=>f!=='index.html').map(f=>base+f)];
await writeFile(new URL('sw.js',root),template.replace("const CACHE='elan-static-dev';",`const CACHE=${JSON.stringify('elan-static-'+base+'-'+version)};`).replace("const SHELL='';",`const SHELL=${JSON.stringify(base+shell)};`).replace('const CORE=[];',`const CORE=${JSON.stringify(assets)};`));
await writeFile(new URL('version.json',root),JSON.stringify({version,commit:process.env.GITHUB_SHA??null}));
await writeFile(new URL('.nojekyll',root),'');console.log(`PWA: ${files.length} assets, release ${version}`);
