import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
/** Existing cells must survive an additive migration unchanged; only declared nullable columns may appear. */
export function verifyPreservedRows(before,after,allowedAddedColumns={}){
 assert.ok(isDeepStrictEqual(Object.keys(before).sort(),Object.keys(after).sort()),'Owning table inventory changed unexpectedly.');
 for(const table of Object.keys(before)){
  assert.ok(before[table].length===after[table].length,'Historical row count changed.');
  for(let i=0;i<before[table].length;i++){
   const previous=before[table][i],current=after[table][i];
   for(const column of Object.keys(previous))assert.ok(isDeepStrictEqual(current[column],previous[column]),'A historical cell changed; private values withheld.');
   for(const column of Object.keys(current).filter(key=>!Object.hasOwn(previous,key)))assert.ok(allowedAddedColumns[table]?.includes(column)&&current[column]===null,'An undeclared column or non-null historical default appeared.');
  }
 }
}
