import {useI18n} from '../../i18n';

/** Where the note came from: the linked task (× unlinks it) or Kora itself. */
export default function NoteSourceChip({title,onOpen,onUnlink}:{title?:string;onOpen?:()=>void;onUnlink?:()=>void}){
  const {t}=useI18n();
  if(!title)return <p className="flex text-xs"><span data-note-source="kora" className="rounded-full bg-black/5 px-2 py-0.5">{t('notes.quick.sourceKora')}</span></p>;
  return <p className="flex text-xs"><span data-note-source="task" className="inline-flex max-w-full items-center gap-1 rounded-full bg-black/5 py-0.5 pl-2">{onOpen?<button type="button" aria-label={t('notes.k.linkedTask',{title})} className="truncate underline-offset-2 hover:underline" onClick={onOpen}>{title}</button>:<span className="truncate" title={t('notes.k.linkedTask',{title})}>{title}</span>}{onUnlink&&<button type="button" aria-label={t('notes.k.unlinkTask')} className="min-h-6 rounded-full px-1.5 hover:bg-black/10" onClick={onUnlink}>×</button>}</span></p>;
}
