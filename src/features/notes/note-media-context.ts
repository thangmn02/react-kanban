import {createContext,useContext} from 'react';
import type {NoteMedia} from './note-media';
export const NoteMediaContext=createContext<NoteMedia|null>(null);
export const useNoteMedia=()=>useContext(NoteMediaContext);
