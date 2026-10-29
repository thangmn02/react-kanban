import {afterEach,it,expect,vi} from 'vitest';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {loadFrozenPercussionModel,frozenPercussionSha256} from './model-assets.js';
afterEach(()=>vi.unstubAllGlobals());
it('loads the exact shipped model bytes and rejects an altered checkpoint',async()=>{
 const model=await readFile('extensions/kanban-music/generated/percussion/percussion.onnx');vi.stubGlobal('crypto',webcrypto);
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(model)));const result=await loadFrozenPercussionModel('http://localhost/model',{sha256:frozenPercussionSha256});expect(Buffer.from(result).equals(model)).toBe(true);
 const altered=Buffer.from(model);altered[100]^=1;vi.stubGlobal('fetch',vi.fn(async()=>new Response(altered)));await expect(loadFrozenPercussionModel('http://localhost/model',{sha256:frozenPercussionSha256})).rejects.toThrow('content mismatch');
});
it('rejects missing files, wrong configuration and HTML fallbacks without initializing inference',async()=>{
 vi.stubGlobal('crypto',webcrypto);const fetcher=vi.fn(async()=>new Response('missing',{status:404}));vi.stubGlobal('fetch',fetcher);
 await expect(loadFrozenPercussionModel('/model',{sha256:'wrong'})).rejects.toThrow('identity mismatch');expect(fetcher).not.toHaveBeenCalled();
 await expect(loadFrozenPercussionModel('/model',{sha256:frozenPercussionSha256})).rejects.toThrow('unavailable');vi.stubGlobal('fetch',vi.fn(async()=>new Response('<html>fallback</html>')));await expect(loadFrozenPercussionModel('/model',{sha256:frozenPercussionSha256})).rejects.toThrow('content mismatch');
});
