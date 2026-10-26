import { expect,it } from 'vitest';
import { stripTaskHtml } from './taskCollections';
it.each([
 ['<p>Review chapter 1</p><p>Complete exercises</p>','Review chapter 1 Complete exercises'],
 ['<strong>Important</strong> &amp; urgent','Important & urgent'],
 ['<ul><li>Read</li><li>Write&nbsp;notes</li></ul>','Read Write notes'],
 ['<img src=x onerror="alert(1)"><script>alert(2)</script><p>Safe','Safe'],
 ['<p>Malformed <strong>text','Malformed text'],
 ['&#x1F44D; &#65; &quot;yes&quot;','👍 A "yes"'],
 ['', ''],
])('produces an inert, readable preview from %s',(input,expected)=>expect(stripTaskHtml(input)).toBe(expected));
