# Law, content and Satchel job (files 04, 05, 15, 22): notes

Work folder: CA/atlas/law_work. Part files 04a..04d are concatenated into CA/atlas/src/04_content.js by `cat` (see build line below).
Harness: law_work/harness.js (node), loads 00_core..05 with stubs, then 15 and 22 with a fake DOM.

Build: cat law_work/04a.js law_work/04b.js law_work/04c.js law_work/04d.js > src/04_content.js

Decisions
- Grades: A primary text read (agency page or PDF, Legislature page by dated archive capture); B transcription host
  (california.public.law, Cornell LII, UpCodes) or derived from public data; C secondary (news, law firm, trial court copy,
  trade site); D judgment, not found, or not verified.
- LAWX ids are new (California). Federal ids kept: cooling, reviews, regz, tcpa. Also kept: gouge, lien, permit, deductible.
- fillCopy: token {County} (ctx.county); {Lic} -> 'CSLB Lic. #n' / 'CSLB license number'.
- satCtx: ctx.fire from BRAND.fire (replaces the Louisiana roof program status field).
- ADRULES rows have a 4th element (where the atlas applies it).
- LAWPUB (global, in 04) keyed by LAWX id; 08_forge_copy.js still has its own local copy (not mine).

Status
- [ ] 04_content.js
- [ ] 05_satchel_rules.js
- [ ] 15_m03_law.js
- [ ] 22_m10_satchel.js
- [ ] harness, Louisiana word search
