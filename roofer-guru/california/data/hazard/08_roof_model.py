#!/usr/bin/env python3
"""roof_hazard_model.json and roof_hazard_model.md: what the evidence supports for turning a ZIP's hazards into per roof
statements by covering (for Rooftop Scout). Every number is from the inspection table built in step 07 or from the
evidence files named in `src`; nothing is estimated here. Run: python3 -I 08_roof_model.py (after 07)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hazlib import *

hz = jload(os.path.join(OUT, 'hazard_events.json'))
R = hz['roof']
LAW = 'SP/research/ca/roofing_law_evidence.md'
DMG = 'SP/research/damage_evidence.md'


def share(t):
    n = t['total']
    return {'n': n, 'dest': t['dest'], 'dest_sh': rnd(100.0 * t['dest'] / n, 1) if n else None, 'damaged': t['major'] + t['minor'] + t['affected'],
            'none': t['none'], 'none_sh': rnd(100.0 * t['none'] / n, 1) if n else None}


roofs = {k: share(R[k]) for k in ('asphalt', 'metal', 'tile', 'concrete', 'wood', 'other', 'unknown') if k in R}
eaves = {k: share(v) for k, v in R['eaves'].items()}
vents = {k: share(v) for k, v in R['vents'].items()}
era = {e: {k: share(t) for k, t in v.items() if t['total'] >= 30} for e, v in R['by_era'].items()}

COV = {
    'shingle3': {'name': 'Asphalt shingle, three tab', 'dins': 'asphalt'},
    'shingleL': {'name': 'Asphalt shingle, laminated', 'dins': 'asphalt'},
    'tile_c': {'name': 'Concrete tile', 'dins': 'tile'},
    'tile_k': {'name': 'Clay tile', 'dins': 'tile'},
    'shake': {'name': 'Wood shake or shingle', 'dins': 'wood'},
    'metal': {'name': 'Metal', 'dins': 'metal'},
    'membrane': {'name': 'Low slope membrane (single ply or modified bitumen)', 'dins': None},
    'bur': {'name': 'Built up roofing', 'dins': None},
}
M = {
    'compiled': COMPILED,
    'read_me': 'Statements flagged xstate rest on field studies outside California (the only measured evidence found); say so when printing them. Each statement has value, unit, basis, src and grade (A observed, B derived, C judgement on records, D assumption). Scout should print a statement only with its basis. not_known lists what must not be implied.',
    'coverings': COV,
    'fire': {
        'table_residences_2018on': roofs,
        'table_note': 'CAL FIRE damage inspections, residences in incidents of 2018 and later (%d residences). The inspection form has one tile class (clay and concrete tile are not separated; "concrete" is a small separate class) and one asphalt class (three tab and laminated are not separated); membranes and built up roofs are not classes (they fall in "other" or "unknown").' % R['n_residences'],
        'eaves': eaves, 'vents': vents, 'by_era': era,
        'caveats': [
            'Raw cross tabulation: not adjusted for fire intensity, building spacing, vegetation, defence actions or building age.',
            'Three fires (Camp 2018, Eaton 2025, Palisades 2025) supply a large share of the rows.',
            'Before 2018 only damaged and destroyed structures were recorded, so earlier incidents cannot give a survival share; they are left out.',
            'Roof class "unknown" is a large group and is mostly undamaged homes (inspectors record less on a home that did not burn), which biases every named class toward loss.',
            'Covering type only: no roof age, slope, condition, underlayment or vent detail beyond the form.',
        ],
        'published': [
            {'value': 'Relative risk of destruction by roof type, statewide 2013 to 2018 (1 = no difference): asphalt 1.05, concrete 0.89, metal 0.97, tile 0.88, wood 1.00 (not significant); enclosed eaves 0.79', 'basis': 'Syphard and Keeley 2019, Fire 2(3):49, Table 2, more than 40,000 exposed structures', 'src': LAW + ' C1b', 'grade': 'A'},
            {'value': 'Roof material "did not explain substantial variation"; enclosed eaves, vent screens and multi pane windows mattered most', 'basis': 'Syphard and Keeley 2019', 'src': LAW + ' C1b', 'grade': 'A'},
            {'value': 'Painted Cave Fire 1990: homes with non flammable roofs 70 percent survived, flammable roofs 19 percent', 'basis': 'Foote 1994 as reported by Cohen 2000', 'src': LAW + ' C1b', 'grade': 'B'},
            {'value': 'Palisades and Eaton 2025: about 90 percent of structures in the perimeters had Class A coverings; Class A roofs "can be overwhelmed" in a conflagration', 'basis': 'IBHS, The 2025 LA Conflagrations', 'src': LAW + ' C1a', 'grade': 'A'},
            {'value': 'Vent screens of 1/8 inch or smaller on only 10.3 percent of assessed structures in the Palisades area and 6.4 percent in the Eaton area', 'basis': 'IBHS (same)', 'src': LAW + ' C1a', 'grade': 'A'},
            {'value': 'Four hardening features: 54 percent chance of no damage; one or two: 36 percent. Under 10 feet between buildings: below 50 percent even with four', 'basis': 'IBHS (same)', 'src': LAW + ' C1a', 'grade': 'A'},
            {'value': 'Camp Fire 2018: homes built before 1997 11.5 percent survived, 1997 or later 38.5 percent', 'basis': 'Knapp et al. 2021, Fire Ecology 17:25', 'src': LAW + ' C1b', 'grade': 'A'},
        ],
        'reading': 'Three statements and no more (the law evidence file, C1): a combustible wood roof was the strongest predictor of loss in the older fires; since most roofs are now Class A, the covering no longer separates survivors from losses and the roof work that matters is at the edges (vents, gutters, eaves, bird stops, debris); in dense neighbourhoods building to building spread can overwhelm any roof.',
        'per_covering': {
            'shingle3': 'Inspection class "asphalt" (three tab and laminated together). Class A when installed as a rated assembly. Use the asphalt row; do not claim a difference between three tab and laminated in fire: none is recorded.',
            'shingleL': 'As three tab: same inspection class.',
            'tile_c': 'Inspection class "tile" (clay and concrete together) and the small class "concrete". Lower destroyed share than asphalt in the raw table and a lower relative risk in Syphard and Keeley (tile 0.88, concrete 0.89). Open tile ends without bird stops let embers and debris under the tile (UC ANR; code rule in the law file A10b).',
            'tile_k': 'As concrete tile: the form does not separate clay.',
            'shake': 'Inspection class "wood": few homes (see n). The older fire studies single out wood roofs (Painted Cave 19 percent survival; Oakland 1991, Laguna Beach 1993). New wood roofs are restricted statewide and banned in some cities (law file A10c).',
            'metal': 'Inspection class "metal". Raw destroyed share is close to asphalt; Syphard and Keeley found metal 0.97 statewide (slightly lower in the northern interior). Many metal roofed residences in the inspections are mobile homes and rural buildings, which the table does not separate.',
            'membrane': 'Not an inspection class. Nothing can be said from the inspections.',
            'bur': 'Not an inspection class. Nothing can be said from the inspections.',
        },
    },
    'wind': {
        'statements': [
            {'value': [65, 53, 80], 'unit': 'mph 3 second gust: expected, lower, upper', 'what': 'threshold of visible damage to a one or two family house', 'basis': 'Enhanced Fujita scale, degree of damage 1', 'src': DMG + ' item 2.5', 'grade': 'A'},
            {'value': [79, 63, 97], 'unit': 'mph', 'what': 'loss of roof covering under 20 percent, gutters, awnings', 'basis': 'Enhanced Fujita scale, degree of damage 2 (asphalt shingle, tile, slate or metal covering)', 'src': DMG + ' item 2.5', 'grade': 'A'},
            {'value': [97, 81, 116], 'unit': 'mph', 'what': 'uplift of roof deck and loss of more than 20 percent of the covering', 'basis': 'Enhanced Fujita scale, degree of damage 4', 'src': DMG + ' item 2.5', 'grade': 'A'},
            {'value': 40, 'unit': 'percent of homes older than 5 years with shingle damage at gusts of 75 to 88 mph', 'what': 'asphalt shingles and age', 'basis': 'IBHS field study of 1,412 homes after two 2008 storms on another coast (hours of wind from a moving storm, not Santa Ana wind: direction and duration differ)', 'xstate': True, 'src': DMG + ' item 3.1', 'grade': 'A'},
            {'value': '60 to 70', 'unit': 'mph', 'what': 'gust at which California forecasters begin to report roof damage in Storm Events narratives', 'basis': 'reading of narratives; the database gives no threshold', 'src': LAW + ' C2', 'grade': 'C'},
            {'value': 'hip and ridge tiles first', 'unit': '', 'what': 'tile roofs in wind', 'xstate': True, 'basis': 'FEMA 490 and RICOWI field investigations in Florida, 2004: hip and ridge tile loss was very common even at moderate wind; mortar set tile failed most; mechanically fastened and foam set far less', 'src': DMG + ' item 7', 'grade': 'A'},
            {'value': 'about 50 percent of shingle roofs older than 5 years had at least 5 percent visible damage, against 10 to 15 percent for tile and metal', 'unit': '', 'what': 'covering and age, Florida field survey 2022', 'xstate': True, 'basis': 'University of Florida for the Florida Building Commission (out of state)', 'src': DMG + ' item 7.4', 'grade': 'A'},
        ],
        'zip_columns': {'g58': 'days a year the nearest airport gusts to 58 mph (the High Wind Warning level)', 'wd58': 'days a year a 58 mph gust was measured within 25 miles (mountain sensors included)', 'off_cls': 'named offshore wind class', 'asce_wind': 'design speed'},
        'per_covering': {
            'shingle3': 'Most exposed to wind of the coverings here: older and unsealed shingles lift first (IBHS; University of Florida). No California test of three tab against laminated was found.',
            'shingleL': 'Heavier than three tab; the age finding (damage rises after about 5 years) applies to shingles generally.',
            'tile_c': 'Hip, ridge and rake tiles go first; loose tiles become debris. Attachment method decides the rest.',
            'tile_k': 'As concrete tile.',
            'shake': 'No wind damage figure found for wood shakes.',
            'metal': 'Ian data: far less damage than shingles beyond 5 years of age. Exposed fastener panels depend on the fasteners (damage evidence item 6C).',
            'membrane': 'No covering specific wind threshold collected; edge metal and flashing are where low slope roofs start to fail (not quantified here).',
            'bur': 'As membrane: not quantified.',
        },
    },
    'hail': {
        'threshold_in': {'shingle3': 1.0, 'shingleL': 1.25, 'tile_c': 1.75, 'tile_k': 1.5, 'shake': 1.5, 'metal': 2.5, 'membrane': [1.0, 2.0], 'bur': [1.75, 2.5]},
        'basis': 'Haag Engineering threshold sizes for the onset of functional damage (Marshall et al. 2002 Table 3; Morrison 2009): hard hail, perpendicular impact, roofs in good condition. Metal 2.5 inches is functional damage to steel panels (denting is cosmetic and comes sooner). Membrane 1 to 2 inches is thermoplastic single ply (EPDM 2; modified bitumen 1.5 to 2). Built up: smooth 1.75 to 2, gravel surfaced 2.5. Wood shake 1.5 is the 2002 table (the 2009 figure prints 1/2, taken as a misprint).',
        'src': DMG + ' item 1', 'grade': 'A',
        'california': 'Hail is rare: 891 Storm Prediction Center reports for the whole state 1955 to 2025, 349 of one inch or more, 54 of 1.75 inches or more; about six days a year with one inch hail anywhere in the state (law file C4). Hail is not a roofing market in California.',
        'zip_columns': {'hail1_n25': 'reports of 1 inch or more within 25 miles since 1955', 'hd1': 'days a year', 'hail_max_in': 'largest nearby'},
    },
    'heat': {
        'statements': [
            {'value': 0.08, 'unit': 'aged solar reflectance', 'what': 'Energy Code default for an unrated asphalt shingle (it absorbs 92 percent of sunlight)', 'src': LAW + ' A9b, C6', 'grade': 'A'},
            {'value': 25, 'unit': 'years', 'what': 'life of standard underlayment under tile (a reserve study consultant; older systems "failing at 20 to 30 years")', 'src': LAW + ' B3', 'grade': 'C'},
            {'value': {'shingle3': 20, 'shingleL': 30, 'bur': 30, 'tile_c': '100+', 'tile_k': '100+', 'membrane': '15 to 25 (EPDM)', 'shake': 30}, 'unit': 'years, national guideline', 'what': 'service life charts with no published method (InterNACHI national chart; NAHB 2007 gives asphalt 20, wood 30, modified bitumen 20). Not California figures', 'src': DMG + ' item 5A', 'grade': 'D'},
            {'value': [80, 95], 'unit': 'F', 'what': 'Cal/OSHA outdoor heat rule: shade at 80 F, high heat procedures at 95 F (limits summer production inland)', 'src': LAW + ' A13', 'grade': 'A'},
        ],
        'zip_columns': {'h100': 'days a year at 100 F or more', 'h110': 'days at 110 F', 'tjul': 'normal July maximum'},
        'note': 'No California field study of shingle, coating or membrane life against heat or ultraviolet was found. Scout may say how hot a ZIP is and that heat and sun age asphalt and sealants; it may not give a life in years for a ZIP.',
    },
    'snow': {
        'statements': [
            {'value': 5.2, 'unit': 'lb/ft2 per inch of snow water', 'what': 'weight of snow on the ground from its water content (unit conversion)', 'src': 'SP/research/ca/sources_weather_hazard.md 8b', 'grade': 'A'},
            {'value': 230, 'unit': 'lb/ft2 ground snow load', 'what': 'limit the mountain building departments (Truckee, Mammoth Lakes, Nevada, Sierra, Mono and Placer counties) set for rooftop solar without special design', 'src': LAW + ' C5; Town of Mammoth Lakes 2021', 'grade': 'A'},
            {'value': 325, 'unit': 'lb/ft2', 'what': "ground snow load in the Town of Truckee's own handout example (13 feet of snow at 25 lb/ft3)", 'src': LAW + ' C5', 'grade': 'A'},
            {'value': 'February to March 2023', 'unit': '', 'what': 'roofs collapsed under snow in Crestline and Lake Arrowhead (100 and 108 inches in a week), and a school roof in Nevada City', 'src': LAW + ' C5; Storm Events', 'grade': 'A'},
        ],
        'zip_columns': {'snow_psf': 'ASCE 7-22 design ground snow load at the town point (units read as lb/ft2, unconfirmed)', 'snow_max_psf': 'on the high ground of the ZIP', 'apr1_swe_in': 'typical 1 April snow water'},
        'note': 'The design roof load is set by the local building department from the ground snow load, roof slope, exposure and heat loss; the official county and town tables were not obtained. Scout may show the ASCE ground value and the 230 lb/ft2 solar limit; it may not state a design roof load for a house.',
    },
    'salt': {
        'statements': [
            {'value': [1500, 800, 400], 'unit': 'feet from surf, large bay, marsh or canal', 'what': 'bare Galvalume not guaranteed nearer than this (MBCI); painted panels 1,000 feet from any salt water', 'src': DMG + ' item 6.1', 'grade': 'A'},
            {'value': [2800, 1200, 600], 'unit': 'feet', 'what': 'minimum distances in a 25 year Galvalume warranty (Drexel Metals)', 'src': DMG + ' item 6.2', 'grade': 'A'},
            {'value': 1, 'unit': 'mile', 'what': 'no Galvalume warranty of any length within one mile of salt or brackish water (Englert)', 'src': DMG + ' item 6.3', 'grade': 'A'},
            {'value': 1500, 'unit': 'feet', 'what': 'painted (PVDF) film warranty applies only beyond this distance from salt water (Metal Sales)', 'src': DMG + ' item 6.4', 'grade': 'A'},
        ],
        'zip_columns': {'coast_km': 'town point to salt water', 'coast_min_km': 'nearest edge of the ZIP', 'salt_cls': '3 within 0.5 km (inside every maker distance above), 2 within 1.6 km (one mile), 1 within 5 km, 0 beyond'},
        'note': 'These are makers\' warranty terms for steel panels, not measurements of corrosion in California. No California study of salt air on roofs, fasteners or flashings was found; nothing here applies to asphalt, tile or membranes.',
    },
    'rain': {
        'statements': [
            {'value': [10383, 14511], 'unit': 're-roof permits, City of Los Angeles, 2022 and 2023', 'what': 'permits rose 40 percent after the wet winter of 2022 to 2023 (that rain caused it is a judgement)', 'src': LAW + ' C3', 'grade': 'C'},
            {'value': 'October', 'unit': '', 'what': 'peak month for Los Angeles re-roof permits, before the rain; low in mid winter', 'src': LAW + ' C3', 'grade': 'B'},
        ],
        'zip_columns': {'rain_d1': 'days a year with 1 inch or more', 'rain_d2': '2 inches or more', 'ar3_d': 'AR3 or stronger days a year at the ZIP latitude of the coast', 'rain_rec_in': 'wettest day on record nearby'},
        'note': 'No count of roof leak claims by rain event was found. Scout may rank ZIPs by heavy rain days; it may not turn them into leak counts.',
    },
    'rules_for_scout': [
        {'if': 'fhsz_vh > 0 or fhsz_high > 0', 'say': 'Part of this ZIP is in a High or Very High Fire Hazard Severity Zone: a re-roof there must be a Class A assembly with the edge and vent details of the wildland code (law file A10).', 'grade': 'A'},
        {'if': 'snow_psf >= 230', 'say': 'Design ground snow load at the town is at or above the 230 lb/ft2 limit the mountain building departments use for rooftop solar.', 'grade': 'B'},
        {'if': 'salt_cls >= 2 and covering == metal', 'say': 'Inside the distance from salt water at which several steel panel makers exclude or shorten their warranties.', 'grade': 'A'},
        {'if': 'wd58 >= 5 or g58 >= 1', 'say': 'Gusts of 58 mph or more are measured near this ZIP several days a year; the scale for visible house damage starts at about 65 mph.', 'grade': 'B'},
        {'if': 'hail1_n25 == 0', 'say': 'No hail of one inch or more has been reported within 25 miles since 1955.', 'grade': 'A'},
        {'if': 'fire_dest > 0', 'say': 'CAL FIRE inspections record structures destroyed by wildfire in this ZIP (fire_worst, fire_worst_yr).', 'grade': 'A'},
    ],
    'not_known': [
        'Survival by roof covering adjusted for fire intensity, spacing and age: only the raw inspection table and one relative risk study exist.',
        'Any fire figure for membranes or built up roofs; any difference between three tab and laminated shingles, or clay and concrete tile, in fire.',
        'Wind damage thresholds by covering measured in California (Santa Ana, Diablo or winter storm wind); insurer counts of California wind claims.',
        'Counts of roof leak claims after atmospheric rivers.',
        'Shingle, coating and membrane service lives in California heat, sun or marine air.',
        'Salt air corrosion rates for California; the effect on fasteners and flashings of non metal roofs.',
        'Official county and town design snow load tables (Placer, Truckee, El Dorado, South Lake Tahoe, Mono, Big Bear); units of the ASCE rasters are read, not confirmed.',
        'Earthquake damage to tile roofs and chimneys: no source was opened.',
        'Roof age, slope, underlayment and condition of any single roof: Scout sees a covering, not its history.',
    ],
}
n = jdump(M, os.path.join(OUT, 'roof_hazard_model.json'), indent=1)

# ---- the markdown note
L = ['# Roof hazard model for Rooftop Scout: what the evidence supports', '',
     'Compiled %s. Machine form: `roof_hazard_model.json` (same content). Grades: A observed, B derived, C judgement on records, D assumption.' % COMPILED, '',
     'Coverings: ' + '; '.join('`%s` %s' % (k, v['name']) for k, v in COV.items()) + '.', '',
     '## 1. Wildfire: residences in CAL FIRE damage inspections, incidents of 2018 and later', '', M['fire']['table_note'], '',
     '| Roof class on the form | residences | destroyed | destroyed share | damaged | no damage | no damage share |', '|---|---|---|---|---|---|---|']
for k, v in sorted(roofs.items(), key=lambda t: -t[1]['n']):
    L.append('| %s | %s | %s | %s%% | %s | %s | %s%% |' % (k, format(v['n'], ','), format(v['dest'], ','), v['dest_sh'], format(v['damaged'], ','), format(v['none'], ','), v['none_sh']))
L += ['', '| Eaves | residences | destroyed share | no damage share |', '|---|---|---|---|'] + ['| %s | %s | %s%% | %s%% |' % (k, format(v['n'], ','), v['dest_sh'], v['none_sh']) for k, v in sorted(eaves.items(), key=lambda t: -t[1]['n'])]
L += ['', '| Vent screens | residences | destroyed share | no damage share |', '|---|---|---|---|'] + ['| %s | %s | %s%% | %s%% |' % (k, format(v['n'], ','), v['dest_sh'], v['none_sh']) for k, v in sorted(vents.items(), key=lambda t: -t[1]['n'])]
L += ['', 'Destroyed share by era built and roof class (classes with 30 or more residences):', '', '| Era built | ' + ' | '.join(['asphalt', 'tile', 'metal', 'wood', 'unknown']) + ' |', '|---|---|---|---|---|---|']
for e in ('pre1980', '1980_2007', '2008on', 'unknown'):
    if e in era:
        L.append('| %s | ' % e + ' | '.join(('%s%% of %s' % (era[e][k]['dest_sh'], format(era[e][k]['n'], ','))) if k in era[e] else 'too few' for k in ('asphalt', 'tile', 'metal', 'wood', 'unknown')) + ' |')
L += ['', '**Caveats (print them with any share):**', ''] + ['- ' + c for c in M['fire']['caveats']]
L += ['', '**Published findings:**', ''] + ['- %s. Basis: %s. Grade %s. (%s)' % (p['value'], p['basis'], p['grade'], p['src']) for p in M['fire']['published']]
L += ['', '**Reading.** ' + M['fire']['reading'], '', '**By covering:**', ''] + ['- `%s`: %s' % (k, v) for k, v in M['fire']['per_covering'].items()]
for sec, title in (('wind', '2. Wind'), ('heat', '4. Heat and sun'), ('snow', '5. Snow load'), ('salt', '6. Salt air'), ('rain', '7. Rain')):
    if sec == 'heat':
        h = M['hail']
        L += ['', '## 3. Hail', '', '| Covering | threshold, inches |', '|---|---|'] + ['| `%s` | %s |' % (k, (' to '.join(str(x) for x in v) if isinstance(v, list) else v)) for k, v in h['threshold_in'].items()]
        L += ['', h['basis'] + ' Grade A. (' + h['src'] + ')', '', h['california']]
    L += ['', '## ' + title, '']
    for s in M[sec]['statements']:
        L.append('- **%s** %s: %s%s Grade %s. (%s)' % (json.dumps(s['value'], ensure_ascii=False).strip('"'), s['unit'], s['what'], ('. Basis: ' + s['basis']) if s.get('basis') else '.', s['grade'], s['src']))
    if M[sec].get('per_covering'):
        L += ['', 'By covering:', ''] + ['- `%s`: %s' % (k, v) for k, v in M[sec]['per_covering'].items()]
    if M[sec].get('note'):
        L += ['', M[sec]['note']]
    L += ['', 'ZIP columns to read: ' + '; '.join('`%s` (%s)' % (k, v) for k, v in M[sec]['zip_columns'].items()) + '.']
L += ['', '## 8. Ready made rules', '', '| when | Scout may say | grade |', '|---|---|---|'] + ['| `%s` | %s | %s |' % (r['if'], r['say'], r['grade']) for r in M['rules_for_scout']]
L += ['', '## 9. Not known (do not imply)', ''] + ['- ' + x for x in M['not_known']]
open(os.path.join(OUT, 'roof_hazard_model.md'), 'w').write('\n'.join(L) + '\n')
log('roof_hazard_model.json', n, 'md lines', len(L))
for k, v in roofs.items():
    print(k, v)
print('eaves', eaves); print('vents', vents)
