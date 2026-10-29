export const frozenPercussionSha256='c571062d76c322d54c2808c95339ea2dadd2f6ab99f9d83163d0f5311cd0f80a';
/** Fail closed on unavailable/stale/corrupt models before ONNX initializes. */
export async function loadFrozenPercussionModel(url,config){
 if(config.sha256!==frozenPercussionSha256)throw Error('Frozen percussion model identity mismatch');
 const response=await fetch(url,{credentials:'omit',redirect:'error'});
 if(!response.ok)throw Error('Frozen percussion model unavailable');
 const bytes=await response.arrayBuffer();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),value=>value.toString(16).padStart(2,'0')).join('');
 if(digest!==frozenPercussionSha256)throw Error('Frozen percussion model content mismatch');
 return bytes;
}
