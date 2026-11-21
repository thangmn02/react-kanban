import { describe, expect, it } from 'vitest';
import { isSafeLinkUrl } from './safeLinkUrl';

describe('isSafeLinkUrl', () => {
  it('accepts web addresses', () => {
    expect(isSafeLinkUrl('https://docs.google.com/document/d/abc')).toBe(true);
    expect(isSafeLinkUrl('http://example.com')).toBe(true);
    expect(isSafeLinkUrl('  https://example.com  ')).toBe(true);
  });

  it('rejects scripts, data and other schemes', () => {
    for (const value of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox', 'file:///C:/Windows', 'tauri://localhost', 'example.com', '']) {
      expect(isSafeLinkUrl(value)).toBe(false);
    }
  });
});
