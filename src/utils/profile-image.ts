export interface AvatarCrop { image:HTMLImageElement; zoom:number; x:number; y:number }
export async function validateProfileImage(file:File) {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('Choose PNG, JPEG or WebP up to 5 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);
  let width=0,height=0,type='';
  if(bytes.length>=24&&bytes[0]===137&&String.fromCharCode(...bytes.slice(1,4))==='PNG') {type='image/png';width=view.getUint32(16);height=view.getUint32(20);}
  else if(bytes[0]===255&&bytes[1]===216){
    type='image/jpeg';let offset=2;
    while(offset+8<bytes.length){if(bytes[offset++]!==255)break;while(bytes[offset]===255)offset++;const marker=bytes[offset++];if(marker===0xda||marker===0xd9)break;
      const length=view.getUint16(offset);if(length<2||offset+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){height=view.getUint16(offset+3);width=view.getUint16(offset+5);break;}offset+=length;}
  } else if(bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'){
    type='image/webp';const chunk=String.fromCharCode(...bytes.slice(12,16));
    if(chunk==='VP8X'){if(bytes[20]&2)throw new Error('Choose a still image.');width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
    else if(chunk==='VP8L'){const bits=view.getUint32(21,true);width=1+(bits&0x3fff);height=1+((bits>>>14)&0x3fff);}
    else if(chunk==='VP8 '){width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
  }
  if(type!==file.type||!width||!height||width*height>40000000||width>16000||height>16000)throw new Error('This image cannot be processed safely. Choose a smaller valid image.');
  return {width,height};
}
export function avatarCropGeometry(crop:AvatarCrop,size=240){
  const scale=Math.max(size/crop.image.naturalWidth,size/crop.image.naturalHeight)*Math.max(1,Math.min(3,crop.zoom));
  const width=crop.image.naturalWidth*scale,height=crop.image.naturalHeight*scale;
  return {width,height,left:(size-width)/2+Math.max(-1,Math.min(1,crop.x))*(width-size)/2,top:(size-height)/2+Math.max(-1,Math.min(1,crop.y))*(height-size)/2};
}
export async function renderAvatarCrop(crop:AvatarCrop):Promise<Blob>{
  const size=512,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const context=canvas.getContext('2d');if(!context)throw new Error('Image editing is unavailable in this browser.');
  const rect=avatarCropGeometry(crop,size);context.fillStyle='#fff';context.fillRect(0,0,size,size);context.drawImage(crop.image,rect.left,rect.top,rect.width,rect.height);
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image processing failed.')),'image/jpeg',0.85));
}
