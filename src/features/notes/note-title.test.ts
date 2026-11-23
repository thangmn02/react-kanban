import { expect, it } from 'vitest';
import { bodyPatch, firstNoteLine, hasAutomaticTitle } from './note-title';

it('names an untitled note after its first line and keeps following it', () => {
  expect(bodyPatch({ title: '', html: '' }, '<p>Call the printer</p><p>About the invoice</p>')).toEqual({ html: '<p>Call the printer</p><p>About the invoice</p>', title: 'Call the printer' });
  expect(bodyPatch({ title: 'Call', html: '<p>Call</p>' }, '<p>Call Minh</p>')).toEqual({ html: '<p>Call Minh</p>', title: 'Call Minh' });
});
it('never replaces a title someone wrote', () => {
  expect(bodyPatch({ title: 'Shopping', html: '<p>Milk</p>' }, '<p>Eggs</p>')).toEqual({ html: '<p>Eggs</p>' });
  expect(hasAutomaticTitle({ title: 'Shopping', html: '<p>Milk</p>' })).toBe(false);
});
it('empties the title with the body, so the note still counts as empty', () => {
  expect(bodyPatch({ title: 'Call', html: '<p>Call</p>' }, '<p></p>')).toEqual({ html: '<p></p>', title: '' });
});
it('limits a long first line and still recognises it as automatic', () => {
  const html = `<p>${'a'.repeat(400)}</p>`, title = firstNoteLine(html);
  expect(title).toHaveLength(160);
  expect(hasAutomaticTitle({ title, html })).toBe(true);
});
