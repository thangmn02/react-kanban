import { describe, expect, it } from 'vitest';
import { authDestination, readReturnTo, safeReturnTo } from './auth-routing';

describe('authentication destinations', () => {
  it('preserves a feature URL including query and fragment across reload', () => {
    const path = '/workspaces/w/boards/b?filter=due%20today#task';
    const auth = new URL(authDestination(path), 'https://koraspace.online');
    expect(readReturnTo(auth.search)).toBe(path);
  });
  it.each(['https://outside.example', '//outside.example', '/%2foutside.example', '/\\outside.example',
    '/%5coutside.example', '/auth/sign-in', '/%61uth/sign-in', '/onboarding', '/tasks%0d%0a', '/%zz'])(
  'rejects unsafe or recursive destination %s', destination => {
    expect(safeReturnTo(destination)).toBe('/');
  });
  it('accepts older router state, with query taking precedence', () => {
    expect(readReturnTo('', { returnTo: '/today' })).toBe('/today');
    expect(readReturnTo('?returnTo=%2Fbeat-grid', { returnTo: '/today' })).toBe('/beat-grid');
    expect(readReturnTo('')).toBe('/');
  });
});
