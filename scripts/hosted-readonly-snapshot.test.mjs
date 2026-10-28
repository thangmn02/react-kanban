// @vitest-environment node
import {EventEmitter} from 'node:events';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {hostedReadOnlySnapshot} from './hosted-readonly-snapshot.mjs';
const mocks=vi.hoisted(()=>({spawn:vi.fn(),stop:vi.fn(),writeFile:vi.fn()}));
vi.mock('node:child_process',()=>({spawn:mocks.spawn,spawnSync:mocks.stop}));
vi.mock('node:fs/promises',()=>({writeFile:mocks.writeFile}));
let child;
beforeEach(()=>{
  vi.resetAllMocks();child=new EventEmitter();child.pid=123;child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();child.kill=vi.fn();
  child.stdin.write=vi.fn(()=>queueMicrotask(()=>child.stdout.emit('data',Buffer.from('00000001-00000001-1\n'))));
  child.stdin.end=vi.fn(()=>queueMicrotask(()=>child.emit('exit',0)));mocks.spawn.mockReturnValue(child);mocks.writeFile.mockResolvedValue(undefined);
});
afterEach(()=>vi.useRealTimers());
const options={dockerArgs:['postgres-image'],env:{},evidence:'private-evidence'};
it('owns and closes the snapshot when recording its process fails',async()=>{
  mocks.writeFile.mockRejectedValue(Error('Private evidence write failed'));
  await expect(hostedReadOnlySnapshot(options)).rejects.toThrow('Private evidence write failed');
  expect(child.stdin.end).toHaveBeenCalledWith('rollback;\n');expect(mocks.stop).not.toHaveBeenCalled();
});
it('handles an early child failure while process evidence is being recorded',async()=>{
  mocks.writeFile.mockImplementation(async()=>{child.emit('error',Error('Spawn failed'));});
  await expect(hostedReadOnlySnapshot(options)).rejects.toThrow('exited before setup');
  expect(child.stdin.write).not.toHaveBeenCalled();
});
it('exports one snapshot and ends its transaction during normal cleanup',async()=>{
  const snapshot=await hostedReadOnlySnapshot(options);expect(snapshot.id).toBe('00000001-00000001-1');
  expect(child.stdin.write).toHaveBeenCalledWith(expect.stringContaining('repeatable read read only'));
  await snapshot.close();expect(child.stdin.end).toHaveBeenCalledWith('rollback;\n');
});
it('bounds cleanup when both graceful exit and exact-container stop fail',async()=>{
  vi.useFakeTimers();const snapshot=await hostedReadOnlySnapshot(options);child.stdin.end.mockImplementation(()=>{});mocks.stop.mockReturnValue({status:1});
  const closed=expect(snapshot.close()).rejects.toThrow('cleanup was not confirmed');await vi.advanceTimersByTimeAsync(20001);await closed;
  expect(mocks.stop).toHaveBeenCalledWith('docker',['stop','--time','5',expect.stringMatching(/^kora-readonly-snapshot-/)],expect.any(Object));expect(child.kill).toHaveBeenCalledWith('SIGTERM');
});
