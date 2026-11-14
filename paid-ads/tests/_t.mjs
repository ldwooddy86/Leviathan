/* shared by the paid ads tests: the link's helpers, and what a connected dashboard gives the toolkit, built from the DFW
   atlas the console carries (Build 4) and a made up brand with a license. No client file is involved. */
import { atlas, BRAND } from '../../dashboard-link/tests/_t.mjs';
import { library, model as readModel, competitors } from '../../dashboard-link/lib/read.mjs';

export * from '../../dashboard-link/tests/_t.mjs';

let made = null;
/* {pack, model, brand, seasons, competitors}: the context every toolkit function takes */
export function fixture() {
  if (!made) {
    const text = atlas(), lib = library(text), mdl = readModel(text, lib);
    const pack = { format: 1, id: 'dfw', depth: 'paid', atlas: 'DFW Thermal Debt Atlas · Build 4', note: 'test pack', lines: lib.lines, angles: lib.angles, negatives: lib.negatives, platforms: lib.platforms, defaults: lib.defaults, desk: lib.desk, service: lib.service, rules: lib.rules };
    made = { pack, model: mdl, roster: competitors(text) };
  }
  return { pack: made.pack, model: made.model, brand: JSON.parse(JSON.stringify(BRAND)), seasons: null, competitors: made.roster.companies.filter(c => !c.self).slice(0, 40).map(c => c.name) };
}
export const sum = a => a.reduce((s, x) => s + (+x || 0), 0);
export const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));
