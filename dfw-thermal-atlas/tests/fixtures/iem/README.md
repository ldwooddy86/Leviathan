# Iowa Environmental Mesonet fixtures

Answers of `https://mesonet.agron.iastate.edu/cgi-bin/request/gis/watchwarn.py` for the Fort Worth office and the 24 cold
product codes the collector asks for, recorded on 2026-11-13.

| File | What it is |
|---|---|
| `watchwarn-fwd-season-2026-2026-11-13.csv` | The running season (2026-07-01 to 2027-07-01) exactly as answered: the 27 column header and no rows, because nothing had been issued yet. |
| `watchwarn-fwd-window-2026-01-24-2026-11-13.csv` | One day of January 2026 (start times from 2026-01-24 12:00 to 2026-01-25 12:00 UTC) exactly as answered: 109 rows, all 27 columns, all 46 zones of the office. |
| `watchwarn-fwd-season-2025-2026-11-13.csv` | Season 2025 to 2026 for the whole office (448 rows), trimmed to the seven columns the collector reads. |
| `watchwarn-fwd-12-zones-2016-to-2026-2026-11-13.csv` | Ten winters in one pull (2016-07-01 to 2026-11-14), trimmed to the 12 county zones (902 of 3,348 rows) and the seven columns. The tests cut it into seasons by start time, the way the service does. |
| `synthetic-quoted-fields.csv` | Hand made. The real answers hold no quoted field, so this drives the quoted comma, the doubled quote, the line break inside quotes, both line endings, a different column order and five rows that must be skipped. |
| `synthetic-season-2026-freeze-warning.csv` | Hand made, in the real 27 column layout: a Freeze Watch replaced by a Freeze Warning for the night of November 16 to 17, 2026, in three of the 12 zones and two outside. Drives the weekly replace of the running season. |
| `synthetic-error-page.html` | Hand made: the kind of page a server in trouble sends with HTTP 200. |
