import test from 'node:test';
import assert from 'node:assert/strict';
import {assertContainsLastRelease,latestRelease} from './release-ancestry.mjs';

test('picks the newest release by number, not by text, and ignores other tags',()=>{
  assert.equal(latestRelease(['v0.1.9','v0.1.56','vnext','v0.1.10']),'v0.1.56');
  assert.equal(latestRelease(['vnext']),null);
});
test('refuses a commit that does not contain the last release, or a checkout without tags',()=>{
  const git=(tags,contains)=>args=>{if(args[0]==='tag')return tags;assert.deepEqual(args,['merge-base','--is-ancestor','v0.1.56','HEAD']);if(!contains)throw Error('exit 1');return '';};
  assert.equal(assertContainsLastRelease(git('v0.1.55\nv0.1.56',true)),'v0.1.56');
  assert.throws(()=>assertContainsLastRelease(git('v0.1.55\r\nv0.1.56',false)),/does not contain the last release v0\.1\.56/);
  assert.throws(()=>assertContainsLastRelease(git('',true)),/Fetch tags/);
});
