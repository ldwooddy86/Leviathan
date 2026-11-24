// Legion · names — PROVISIONAL STUB (the names module owner replaces this file; same exports).
// Contract: surname(rng, heritage), givenName(rng, {heritage, sex, birthYear, generation, nativity}), nickname(rng, given, {heritage, age}).

const SUR = ['Garcia', 'Nguyen', 'Smith', 'Kim', 'Johnson', 'Hernandez', 'Lee', 'Martinez', 'Wong', 'Brown'];
const F = ['Maria', 'Linh', 'Jennifer', 'Grace', 'Ashley', 'Ana', 'Mei', 'Sofia', 'Emily', 'Patricia'];
const M = ['Jose', 'Minh', 'Michael', 'Daniel', 'David', 'Luis', 'Kevin', 'James', 'Juan', 'Robert'];

export const NAME_HERITAGES = [];
/** @returns {string} */
export function surname(rng, heritage) { return rng.pick(SUR); }
/** @returns {string} */
export function givenName(rng, { sex }) { return rng.pick(sex === 'F' ? F : M); }
/** @returns {string|null} */
export function nickname(rng, given) { return null; }
