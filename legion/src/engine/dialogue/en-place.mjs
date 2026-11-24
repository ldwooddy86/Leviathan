// Legion · dialogue · English templates II: the place. Weather and the forecast, traffic and the commute, fire,
// storms and floods, heat, housing and rent, insurance, earthquakes, food, places to go, directions, the
// neighborhood, history and memories, and opinions on local things.
//
// Every number, name and date in these lines arrives through a slot the planner filled from the world pack
// (ground.mjs); the lines themselves only carry the speaker's way of saying it and their own feelings.

import { compileBank } from './core.mjs';

/** The place bank, compiled. */
export const PLACE = compileBank({
  // ---------------------------------------------------------------- weather now and next
  'wx.now': `
    It's {temp} out right now, {sky}.
    {temp} degrees and {sky}.
    Right now it's {temp} and {sky}.
    It's {sky}, about {temp} degrees.
    @loose {temp} and {sky}. Not bad.
    @plain It's {temp} degrees at the moment, and {sky}.
    @kid It's {temp} degrees!
  `,
  'wx.nowPlain': `
    It's {temp} out right now.
    {temp} degrees right now.
    It's about {temp} out.
  `,
  'wx.stale': `
    It's about {temp} out. Pretty typical for {month}.
    Around {temp}, I'd guess. About normal for {month}.
  `,
  'wx.tonight': `
    Supposed to get down to {low} tonight.
    Tonight it drops to around {low}.
    It'll be {low} tonight, {nextSky}.
    Bring a jacket later. It's going down to {low}.
  `,
  'wx.next': `
    {whenCap} it's supposed to be {nextSky}, around {high}.
    The forecast says {nextSky} {when}, with a high near {high}.
    {whenCap} looks {nextSky}. High of {high} or so.
  `,
  'wx.rainChance': `
    There's a {pop} percent chance of rain {when}.
    They're saying {pop} percent chance of rain {when}.
    Maybe some rain {when}. {pop} percent, they say.
  `,
  'wx.keyMsg': `
    The weather service says {keyMsg}
    According to the forecast, {keyMsg}
    I saw the forecast. {keyMsgCap}
  `,
  'wx.alert': `
    There's a {alert} out {until}.
    The weather service has a {alert} up {until}.
    Heads up, there's a {alert} {until}.
    They put out a {alert}. It runs {until}.
  `,
  'wx.alertNoEnd': `
    There's a {alert} out right now.
    The weather service put out a {alert}.
  `,
  'wx.alertFeel': `
    That kind of thing always makes me a little nervous.
    I keep checking my phone for updates.
    @steady It's probably fine, but I'm keeping an eye on it.
    @worrier I won't relax until it's over.
  `,
  'wx.coastalAlert': `
    It's the surf and the tides, mostly. Stay off the rocks.
    The beach parking lots flood when the tide comes in. Don't park down there.
  `,
  'wx.airOkay': `
    The air's all right today, as far as I can tell.
    Air seems fine today. No smoke, anyway.
  `,
  'wx.airSmoke': `
    Fire season is another story. Some summers the smoke sits here for weeks.
    It's the smoke in fire season that gets you.
  `,
  'wx.fireOutlook': `
    And the fire weather outlook is {fireOutlook} today.
    Fire weather's rated {fireOutlook} today, so be careful.
  `,
  'wx.feel.clear': `
    Can't complain about weather like this.
    It's {very} nice out.
    @loose It's a {very} pretty day.
    This is why we live here.
    Perfect day to be outside.
    Not a cloud in the sky.
    @worrier Enjoy it while it lasts.
    @kid It's a good day for the park!
  `,
  'wx.feel.cloudy': `
    A little gray, but I don't mind.
    Kind of a gloomy one.
    Gray days are good for staying in.
  `,
  'wx.feel.fog': `
    The fog's thick today.
    It's {very} foggy. Drive careful.
    Can't see much past the end of the block.
    Foggy mornings are just part of life here.
  `,
  'wx.feel.rain': `
    We need the rain, so I won't complain.
    Everybody forgets how to drive the second it rains.
    Good day to stay inside.
    @house I'm watching my gutters.
  `,
  'wx.feel.heat': `
    It's brutal out there.
    It's {very} hot. Stay inside if you can.
    Stay in the shade if you can.
    Drink some water. I mean it.
    @outdoor Rough day to work outside.
  `,
  'wx.feel.cold': `
    Cold for here, anyway.
    It's {very} cold this morning. Well, for here.
    Sweatshirt weather.
    I had to dig out a jacket this morning.
  `,
  'wx.feel.wind': `
    The wind's something today.
    Hold onto your hat.
    @firezone Wind like this always makes me nervous about fires.
  `,
  'wx.feel.smoke': `
    The air's bad today. I'm staying in as much as I can.
    You can smell the smoke.
  `,
  'wx.feel.snow': `
    There's snow up high. Beautiful.
    Chains in the trunk, just in case.
  `,
  'wx.climate.tjul': `
    Summers here average around {tjul} in July.
    July highs average about {tjul} here.
    In summer it's usually around {tjul}.
  `,
  'wx.climate.rain': `
    We get about {rainIn} inches of rain a year.
    Something like {rainIn} inches of rain in a year here.
  `,
  'wx.climate.snow': `
    We get snow, about {snowIn} inches a year.
    About {snowIn} inches of snow in a normal year.
    Oh, we get snow. Something like {snowIn} inches a year.
  `,
  'wx.climate.snowLoad': `
    Oh, we get snow. The roofs up here are built to hold {psf} pounds per square foot of it.
    Plenty. Roofs here are designed for {psf} pounds of snow per square foot, and they need it.
  `,
  'wx.climate.someSnow': `
    Some, in a cold winter. Not like up in the high country.
    We get a little most winters. It doesn't stick around long.
  `,
  'wx.climate.noSnow': `
    Snow? Not down here. You can see it on {peak} after a storm, though.
    Not here, no. You have to drive up to the mountains for snow.
    Snow? Here? No. Maybe once in a lifetime.
  `,

  // ---------------------------------------------------------------- traffic and the commute
  'tr.drive': `
    I take {road} to {workCity}. {commuteMin} minutes if I'm lucky.
    {road} every morning to {workCity}.
    It's {commuteMin} minutes to {workCity} on {road}, on a good day.
    I drive to {workCity} on {road}. {commuteMin} minutes each way.
    My whole life is {road}. {commuteMin} minutes each way to {workCity}.
  `,
  'tr.driveLocal': `
    I work right here in town, so it's only {commuteMin} minutes.
    Work's close. {commuteMin} minutes, door to door.
    It's a short drive, {commuteMin} minutes. I'm lucky.
  `,
  'tr.carpool': `
    I carpool to {workCity}. {commuteMin} minutes, and the carpool lane helps.
    We carpool to {workCity}. It's {commuteMin} minutes and cheaper on gas.
  `,
  'tr.transit': `
    I take {transit} to {workCity}. About {commuteMin} minutes.
    {transitCap} to work, {commuteMin} minutes each way.
    I ride {transit} in. {commuteMin} minutes, and I get to read.
  `,
  'tr.bike': `
    I bike to work. {commuteMin} minutes and no traffic.
    I ride my bike in. {commuteMin} minutes, best part of my day.
  `,
  'tr.walk': `
    I walk to work. Best commute there is.
    I walk. {commuteMin} minutes and no parking to worry about.
  `,
  'tr.motorcycle': `
    I ride my motorcycle to {workCity}. Lane splitting saves my sanity.
    Motorcycle to {workCity}, {commuteMin} minutes.
  `,
  'tr.wfh': `
    I work from home, so I mostly skip {road}.
    No commute for me. I work from home and stay off {road}.
    I work from home. Best perk there is: no {road}.
  `,
  'tr.retired': `
    I'm retired, so I just stay off {road} at rush hour.
    Being retired, I can go when it's empty. Never {road} at five.
  `,
  'tr.noCar': `
    I don't have a car, so I take the bus.
    No car. I walk or take the bus.
    I don't drive. The bus gets me where I need to go, eventually.
  `,
  'tr.nonDriver': `
    I don't really drive much, honestly.
    I'm not on the road much these days.
  `,
  'tr.kidRide': `
    My {driverWord} drives me to school.
    {driverWord} takes me to school in the car.
  `,
  'tr.kidWalk': `
    I walk to school.
    I walk to school. It's close.
  `,
  'tr.kidBus': `
    I take the bus to school.
    I ride the school bus.
  `,
  'tr.kid': `
    I don't drive. I'm a kid.
    I can't drive yet!
  `,
  'tr.teenDrive': `
    I don't have my license yet.
    I can't drive yet. A couple more years.
  `,
  'tr.road': `
    {road} is the big one around here. {aadtCap}.
    {roadCap} carries {aadt}. You can hear it from my street.
    Around here it's all about {road}. {aadtCap}, they say.
    {roadCap} is the main way in and out of here. {aadtCap}.
  `,
  'tr.roadSmall': `
    {road} is the main road around here.
    Mostly we use {road}.
  `,
  'tr.roadFeel': `
    {roadCap} gets jammed every afternoon.
    Avoid {road} at rush hour if you can.
    {roadCap} at five o'clock? No thank you.
    There's always construction on {road}.
    @worrier I hate driving {road}. People are crazy out there.
  `,
  'tr.stretch': `
    And don't get me started on {stretch}.
    {stretchCap} is its own adventure.
    If you're going over {stretch}, give yourself extra time.
  `,
  'tr.roadQueryNear': `
    {roadQ}? That's right near me.
    Oh, {roadQ}. I know it well.
    {roadQ}, sure. It's close.
  `,
  'tr.roadQueryFar': `
    {roadQ}? That's not really my area.
    I don't drive {roadQ} much. It's a ways from here.
    {roadQ}? Never on it, honestly.
  `,
  'tr.transitShare': `
    {shareCap} take {transit} to work.
    Plenty of people here ride {transit}. {shareCap} take it to work.
  `,
  'tr.wfhShare': `
    {shareCap} work from home now, so mornings are quieter.
    {shareCap} work from home these days. The streets are emptier at eight than they used to be.
  `,
  'tr.feel': `
    Traffic around here is just part of life.
    Everybody complains about the traffic. Everybody also drives.
    I plan my whole day around traffic.
    @senior It wasn't always like this. Or maybe I just had more patience.
  `,

  // ---------------------------------------------------------------- fire
  'fire.lived': `
    {fireCap}, in {year}. I'll never forget it.
    I was here for {fire}, back in {year}.
    {fireCap}. {month} {year}.
    We went through {fire} in {year}.
    {fireCap} in {year}. That's the one everybody here remembers.
  `,
  'fire.livedChild': `
    I was little when {fire} happened, in {year}.
    I remember {fire} in {year}. I was just a kid.
  `,
  'fire.livedTeen': `
    I was {ageThen} when {fire} happened, in {year}.
    {fireCap}, in {year}. I was {ageThen}.
  `,
  'fire.tollThere': `
    It destroyed {dest} in {place}.
    It took out {dest} in {place}.
  `,
  'fire.remember': `
    I remember {fire}, in {year}.
    {fireCap}, {month} {year}. I remember it well.
    {fireCap} in {year}. It wasn't right here, but everybody felt it.
  `,
  'fire.distance': `
    It burned {miles} from here.
    The closest it got was {miles} away.
  `,
  'fire.toll': `
    It destroyed {dest} around here.
    It took out {dest} in {place}.
    {destCap} gone, just around here.
    We lost {dest} here.
  `,
  'fire.size': `
    It burned {acres} in all.
    {acresCap} burned.
    It burned {acres}, start to finish.
  `,
  'fire.before': `
    {fireCap} was in {year}, before I lived here. People still talk about it.
    That was before my time here, but {fire} in {year} burned {acres}.
    I moved here after {fire}, but you can still see where it burned.
  `,
  'fire.other': `
    And there was {fire} in {year}, too.
    Then {fire} in {year}.
    {fireCap} in {year} came close too.
  `,
  'fire.near': `
    We don't really get fires right in {place}. The closest was {fire}, back in {year}, {miles} away.
    Fire's not really our problem here. The nearest one I know of was {fire} in {year}, {miles} off.
    Not in town. {fireCap} in {year} was the closest, {miles} away.
  `,
  'fire.kidMore': `
    That's all I know. Ask my {parentWord}.
    I don't remember much else. Ask my {parentWord}.
  `,
  'fire.nothingMore': `
    That's really all there is to tell. We've been lucky.
    Honestly, that's about it. Fire's never come right through here.
  `,
  'fire.none': `
    Fire's not really a thing right here. Earthquakes, maybe.
    We're lucky. Fire hasn't been a problem right around here.
  `,
  'fire.zone': `
    {hazardCap} {place} is in a very high fire hazard zone.
    They've got {hazard} {place} marked as very high fire hazard.
    {hazardCap} this area is very high fire hazard, officially.
  `,
  'fire.prep': `
    We keep go-bags by the door now.
    I clear the brush every spring.
    I check the fire map every time the wind picks up.
    Everybody here has an evacuation plan. You have to.
    @house We cleared everything within thirty feet of the house.
  `,
  'fire.offshore': `
    And the {offName} winds are blowing today, so everybody's on edge.
    With the {offName} winds today, nobody's relaxed.
  `,
  'fire.alert': `
    There's a {alert} out right now, too.
    And there's a {alert} today. So, yeah.
  `,
  'fire.smoke': `
    Even when the fires aren't close, the smoke gets here.
    Some summers the smoke sits here for weeks.
  `,
  'fire.feel': `
    You never really get over it.
    It changes how you look at a windy day.
    It could happen again any year. That's the thing.
    @worrier I think about it every fire season.
    @steady You prepare and you live your life.
  `,
  'fire.kid': `
    There was a big fire here once. My {parentWord} told me about it.
    My {parentWord} told me there was a big fire here before I was born.
  `,

  // ---------------------------------------------------------------- storms, floods, wind
  'storm.ar': `
    The atmospheric river in {when} was a big one. A category {rank}.
    {whenCap}, the atmospheric river. Category {rank}.
    That storm in {when} was a category {rank} atmospheric river.
    The big one was {when}. A category {rank} atmospheric river.
  `,
  'storm.arLived': `
    I remember the one in {when}. {exp}
    The storm in {when}, I remember. {exp}
  `,
  'storm.arRank': `
    It was a category {rank} atmospheric river.
    That was a category {rank}, the strongest kind.
  `,
  'storm.fema': `
    The county got a federal disaster declaration for the {title}.
    The {title} got the county a disaster declaration.
    There was a disaster declaration for the {title}, {when}.
  `,
  'storm.femaLived': `
    The {title}. {exp}
  `,
  'storm.rainRecord': `
    The record for one day is {rainRec} inches, back in {when}.
    The most rain in a single day here was {rainRec} inches, in {when}.
  `,
  'storm.flood': `
    Flooding's a real thing here. There have been {floodWords} flood reports nearby since the nineties.
    We get floods. {floodWordsCap} flood reports around here over the years.
  `,
  'storm.dry': `
    We don't get much rain here. About {rainIn} inches a year.
    Storms? Not much. Maybe {rainIn} inches of rain a year.
  `,
  'storm.now': `
    And there's rain in the forecast {when}.
    Rain's coming {when}, they say.
  `,
  'storm.prep': `
    I clean the gutters before every storm.
    We keep sandbags in the garage, just in case.
    When the power goes out, we've got candles and a camp stove.
    @worrier I can't sleep when the wind's howling.
  `,
  'storm.wind': `
    The {windName} of {when} gusted to {gust} miles an hour.
    The worst wind I can think of was {when}. Gusts of {gust} miles an hour.
  `,
  'storm.gustRecord': `
    The strongest gust on record here was {gust} miles an hour, in {when}.
  `,
  'storm.none': `
    Big storms aren't really our thing here.
    We're pretty lucky with storms, honestly.
  `,

  // ---------------------------------------------------------------- heat
  'heat.days': `
    We get about {h100} days over 100 a year.
    Something like {h100} days a year hit 100 here.
    It's over 100 about {h100} days a year.
  `,
  'heat.days90': `
    About {h90} days a year hit 90.
    It's over 90 something like {h90} days a year.
  `,
  'heat.jul': `
    July averages around {tjul}.
    In July it's {tjul} on a normal day.
  `,
  'heat.record': `
    The record is {recTemp}, set {recDate}.
    Hottest day on record here was {recTemp}, back on {recDate}.
    It hit {recTemp} once. {recDateCap}. That's the record.
  `,
  'heat.recordLived': `
    I remember that day. {exp}
    I was here for that one. {exp}
  `,
  'heat.now': `
    It's {temp} right now, if you're wondering.
    Today it's {temp}.
  `,
  'heat.cope': `
    The AC runs from May to October.
    We close the blinds by noon and don't open them till dark.
    I do everything early, before it gets bad.
    @outdoor We start at dawn in the summer to beat the heat.
    @senior I stay inside in the afternoons when it gets bad.
    @desert You learn to live by the thermometer out here.
  `,
  'heat.coast': `
    Heat? Not really, not here. July averages around {tjul}.
    We don't really get hot here. July's about {tjul}.
    The ocean keeps us cool. July is around {tjul}.
  `,
  'heat.mild': `
    It gets warm, but it's not crazy. July's about {tjul}.
    Summers are warm. Around {tjul} in July.
  `,
  'heat.alert': `
    And there's a {alert} out, so yeah.
  `,

  // ---------------------------------------------------------------- housing and rent
  'house.value': `
    Houses around here go for {value} now.
    A regular house here runs {value}.
    You're looking at {value} for a house here.
  `,
  'house.bought': `
    We bought in {yearMoved}. I don't think we could afford it now.
    We got in back in {yearMoved}. Lucky timing.
    I bought in {yearMoved}. If I had to buy today, forget it.
  `,
  'house.boughtLong': `
    We bought our place in {yearMoved}, back when normal people could.
    {yearMoved}. That's when we bought. Different world.
  `,
  'house.kidsFuture': `
    My kids will never be able to afford to live here.
    I worry the kids won't be able to stay here.
  `,
  'house.young': `
    I still live with my {parentsWord}. It's the only way to save anything.
    Moving out costs so much. I'm saving.
  `,
  'house.minor': `
    I don't know. My {parentsWord} worry about that stuff.
    My {parentsWord} handle that.
  `,
  'house.owners': `
    It's mostly homeowners around here. People stay a long time.
    Most people on my street own their places.
  `,
  'house.renters': `
    Most people on my block rent.
    It's mostly renters around here.
  `,
  'house.opinion': `
    They need to build more housing. Simple as that.
    It's supply and demand. We don't build enough.
    I'm all for more housing, as long as they build the roads to go with it.
    @settled All this new construction, and nowhere to park.
    @settled I don't want this place to turn into a big city.
    @senior I don't know how young people do it these days.
  `,
  'rent.feel': `
    Rent goes up every year.
    Rent here is {very} expensive. That's just how it is.
    Rent is the first thing I pay and the last thing I stop thinking about.
    @works Most of my paycheck goes to rent.
    I'd love to buy someday. Not around here, though.
    @worrier Every time the lease comes up I hold my breath.
  `,
  'rent.ownerSide': `
    I own, so rent's not my problem directly. But I hear it from everybody.
    We own, thank goodness. Renters around here have it rough.
  `,
  'rent.family': `
    I live with family, so the rent isn't on me. But I hear about it.
    Not my bill, thank goodness. But nothing's cheap around here.
  `,
  'rent.noNumber': `
    I won't say what I pay. Too depressing.
    Don't ask me what I pay. It hurts to say out loud.
  `,

  // ---------------------------------------------------------------- insurance
  'ins.fair': `
    A lot of people around here got dropped and ended up on the FAIR Plan. {fairWordsCap} homes here are on it.
    {fairWordsCap} homes here are on the FAIR Plan now. That tells you everything.
    So many people here are on the FAIR Plan now. About {fair} for every 100 homes.
  `,
  'ins.nonren': `
    In 2023, {nonren} policies around here didn't get renewed.
    {nonrenCap} homeowners here got non-renewal letters in 2023.
  `,
  'ins.prem': `
    The average premium around here is about {prem} a year.
    People here pay about {prem} a year for homeowner's insurance, on average.
  `,
  'ins.mine': `
    Ours went up again this year.
    Every renewal letter, I hold my breath.
    We shopped around for months.
    @worrier I'm scared to open the mail from the insurance company.
  `,
  'ins.renter': `
    @rents I just have renter's insurance. The homeowners around here have it way worse.
    @rents I rent, so it's just renter's insurance for me. Owners are getting hammered.
  `,
  'ins.notMine': `
    I don't deal with the insurance. That's whoever owns the place.
    It's not my house, so I stay out of that. But I hear the complaints.
  `,
  'ins.minor': `
    I don't know anything about that. Ask my {parentWord}.
    That's grown-up stuff.
  `,
  'ins.low': `
    Insurance isn't too bad here, honestly. Not like up in the hills.
    We're lucky. Insurance here is still mostly normal.
  `,
  'ins.feel': `
    It's the fire risk. The companies don't want to cover it.
    It's the thing nobody talks about until their letter comes.
  `,

  // ---------------------------------------------------------------- earthquakes
  'quake.fema': `
    The county got a disaster declaration after the {title} in {year}.
    {titleCap}, {year}. That one shook everybody up.
    Remember the {title}? {year}. The county got federal disaster help for that one.
  `,
  'quake.lived': `
    I felt the {title}, in {year}. {exp}
    The {title}, {year}. I remember it. {exp}
  `,
  'quake.femaAfter': `
    The county got federal disaster help after that one.
    There was a federal disaster declaration for the county after it.
  `,
  'quake.prep': `
    We keep water and a flashlight in the garage.
    I strapped the water heater down. Everybody should.
    We've got an earthquake kit in the closet. Somewhere.
    I keep shoes by the bed, just in case.
  `,
  'quake.feel': `
    You never really get used to them.
    The little ones I sleep through. It's the big one I think about.
    It's California. You just live with it.
    @worrier Every truck that goes by, I think it's starting.
  `,
  'quake.none': `
    We feel the little ones now and then. Nothing big that I remember here.
    Small ones, sure. Nothing that did real damage around here.
  `,

  // ---------------------------------------------------------------- food
  'food.mine': `
    Honestly, I'm a taco truck person.
    I'm a sucker for a good burrito.
    Pho on a cold day, that's my thing.
    I'll eat anything, as long as it's good.
    @senior I like a good diner breakfast.
    @kid Pizza!
    @kid Mac and cheese. And pizza.
    @teen Anything fried. Don't judge.
  `,
  'food.cook': `
    I'd rather cook at home, honestly.
    I like cooking more than eating out.
  `,
  'food.heritage': `
    Nothing beats the {dish} at home.
    My family makes the best {dish}.
    Come by on a holiday and you'll get {dish}.
  `,
  'food.good': `
    The food around here is {very} good.
    Honestly, the tacos around here are so good.
    @loose The burritos around here are {very} good. I'm not even kidding.
  `,
  'food.lots': `
    You won't go hungry around here. There's food on every block.
    There are more places to eat around here than I could ever try.
    Every kind of food you can think of is within a few blocks.
  `,
  'food.some': `
    There's a decent spread of places to eat around here.
    We've got a few good spots. Not a ton, but good ones.
  `,
  'food.few': `
    Not many restaurants out here. Most of us cook.
    For restaurants, people mostly drive to {nearTown}.
    It's slim pickings out here. You learn to cook.
  `,
  'food.tip': `
    Ask anybody here, they'll tell you their favorite spot.
    Follow the line. If there's a line, it's good.
    The best places don't look like much from outside.
  `,

  // ---------------------------------------------------------------- places to go
  'place.beach': `
    {beachCap} is {miles} away. Go at sunset.
    If you like the water, {beach} is {miles} from here.
    You've got to see {beach}. It's {miles} away.
  `,
  'place.trail': `
    There's {trail}, {miles} from here. Great views.
    Try {trail}. It's {miles} away and worth it.
    If you like hiking, {trail} is {miles} from here.
  `,
  'place.landmark': `
    If you've got a day, go see {landmark}.
    You can't come here and not see {landmark}.
    {landmarkCap} is worth the trip.
  `,
  'place.water': `
    {water} is nice for an afternoon.
    Go out to {water}. It's {miles} from here.
  `,
  'place.park': `
    The park's nice in the mornings.
    There's a park close by. Good for a walk.
  `,
  'place.game': `
    Catch a {teamName} game if you can.
    If you're around for the season, go see {team}.
  `,
  'place.town': `
    {town} is worth a visit. It's {miles} {dir} of here.
    Drive over to {town}, {miles} {dir}. Nice place.
  `,
  'place.mine': `
    Honestly, my favorite thing around here is {doingThing}.
    If you ask me, {doingThing} is the best way to spend a day here.
  `,
  'place.none': `
    There's not a ton to do right here, honestly. But it's quiet.
    It's a quiet place. People come here to get away from things.
  `,

  // ---------------------------------------------------------------- directions
  'dir.place': `
    {target} is {miles} {dir} of here.
    {target}? That's {miles} {dir}.
    It's {miles} {dir} of here.
    {target} is {miles} {dir}, give or take.
  `,
  'dir.road': `
    Take {road}.
    Your best bet is {road}.
    Just get on {road} and go.
    Hop on {road}, it's easiest.
  `,
  'dir.near': `
    It's close. Just {miles} {dir}.
    Oh, that's right nearby. {milesCap} {dir}.
    Easy. {milesCap} {dir} of here.
  `,
  'dir.far': `
    {target}? That's a haul. {milesCap} {dir}.
    {target} is way out there. {milesCap} {dir}.
    That's a long way from here. {milesCap} {dir}.
  `,
  'dir.here': `
    You're in it! This is {place}.
    You're standing in it.
    This is {place}! You made it.
  `,
  'dir.errand': `
    The {word} I go to is in {city}, {miles} away.
    I use the {word} in {city}. {milesCap} from here.
  `,
  'dir.errandHere': `
    There's a {word} right here in town.
    The {word} I go to is close, right here in {place}.
  `,
  'dir.unknown': `
    Hmm, I couldn't give you good directions there.
    I'm not sure how to get there from here. Your phone will do better than me.
    I don't know that one well enough to give directions.
    @plain I'm afraid I couldn't give you directions there.
  `,
  'dir.kid': `
    I don't know. Ask my {parentWord}.
    I don't know where that is.
  `,
  'dir.map': `
    You'll want a map for the rest.
    Your phone will do better than me after that.
  `,

  // ---------------------------------------------------------------- the neighborhood
  'hood.urban': `
    It's busy. Always something going on.
    There's always noise, but I like the energy.
    You can walk to just about everything.
    It's crowded, but you're never bored.
  `,
  'hood.suburban': `
    It's quiet. Lots of families.
    Pretty quiet. People mow their lawns on Saturday.
    It's a good neighborhood. Nothing too exciting.
    Quiet streets, everybody waves.
  `,
  'hood.rural': `
    It's quiet out here. Lots of space.
    Everybody knows everybody out here.
    It's the country. You can hear yourself think.
  `,
  'hood.lang': `
    You hear a lot of {langName} on my block. {shareCap} speak it at home.
    {shareCap} speak {langName} at home.
    {langNameCap} is everywhere around here. {shareCap} speak it at home.
  `,
  'hood.old': `
    Most of the houses here went up in {decade}.
    A lot of the houses on my street are from {decade}.
    @funny The houses here are older than I am.
  `,
  'hood.landmark': `
    On a clear day you can see {peak} from here.
    You can see {peak} from around here when the air's clean.
  `,
  'hood.change': `
    @adult It's changed a lot since {zipSince}. Prices, mostly.
    @adult When I moved here in {zipSince} it was a different place. Same streets, different prices.
    @minor It's changed a little since we moved here in {zipSince}. More traffic.
  `,
  'hood.safe': `
    I feel safe here. People look out for each other.
    It's fine. Lock your car, like anywhere.
    I've never had a problem. Neighbors keep an eye out.
  `,
  'hood.like': `
    I like it here. It's home.
    I love it here. It's {very} easy to live here.
    I wouldn't live anywhere else.
    It has its problems, but I love it.
    @prickly It's fine. It's a place to live.
  `,
  'hood.region': `
    That's {region} for you.
    Welcome to {region}.
  `,

  // ---------------------------------------------------------------- history and memories
  'hist.since': `
    I've been here since {zipSince}.
    I moved here in {zipSince}.
    {zipSince}. That's when I got here.
  `,
  'hist.grew': `
    I grew up here, so I've seen it all change.
    I've been here my whole life. I've seen a lot.
  `,
  'hist.arrival': `
    I came to the US in {arrivalYear}.
    I got here in {arrivalYear}. A lot has changed since.
  `,
  'hist.event': `
    You know what I remember? {memTitleCap}. {exp}
    {memTitleCap}. {exp}
    I'll never forget {memTitle}. {exp}
    I remember {memTitle}. {exp}
  `,
  'hist.life': `
    {lifeLine}
  `,
  'hist.yearHit': `
    {year}? That was the year of {event}.
    {year}... that's {event}.
  `,
  'hist.yearMiss': `
    {year}? Nothing special that I remember, honestly.
    I can't think of anything big in {year}.
  `,
  'hist.kid': `
    I'm only {age}. I don't remember much.
    I'm too young to remember the old days.
  `,
  'hist.change': `
    It's changed a lot since {zipSince}. Prices, mostly.
    The place has grown up a lot since I got here.
  `,
  'hist.more': `
    That's about all I remember, honestly.
    I think I've told you my best stories already.
  `,

  // ---------------------------------------------------------------- opinions
  'op.politics': `
    I try to keep politics out of small talk.
    Ask me about the traffic instead. That I can rant about.
    I don't really get into politics with people I just met.
    @plain I'd rather not get into politics, if you don't mind.
    @kid I don't know. I'm a kid.
  `,
  'op.religion': `
    I go to church on Sundays. That's between me and God.
    My faith matters to me, but I don't push it on anybody.
  `,
  'op.religionNone': `
    I don't really talk about religion.
    That's a personal thing. I keep it to myself.
  `,
  'op.playerGood': `
    You seem nice enough.
    I like you. You ask good questions.
    You're all right.
  `,
  'op.playerMeh': `
    I'm still deciding.
    Ask me again in a bit.
  `,
  'op.playerBad': `
    Honestly? Not great so far.
    You haven't made the best impression.
  `,
  'op.traffic': `
    They keep widening {road} and it never helps.
    We need better transit. Everybody knows it.
    It's too many cars and not enough roads. Or too many roads. People argue.
  `,
  'op.weather': `
    Best weather in the world. I won't apologize for it.
    You pay for the weather here. Mostly it's worth it.
  `,
  'op.generic': `
    Honestly, I go back and forth on it.
    I don't have a strong opinion on that one.
    Depends who you ask. Everybody's got an opinion.
    @blunt I don't think about it much, honestly.
  `,
});
