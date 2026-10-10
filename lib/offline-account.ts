export type LocalAccount={user:{id:string;email?:string}};
const KEY='elan-offline-account';
export function readOfflineAccount(storage:Pick<Storage,'getItem'>):LocalAccount|null{
 try{const value=JSON.parse(storage.getItem(KEY)??'null');return typeof value?.user?.id==='string'&&/^[0-9a-f-]{36}$/i.test(value.user.id)&&typeof value.user.email==='string'?value:null}catch{return null}
}
export function rememberAccount(storage:Pick<Storage,'setItem'|'removeItem'>,account:LocalAccount|null){
 try{if(account)storage.setItem(KEY,JSON.stringify({user:{id:account.user.id,email:account.user.email??''}}));else storage.removeItem(KEY)}catch{}
}
// This identity only opens the local cache offline; it never grants API access.
