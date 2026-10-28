import { useEffect,useRef,useState } from 'react';
import { useI18n } from '../../i18n';
import { DEFAULT_IDENTITY_IMAGE } from '../../services/profile.service';
import { avatarCropGeometry,validateProfileImage,type AvatarCrop } from '../../utils/profile-image';
import { motion,useReducedMotion } from 'framer-motion';
import { uiFade } from '../../shared/motion';

export default function AvatarEditor({src,value,onChange,onBusy}:{src:string;value:AvatarCrop|null|undefined;onChange:(value:AvatarCrop|null)=>void;onBusy:(busy:boolean)=>void}){
  const {t}=useI18n();const reduced=useReducedMotion();const [file,setFile]=useState<File|null>(null);const [error,setError]=useState('');
  const callbacks=useRef({onChange,onBusy});useEffect(()=>{callbacks.current={onChange,onBusy};},[onChange,onBusy]);
  useEffect(()=>{
    if(!file)return;let active=true,url='';
    void validateProfileImage(file).then(async()=>{url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();if(active)callbacks.current.onChange({image,zoom:1,x:0,y:0});})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Image could not be opened.');})
      .finally(()=>{if(active)callbacks.current.onBusy(false);});
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[file]);
  const rect=value?avatarCropGeometry(value):null;
  const drag=useRef<{id:number;x:number;y:number;crop:AvatarCrop}|null>(null);
  return <fieldset className="space-y-3"><legend className="text-sm font-semibold text-slate-800">{t('settings.avatar')}</legend>
    <div className="relative mx-auto h-60 w-60 touch-none overflow-hidden rounded-2xl border border-slate-200 bg-slate-100" aria-label={t('settings.imagePreview')}
      onPointerDown={event=>{if(!value)return;drag.current={id:event.pointerId,x:event.clientX,y:event.clientY,crop:value};event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{const start=drag.current;if(!start||start.id!==event.pointerId)return;const geometry=avatarCropGeometry(start.crop);onChange({...start.crop,x:Math.max(-1,Math.min(1,start.crop.x+(geometry.width>240?2*(event.clientX-start.x)/(geometry.width-240):0))),y:Math.max(-1,Math.min(1,start.crop.y+(geometry.height>240?2*(event.clientY-start.y)/(geometry.height-240):0)))});}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}>
      <motion.div key={value?.image.src||src} className="absolute inset-0" initial={reduced?false:{opacity:0}} animate={{opacity:1}} transition={reduced?{duration:0}:uiFade}>
      {value&&rect ? <img src={value.image.src} alt={t('settings.imagePreview')} draggable={false} className="absolute max-w-none" style={rect}/>
        : <img src={value===null?DEFAULT_IDENTITY_IMAGE:src||DEFAULT_IDENTITY_IMAGE} alt={t('settings.imagePreview')} className="h-full w-full object-cover" onError={event=>{event.currentTarget.src=DEFAULT_IDENTITY_IMAGE;event.currentTarget.onerror=null;}}/>}
      </motion.div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-slate-900/10"/>
    </div>
    <label className="block text-xs font-medium text-slate-600">{t('settings.chooseImage')}<input type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full text-sm" onChange={event=>{const next=event.target.files?.[0];if(next){onBusy(true);setError('');setFile(next);}event.target.value='';}}/></label>
    <p className="text-xs text-slate-500">{t('settings.imageHint')}</p>
    {value&&(['zoom','x','y'] as const).map(key=><label key={key} className="flex items-center gap-3 text-xs text-slate-600"><span className="w-24">{t(`settings.crop.${key}`)}</span><input className="min-w-0 flex-1" aria-label={t(`settings.crop.${key}`)} type="range" min={key==='zoom'?1:-1} max={key==='zoom'?3:1} step="0.01" value={value[key]} onChange={event=>onChange({...value,[key]:Number(event.target.value)})}/></label>)}
    <button type="button" onClick={()=>{setFile(null);onBusy(false);onChange(null);setError('');}} className="min-h-10 cursor-pointer rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">{t('settings.restoreImage')}</button>
    {error&&<p role="alert" className="text-sm text-rose-700">{error}</p>}
  </fieldset>;
}
