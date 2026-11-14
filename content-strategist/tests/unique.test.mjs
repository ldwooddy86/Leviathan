/* lib/unique.mjs: a set of city pages must not be one page with the city swapped. */
import { ok, done, read } from './_t.mjs';
import { compare, runs } from '../lib/unique.mjs';
import { parseMarkdown } from '../lib/doc.mjs';

const body = f => parseMarkdown(read(f)).blocks.filter(b => b.type === 'p' || /^h[1-6]$/.test(b.type)).map(b => b.text).join('\n');
const plano = body('landing.md'), frisco = plano.replace(/Plano/g, 'Frisco'), blog = body('blog.md');
ok(runs('a b c d e', 4).size === 2 && runs('a b c', 4).size === 0, 'four word runs');
let r = compare([{ name: 'plano', text: plano, mask: ['Plano'] }, { name: 'frisco', text: frisco, mask: ['Frisco'] }]);
ok(!r.ok && r.pairs.length === 1 && r.pairs[0].similarity > 0.95 && r.repeated.length > 10, 'the same page with the city swapped is caught, however the name reads', r.pairs);
r = compare([{ name: 'plano', text: plano, mask: ['Plano'] }, { name: 'blog', text: blog, mask: [] }]);
ok(r.ok && r.pairs.length === 0 && r.pages[0].similarity < 0.1 && r.repeated.length === 0, 'two pages written apart share almost nothing', r.pages);
const a = 'Our crew fixed a heat pump in Allen last week and the owner was glad. Call us any time for a repair visit at your home today.', b = 'We serve Wylie with care. Call us any time for a repair visit at your home today. Furnaces need a check before winter comes around.', c = 'Rowlett sits by the lake and homes there are newer. Call us any time for a repair visit at your home today. Ducts leak in old attics.';
r = compare([{ name: 'a', text: a, mask: ['Allen'] }, { name: 'b', text: b, mask: ['Wylie'] }, { name: 'c', text: c, mask: ['Rowlett'] }], { limit: 0.9 });
ok(!r.ok && r.repeated[0].pages.length === 3 && /call us any time/.test(r.repeated[0].sentence), 'a sentence that turns up on three pages fails the set even when no pair is close');
ok(compare([{ name: 'a', text: a, mask: [] }, { name: 'b', text: b, mask: [] }], { limit: 0.9 }).ok, 'the same sentence on two pages is listed, not failed');
done();
