import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyPreservedRows} from './migration-reconciliation.mjs';
test('accepts exactly the declared nullable schema addition without changing old cells',()=>{
 verifyPreservedRows({tasks:[{id:'a',completed_at:null}]},{tasks:[{id:'a',completed_at:null,repeat_interval:null}]},{tasks:['repeat_interval']});
});
test('rejects silent historical timestamp repair without disclosing row data',()=>{
 assert.throws(()=>verifyPreservedRows({tasks:[{id:'private-id',completed_at:null}]},{tasks:[{id:'private-id',completed_at:'private-value'}]}),error=>!error.message.includes('private-')&&/historical cell/.test(error.message));
});
test('rejects undeclared defaults, deletion, additions, reordering and task identity changes',()=>{
 for(const next of [[{id:'a',extra:null}],[{id:'a',repeat_interval:'daily'}],[],[{id:'a'},{id:'b'}],[{id:'b'}]])assert.throws(()=>verifyPreservedRows({tasks:[{id:'a'}]},{tasks:next},{tasks:['repeat_interval']}));
});
