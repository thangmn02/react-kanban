import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n';
import LinkPreviewPanel from '../components/organisms/LinkPreviewPanel';
import { embedUrlFor } from './linkEmbed';

afterEach(cleanup);

it('maps documents, designs and boards to the address their service offers for embedding', () => {
  expect(embedUrlFor('https://docs.google.com/document/d/AbC_12-x/edit?usp=sharing')).toBe('https://docs.google.com/document/d/AbC_12-x/preview');
  expect(embedUrlFor('https://docs.google.com/spreadsheets/d/SHEET/edit#gid=0')).toBe('https://docs.google.com/spreadsheets/d/SHEET/preview');
  expect(embedUrlFor('https://docs.google.com/presentation/d/DECK/edit')).toBe('https://docs.google.com/presentation/d/DECK/preview');
  expect(embedUrlFor('https://www.figma.com/design/KEY123/My-file?node-id=1-2'))
    .toBe('https://www.figma.com/embed?embed_host=kora&url=' + encodeURIComponent('https://www.figma.com/design/KEY123/My-file?node-id=1-2'));
  expect(embedUrlFor('https://miro.com/app/board/uXjVabc=/')).toBe('https://miro.com/app/live-embed/uXjVabc=/');
});

it('frames nothing else', () => {
  for (const link of ['http://docs.google.com/document/d/x/edit', 'https://example.com/page', 'https://docs.google.com/forms/d/x', 'https://docs.google.com.evil.test/document/d/x/edit',
    'https://evil.test/?u=https://docs.google.com/document/d/x/edit', 'javascript:alert(1)', 'not a url', 'https://miro.com/login', 'https://figma.com/community']) expect(embedUrlFor(link)).toBeNull();
});

it('shows the document in a sandboxed frame with a way out and a way back', () => {
  const onClose = vi.fn();
  const view = render(<I18nProvider><LinkPreviewPanel name="Spec" url="https://docs.google.com/document/d/x/edit" embedUrl="https://docs.google.com/document/d/x/preview" onClose={onClose} /></I18nProvider>);
  const frame = view.container.querySelector('iframe')!;
  expect(frame.getAttribute('src')).toBe('https://docs.google.com/document/d/x/preview');
  expect(frame.getAttribute('sandbox')).not.toContain('allow-top-navigation');
  expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
  expect(frame.getAttribute('title')).toBe('Spec');
  expect(screen.getByRole('link', { name: 'Open in new tab' }).getAttribute('href')).toBe('https://docs.google.com/document/d/x/edit');
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledOnce();
});
