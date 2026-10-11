// Prepare a private, insert-only SQL import after an account has been invited/created.
// Run locally: node scripts/prepare-profile.mjs backup.json email@example.com output.sql
import {readFile,writeFile} from 'node:fs/promises';
import {programSchema} from '../lib/backup.ts';
const [file,email,output]=process.argv.slice(2);
if(!file||!email||!output||!email.includes('@'))throw Error('Usage: node --experimental-strip-types scripts/prepare-profile.mjs backup.json email output.sql');
const backup=JSON.parse(await readFile(file,'utf8'));
const program=programSchema.parse(backup.program);
const json=JSON.stringify(program),tag='$elan_profile$';
if(json.includes(tag)||json.includes('$setup$')||email.includes('$setup$'))throw Error('Unexpected SQL delimiter in programme');
const escaped=email.trim().toLowerCase().replaceAll("'","''");
const sql=`-- Private programme. Do not commit this file to GitHub.
do $setup$
declare account_id uuid;
begin
 select id into account_id from auth.users where lower(email)='${escaped}';
 if account_id is null then raise exception 'Create or invite the account first'; end if;
 insert into public.elan_programs(user_id,payload,revision)
 values(account_id,${tag}${json}${tag}::jsonb,1)
 on conflict(user_id) do nothing;
end;
$setup$;
select jsonb_array_length(p.payload->'modeles') as programmes_prepares
from public.elan_programs p join auth.users u on p.user_id=u.id
where lower(u.email)='${escaped}';
`;
await writeFile(output,sql,{mode:0o600});
console.log('Private import prepared. Existing programmes will not be overwritten.');
