/** A release must contain the previous one, or a shipped fix can disappear in the next build. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const parts=tag=>/^v(\d+)\.(\d+)\.(\d+)$/.exec(tag)?.slice(1).map(Number);
export function latestRelease(tags){
  return tags.filter(parts).sort((a,b)=>{const x=parts(a),y=parts(b);return x[0]-y[0]||x[1]-y[1]||x[2]-y[2];}).at(-1)??null;
}
export function assertContainsLastRelease(git=args=>execFileSync('git',args,{encoding:'utf8'}).trim(),commit='HEAD'){
  const last=latestRelease(git(['tag','--list','v*']).split(/\r?\n/));
  assert.ok(last,'No release tag is present. Fetch tags first (git fetch --tags).');
  try{git(['merge-base','--is-ancestor',last,commit]);}
  catch{throw Error(`This commit does not contain the last release ${last}. Merge it first, or its fixes would disappear.`);}
  return last;
}
