import { expect, it } from 'vitest';
import { safeNoteHtml } from './safe-note-html';
it('retains rich text while dropping executable nodes, event attributes and unsafe image/link capabilities', () => {
  const html = safeNoteHtml('<h2>Heading</h2><p><u>Keep</u><strong>bold</strong><a href="javascript:alert(1)" onclick="alert(2)">bad</a><a href="https://example.com">good</a></p><script>bad()</script><iframe src="https://example.com"></iframe><img src="data:image/png;base64,large"><img data-kora-note-image="b8657168-ec29-4196-9229-9721e418193d" src="https://private.example/image?token=secret">');
  expect(html).toContain('<h2>Heading</h2>'); expect(html).toContain('<u>Keep</u>'); expect(html).toContain('href="https://example.com"');
  expect(html).not.toMatch(/javascript:|onclick|<script|<iframe|base64|token=secret/);
  expect(html).toContain('data-kora-note-image=');
});
