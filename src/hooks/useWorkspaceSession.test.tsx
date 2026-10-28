import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {useWorkspaceSession} from './useWorkspaceSession';

const mocks=vi.hoisted(()=>({fetch:vi.fn()}));
vi.mock('../services/workspace.service',()=>({ensureUserProfile:async()=>{},fetchUserWorkspaces:mocks.fetch,createWorkspaceForCurrentUser:vi.fn()}));
const user={id:'workspace-session-test',name:'Reader',email:null,avatarUrl:'',isMock:false};
beforeEach(()=>{localStorage.clear();mocks.fetch.mockReset();});afterEach(cleanup);
it('returns refreshed membership rows so guarded transitions can validate their destination',async()=>{
  mocks.fetch.mockResolvedValue([{id:'workspace-a',name:'Original',role:'owner'}]);const {result}=renderHook(()=>useWorkspaceSession(user));
  await waitFor(()=>expect(result.current.isWorkspaceLoading).toBe(false));
  const rows=[{id:'workspace-a',name:'Original',role:'owner'},{id:'workspace-b',name:'Accepted',role:'member'}];mocks.fetch.mockResolvedValue(rows);
  let refreshed;await act(async()=>{refreshed=await result.current.reloadWorkspaces();});expect(refreshed).toEqual(rows);expect(result.current.activeWorkspaceId).toBe('workspace-a');
});
it('returns an explicit failed reload while preserving the current workspace',async()=>{
  mocks.fetch.mockResolvedValue([{id:'workspace-a',name:'Original',role:'owner'}]);const {result}=renderHook(()=>useWorkspaceSession(user));
  await waitFor(()=>expect(result.current.isWorkspaceLoading).toBe(false));mocks.fetch.mockRejectedValue(Error('Membership fetch unavailable'));
  let refreshed;await act(async()=>{refreshed=await result.current.reloadWorkspaces();});expect(refreshed).toBeNull();expect(result.current.activeWorkspaceId).toBe('workspace-a');expect(result.current.workspaceErrorMessage).toBe('Membership fetch unavailable');
});
