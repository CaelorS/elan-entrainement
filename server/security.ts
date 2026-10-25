export function validMcpClaims(c:Record<string,unknown>|undefined,issuer:string,now=Math.floor(Date.now()/1000)){
 return !!c&&c.iss===issuer&&c.aud==='authenticated'&&c.role==='authenticated'&&typeof c.client_id==='string'&&c.client_id.length>0&&typeof c.sub==='string'&&typeof c.iat==='number'&&c.iat<=now+60&&typeof c.exp==='number'&&c.exp>now;
}
export async function boundedBody(req:Request,max:number){
 const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
 if(reader)for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error('request_too_large')}chunks.push(value)}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}return bytes;
}
