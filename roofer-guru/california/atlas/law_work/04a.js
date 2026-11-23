/* ==== 04_content.js ==== */
/* ==== content: service lines, California code, license and claims register, copy angles, keywords ==== */
"use strict";
/* Copy that leaves the atlas carries no hyphen or dash and no meta notes (house style). Statements of California law below come
   from the evidence file compiled November 19, 2026: statutes read as dated archive captures of the Legislature's pages or on
   california.public.law, regulations on the Cornell Legal Information Institute and dir.ca.gov, Title 24 on UpCodes and in the
   Energy Commission's own PDFs, and agency pages (CSLB, Department of Insurance, FAIR Plan, city building departments). Each row
   carries its citation, its source and a grade. The three federal rows (16 CFR 429, 16 CFR 465 and 255, 12 CFR 1026.24) and the
   federal calls and texts row were read on ecfr.gov on October 6, 2026 for the earlier edition and are carried over unchanged.
   Grades: A = primary text read (an agency's own page or PDF, or the Legislature's page by dated archive capture);
   B = the text read on a transcription host, or a count derived from a public data file; C = secondary (news report, law firm
   note, trial court decision on a third party site, trade site); D = judgment, or searched for and not found, or not verified.
   Research material, not legal or insurance advice. */
/* the thirteen line keys, in page order (00_core.js carries the same list as LINE_KEYS) */
const LX_ALL = ['replace', 'repair', 'storm', 'fire', 'harden', 'tile', 'solar', 'metal', 'mh', 'mf', 'comm', 'coat', 'newc'];
const LX_RES = ['replace', 'repair', 'storm', 'fire', 'harden', 'tile', 'solar', 'metal', 'mh'];
const LX_COM = ['mf', 'comm', 'coat', 'newc'];
/* statute, regulation and agency pages read for this build (label -> URL) */
const LAWLINK = {
  'BPC 7026': 'https://web.archive.org/web/20231231083859/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7026',
  'BPC 7048': 'https://web.archive.org/web/20260814172623/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7048',
  'BPC 7027.1': 'https://web.archive.org/web/20260306063256/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7027.1',
  'BPC 7027.2': 'https://web.archive.org/web/20250214102409/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7027.2',
  'BPC 7028': 'https://web.archive.org/web/20260814172524/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7028',
  'BPC 7028.7': 'https://california.public.law/codes/ca_bus_and_prof_code_section_7028.7',
  'BPC 7028.16': 'https://web.archive.org/web/20221005221134/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7028.16',
  'BPC 7030.5': 'https://california.public.law/codes/ca_bus_and_prof_code_section_7030.5',
  'BPC 7031': 'https://web.archive.org/web/20250413235714/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7031',
  'BPC 7058.5': 'https://web.archive.org/web/20231231092207/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7058.5',
  'BPC 7071.6': 'https://web.archive.org/web/20250506044423/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7071.6',
  'BPC 7099.2': 'https://california.public.law/codes/ca_bus_and_prof_code_section_7099.2',
  'BPC 7125': 'https://california.public.law/codes/ca_bus_and_prof_code_section_7125',
  'BPC 7125.4': 'https://california.public.law/codes/ca_bus_and_prof_code_section_7125.4',
  'BPC 7151': 'https://california.public.law/codes/ca_bus_and_prof_code_section_7151',
  'BPC 7152': 'https://california.public.law/codes/ca_bus_and_prof_code_section_7152',
  'BPC 7153': 'https://california.public.law/codes/ca_bus_and_prof_code_section_7153',
  'BPC 7159 (2021 text)': 'https://web.archive.org/web/20250719000748/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7159',
  'BPC 7159 (2026 text)': 'https://california.public.law/codes/ca_bus_and_prof_code_section_7159',
  'BPC 7159.5': 'https://web.archive.org/web/20241211024520/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7159.5',
  'BPC 7159.10': 'https://california.public.law/codes/ca_bus_and_prof_code_section_7159.10',
  'BPC 7159.14': 'https://web.archive.org/web/20231231083910/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=7159.14',
  'Civil Code 1689.6': 'https://california.public.law/codes/ca_civ_code_section_1689.6',
  'Civil Code 1797.91': 'https://california.public.law/codes/ca_civ_code_section_1797.91',
  'Civil Code 1797.93': 'https://california.public.law/codes/ca_civ_code_section_1797.93',
  'Civil Code 4720': 'https://california.public.law/codes/ca_civ_code_section_4720',
  'Civil Code 8200': 'https://web.archive.org/web/20221025230332/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=8200',
  'Civil Code 8204': 'https://web.archive.org/web/20250424140343/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=8204',
  'Civil Code 8412': 'https://web.archive.org/web/20250620070653/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=8412',
  'Civil Code 896': 'https://web.archive.org/web/20230514154602/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=896',
  'Code Civ. Proc. 337.15': 'https://web.archive.org/web/20251024072017/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CCP&sectionNum=337.15',
  'Penal Code 396': 'https://california.public.law/codes/ca_penal_code_section_396',
  'Penal Code 551': 'https://california.public.law/codes/ca_penal_code_section_551',
  'Insurance Code 15006': 'https://web.archive.org/web/20250317210838/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=INS&sectionNum=15006',
  'Insurance Code 15007': 'https://california.public.law/codes/ca_ins_code_section_15007',
  'Insurance Code 15027': 'https://web.archive.org/web/20250430215038/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=INS&sectionNum=15027',
  'Insurance Code 520': 'https://california.public.law/codes/ca_ins_code_section_520',
  'Insurance Code 2051.5': 'https://california.public.law/codes/ca_ins_code_section_2051.5',
  'Insurance Code 675.1': 'https://web.archive.org/web/20260905070120/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=INS&sectionNum=675.1',
  'Health and Safety Code 13132.7': 'https://california.public.law/codes/ca_health_and_safety_code_section_13132.7',
  'Public Resources Code 4291': 'https://web.archive.org/web/20261003015450/https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=PRC&sectionNum=4291',
  '10 CCR 2695.5': 'https://www.law.cornell.edu/regulations/california/10-CCR-2695.5',
  '10 CCR 2695.7': 'https://www.law.cornell.edu/regulations/california/10-CCR-2695.7',
  '10 CCR 2695.9': 'https://www.law.cornell.edu/regulations/california/10-CCR-2695.9',
  '10 CCR 2644.9': 'https://www.law.cornell.edu/regulations/california/10-CCR-2644.9',
  '8 CCR 1731': 'https://www.dir.ca.gov/title8/1731.html',
  '8 CCR 1730': 'https://www.dir.ca.gov/title8/1730.html',
  '8 CCR 3395': 'https://www.dir.ca.gov/title8/3395.html',
  '8 CCR 1529': 'https://www.dir.ca.gov/title8/1529.html',
  '2025 Energy Code': 'https://www.energy.ca.gov/sites/default/files/2026-07/CEC-400-2025-010-F.pdf',
  '2022 Energy Code': 'https://www.energy.ca.gov/sites/default/files/2022-12/CEC-400-2022-010_CMF.pdf',
  '2025 Wildland-Urban Interface Code, chapter 5': 'https://up.codes/viewer/california/ca-wuic-2025/chapter/5/special-building-construction-regulations',
  '2025 Wildland-Urban Interface Code, chapter 1': 'https://up.codes/viewer/california/ca-wuic-2025/chapter/1/administration',
  '2022 Building Code, chapter 15': 'https://up.codes/viewer/california/ca-building-code-2022/chapter/15/roof-assemblies-and-rooftop-structures',
  '2025 Residential Code, chapter 9': 'https://up.codes/viewer/california/ca-residential-code-2025/chapter/9/roof-assemblies',
  'Building Standards Commission bulletin 25-03': 'https://www.dgs.ca.gov/-/media/Divisions/BSC/06-News/Information-Bulletins/2025/BSC-Bulletin-25-03-AB130-FINAL.pdf',
  'Building Standards Commission, Codes': 'https://www.dgs.ca.gov/BSC/Codes',
  'CSLB bulletin 24-07 (AB 2622)': 'https://www.cslb.ca.gov/Resources/IndustryBulletins/2024/AB%202622%20Implementation.FINAL.pdf',
  'CSLB bulletin 25-04 (new laws for 2026)': 'https://www.cslb.ca.gov/Resources/IndustryBulletins/2026/New%20Laws.FINAL.pdf',
  'CSLB C-39 classification': 'https://www.cslb.ca.gov/About_Us/Library/Licensing_Classifications/Licensing_Classifications_Detail.aspx?Class=C39',
  'CSLB bond requirements': 'https://www.cslb.ca.gov/Contractors/Maintain_License/Bond_Information/Bond_Requirements.aspx',
  'CSLB home improvement salesperson': 'https://www.cslb.ca.gov/Contractors/Applicants/Home_Improvement_Registration/Before_Applying_For_HIS.aspx',
  'CSLB': 'https://www.cslb.ca.gov/',
  'Department of Insurance, Safer from Wildfires': 'https://www.insurance.ca.gov/01-consumers/200-wrr/Safer-from-Wildfires.cfm',
  'Department of Insurance, moratorium on non-renewals': 'https://www.insurance.ca.gov/01-consumers/140-catastrophes/MandatoryOneYearMoratoriumNonRenewals.cfm',
  'Department of Insurance, After the Fires flyer': 'https://www.insurance.ca.gov/01-consumers/140-catastrophes/upload/After-the-fires-flyer-LJ-01132025.pdf',
  'FAIR Plan key statistics': 'https://www.cfpnet.com/key-statistics-data/',
  'FAIR Plan wildfire hardening discounts': 'https://www.cfpnet.com/wp-content/uploads/2025/11/Wildfire-Hardening-Discounts-for-Dwelling-Fire-Commercial-Policies-2025.11.15.pdf',
  'Los Angeles wood shake bulletin': 'https://dbs.lacity.gov/sites/default/files/efs/forms/pc17/IB-P-BC-2023-13-Roofing-Requirements-For-Wood-Shakes-and-Shingles.pdf',
  'Los Angeles County reroofing manual': 'https://ladpw.org/bsd/lib/fp/Building/Building%20Code%20Manuals/2023/BCM%201512%20A1%20-%20Reroofing%20on%20Roofs%20With%20or%20Without%20Solar%20Energy%20Systems%20(04-01-25).pdf',
  'San Diego Information Bulletin 123': 'https://www.sandiego.gov/development-services/forms-publications/information-bulletins/123',
  'Wildfire Task Force, Zone 0': 'https://wildfiretaskforce.org/california-board-of-forestry-approves-first-in-the-nation-zone-0-defensible-space-regulations/',
  'LADWP rebate fact sheet': 'https://www.ladwp.com/sites/default/files/2026-02/2024_FACT_SHEETS_CRP_Eng_042024.pdf',
  '16 CFR 465': 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-465',
  '16 CFR 429': 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-429',
  '12 CFR 1026.24': 'https://www.ecfr.gov/current/title-12/chapter-X/part-1026/subpart-C/section-1026.24',
  '47 CFR 64.1200': 'https://www.ecfr.gov/current/title-47/chapter-I/subchapter-B/part-64/subpart-L/section-64.1200',
};
