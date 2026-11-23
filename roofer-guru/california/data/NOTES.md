# CA/data build notes (resume file)

Scripts run in order by build_all.sh with `python3 -I`. Intermediate files in CA/data/work/ (JSON).

- [x] SCHEMA.md first issue
- [ ] 01_people.py   ACS + crosswalk + business + insurance + FEMA + CSLB -> work/zip_base.json, county_base.json
- [ ] 02_geo.py      geometry -> work/geo.json
- [ ] 03_roofmodel.py cohort model -> work/roof.json
- [ ] 04_lines.py    pools, rates, z, fees, index, comp -> work/lines.json
- [ ] 05_assemble.py merge everything (+ hazard out) -> out/ca_atlas_data.json
- [ ] 06_checks.py   tests -> out/build_report.md
- hazard job: CA/data/hazard/out (HAZARD_SCHEMA.md) ; stub in work/hazard_stub.json until it exists
