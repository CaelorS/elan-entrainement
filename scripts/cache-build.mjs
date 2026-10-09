import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../dist/client/',import.meta.url);
async function walk(dir){let out=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){if(e.name.startsWith('.'))continue;const p=dir+e.name;if(e.isDirectory())out.push(...await walk(p+'/'));else if(/\.(js|css|json|svg|png|m4a|webmanifest|woff2?)$/.test(p)&&p!=='sw.js')out.push('/'+p)}return out}
const assets=await walk('');const hash=createHash('sha256').update(JSON.stringify(assets)).update(await readFile(new URL('../app/page.tsx',import.meta.url))).digest('hex').slice(0,12);let sw=await readFile(new URL('../public/sw.js',import.meta.url),'utf8');sw=sw.replace("const CACHE='elan-v1';",`const CACHE='elan-${hash}';`).replace(/const CORE=\[[^;]+;/,`const CORE=${JSON.stringify(['/',...assets])};`);await writeFile(new URL('sw.js',root),sw);console.log(`Offline cache: ${assets.length} assets, ${hash}`);
