import {Node,ReactNodeViewRenderer} from '@tiptap/react';
import NoteImageView from './note-image-view';

export const NoteImageNode = Node.create({
  name: 'noteImage', group: 'block', atom: true, draggable: true,
  addAttributes() { return { imageId: { default: null, parseHTML: element => element.getAttribute('data-kora-note-image') }, width: { default: 280, parseHTML: element => Math.max(80, Math.min(840, Number(element.getAttribute('width')) || 280)) }, alt: { default: '', parseHTML: element => (element.getAttribute('alt') || '').slice(0, 300) } }; },
  parseHTML() { return [{ tag: 'img[data-kora-note-image]' }]; },
  renderHTML({ HTMLAttributes }) { return ['img', { 'data-kora-note-image': HTMLAttributes.imageId, width: Math.max(80, Math.min(840, Number(HTMLAttributes.width) || 280)), alt: String(HTMLAttributes.alt || '').slice(0, 300) }]; },
  addNodeView() { return ReactNodeViewRenderer(NoteImageView); },
});
