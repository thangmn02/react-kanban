export function readWav(buffer){const v=new DataView(buffer.buffer,buffer.byteOffset,buffer.byteLength);let p=12,f,d;
  while(p<v.byteLength){const id=buffer.toString('ascii',p,p+4),s=v.getUint32(p+4,true);if(id==='fmt ')f={fmt:v.getUint16(p+8,true),ch:v.getUint16(p+10,true),rate:v.getUint32(p+12,true),bits:v.getUint16(p+22,true)};if(id==='data')d={o:p+8,s};p+=8+s+(s&1);}
  const n=d.s/(f.bits/8)/f.ch,x=new Float32Array(n);for(let i=0;i<n;i++){let s=0;for(let c=0;c<f.ch;c++){const o=d.o+(i*f.ch+c)*f.bits/8;s+=f.fmt===3?v.getFloat32(o,true):f.bits===16?v.getInt16(o,true)/32768:v.getInt32(o,true)/2147483648;}x[i]=s/f.ch;}
  return {rate:f.rate,x};}
