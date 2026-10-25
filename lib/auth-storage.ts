// The choice and temporary credentials live in the tab's session storage.
// No password is stored. Persistent mode keeps the existing Supabase storage key.
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const MODE='elan-auth-session-only';
const IDENTITY='elan-offline-account';
export function createAuthStorage(local:Store,temporary:Store,authKey:string){
 const sessionOnly=()=>temporary.getItem(MODE)==='1';
 const selected=()=>sessionOnly()?temporary:local;
 return {
  getItem:(key:string)=>selected().getItem(key),
  setItem:(key:string,value:string)=>{selected().setItem(key,value);(sessionOnly()?local:temporary).removeItem(key)},
  removeItem:(key:string)=>{local.removeItem(key);temporary.removeItem(key)},
  configure:(remember:boolean)=>{
   if(remember)temporary.removeItem(MODE);else temporary.setItem(MODE,'1');
   // Remove only this app's prior authentication and offline identity from the other store.
   const other=remember?temporary:local;
   for(const key of [authKey,authKey+'-user',authKey+'-code-verifier',IDENTITY])other.removeItem(key);
  },
  identityStorage:selected,
  clearIdentity:()=>{local.removeItem(IDENTITY);temporary.removeItem(IDENTITY)}
 };
}
