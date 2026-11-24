// Legion · lexicon · Southern California voices: Los Angeles and Ventura, Orange County, the Inland Empire,
// the deserts and San Diego.

import { lines, words, slang } from './text.mjs';

/** Southern California families. */
export const FAMILIES = {
  la: {
    name: 'Los Angeles',
    register: 'Easygoing and fast at once; distance is measured in minutes; "the" before every freeway; "like" and "literally" across generations. Talks traffic, rent, the weather (and feeling cold below sixty), June Gloom, the Santa Anas, fire, the game, and food from everywhere.',
    words: words(`
      the 405 | road | SoCal puts "the" before every freeway number: the 405, the 10, the 5, the 101
      PCH | road | Pacific Coast Highway, State Route 1 along the coast
      the Valley | place | the San Fernando Valley, over the hill from the city
      over the hill | place | between the Valley and the Westside or Hollywood
      SigAlert | road | a radio traffic alert for a blocked lane
      June Gloom | weather | the gray early summer under the marine layer
      May Gray | weather | the gray mornings before June Gloom
      the marine layer | weather | the low cloud deck off the ocean that burns off by afternoon, or doesn't
      Santa Anas | weather | hot, dry desert winds in the fall; fire weather
      the Metro | transit | LA's trains and buses
      Metrolink | transit | the regional commuter trains
      the industry | work | the entertainment business
      the Big One | culture | the earthquake everybody's waiting for
      SoCal | identity | Southern California
      Angeleno | identity | a person from LA
      Amtrak | transit | the Pacific Surfliner out of Union Station, up to Santa Barbara or down to San Diego
    `),
    greetings: lines(`
      Hey! How's it going? How was the drive?
      Hey, what's up? You staying cool?
      Hi! Long time, how've you been?
      Hey there, how was traffic?
      Oh my gosh, hi!
      Hey, what's going on?
      Morning! You see how gray it is?
      Hey! You survived the freeway.
    `),
    farewells: lines(`
      Okay, I gotta go beat traffic.
      All right, drive safe on the freeway.
      Okay, let's get lunch soon, for real this time.
      Bye! Text me when you get home.
      Later! Don't take the 405.
      All right, see you on the other side of the hill.
      Okay, I'm gonna go try to find my car.
      Have a good one, stay cool.
    `),
    fillers: lines(`
      like
      literally
      basically
      you know what I mean
    `),
    intensifiers: lines(`
      literally
      insanely
      so
    `),
    agreement: lines(`
      Totally.
      For sure, for sure.
      Literally.
      Right?!
      Hundred percent.
      So true.
    `),
    surprise: lines(`
      Shut up.
      Wait, what?
      Oh my God.
      Are you kidding me?
      That's insane.
      Stop it. Really?
    `),
    weather: {
      fog: lines(`
        June Gloom, every single day.
        May Gray, then June Gloom, then it's August and everything's on fire.
        The marine layer's thick this morning. Burns off by noon, maybe.
        Gray at the beach and blazing in the Valley.
        Sun's out inland and it's gray at the coast. Classic.
      `),
      heat: lines(`
        {temp} in the Valley. Of course.
        It's so hot the freeway's shimmering.
        Heat wave, and the power keeps flickering.
        Even the beach is packed on a day like this.
        Too hot to go anywhere without AC.
      `),
      rain: lines(`
        It's raining, so everybody in LA forgot how to drive.
        The freeways are a disaster. It's raining.
        Rain like this, I worry about the burn areas sliding.
        Three drops of rain and there's a SigAlert.
        The LA River actually has water in it.
      `),
      wind: lines(`
        Santa Anas are blowing. Everybody's nervous.
        Santa Ana winds and red flag warnings. Here we go.
        Palm fronds all over the street from the wind.
        Hot wind out of the desert. That's fire weather.
      `),
      cold: lines(`
        It's {temp} and I'm freezing. Don't judge.
        Cold for LA means a jacket over a t-shirt.
        Got the space heater out. LA cold.
      `),
      smoke: lines(`
        Smoke from the fire is coming over the hills.
        Ash on my car this morning. That fire's close.
        The sun's red from the smoke. Scary.
        Everybody's checking the evacuation maps.
      `),
      snow: lines(`
        Snow on {peak}! You can see it from the freeway.
        Snow on the mountains and palm trees in the front yard. That's LA.
      `),
      clear: lines(`
        After the rain, the mountains look close enough to touch.
        The smog's gone and the sky's blue. Enjoy it.
        Sunny in January. Sorry, rest of the country.
      `),
    },
    traffic: lines(`
      {road} was a parking lot. Like always.
      There's a SigAlert on {road}, so plan on an hour.
      It's twelve miles and it took me an hour and ten.
      I don't go west of the 405 after three.
      Took surface streets the whole way to skip {road}.
      {road} at rush hour? I'll just live in my car.
      Everybody in LA measures distance in minutes, not miles.
      {stretch} was backed up again.
      The carpool lane was slower than the regular lanes, somehow.
      Somebody lost a mattress on {road}. Every week, a mattress.
      I listen to a whole podcast on {road} every morning.
    `),
    prideLines: lines(`
      LA's got the best food in the country, and I'll argue with anybody.
      You can surf in the morning and ski in the afternoon. Not that anybody does.
      Every neighborhood here is its own world.
      People think LA is Hollywood. It's not. It's all of us.
      The sunsets here are unreal.
      I'm an Angeleno, through and through.
      Taco trucks on every corner. Can't beat it.
      A {team} game is the only time LA agrees on anything.
      Say what you want about LA, it's home.
      There's nowhere else like this city.
    `),
    complaintLines: lines(`
      Rent in LA is criminal.
      Traffic is a full-time job.
      I spend more time in my car than at home.
      Everything's getting more expensive and nothing's getting better.
      You can't buy a house anywhere near where you work.
      Parking tickets in this city are a racket.
      Every time it's windy now, I worry about fires.
      The Metro's great if it goes where you're going. It doesn't.
      Insurance companies are pulling out of the hills.
    `),
    food: lines(`
      Taco truck tacos at midnight. That's LA.
      Bacon-wrapped hot dogs from the cart outside the game.
      Korean barbecue on a Friday night with the whole crew.
      The best pho, the best tacos, the best dim sum, all in one city.
      There's a hole-in-the-wall on every block that beats anything fancy.
      Thai food here is the best outside Thailand.
      Breakfast burritos are a food group here.
      Elote from the guy with the cart, with everything on it.
      Burgers from the stand with the line around the block.
      Fruit from the cart with chili and lime.
    `),
    youth: {
      greetings: lines(`
        Heyyy, what's up!
        Bro, what's up?
      `),
      farewells: lines(`
        Okay bye, see you!
        Later, bro.
      `),
      agreement: lines(`
        Literally.
        For real for real.
        Lowkey true.
      `),
      surprise: lines(`
        Literally what?
        Stop. You're lying.
      `),
      intensifiers: lines(`
        literally
        lowkey
      `),
    },
    elder: {
      greetings: lines(`
        Well, hello! Isn't this weather something?
      `),
      farewells: lines(`
        You drive safely now, those freeways are crazy.
      `),
    },
    slang: slang(`
      SigAlert | 1 | 25-85 | a radio traffic alert for a blocked lane | There's a SigAlert on the 10.
      grip | 2 | 15-40 | a lot ("a grip of") | There was a grip of people at the beach.
      fully | 2 | 15-45 | totally | I fully forgot.
    `),
    teams: ['the Dodgers', 'the Lakers', 'the Rams', 'the Clippers', 'the Kings', 'the Galaxy', 'LAFC', 'the Chargers', 'the Sparks', 'UCLA', 'USC'],
  },

  oc: {
    name: 'Orange County',
    register: 'Bright, upbeat and polished; beach-casual near the coast, suburban-practical inland. Says "OC" (never "the OC"), "the 405", "the 5", "the 55", and grumbles about the toll roads. Talks the beach, the weather, housing, the food in Little Saigon, the Angels and the Ducks.',
    words: words(`
      OC | identity | Orange County; locals don't say "the OC"
      the 714 | identity | north and central Orange County's area code
      the 949 | identity | the south and coastal OC area code
      the toll roads | road | the 73, 133, 241 and 261: fast, and they'll bill you
      the Orange Crush | road | the 5, 57 and 22 interchange in Orange
      the El Toro Y | road | where the 5 and the 405 merge in Irvine
      South County | place | Mission Viejo, San Clemente and everything south of Irvine
      June Gloom | weather | gray early summer at the coast
      Santa Anas | weather | the hot, dry fall winds through the canyons
      Little Saigon | place | Westminster and Garden Grove's Vietnamese business district
    `),
    greetings: lines(`
      Hey! How's it going?
      Hi! How was the drive?
      Hey, what's up? Beach later?
      Oh hey! Good to see you!
      Hey there! Gorgeous day, huh?
      Hi! How's your week going?
      Hey! You survived the 405.
      Morning! Gray at the beach again?
    `),
    farewells: lines(`
      Okay, I gotta beat traffic on the 405.
      Bye! See you at the beach.
      All right, have a good one, enjoy the sun.
      Okay, text me!
      Later! Don't let the toll roads bankrupt you.
      All right, see you this weekend.
      Okay, drive safe!
      Bye, have the best day.
    `),
    fillers: lines(`
      like
      literally
      honestly
    `),
    intensifiers: lines(`
      literally
      super
    `),
    agreement: lines(`
      Totally.
      Literally, yes.
      For sure.
    `),
    surprise: lines(`
      Shut up.
      No way!
      Oh my gosh, really?
    `),
    weather: {
      fog: lines(`
        June Gloom at the beach again.
        Gray at the coast, sunny in Anaheim.
        The marine layer's hanging on all day.
      `),
      heat: lines(`
        {temp} inland and perfect at the beach. Easy call.
        Hot enough that the whole county's at the beach.
      `),
      rain: lines(`
        It rained and the freeways forgot how to work.
        Rain! Everybody's driving like it's a blizzard.
      `),
      wind: lines(`
        Santa Anas are blowing through the canyons again.
        Red flag warning in the canyons. Everybody's nervous.
      `),
      cold: lines(`
        It's {temp} and I'm wearing a jacket. OC winter.
      `),
      smoke: lines(`
        Smoke from the fire in the canyons, and ash on the cars.
        The air's terrible. The fire's close.
      `),
      snow: lines(`
        Snow on {peak} this morning!
      `),
      clear: lines(`
        Clear enough to see Catalina from the beach.
        Perfect beach day. Honestly, every day is.
      `),
    },
    traffic: lines(`
      The 405 was a parking lot from Irvine to Long Beach.
      The El Toro Y at five is the worst place on earth.
      Took the toll road. Worth every dollar.
      The Orange Crush was crushed. Shocker.
      The 5 through Santa Ana, forget it.
      The 91 to Riverside was solid.
      PCH on a summer weekend is all beach traffic.
      Everybody's on the 55 at the same time.
    `),
    prideLines: lines(`
      Best beaches in California, I'll argue with anybody.
      Clean, safe and twenty minutes from the beach.
      Little Saigon has the best Vietnamese food outside Vietnam.
      Angels game on a summer night.
      Fireworks from the park in Anaheim every summer night.
      OC is more than what you see on TV.
    `),
    complaintLines: lines(`
      A starter home here costs a million dollars.
      The toll roads cost a fortune.
      Traffic on the 405 is a full-time job.
      Everything's a strip mall.
      Insurance in the canyons is impossible now.
    `),
    food: lines(`
      Pho in Little Saigon is the best anywhere.
      Fish tacos after the beach.
      Boba in Irvine. So many choices.
      Banh mi from the bakery in Westminster.
      Strawberries from the stand by the old fields.
    `),
    teams: ['the Angels', 'the Ducks', 'the Dodgers', 'the Rams', 'the Lakers', 'UC Irvine'],
  },

  ie: {
    name: 'Inland Empire',
    register: 'Unpretentious, proud, and a little defensive about the IE; long commutes and hot summers. Says "the IE", "the 909", "the 951", "the 10", "the 15", "the 91", "the 215". Talks heat, smog, warehouses, the Santa Anas and fire, Cajon Pass, and the commute to LA or OC.',
    words: words(`
      the IE | identity | the Inland Empire: Riverside and San Bernardino counties' valleys
      the 909 | identity | San Bernardino, Ontario, Rancho Cucamonga and Pomona's area code
      the 951 | identity | Riverside, Corona, Moreno Valley and Temecula's area code
      the 91 | road | the freeway to Orange County, the IE's commute
      the 215 | road | Riverside to San Bernardino, and south to Temecula
      the 15 | road | north through Cajon Pass to the High Desert and Vegas
      Cajon Pass | road | the climb out of the valley to the desert
      the warehouses | work | the distribution centers that fill the valley
      Metrolink | transit | the commuter trains into LA and OC
      Santa Anas | weather | hot fall winds out of the desert; fire weather
      smog | weather | it pools up against the mountains
      swamp cooler | home | an evaporative cooler, the old IE standby
    `),
    greetings: lines(`
      Hey, what's up? Hot enough for you?
      Hey! How's it going? You working today?
      What's going on? How was the drive?
      Hey, long time! Still out in {place}?
      Morning! Already hot, huh?
      Hey there! You beat the traffic?
      What's up! How's the family?
      Hey! You make it back from the coast okay?
    `),
    farewells: lines(`
      All right, drive safe on the 15.
      Okay, I gotta get on the road before the 91 locks up.
      Later, stay cool.
      All right, see you, don't melt.
      Okay, I'll catch you next time.
      Later! Watch the wind on the pass.
      All right, take it easy.
      Okay, go get some shade.
    `),
    fillers: lines(`
      like
      bro
      honestly
    `),
    intensifiers: lines(`
      so
      super
    `),
    agreement: lines(`
      Facts.
      For sure.
      Yeah, that's real.
    `),
    surprise: lines(`
      No way, bro.
      For real?
      That's crazy.
    `),
    weather: {
      fog: lines(`
        The marine layer made it all the way out here this morning? That's rare.
        Fog in the valley. You can't even see the mountains.
      `),
      heat: lines(`
        {temp} in the IE. Just another day.
        Too hot to touch the car door.
        The swamp cooler's working overtime.
        The pool's like bathwater, it's so hot.
      `),
      rain: lines(`
        Rain in the IE, everybody panics.
        The washes are running. Stay out of them.
      `),
      wind: lines(`
        Santa Anas through Cajon Pass, the big rigs are getting blown around.
        Santa Ana winds again. Everybody's watching for fires.
        Wind's so strong the palm trees are bending sideways.
      `),
      cold: lines(`
        Cold morning, frost on the lawns.
        The mountains got snow, so it's freezing down here.
      `),
      smoke: lines(`
        Smoke's coming over from the fire in the hills.
        Between the smog and the smoke, you can't see the mountains.
      `),
      snow: lines(`
        Snow on the mountains! You can see it from the 10.
        Fresh snow on {peak}. Best view in the IE.
      `),
      clear: lines(`
        After a storm you can see every mountain around the valley.
        Clear day. The mountains look close enough to touch.
      `),
    },
    traffic: lines(`
      The 91 was a parking lot all the way to Orange County.
      The 15 through Cajon Pass is all trucks.
      The 10 at rush hour, forget about it.
      Two hours each way to work in LA. Every day.
      Warehouse trucks on every road.
      The 215 and 60 interchange is a nightmare.
      Took Metrolink and read a whole book.
      Sunday afternoon on the 15 is everybody coming back from Vegas.
    `),
    prideLines: lines(`
      The IE gets a bad rap, but this is home.
      909 forever.
      951 all day.
      You can still buy a house here. Barely.
      Mountains, desert and the beach, all about an hour away.
      Real people, hard workers.
      Riverside has history. Look it up.
      Temecula wine country is right in our backyard.
    `),
    complaintLines: lines(`
      Warehouses everywhere you look.
      The air quality out here is terrible.
      The commute is killing me.
      LA and OC people act like we're the middle of nowhere.
      Summers keep getting hotter.
      Everybody priced out of the coast moved here, and now we're getting priced out too.
    `),
    food: lines(`
      Taco trucks after a long shift.
      Fresh oranges from the old groves.
      Burgers from the stand on old Route 66.
      Wine tasting in Temecula on a Saturday.
      Carne asada in the backyard every weekend.
    `),
    slang: slang(`
      the IE | 1 | 12-85 | the Inland Empire | Born and raised in the IE.
    `),
    teams: ['the Dodgers', 'the Rams', 'the Lakers', 'the Angels', 'UC Riverside', 'the Chargers'],
  },

  desert: {
    name: 'Desert',
    register: 'Easygoing, weathered and a little wry; the heat is a fact of life. Says "dry heat", "snowbirds", "swamp cooler", "monsoon", "the wash", "the base". Talks heat, wind, dust, water, the long drive to the city, and how quiet and beautiful the desert is.',
    words: words(`
      dry heat | weather | what everyone says, and it's still hot
      snowbirds | identity | winter residents from colder places
      swamp cooler | home | an evaporative cooler; works until the humidity comes
      monsoon | weather | summer thunderstorms from the south, with flash floods in the washes
      the wash | place | a dry streambed that floods fast in a storm
      dust storm | weather | wind-driven walls of dust that drop visibility to nothing
      the base | work | the nearby military base, a big employer
      the 760 | identity | the desert's area code, with the 442 overlay
    `),
    greetings: lines(`
      Hey! Staying cool?
      Morning! Get your walk in before the heat?
      Hey there, how's it going?
      Well, hey! Haven't seen you since spring.
      Hey! You back for the season?
      Morning! Gonna be a scorcher.
      Hi! How's the heat treating you?
      Hey, good to see you out and about.
    `),
    farewells: lines(`
      Stay hydrated out there.
      All right, stay cool.
      Okay, drive safe, watch for the wind.
      See you next season.
      Take care, keep the water bottle full.
      All right, see you when it cools off.
      Okay, go hide from the sun.
      Take it easy out there.
    `),
    fillers: lines(`
      well
      anyhow
      honestly
    `),
    intensifiers: lines(`
      real
      plenty
    `),
    agreement: lines(`
      Yep.
      Sure is.
      You got that right.
    `),
    surprise: lines(`
      Huh. Really?
      Well, I'll be.
      No kidding.
    `),
    weather: {
      fog: lines(`
        Fog in the desert? I've never seen that.
      `),
      heat: lines(`
        {temp}, and it's a dry heat. Still an oven.
        You do everything before nine in the morning in summer.
        The steering wheel's untouchable. Oven mitts in the car.
        The swamp cooler can't keep up with this.
        Summer here is like winter everywhere else. You stay inside.
      `),
      rain: lines(`
        Monsoon storm coming, the washes will run.
        Flash flood warning. Stay out of the washes.
        It rained and the whole desert smells like creosote.
        The rain came sideways and was over in ten minutes.
      `),
      wind: lines(`
        Wind's blowing sand across the road again.
        Dust storm coming. You can see the wall of it.
        The wind never stops out here.
      `),
      cold: lines(`
        Cold desert night. You forget how cold it gets.
        Frost in the desert, and the snowbirds are complaining.
      `),
      smoke: lines(`
        Smoke from the fires in the mountains blew down into the valley.
      `),
      snow: lines(`
        Snow on {peak}! Palm trees and snow in one view.
        Snow on the mountains and shorts weather down here.
      `),
      clear: lines(`
        Winter in the desert is perfect. That's why everybody comes.
        Clear night, a million stars.
        Not a cloud for a hundred miles.
      `),
    },
    traffic: lines(`
      {road} through the desert is long and straight, and somebody's always flying.
      The wind closed {road} again. Sand everywhere.
      Snowbird season. The roads are full.
      Nothing out here but the road and the heat.
      Watch for blowing sand on {road}.
      It's an hour to anywhere, and nobody minds.
      {stretch} was windy enough to push the car around.
      Big rigs on {road} all night long.
      Somebody broke down on {road} in the heat. Always carry water.
    `),
    prideLines: lines(`
      The desert's beautiful if you know how to look.
      Winters here are the best in the country.
      The stars out here are unreal.
      Quiet. Space. Nobody on top of you.
      People think the desert's empty. It's full of life.
      Wildflowers after a wet winter, unbelievable.
      {place} is small, but it's ours.
      Desert people are tough and kind.
    `),
    complaintLines: lines(`
      Summers are brutal and the power bill is worse.
      Everything's an hour's drive away.
      Water's going to be the fight out here.
      The wind and the dust never quit.
      Nobody comes here in July, and I understand why.
      The nearest hospital is a long way off.
      Jobs out here are few and far between.
    `),
    food: lines(`
      A date shake on a hot day, the best thing in the desert.
      Tamales at the market in December.
      Burgers at the old diner on the highway.
      Fresh dates from the grove.
      Fresh grapefruit from a neighbor's tree.
      Mexican food from the little place by the highway.
      Ice-cold watermelon on the porch in July.
    `),
    teams: ['the Dodgers', 'the Lakers', 'the Rams', 'the Padres'],
  },

  sd: {
    name: 'San Diego',
    register: 'Laid-back, sunny, outdoorsy and friendly; beach-casual near the coast, suburban-practical inland. Says "the 5", "the 8", "the 15", "the 805". Talks the weather (perfect), May Gray, surfing, the Navy, the border, fish tacos, and the Padres.',
    words: words(`
      the 5 | road | San Diego's freeways always take "the": the 5, the 8, the 15, the 805
      the Coaster | transit | the North County commuter train along the coast
      the trolley | transit | San Diego's light rail, down to the border
      the Sprinter | transit | the inland North County train, Oceanside to Escondido
      North County | place | Oceanside, Carlsbad, Encinitas, Escondido and on up
      East County | place | El Cajon, Santee, La Mesa, Lakeside and the backcountry
      South Bay | place | Chula Vista, National City and Imperial Beach; not LA's, not the Bay Area's
      May Gray | weather | the gray spring mornings off the ocean
      June Gloom | weather | the gray early summer
      TJ | place | Tijuana, just across the border
      the Navy | work | the bases and the ships, a big part of San Diego life
      America's Finest City | identity | the city's own nickname, used half-ironically
      the 619 | identity | the core San Diego area code
      Amtrak | transit | the Pacific Surfliner up the coast to LA
    `),
    greetings: lines(`
      Hey! Beautiful day, huh?
      Hey, how's it going? Catch any waves?
      Morning! Gray again, huh?
      Hey there! How's everything?
      Oh hey! You heading to the beach?
      Hi! How's your week been?
      Hey! Long time, what's new?
      Morning! Another perfect one.
    `),
    farewells: lines(`
      Okay, enjoy the sunshine.
      All right, see you at the beach.
      Later! Have a good one.
      Okay, take it easy. It's San Diego.
      All right, drive safe on the 5.
      Okay, see you this weekend.
      Bye! Go Padres.
      Take care, enjoy the sunset.
    `),
    fillers: lines(`
      like
      honestly
      dude
    `),
    intensifiers: lines(`
      super
      totally
    `),
    agreement: lines(`
      Totally.
      Right on.
      For sure, dude.
    `),
    surprise: lines(`
      No way, dude.
      Whoa, really?
      That's crazy.
    `),
    weather: {
      fog: lines(`
        May Gray, June Gloom, and then summer finally shows up in August.
        Gray at the beach, sunny ten minutes inland.
        The marine layer's thick this morning.
      `),
      heat: lines(`
        {temp} in East County, perfect at the beach.
        It's actually hot. San Diego doesn't do hot.
      `),
      rain: lines(`
        It's raining, so the whole city's staying home.
        Rain in San Diego is an event.
      `),
      wind: lines(`
        Santa Anas are blowing. Everything's dry.
        Hot wind from the east. Red flag warning.
      `),
      cold: lines(`
        It's {temp} and I'm freezing. I've lived here too long.
        San Diego winter means a hoodie in the morning.
      `),
      smoke: lines(`
        Smoke from the backcountry fire is blowing west.
      `),
      snow: lines(`
        Snow on {peak}! Everybody's driving out to Julian.
      `),
      clear: lines(`
        Sunny and perfect, like always.
        You can see the islands off the coast today.
        Another perfect day in paradise.
      `),
    },
    traffic: lines(`
      The 5 through downtown at five, forget it.
      The 805 was backed up past the 52.
      The 15 up to North County was a parking lot.
      Took the trolley. Way easier.
      The merge where the 5 and the 805 split, the worst.
      Border traffic coming back was long again.
      Took the Coaster up to work and read the whole way.
      The 8 east was stopped at the 805.
    `),
    prideLines: lines(`
      Best weather in the country, and it's not close.
      Beach, bay, mountains, desert, all in one county.
      Go Padres! The whole city's behind them.
      San Diego is laid-back, and we like it that way.
      The sunsets at the cliffs are unreal.
      Fish tacos were made for a place like this.
    `),
    complaintLines: lines(`
      The sunshine tax is real.
      Rent near the beach is impossible.
      Military pay doesn't go far here.
      Everything good costs a fortune.
      The traffic is getting as bad as LA.
    `),
    food: lines(`
      Fish tacos at the beach. San Diego classic.
      California burrito, with the fries inside.
      Carne asada fries after a night out.
      Tacos in Barrio Logan.
      There's a taco shop on every corner, and most of them are great.
    `),
    teams: ['the Padres', 'the Aztecs', 'San Diego FC', 'the Wave', 'the Gulls'],
  },
};

/** Southern California dialect keys. */
export const KEYS = {
  'la-westside': {
    family: 'la', name: 'the Westside', region: 'Los Angeles (Westside: Santa Monica to Westchester)', areaCodes: ['310', '424'],
    words: words(`
      the 310 | identity | the Westside and South Bay area code
      the Westside | place | from about the 405 west to the ocean
      the beach | place | always "the beach," never "the ocean"
      the canyons | place | Topanga, Malibu, Mandeville: winding roads and fire danger
      the Expo Line | transit | the train from downtown to Santa Monica, by its old name
      Venice | place | the boardwalk, the canals, the skate park
    `),
    weather: {
      clear: lines(`
        Clear day, you can see Catalina.
      `),
      fog: lines(`
        Gray at the beach until two, then gorgeous.
        Marine layer in Santa Monica, scorching in the Valley.
      `),
    },
    traffic: lines(`
      I don't go east of the 405 after three.
      PCH to Malibu on a Sunday, forget it.
      The Sepulveda Pass at five is where dreams go to die.
      Took the train to Santa Monica. Honestly not bad.
    `),
    prideLines: lines(`
      Ocean air every day. I'm spoiled.
      Sunset off the pier never gets old.
      Biking the beach path down to the South Bay. That's my Sunday.
      Venice is weird and wonderful.
    `),
    complaintLines: lines(`
      A one-bedroom near the beach costs more than a house almost anywhere.
      Everything's a twenty-minute drive that takes forty.
      Parking at the beach costs as much as lunch.
      The fires in the canyons scare me more every year.
    `),
    food: lines(`
      Fish tacos by the beach.
      Farmers market in Santa Monica on Wednesday, chefs everywhere.
      Ramen on Sawtelle, then boba.
      Acai bowl after a surf.
    `),
    slang: slang(`
      the 310 | 1 | 13-80 | the Westside and South Bay | Born and raised in the 310.
    `),
  },
  'la-central': {
    family: 'la', name: 'Central LA', region: 'Los Angeles (Hollywood, Koreatown, downtown, Silver Lake)', areaCodes: ['213', '323'],
    words: words(`
      the 213 | identity | downtown's area code, the original
      the 323 | identity | Hollywood and the old core around downtown
      K-Town | place | Koreatown, open late, always busy
      DTLA | place | downtown Los Angeles
      the Eastside | place | to some, Silver Lake and Echo Park; to others, only east of the river
      the Hollywood sign | place | always there in the corner of your eye
      Griffith Park | place | the city's big hilly park with the observatory
    `),
    weather: {
      heat: lines(`
        {temp} downtown, and the concrete's holding every bit of it.
      `),
    },
    traffic: lines(`
      Hollywood traffic on a Friday night, don't even.
      The 101 through Hollywood was stopped dead.
      Took the train downtown. Way easier than parking.
      The four-level was a mess again.
    `),
    prideLines: lines(`
      K-Town never sleeps, and neither do I.
      Griffith Park on a clear morning, you can see the whole city.
      Silver Lake has the best little shops and coffee.
      Downtown has the best old buildings in the city.
      Every culture in the world is within a mile of me.
    `),
    complaintLines: lines(`
      Parking in Hollywood is a scam.
      Rent in Echo Park doubled since I moved in.
      Tourists stop dead in the middle of the sidewalk on the Walk of Fame.
      Downtown's always under construction.
    `),
    food: lines(`
      Korean barbecue in K-Town until two in the morning.
      Thai Town for late-night noodles.
      Street tacos outside the club.
      Armenian bakery in East Hollywood.
    `),
  },
  'la-eastside': {
    family: 'la', name: 'the Eastside', region: 'Los Angeles (East LA, Boyle Heights, Northeast LA, the Gateway Cities)', areaCodes: ['323', '562'],
    words: words(`
      the Eastside | place | east of the LA River: Boyle Heights, East LA, Lincoln Heights, El Sereno and on out
      the 323 | identity | the old LA area code around downtown
      the 562 | identity | the southeast cities' and Long Beach's area code
      Whittier Boulevard | place | the main drag through East LA, famous for cruising
      the 710 | road | the truck freeway to the port
      the river | place | the LA River, concrete and all
      NELA | place | Northeast LA: Highland Park, Eagle Rock, Cypress Park, Glassell Park
      the swap meet | place | the open-air market for everything
    `),
    weather: {
      heat: lines(`
        {temp} east of the river. The ocean breeze never makes it this far.
      `),
    },
    traffic: lines(`
      The 710 is nothing but trucks from the port.
      The East LA Interchange. Enough said.
      The 60 and the 5 both backed up, so I'm stuck either way.
      Took the train downtown. Way easier.
    `),
    prideLines: lines(`
      The Eastside is the heart of LA.
      Boyle Heights raised me.
      Cruising down Whittier Boulevard on a Sunday. The cars are art.
      Everybody knows everybody's family here.
      Highland Park still has that neighborhood feel.
      The murals around here tell the whole story.
    `),
    complaintLines: lines(`
      The freeways cut right through the neighborhood.
      Rents keep going up and the old families are getting pushed out.
      The trucks from the port make the air terrible.
      The city forgets about east of the river.
    `),
    food: lines(`
      Tacos de canasta from the lady on the corner.
      Menudo on Sunday morning.
      Pan dulce from the bakery.
      Elote and raspados after school.
    `),
  },
  sfv: {
    family: 'la', name: 'the Valley', region: 'Los Angeles (San Fernando Valley, Burbank, Glendale)', areaCodes: ['818', '747'],
    words: words(`
      the 818 | identity | the Valley's area code, and its identity
      the Valley | place | the San Fernando Valley, flat and hot and proud of it
      over the hill | place | to the Westside or Hollywood, through a canyon or the Sepulveda Pass
      Ventura Boulevard | place | the Valley's main street of restaurants and shops
      the canyons | road | Coldwater, Laurel, Beverly Glen: the back ways over the hill
      the Orange Line | transit | the busway across the Valley, by its old name
    `),
    weather: {
      heat: lines(`
        {temp} in the Valley. Always hotter than the city.
        Valley heat is no joke. The pool is the only answer.
      `),
    },
    traffic: lines(`
      Getting over the hill takes the whole day.
      The 405 through the pass at five, I'd rather walk.
      The 101 through the Valley is solid red.
      Took Coldwater to skip the pass, and so did everybody else.
    `),
    prideLines: lines(`
      The Valley has more real people than the rest of LA.
      The 818 forever.
      Backyards, pools and room to breathe.
      Ventura Boulevard has every kind of food.
      The studios are in Burbank. This is where the shows really get made.
    `),
    complaintLines: lines(`
      The Valley gets so hot in summer.
      Everybody from the city looks down on the Valley.
      Getting anywhere from here takes an hour.
    `),
    food: lines(`
      Sushi on Ventura Boulevard, the best in the city.
      Armenian bakery in Glendale, the lahmajoun is unbeatable.
      Taco trucks in North Hollywood.
      Pupusas in Van Nuys.
    `),
    slang: slang(`
      the 818 | 1 | 13-80 | the San Fernando Valley | Valley kid, 818 forever.
    `),
  },
  'santa-clarita': {
    family: 'la', name: 'Santa Clarita Valley', region: 'Los Angeles County (Santa Clarita, Valencia, Castaic)', areaCodes: ['661'],
    words: words(`
      the SCV | identity | the Santa Clarita Valley
      the 661 | identity | the area code shared with the Antelope Valley and Kern
      the 14 | road | the freeway out to the Antelope Valley
      the Newhall Pass | road | where the 5 and the 14 split, the bottleneck into LA
      the paseos | place | Valencia's walking paths under the streets
    `),
    weather: {
      heat: lines(`
        {temp} in Santa Clarita, hotter than the Valley even.
      `),
      wind: lines(`
        Santa Anas through the canyon. Everybody's watching the hills.
      `),
    },
    traffic: lines(`
      The 5 through the Newhall Pass is how I spend every morning.
      Everybody commutes into the Valley at the same time.
      The 14 backs up all the way from the Antelope Valley.
    `),
    prideLines: lines(`
      Safe, quiet, good schools, close enough to LA.
      The paseos in Valencia. My kids walk everywhere.
      You can hear the roller coasters screaming on summer nights.
      Real hills, real trails.
    `),
    complaintLines: lines(`
      Fire season out here is terrifying.
      The commute into LA is brutal.
      Every hill is turning into houses.
      Nothing to do at night.
    `),
    food: lines(`
      Barbecue in the backyard every weekend.
      The good restaurants are in Old Town Newhall.
      Taco truck by the park after soccer.
    `),
  },
  'la-south': {
    family: 'la', name: 'South LA', region: 'Los Angeles (South LA, Inglewood, Compton)', areaCodes: ['323', '310', '424'],
    words: words(`
      the 323 | identity | South LA's area code, with the 310 to the west
      Crenshaw | place | the boulevard and the district, a center of Black LA history
      the Shaw | place | Crenshaw, for short
      Leimert Park | place | the neighborhood of art, music and drum circles
      the stadium | place | the football stadium in Inglewood
      the Coliseum | place | the old stadium at Exposition Park
      the 110 | road | the Harbor Freeway, straight down the middle
    `),
    weather: {
      heat: lines(`
        {temp} and no shade at the bus stop.
      `),
    },
    traffic: lines(`
      The 110 was stopped dead from downtown.
      Game day in Inglewood, don't go anywhere near the stadium.
      The 105 actually moved today. Shocking.
      Took the train to the Coliseum. Way better than parking.
    `),
    prideLines: lines(`
      Leimert Park on a Sunday: the drums, the art, everybody's out.
      South LA built a lot of what LA is.
      Inglewood is the center of the sports world now.
      My family's been here for generations.
      Everybody knows everybody on my block.
    `),
    complaintLines: lines(`
      They put a stadium up and the rents shot up.
      Grocery stores with real produce are too far.
      The bus takes forever.
      Developers want everything, and they're pushing families out.
    `),
    food: lines(`
      Fried catfish and greens on a Sunday.
      Taco trucks on Slauson.
      Barbecue from the spot on Crenshaw.
      Burgers from the stand on the corner.
    `),
  },
  'southbay-la': {
    family: 'la', name: 'the South Bay', region: 'Los Angeles (the beach cities, Torrance, San Pedro, Carson)', areaCodes: ['310', '424'],
    words: words(`
      the South Bay | place | the beach cities, Torrance, Gardena, Carson and San Pedro; LA's South Bay, not the Bay Area's
      the beach cities | place | Manhattan, Hermosa and Redondo
      the Strand | place | the beach walk and bike path through the beach cities
      the port | work | the Port of Los Angeles in San Pedro and Wilmington
      Pedro | place | San Pedro, to locals
      PV | place | Palos Verdes, the hilly peninsula
    `),
    weather: {
      fog: lines(`
        June Gloom in the beach cities, the whole month.
        Fog's sitting on PV this morning.
      `),
    },
    traffic: lines(`
      The 405 through the South Bay at five is a crawl.
      PCH through the beach cities on a summer weekend, no thanks.
      The 110 to the port is all trucks.
      The bridge to Terminal Island was backed up.
    `),
    prideLines: lines(`
      Beach volleyball, the Strand, sunsets. Can't beat it.
      Pedro is a real neighborhood. Everybody knows everybody.
      Torrance has the best Japanese food outside Japan.
      PV on a clear day, you can see Catalina.
    `),
    complaintLines: lines(`
      Beach city rent is out of control.
      The refinery smell when the wind's wrong.
      Trucks from the port everywhere.
      Parking near the pier in summer, forget it.
    `),
    food: lines(`
      Japanese curry and ramen in Torrance.
      The fish market in San Pedro, fried fish right there on the dock.
      Hawaiian plate lunch in Gardena.
      Poke bowls after the beach.
    `),
  },
  longbeach: {
    family: 'la', name: 'Long Beach', region: 'Los Angeles County (Long Beach and the 562)', areaCodes: ['562'],
    words: words(`
      the LBC | identity | Long Beach
      the 562 | identity | Long Beach and the southeast cities' area code
      the port | work | the Port of Long Beach, cranes on the skyline
      Belmont Shore | place | Second Street's bars and shops by the beach
      the Queen Mary | place | the old ocean liner docked in the harbor
      the 710 | road | the truck freeway up from the port
      Cambodia Town | place | the stretch of Anaheim Street at the heart of Long Beach's Cambodian community
    `),
    weather: {
      wind: lines(`
        Breezy by the water, hot inland.
      `),
      clear: lines(`
        Clear day, you can see Catalina from the shore.
      `),
    },
    traffic: lines(`
      The 710 is port trucks, all day, every day.
      The 405 through Long Beach at five is stopped.
      Took the Blue Line downtown. It's the A Line now, whatever.
      Second Street on a Saturday, no parking anywhere.
    `),
    prideLines: lines(`
      The LBC has its own thing going. Not LA, not OC.
      Long Beach has a little of everybody.
      Biking the beach path along the shore.
      Cambodia Town has some of the best food in the city.
    `),
    complaintLines: lines(`
      The air near the port is terrible.
      Rent by the beach went crazy.
      The trucks never stop.
      Parking in Belmont Shore is impossible.
    `),
    food: lines(`
      Cambodian noodle soup in Cambodia Town.
      Fish tacos by the shore.
      Mexican seafood spot on Anaheim Street.
      Breakfast at the diner by the water.
    `),
    teams: ['the Dodgers', 'the Lakers', 'the Rams', 'Long Beach State', 'the Galaxy', 'the Clippers'],
  },
  sgv: {
    family: 'la', name: 'San Gabriel Valley', region: 'Los Angeles County (Pasadena to Pomona)', areaCodes: ['626', '909'],
    words: words(`
      the 626 | identity | the San Gabriel Valley's area code, with its night markets, boba and car culture
      the SGV | identity | the San Gabriel Valley
      the San Gabriels | place | the mountains along the north edge of the valley
      boba | food | tapioca milk tea; the SGV takes it seriously
      the foothills | place | Altadena, Sierra Madre, Monrovia and Glendora under the mountains
      the Rose Parade | culture | the New Year's parade down Colorado Boulevard in Pasadena
    `),
    weather: {
      heat: lines(`
        {temp} in the SGV. It's always hotter out here.
        No ocean breeze out here, just heat.
      `),
      wind: lines(`
        Santa Anas coming down the canyons. Everybody's watching the foothills.
      `),
    },
    traffic: lines(`
      The 10 east at five is solid from downtown to West Covina.
      The 210 was backed up all the way to Pasadena.
      Kellogg Hill was a mess again.
      Took the train to Pasadena. Not bad.
    `),
    prideLines: lines(`
      Best Chinese food in America, right here in the 626.
      Boba is a lifestyle here.
      The San Gabriels right there every morning.
      Pasadena on New Year's morning, the whole world's watching.
      Old Town Pasadena on a Friday night.
    `),
    complaintLines: lines(`
      The smog sits right up against the mountains.
      Everybody drives here. Nobody walks.
      Housing in the nice school districts costs a fortune.
      Fire season in the foothills keeps everybody up at night.
    `),
    food: lines(`
      Soup dumplings in San Gabriel, then boba.
      Dim sum in Monterey Park on a Sunday.
      Hot pot for every celebration.
      Night market food all summer.
      Taiwanese breakfast: warm soy milk and fried dough.
    `),
    slang: slang(`
      the 626 | 1 | 13-80 | the San Gabriel Valley | Boba runs in the 626.
    `),
  },
  ventura: {
    family: 'la', name: 'Ventura County', region: 'Ventura County (Ventura, Oxnard, Thousand Oaks, Simi Valley)', areaCodes: ['805', '820'],
    words: words(`
      the 805 | identity | Ventura County's area code, shared with the Central Coast
      the Conejo | place | the Conejo Valley: Thousand Oaks, Newbury Park, Westlake
      Simi | place | Simi Valley
      the Rincon | road | the 101 along the water up to Santa Barbara
      the strawberry fields | ag | Oxnard's fields along the 101
      the islands | place | the Channel Islands offshore
    `),
    weather: {
      fog: lines(`
        Fog over the strawberry fields this morning.
        Marine layer at the harbor, sunny in Ojai.
      `),
      wind: lines(`
        Santa Anas through the canyons. The whole county's on edge.
      `),
    },
    traffic: lines(`
      The 101 over the Conejo Grade was crawling.
      The 118 into the Valley every morning, same story.
      Everybody from LA heading up the coast on the weekend.
      Farm trucks on the back roads in Oxnard.
    `),
    prideLines: lines(`
      Close to LA, but it's not LA, and that's the point.
      Ventura's still a beach town at heart.
      The islands on a clear day look close enough to swim to.
      Ojai sunsets. The pink moment.
      Oxnard strawberries are the best.
    `),
    complaintLines: lines(`
      Fire season in the canyons terrifies everybody.
      Housing's gotten as expensive as LA.
      The 101 is the only way anywhere.
    `),
    food: lines(`
      Fresh strawberries from the stand by the 101.
      Fish tacos at the harbor.
      Avocados from the groves up the canyon.
    `),
    teams: ['the Dodgers', 'the Rams', 'the Lakers', 'the Chargers', 'the Kings'],
  },

  'oc-coast': {
    family: 'oc', name: 'Coastal Orange County', region: 'Orange County (Huntington Beach to San Clemente)', areaCodes: ['949', '714', '657'],
    words: words(`
      the pier | place | Huntington Beach pier, or Newport's, or whichever is yours
      Surf City | identity | Huntington Beach
      the Wedge | place | Newport's shorebreak, where the big waves stack up
      the harbor | place | Newport Harbor and its boats
      the swallows | culture | the birds that return to San Juan Capistrano's mission every spring
      Laguna | place | Laguna Beach: galleries and coves
    `),
    weather: {
      fog: lines(`
        Gray at the pier until noon.
        June Gloom means I'm surfing alone.
      `),
    },
    traffic: lines(`
      PCH through Newport on a Saturday, total gridlock.
      Laguna Canyon Road on a summer weekend, bring snacks.
      Parking near the pier is a nightmare all summer.
    `),
    prideLines: lines(`
      Surf City, for a reason.
      Sunset at the pier, every night if I can.
      Laguna's coves and galleries. Nothing like it.
      Living by the beach, I'll never take it for granted.
    `),
    complaintLines: lines(`
      Tourists all summer, every summer.
      Beach parking costs more than lunch.
      Rent at the beach is out of reach.
    `),
    food: lines(`
      Fish tacos at the pier.
      Breakfast burrito after dawn patrol.
      Acai bowls everywhere you look.
    `),
    youth: {
      greetings: lines(`
        What's up, brah?
      `),
    },
    slang: slang(`
      dawn patrol | 2 | 15-70 | an early-morning surf session | Dawn patrol tomorrow?
      brah | 2 | 15-55 | buddy (surfer) | What's up, brah?
      kook | 2 | 14-60 | a clueless beginner, usually in the water | Some kook dropped in on me.
    `),
  },
  'oc-inland': {
    family: 'oc', name: 'Inland Orange County', region: 'Orange County (Anaheim, Santa Ana, Irvine, Fullerton)', areaCodes: ['714', '657', '949'],
    words: words(`
      the park | place | the theme park in Anaheim, with its fireworks every summer night
      Little Saigon | place | Westminster and Garden Grove
      Downtown Santa Ana | place | the old downtown, theaters and murals
      Irvine | place | planned villages, quiet streets
      the Circle | place | Old Towne Orange's plaza
    `),
    weather: {
      heat: lines(`
        {temp} in Anaheim, and the beach is right there.
      `),
    },
    traffic: lines(`
      The 5 through Anaheim is always under construction.
      Game day at the stadium, the 57 is stopped.
      Everybody in Irvine leaves at the same time.
      The 22 to the 405, worst merge in the county.
    `),
    prideLines: lines(`
      Fireworks from the park every summer night, right from my backyard.
      Little Saigon has the best food in the county.
      Irvine is safe and clean, and the schools are great.
      Old Towne Orange on a Saturday.
      Downtown Santa Ana is the real OC.
    `),
    complaintLines: lines(`
      Irvine is beautiful and you can't afford a thing.
      The beach is close, but parking is a nightmare.
      Every field became a housing tract.
      Tourist traffic around the resort, all year.
    `),
    food: lines(`
      Pho in Westminster after a long week.
      Banh mi from the bakery, still cheap and still perfect.
      Mexican food in Santa Ana, the real deal.
      Korean food in Buena Park and Fullerton.
      Boba in Irvine. There's a new place every week.
    `),
  },

  ie: {
    family: 'ie', name: 'Inland Empire', region: 'Inland Empire (Riverside, San Bernardino, Ontario, Temecula)', areaCodes: ['909', '951', '840'],
    words: words(`
      Mount Rubidoux | place | Riverside's hill with the cross on top and the sunrise hike
      the Pass | place | Banning, Beaumont and the windy gap to the desert
      Temecula | place | wine country at the south end of the 951
      Rancho | place | Rancho Cucamonga
    `),
    traffic: lines(`
      The 60 through Moreno Valley at five is a crawl.
      The 15 through Temecula on a Friday, forget it.
      The 10 through the Pass, hold on to the wheel.
    `),
    prideLines: lines(`
      Sunrise from Mount Rubidoux. Best view in the IE.
      Rancho is clean and the mountains are right there.
    `),
    complaintLines: lines(`
      Every orange grove turned into a warehouse.
      The 91 toll lanes cost a fortune.
    `),
    food: lines(`
      Mexican food in San Bernardino, the real stuff.
      Breakfast burritos from the truck by the warehouse.
    `),
  },

  'desert-cv': {
    family: 'desert', name: 'Coachella Valley', region: 'Desert (Palm Springs to Indio)', areaCodes: ['760', '442'],
    words: words(`
      the Valley | place | here, the Coachella Valley
      up valley, down valley | place | up valley is Palm Springs and the west end; down valley is Indio, Coachella and Mecca
      the windmills | place | the wind turbines in the pass outside Palm Springs
      the tram | place | the aerial tramway up Mount San Jacinto
      date shake | food | blended dates and ice cream, the desert's signature drink
      the Salton Sea | place | the shrinking inland sea at the south end of the valley
      season | identity | the winter high season, when the snowbirds are here
    `),
    weather: {
      heat: lines(`
        {temp} in Palm Springs. The misters are on everywhere.
        Summer in the desert, and the town empties out.
      `),
      wind: lines(`
        The wind through the pass is howling. The windmills are spinning.
      `),
    },
    traffic: lines(`
      Season traffic on Highway 111, every light.
      The 10 through the windmills is windy. Hold the wheel.
      Festival traffic in Indio. Avoid it.
    `),
    prideLines: lines(`
      Sunshine almost every day of the year.
      The mountains turn pink at sunset.
      Palm Springs has that midcentury style nobody else has.
      Golf in January in shorts.
      Date groves and mountains. It's like nowhere else.
    `),
    complaintLines: lines(`
      Summer power bills are unreal.
      The Salton Sea smell when the wind's wrong.
      Everything shuts down in summer.
      The workers can't afford to live anywhere near the resorts.
    `),
    food: lines(`
      Date shake in Indio.
      Tacos in Coachella, the real deal.
      Brunch by the pool in Palm Springs.
    `),
  },
  'high-desert': {
    family: 'desert', name: 'High Desert', region: 'Mojave Desert (Victorville, Hesperia, Barstow, Ridgecrest, Twentynine Palms)', areaCodes: ['760', '442'],
    words: words(`
      the High Desert | identity | the Victor Valley and the Mojave towns up above Cajon Pass
      the Victor Valley | place | Victorville, Hesperia, Apple Valley and Adelanto
      the Pass | road | Cajon Pass, the drive down to the valley
      Vegas traffic | road | Sunday afternoons on the 15
      Joshua trees | place | the desert's spiky signature trees
      the base | work | Fort Irwin, Twentynine Palms, Edwards or China Lake, depending on the town
      the 395 | road | north toward Ridgecrest and the Eastern Sierra
    `),
    weather: {
      wind: lines(`
        The wind's blowing so hard the trash cans are in the next county.
        Wind and snow on the Pass. They'll close it.
      `),
      cold: lines(`
        Freezing at night up here. People forget it's high desert.
      `),
      snow: lines(`
        Snow in the High Desert! The Joshua trees look unreal.
      `),
    },
    traffic: lines(`
      When the Pass closes, the whole High Desert is stuck.
      Sunday on the 15 is everybody driving home from Vegas.
      Trucks on the 395 all day.
      Commuting down the hill every day, two hours easy.
    `),
    prideLines: lines(`
      You can still own a house with a yard up here.
      Quiet and open. I can breathe out here.
      Joshua trees and sunsets. That's home.
      The stars at night, unbelievable.
    `),
    complaintLines: lines(`
      The commute down the hill is killing me.
      Nothing's open late.
      The wind never, ever stops.
      The jobs are all down the hill.
    `),
    food: lines(`
      Burgers at the old diner on Route 66.
      Taco truck outside the base gate.
      Barbecue in the backyard every weekend.
    `),
  },
  'antelope-valley': {
    family: 'desert', name: 'Antelope Valley', region: 'Los Angeles County desert (Lancaster, Palmdale) and Rosamond', areaCodes: ['661'],
    words: words(`
      the AV | identity | the Antelope Valley
      the 661 | identity | the AV's area code, shared with Santa Clarita and Kern
      the 14 | road | the Antelope Valley Freeway down to Santa Clarita and LA
      the poppies | place | the orange hills of the poppy reserve in spring
      aerospace | work | the plants and flight-test centers that built the AV
    `),
    weather: {
      wind: lines(`
        AV wind. It never quits.
        Wind's blowing sand across the 14.
      `),
      clear: lines(`
        The poppies are blooming on the hills. Everything's orange.
      `),
    },
    traffic: lines(`
      The 14 into the city every morning, two hours.
      Palmdale to the Valley is a long haul.
      The 138 is two lanes and people pass like crazy.
    `),
    prideLines: lines(`
      Poppy season in the AV is the best show in the state.
      Aerospace built this valley, and we still build the planes.
      Big skies, open space, real sunsets.
      The AV is still affordable, and that matters.
    `),
    complaintLines: lines(`
      Commuting to LA eats my whole life.
      The wind and the dust, every day.
      There's nothing to do here but drive somewhere else.
    `),
    food: lines(`
      Taco trucks on the boulevard.
      Fruit stands in Littlerock in the summer.
      Burgers at the old stand in Lancaster.
    `),
    slang: slang(`
      the AV | 1 | 12-80 | the Antelope Valley | Born and raised in the AV.
    `),
  },
  'low-desert': {
    family: 'desert', name: 'Colorado River and low desert', region: 'Desert (Blythe, Needles, Borrego Springs)', areaCodes: ['760', '442'],
    words: words(`
      the river | place | the Colorado River, the line with Arizona and the reason anyone lives here
      the 40 | road | Needles' interstate east to Arizona
      the 10 | road | Blythe's interstate between Phoenix and LA
      Anza-Borrego | place | the desert state park around Borrego Springs
    `),
    weather: {
      heat: lines(`
        {temp} by the river, so everybody's in it.
        Some days this is the hottest place in the country, and we live here on purpose.
      `),
    },
    traffic: lines(`
      Everybody between Phoenix and LA stops here for gas.
      The 40 is all trucks.
      Snowbird RVs on every road in winter.
    `),
    prideLines: lines(`
      The river in summer. Nothing better.
      Wildflowers in Borrego after a wet winter, unbelievable.
      Small towns where everybody waves.
    `),
    complaintLines: lines(`
      The nearest big store is hours away.
      The heat in summer is dangerous.
      Nobody comes out here except to pass through.
    `),
    food: lines(`
      Fresh fish from the river.
      Pie at the café in town.
    `),
  },
  imperial: {
    family: 'desert', name: 'Imperial Valley', region: 'Imperial County (El Centro, Calexico, Brawley)', areaCodes: ['760', '442'],
    words: words(`
      the Imperial Valley | place | the farm valley below sea level, green in the middle of the desert
      the canal | place | the All-American Canal that waters the valley
      the border | place | Calexico and Mexicali, two cities that are really one community
      lettuce season | ag | the winter vegetables: lettuce, carrots, broccoli
      the 8 | road | the interstate west to San Diego, up and over the mountains
      the Salton Sea | place | the lake at the north end of the valley
    `),
    weather: {
      heat: lines(`
        {temp} in the valley. Just a summer day.
        The fields need water, and so do we.
      `),
      wind: lines(`
        Dust storm coming off the desert. You can't see the road.
      `),
    },
    traffic: lines(`
      The line at the border crossing was long again.
      The 8 over the mountains to San Diego, that's a climb.
      Farm trucks and tractors on every road at harvest.
      Carrot trucks on the 86.
    `),
    prideLines: lines(`
      We grow the winter vegetables for the whole country.
      Calexico and Mexicali. Two cities, one family.
      Small-town valley. Everybody knows your family.
      Sunrise over the fields, the mountains purple.
    `),
    complaintLines: lines(`
      The heat in summer is deadly.
      The air is bad from the dust and the dry lakebed.
      The jobs are seasonal and the pay is low.
      San Diego forgets we're part of the same region.
    `),
    food: lines(`
      Carne asada on the weekend.
      Tacos in Calexico, the real thing.
      Fresh lettuce right from the field.
      Dates from the groves.
    `),
    teams: ['the Padres', 'the Dodgers', 'the Chargers', 'the Rams'],
  },

  'sd-coast': {
    family: 'sd', name: 'Coastal San Diego', region: 'San Diego County coast (Oceanside to Imperial Beach)', areaCodes: ['619', '858', '760', '442'],
    words: words(`
      the cliffs | place | Sunset Cliffs, the evening spot
      PB | place | Pacific Beach
      OB | place | Ocean Beach
      Encinitas | place | the surf town in North County
      Torrey Pines | place | the bluff park and the gliderport
      the bay | place | Mission Bay or San Diego Bay
      dawn patrol | surf | the early surf session before work
    `),
    traffic: lines(`
      PB on a Saturday, nowhere to park.
      The Coaster's packed with surfboards in summer.
      The 5 through Del Mar on race day, avoid it.
    `),
    prideLines: lines(`
      Surfing before work. That's the life.
      OB is the last real beach town.
      Sunset at the cliffs, every week.
      Encinitas is the best surf town in the county.
    `),
    complaintLines: lines(`
      Short-term rentals took over the beach neighborhoods.
      Parking at the beach in summer, forget it.
      Tourists everywhere, all year.
    `),
    food: lines(`
      Fish tacos from the shack after surfing.
      A breakfast burrito at dawn.
      Poke at the market by the harbor.
    `),
    youth: {
      greetings: lines(`
        What's up, brah?
      `),
    },
    slang: slang(`
      dawn patrol | 2 | 15-70 | an early-morning surf session | Dawn patrol tomorrow?
      brah | 2 | 15-55 | buddy (surfer) | What's up, brah?
      kook | 2 | 14-60 | a clueless beginner, usually in the water | Some kook dropped in on me.
    `),
  },
  'sd-inland': {
    family: 'sd', name: 'Inland San Diego', region: 'San Diego County inland (East County, inland North County, Chula Vista)', areaCodes: ['619', '858', '760', '442'],
    words: words(`
      the 8 | road | the freeway east through Mission Valley and out to the mountains
      the 52, the 125 | road | the East County connectors
      Escondido | place | inland North County
      the backcountry | place | Julian, Ramona, the ranches
    `),
    weather: {
      heat: lines(`
        {temp} in East County. The beach people have no idea.
      `),
    },
    traffic: lines(`
      The 8 west in the morning is everybody heading to the coast for work.
      The 15 from Escondido at five is solid.
      The 125 out to Santee was backed up.
    `),
    prideLines: lines(`
      East County is the real San Diego.
      More house for the money than at the beach.
      Backcountry ranches, horses, open space.
      Julian in the fall for apple pie.
    `),
    complaintLines: lines(`
      It's so much hotter out here than at the coast.
      Wildfire season out here is no joke.
      The commute to the coast eats your day.
    `),
    food: lines(`
      Chaldean bakery in El Cajon, the best bread around.
      Korean barbecue on Convoy.
      Apple pie in Julian.
    `),
  },
};
