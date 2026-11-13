    /* ---------- prose: how it is built, the judgment calls, what is left out, caveats, sources ---------- */
    function prose(V) {
      const P = V.P, pctOf = v => Math.round(v * 100) + '%';
      $('#h17Meth', root).innerHTML = [
        `<b>One cell per ZIP per line.</b> Four lines (heating repair, gas furnace replacement, heat pump replacement, tune up and safety check) in each of the ${N(ZR.length)} residential ZIPs. Jobs this month are module 12's jobs a year, times the share of systems where a homeowner decides (an owner occupied house counts 1, a rented house 0.6, an apartment 0.25), times the month's season index and the ZIP's cold exposure. ${G('B/D')}`,
        `<b>Reach.</b> Drive minutes are 5 plus the straight line kilometres from the dispatch point (${esc(V.origin.label)}). A lead is worth full value at the door and half at the half value drive: ${N(P.half.heat)} minutes for repair, ${N(P.half.furnace)} for replacement, ${N(P.half.maint)} for a tune up. A line is not sold where reach falls under ${D(P.cut, 2)}. ${G('C/D')}`,
        `<b>What can be won.</b> Only jobs that start with a paid click can be bought (repair ${pctOf(P.paid.heat)}, furnace ${pctOf(P.paid.furnace)}, heat pump ${pctOf(P.paid.heatpump)}, tune up ${pctOf(P.paid.maint)}), and one advertiser wins at most ${pctOf(P.cap)} of those. That ceiling is why a ZIP gets dearer the more of it is already bought. ${G('D')}`,
        `<b>Cost per lead.</b> The line's metro cost per lead (module 12's platform costs, blended over the platforms in use) times a cost index for the ZIP: its relative click cost and the line's competitor pressure, each believed at ${D(P.trust, 2)} strength because both measure where competitor shops sit, not what an auction costs. ${G('D')}`,
        `<b>Return.</b> Gross profit per job (the first ticket plus ${pctOf(P.pipeCredit)} of module 12's replacement pipeline credit) times the close rate and reach, over the cost per lead: what the first ad dollar in the cell brings back. ${G('D')}`,
        `<b>One fill across the four lines.</b> Each next dollar goes where it earns most. The return is not known to better than about ${pctOf(P.doubt)}, so the fill averages over that doubt instead of betting on a ranking it cannot defend, and the gap between lines is believed at ${D(P.gamma, 2)} strength for the decision only. Reported gross profit is never shrunk. ${G('C')}`,
        `<b>Guards.</b> The last dollar must bring back ${M$(P.hurdle)} of gross profit or it stays unspent. No ZIP takes more than ${pctOf(P.zipCap)} of the plan. ZIPs within ${N(P.coreMin)} minutes stay in the repair and tune up buys. A ZIP that would get under ${D(P.depth, 1)} of a lead a month in a line is dropped from that line. Pins and blocks are honored first.`,
        `<b>Ranges.</b> The plan as solved is replayed in 120 seeded worlds in which lead costs, close rates, paid shares, the advertiser cap, the pipeline credit, reach and jobs all move inside stated bounds. The 10th and 90th percentile are the range printed beside every outcome; the same worlds are used for every plan, so two plans differ by their inputs and never by the dice. ${G('D')}`,
        `<b>The week.</b> Each forecast low gets a weight (a 40°F night is 1) and a ZIP's week is its seven nights against the month's normal night, read from its three nearest forecast points. Repair follows the cold one for one, replacement by a third to a half, tune ups the other way. Alerts set a floor by county. Anything above a normal week draws on the freeze reserve; anything below goes back. ${G('A/D')}`,
      ].map(x => `<li>${x}</li>`).join('');
      $('#h17Judg', root).innerHTML = judgList([
        ['Reach is a policy, not an estimate', 'The owner decides how far a truck goes for a no heat call. The three sliders are the first controls on the page and the held back table shows what each choice leaves out.'],
        ['Stated indexes enter at half strength', 'Relative click cost and competitor pressure are priors until the account measures them. At full strength they push the plan out to Forney and Rockwall; at zero they pull it into Lakewood and the Park Cities.'],
        ['The desk believes a quarter of the gap between lines', 'Module 12 makes a heat pump lead worth far more per dollar than a repair lead, on stated lead costs and close rates. Trusted in full that would starve repair in a freeze. The decision uses a quarter of the gap; the reported dollars use all of it.'],
        ['Pipeline is shown apart', 'Three quarters of the gross profit of a repair call is the replacement it may become. Every table prints direct gross profit and gross profit with pipeline in separate columns.'],
        ['Budgets follow the weather, bids follow value', 'Cold raises how many people search, not what a job is worth, so location bid adjustments never move with the forecast. The money moves through daily budgets and bid caps.'],
        ['No ZIP is lowered for who lives there', 'There is no income, race, ethnicity or age term anywhere in the scoring. The ticket by ZIP comes from permit valuations in module 12 and is the only place home value enters.'],
        ['A hurdle instead of spending to the last dollar', `Under ${M$(P.hurdle)} of gross profit on the last ad dollar the rest of the budget is left unspent and the page says how much.`],
        ['Local Services Ads stay off until verified', 'The August 2026 roster shows no Local Services badge for the client. The switch is in the plan; the sheet lists the steps still open.'],
        ['A ZIP list is frozen in a week without a cold trigger', 'Changing location targets every Monday resets learning for nothing. Without a trigger only the money moves; with one, ZIPs can join and leave only when a line is paused or out of reach.'],
        ['The reserve keeps no ledger', 'The week card shows what this week draws or returns against a normal week. What the account actually spent is the owner\'s number; the desk does not pretend to know it.'],
      ]);
      $('#h17Not', root).innerHTML = judgList([
        ['Keyword volumes', 'No keyword tool was queried. Demand is the stock model\'s jobs, not search counts.'],
        ['Competitor spend', 'No estimate of what any competitor spends. Pressure counts mapped competitors nearby and what they sell.'],
        ['Customer or account data', 'Nothing from the client\'s own leads, calls or invoices. Module 15 holds the account connectors; none of it feeds this plan yet.'],
        ['Income, race, ethnicity or age', 'None is an input to any score, reach, bid or budget on this page.'],
        ['Traffic or drive time tables', 'Minutes are straight line distance plus five. A lake or a toll road changes the real drive.'],
      ]);
      $('#h17Cav', root).innerHTML = judgList([
        ['Dollar outcomes are benchmark arithmetic', 'Leads, jobs and gross profit follow module 12\'s stated lead costs, close rates, tickets and margins (grade D). Use them to compare ZIPs and budgets, not to forecast the bank balance.'],
        ['ZIP dollars are where spend is expected to land', 'No platform takes a budget by ZIP. What is uploaded is the list, the bid adjustment and the campaign budget; the ZIP dollars are a tripwire for the location report.'],
        ['Small numbers', 'A replacement line at this budget expects a handful of jobs a month. Judge months, not weeks.'],
        ['Straight line minutes', 'Rockwall is across the bridge on Interstate 30 and Sunnyvale is closer than it looks. Pin or block a ZIP when the map and the road disagree.'],
        ['Competition is the August 2026 roster', 'A ZIP with no mapped competitor is not a ZIP without competitors.'],
        ['The cold response has not been fitted to a call log', 'Night weights and line responses are shaped on degree days. The only measured anchors are the permit regressions in module 04 and a published heat wave study.'],
        ['Simulations are not forecasts', 'The scenario selector reruns the week on invented lows built from the live ones. It shows what the rules would do, not what the weather will.'],
      ]);
    }
