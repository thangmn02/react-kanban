import type {ReactNode} from 'react';
import type {NoteMedia} from './note-media';
import {NoteMediaContext} from './note-media-context';
export function NoteMediaProvider({media,children}:{media:NoteMedia|null;children:ReactNode}){return <NoteMediaContext.Provider value={media}>{children}</NoteMediaContext.Provider>;}
