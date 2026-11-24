// Legion · lexicon · Northern California voices: the Bay Area, the Sacramento Valley, the San Joaquin Valley
// and the North State. FAMILIES hold what a whole region shares; KEYS hold each sub-region's own words and
// lines. dialects.mjs layers statewide + family + key into DIALECTS.

import { lines, words, slang } from './text.mjs';

/** Regional families of Northern California. */
export const FAMILIES = {
  bay: {
    name: 'Bay Area',
    register: 'Casual, quick, a little understated; "hella" from most people under fifty and more from the young. Says 101, 880, 280 with no "the". Brings up microclimates, rent, commutes and tech without being asked.',
    words: words(`
      hella | intensifier | very, a lot of: "hella foggy", "hella people"; born in the Bay, used by every generation under about fifty
      hecka | intensifier | the milder, kid-safe hella
      the city | place | San Francisco, never Oakland or San Jose: "going into the city"
      the Bay | place | the whole region, or the water itself
      BART | transit | Bay Area Rapid Transit, the regional trains
      Caltrain | transit | the Peninsula commuter train between San Francisco and San Jose
      the bridge | road | whichever bridge you cross every day; context decides
      Karl the Fog | weather | the summer fog over San Francisco, talked about like a person who overstays
      the marine layer | weather | the low cloud deck that comes in off the ocean
      microclimates | weather | sun in one neighborhood, fog three blocks over
      Diablo winds | weather | the dry offshore winds of autumn; red flag days and power shutoffs
      NorCal | identity | Northern California, said with some pride
      tech | work | the industry: "she's in tech"
    `),
    greetings: lines(`
      @wx:cold,fog,rain,wind,snow Hey! You staying warm out there?
      @wx:fog Hey, how's it going? Fog get you this morning?
      Oh hey, I haven't seen you in forever.
      Hey, you made it! How was the drive?
      What's up? You still living in {neighborhood}?
      Hey, how's everything on your side of the Bay?
      @wx:heat,rain,wind,cold,smoke,snow Hi! Crazy weather, huh?
      Hey, good timing, I was just about to head out.
    `),
    farewells: lines(`
      All right, get home safe.
      @drives Okay, I'm gonna try to beat traffic.
      Later! Bring a jacket, it's going to get cold.
      Okay, see you on the other side of the bridge.
      @wx:rain Have a good one, stay dry.
      All right, catch you next time you're over this way.
      Text me when you get home.
      @wx:fog,clear Okay, I'm out before the fog rolls back in.
    `),
    fillers: lines(`
      like
      you know what I mean
      so yeah
      honestly
    `),
    intensifiers: lines(`
      hella
      super
      way
    `),
    agreement: lines(`
      Hella true.
      Yeah, for real.
      Facts, though.
      Yeah, that's real.
      Hundred percent.
    `),
    surprise: lines(`
      That's wild.
      Hella crazy.
      Shut up, really?
      Are you serious right now?
      No way. In this economy?
    `),
    weather: {
      fog: lines(`
        Karl the Fog is back.
        The fog's pouring over the hills again.
        Socked in on this side of the hill, and probably sunny on the other. Microclimates.
        @m6-8 It's summer, so of course it's foggy.
        @coast The foghorns had me up all night.
        The fog's sitting right on {landmark}.
        Layers. Always layers.
      `),
      heat: lines(`
        {temp}? In the Bay? Half these houses don't even have AC.
        When it gets this hot everybody heads for the coast.
        A real heat wave here always feels like fire weather to me.
        Everybody's at the beach, and it's probably still foggy there.
      `),
      rain: lines(`
        Feels like one of those atmospheric rivers.
        The hills are finally going to turn green.
        @works Good for the reservoirs, bad for my commute.
        Rain like this, I worry about the hillsides sliding.
      `),
      wind: lines(`
        @offshore Diablo winds again. Everybody's on edge.
        @alert:redflag Red flag day. They might shut off the power up in the hills.
        @coast Wind's whipping right off the bay.
      `),
      cold: lines(`
        Bay Area cold is damp. It gets right into your bones.
        Grab a hoodie, it's going to drop once the fog comes in.
        @coast It's not that cold, it's the wind off the water.
      `),
      smoke: lines(`
        Smoke again. Probably drifting down from up north.
        When the sky goes orange from the fires, it feels like another planet.
        Masks on for the smoke again.
      `),
      snow: lines(`
        Snow on {peak}! People are driving up just to look at it.
        Snow up at Tahoe, so the whole Bay's going to be on 80 this weekend.
      `),
      clear: lines(`
        You can see all the way across the bay today.
        @coast No fog today. Rare. Enjoy it.
        @m9-10 Fall is our real summer here.
        @m9-10 September and October are the best weather we get.
        Clear day. The bridges look unreal.
      `),
    },
    traffic: lines(`
      Bridge traffic was brutal this morning.
      @drives The metering lights at the bridge took forever.
      {road} was backed up the whole way.
      @drives Took me an hour to go fifteen miles.
      @drives @works The carpool lane is the only reason I'm not late.
      The tech shuttles were blocking the whole lane again.
      {stretch} was jammed again.
      Nobody in the Bay knows how to merge. Nobody.
      @drives I left at six to beat traffic and it was already bad at six.
      {road} through the whole Bay is a nightmare at five.
    `),
    prideLines: lines(`
      There's no place like the Bay when the weather's right.
      Ocean, redwoods, the city, all within an hour. Where else?
      Bay Area people are just different. We just are.
      Burritos here are better than anywhere. I'll fight about it.
      The views from the hills never get old.
      Everything starts here first. Good and bad.
      Go {teamName}. Always.
      Once you've lived in the Bay, everywhere else feels small.
      The food here, honestly. You can eat anything from anywhere.
    `),
    complaintLines: lines(`
      @adult @native Rent is insane. Everybody I grew up with moved to Sacramento or out of state.
      @adult A million dollars for a two-bedroom fixer. A million.
      @rents My landlord raised the rent again.
      @adult The cost of living is pushing everybody out.
      They keep building and none of it's for regular people.
      BART is great when it works.
      Tech money changed everything around here.
      @rents I pay that much in rent and I still have roommates.
      @adult You need two incomes and a miracle to buy anything here.
    `),
    food: lines(`
      Mission-style burrito, foil-wrapped, as big as your arm. That's lunch.
      Dim sum on Sunday morning, that's tradition.
      Sourdough from a real bakery. Nothing like it.
      Garlic fries at the ballgame. I don't even care about the score.
      @anytime Dungeness crab season is the best time of year.
      Pho on a foggy day just makes sense.
      Banh mi from the little spot by the station.
      The ramen line was out the door again.
      Saturday farmers market, then a long walk.
      @works Boba run after work. It's a whole ritual.
    `),
    youth: {
      greetings: lines(`
        What's up, what's up.
        Ayy, what's good?
        Hella long time, what's up?
      `),
      farewells: lines(`
        All right, I'm out, I'm hella tired.
        Yee, see you!
        Later, hit me up.
      `),
      agreement: lines(`
        Hella.
        Yee.
        Fasho.
        That's hella true.
      `),
      surprise: lines(`
        That's hella crazy.
        Bro, no way.
        Yo, that's wild.
      `),
      intensifiers: lines(`
        hella
        hecka
        dumb
      `),
      fillers: lines(`
        bro
        like
      `),
    },
    elder: {
      greetings: lines(`
        @wx:fog Well, hello! Isn't this fog something?
        @h4-11 @wx:cold,fog,rain,wind,snow Good morning! Chilly one today.
      `),
      farewells: lines(`
        @wx:cold,fog,rain,wind,snow Bundle up out there.
        Mind the bridge traffic going home.
      `),
      surprise: lines(`
        Well, how about that.
      `),
    },
    slang: slang(`
      hella | 1 | 12-55 | very; a lot of (born in the Bay, now NorCal-wide) | It's hella cold today.
      hecka | 1 | 8-16 | very (the kid-safe hella) | That's hecka cool.
      yee | 2 | 14-35 | yes!, an excited yeah | Yee, let's go.
      fasho | 2 | 14-40 | for sure | Fasho, I'll be there.
      dumb | 2 | 15-40 | very (as in "dumb good") | That burrito was dumb good.
      the Yay | 2 | 15-40 | the Bay Area | Nothing like the Yay.
      hyphy | 3 | 30-48 | wild, high energy (the Bay rap era) | That party got hyphy.
      yadadamean | 3 | 30-48 | you know what I mean | It's hella late, yadadamean?
      bootsie | 3 | 15-35 | lame, fake | Those shoes are bootsie.
    `),
    teams: ['the Giants', 'the Warriors', 'the Niners', 'the Valkyries'],
  },

  sac: {
    name: 'Sacramento Valley',
    register: 'Laid-back, friendly, plainspoken; "hella" is common in Sacramento. Talks heat and the Delta breeze, the rivers and levees, state jobs, the drive up to Tahoe, and Bay Area people moving in.',
    words: words(`
      hella | intensifier | very, a lot of; as common in Sacramento as in the Bay
      the Valley | place | the Sacramento Valley, and the Central Valley as a whole; never the San Fernando Valley
      tule fog | weather | the thick ground fog of valley winters
      the Delta breeze | weather | the cool evening wind up from the Delta that saves summer nights
      triple digits | weather | summer afternoons over one hundred
      the river | place | the American or the Sacramento, depending on who you ask
      the levee | place | the river banks people walk, ride and watch in flood years
      frontage road | road | the side road that runs along the freeway
      the foothills | place | the Sierra foothills east of the valley
      up the hill | place | to Tahoe or the mountains
      the Bay | place | the Bay Area, a couple of hours west
      Amtrak | transit | the Capitol Corridor trains between Sacramento, Davis and the Bay Area
    `),
    greetings: lines(`
      @wx:heat Hey! Hot enough for you?
      @wx:heat Hey, how's it going? Staying cool?
      @h4-11 @wx:fog Morning! You see that fog?
      Hey there, how's your week?
      Oh hey, I didn't know you were back in town.
      Hey, how's the family doing?
      Well, hey! Haven't seen you since the river.
      @h4-11 @wx:heat Morning! Supposed to be another warm one.
    `),
    farewells: lines(`
      @wx:heat All right, stay cool.
      @wx:fog Okay, drive safe in the fog.
      @wx:heat Have a good one, don't melt.
      Okay, I'll see you at the river.
      All right, say hi to everybody for me.
      @wx:heat Okay, take it easy, it's too hot to rush.
      Later! Drive careful on 99.
    `),
    fillers: lines(`
      like
      you know
      honestly
    `),
    intensifiers: lines(`
      hella
      real
      super
    `),
    agreement: lines(`
      Hella true.
      Yep.
      You got that right.
      Yeah, for sure.
    `),
    surprise: lines(`
      No way, really?
      Huh, I had no idea.
      That's hella wild.
    `),
    weather: {
      fog: lines(`
        Tule fog's so thick I couldn't see the car in front of me.
        Foggy-day schedule at the schools again.
        @m11-2 Tule fog season. Low beams and patience.
        The fog didn't lift all day.
        You can't see the other side of the field.
      `),
      heat: lines(`
        @m5-8 Triple digits. Welcome to summer in the valley.
        Everybody says it's a dry heat. It's still an oven.
        @anytime I get everything done before ten in the morning in the summer.
      `),
      rain: lines(`
        When the rivers come up like this, everybody starts watching the levees.
        The bypass is filling up.
        Rain's good for the rice.
        The ground's soaked and the creeks are full.
      `),
      wind: lines(`
        North wind's blowing and my allergies are done.
        Wind's kicking up dust off the fields.
        A north wind like this dries everything out fast.
      `),
      cold: lines(`
        Frost on the lawn. Gotta cover the citrus.
        Valley cold is wet and gray.
        Below freezing this morning. The ground was white.
      `),
      smoke: lines(`
        The smoke settles in the valley and has nowhere to go.
        Every fire up in the hills, the smoke ends up down here.
        Air's so bad you can't see the foothills.
      `),
      snow: lines(`
        Snow in the foothills! You can see it from the freeway.
        Fresh snow up the hill, so everybody's going to be on 80.
      `),
      clear: lines(`
        Clear day, you can see the Sierra from here.
        @m3-5 Spring in the valley is perfect. Short, but perfect.
        After the rain you can see the mountains for miles.
      `),
    },
    traffic: lines(`
      {road} through downtown at five, forget it.
      Everybody heading up to Tahoe on a Friday turns 80 into a mess.
      Traffic's nothing like the Bay, but it's getting there.
      Somebody's always crawling up 50 on a ski weekend.
      Fog on {road} this morning, everybody doing thirty.
      @drives The frontage road was faster than the freeway.
      @m7-10 @drives Harvest trucks on the two-lane, so I just settled in.
      {stretch} was backed up again.
    `),
    prideLines: lines(`
      We're close to everything: Tahoe, the coast, the Bay.
      People are friendly here. Not fake friendly.
      @anytime River in the summer, snow in the winter, a couple hours either way.
      The valley feeds half the country.
      I'll take our sunsets over anybody's.
      @native {place} is my town. Born and raised.
      Kids still ride their bikes everywhere here.
      The trees, the rivers, the farms. I love it here.
    `),
    complaintLines: lines(`
      @anytime The summers keep getting hotter.
      @adult Bay Area people moved here and now we can't afford it either.
      Traffic used to be nothing. Not anymore.
      @anytime Allergy season here is no joke.
      Everybody talks about the Bay and forgets we exist.
      @adult @anytime The power bill in July is worse than anything in winter.
      Our water is always somebody else's fight.
    `),
    food: lines(`
      @anytime Peaches right off the tree in summer.
      Sweet corn from a roadside stand.
      Taco trucks everywhere, and they're all good.
      The Sunday farmers market is the best thing in town.
      Rice from up the road, almonds from down the road.
      @anytime Tomatoes in August. Nothing else compares.
    `),
    youth: {
      farewells: lines(`
        @wx:heat All right, I'm out, it's hella hot.
      `),
      agreement: lines(`
        Hella.
        Yee.
      `),
      intensifiers: lines(`
        hella
      `),
    },
    elder: {
      greetings: lines(`
        @h4-11 @wx:heat Morning! Gonna be another hot one.
      `),
      farewells: lines(`
        @wx:heat Stay cool, now.
      `),
      agreement: lines(`
        You got that right.
      `),
    },
    slang: slang(`
      hella | 1 | 12-55 | very; a lot of | It's hella hot today.
      yee | 2 | 14-35 | yes!, an excited yeah | Yee, river day.
    `),
    teams: ['the Kings', 'the Niners', 'the Giants', 'the Warriors'],
  },

  sjv: {
    name: 'San Joaquin Valley',
    register: 'Plainspoken, warm, practical, proud and a little defensive. Talks heat, fog, water, ag work, the drive on 99, and the coast or the mountains as the weekend escape. "The Valley" means the Central Valley.',
    words: words(`
      the Valley | place | the Central Valley, never the San Fernando Valley
      tule fog | weather | thick winter ground fog; foggy-day school schedules, pileups on 99
      the 99 | road | Highway 99, the valley's main street; usually just "99"
      frontage road | road | the side road along the freeway or highway
      the canal | place | the irrigation canals; swim at your own risk
      ag | work | agriculture, the work everything here runs on
      the packing house | work | where fruit gets sorted, boxed and shipped
      fruit stand | food | roadside stands selling peaches, cherries, corn and melons
      Valley fever | health | a fungal infection from the dust, a real worry here
      the foothills | place | the Sierra foothills to the east
      the coast | place | Monterey, Pismo or Santa Cruz for a weekend, a few hours west
      water | ag | groundwater, canals, allocations; everybody has an opinion
      Amtrak | transit | the San Joaquins, the valley's train from Bakersfield up to Sacramento and the Bay Area
    `),
    greetings: lines(`
      @wx:heat Hey! Hot one today, huh?
      Hey there, how you doing?
      @h4-11 @wx:fog Morning! Fog lift where you're at?
      Hey, how's the family?
      Well, hey, I haven't seen you in a while.
      Hey, how's work been?
      @h4-11 @wx:heat Morning! You get any sleep in this heat?
      @m6-10 Hey there! Busy season, huh?
    `),
    farewells: lines(`
      @wx:heat All right, stay cool out there.
      @wx:fog Okay, careful in the fog.
      See you, tell your folks hi.
      Take it easy, don't work too hard.
      Okay, I'll let you get back to it.
      All right, see you at the game.
      Drive safe on 99, people are crazy.
      @wx:heat @h6-15 Okay, I gotta get going before it gets any hotter.
    `),
    fillers: lines(`
      you know
      I mean
      anyhow
    `),
    intensifiers: lines(`
      real
      plenty
    `),
    agreement: lines(`
      Yep.
      That's for sure.
      You got that right.
      Ain't that the truth.
    `),
    surprise: lines(`
      Well, I'll be.
      No kidding?
      Huh. Didn't see that coming.
    `),
    weather: {
      fog: lines(`
        Tule fog's thick as soup out there.
        Foggy-day schedule at the school again.
        You can't see past the hood of your car in this fog.
        Fog on 99 is how people get hurt. Take it slow.
        The fog never burned off today.
      `),
      heat: lines(`
        @h4-11 {temp} and it's not even noon.
        Triple digits, and probably all week.
        @m6-9 The Valley in {month} is no joke.
        Too hot to work outside after two.
        At least it cools off at night. Sometimes.
      `),
      rain: lines(`
        We need every drop.
        Rain on the orchards. Good for the trees.
        The ground's so dry the rain just runs off.
      `),
      wind: lines(`
        Wind's kicking the dust up off the fields.
        Dust blowing across the road out west, you couldn't see a thing.
        Windy and dusty. My allergies are wrecked.
      `),
      cold: lines(`
        @alert:frost Frost warning. The growers will be running the wind machines all night.
        @m11-2 Cold and foggy, the Valley winter special.
        @drives Freezing this morning, had to scrape the windshield.
      `),
      smoke: lines(`
        Smoke settles in and fills the whole valley.
        Between the smoke and the dust, the air here is rough.
        You can't even see the mountains with all this smoke.
      `),
      snow: lines(`
        Snow on the Sierra! Clear enough to see it from town.
        Fresh snow in the mountains, everybody's driving up.
      `),
      clear: lines(`
        After a rain you can see the Sierra from here. Best view in the state.
        Clear day, you can see {landmark}.
        @m2-4 Spring, with everything blooming. That's our good season.
      `),
    },
    traffic: lines(`
      {road} is all trucks, all the time.
      @drives Stuck behind a tractor on the two-lane.
      @drives Took the frontage road to skip the backup.
      Fog on {road} this morning, nobody could see a thing.
      They've been working on 99 my whole life.
      @m7-10 @drives Harvest season, there's a truck full of tomatoes in front of me no matter where I go.
      Somebody always flies past you on 99 like it's a racetrack.
      Everybody slows down for the cop at the overpass.
      {stretch} was backed up for miles.
    `),
    prideLines: lines(`
      We feed the whole country from right here.
      Valley people work hard. That's just how it is.
      People here will help you without being asked.
      A couple hours to the mountains, a couple hours to the coast.
      Small-town feel, even in the cities.
      You haven't had a peach until you've had one off the tree here.
      @native {place} raised me. I'm proud of it.
      Nobody outside the Valley gets it, and that's fine.
    `),
    complaintLines: lines(`
      @anytime The air quality in summer is awful.
      Water's always the fight. Always.
      Nobody in Sacramento or LA thinks about the Valley.
      The heat keeps getting worse.
      @adult Bay Area money moved in and the rents went with it.
      @adult Jobs here are hard work for not enough pay.
      The dust gets into everything.
      They forget we're here until they need the food.
    `),
    food: lines(`
      Fruit stand peaches. Best in the world.
      @works Taco trucks after a long shift, every time.
      Tri-tip on the grill every weekend.
      Fresh corn and melons from the stand by the road.
      @anytime There's always somebody selling tamales at the holidays.
      @anytime Cherries in spring, peaches in summer, pomegranates in fall.
      Almonds from the orchard down the road.
    `),
    elder: {
      greetings: lines(`
        @h4-11 @wx:heat Morning! Gonna be a hot one.
      `),
      farewells: lines(`
        @wx:fog You take care now, and watch that fog.
      `),
    },
    slang: slang(`
      hella | 1 | 12-40 | very; a lot of (NorCal; heard up and down the valley) | It's hella foggy out.
    `),
    teams: ['the Niners', 'the Giants', 'the Dodgers', 'the Warriors'],
  },

  north: {
    name: 'Northern California',
    register: 'Unhurried, dry humor, outdoorsy and independent; plenty of "up here" and "down south" (meaning Sacramento or the Bay). Talks fog or heat, fire, rain, roads that close, fishing and hunting, jobs, and how far everything is.',
    words: words(`
      up here | identity | the north state, as opposed to everything south of Sacramento
      down south | place | anywhere from Sacramento on down
      the redwoods | place | the coast forests of the tallest trees on earth
      the North State | identity | the upper third of California, as people up here call it
      NorCal | identity | Northern California; the real one, they'd say
      fire season | fire | late summer and fall, when the smoke and the evacuation orders come
      deer season | outdoors | fall hunting season; half the trucks have a rifle rack
      the river | place | the Klamath, the Trinity, the Eel or the Sacramento, whichever is closest
      the woodstove | home | the heat source of half the houses up here
    `),
    greetings: lines(`
      Hey there. How you holding up?
      @h4-11 @wx:cold,fog,rain,snow,wind Morning! Cold one today.
      Hey, good to see you. How's everybody?
      Well, hey, stranger.
      Howdy. Long time.
      @wx:rain,wind,snow Hey! You make it through the storm okay?
      @h4-11 Morning. Roads all right coming in?
      Hey, how's the fishing been?
    `),
    farewells: lines(`
      All right, drive careful on those curves.
      Okay, see you next time you come through.
      @wx:rain Take care, stay dry.
      All right, holler if you need anything.
      Okay, watch for deer on the way home.
      See you in town.
      @m10-4 All right, keep the woodstove going.
      Take it easy. Tell your folks hi.
    `),
    fillers: lines(`
      well
      I'll tell you
      anyhow
    `),
    intensifiers: lines(`
      plumb
      real
      darn
    `),
    agreement: lines(`
      Yep.
      You bet.
      Sure is.
      That's about right.
    `),
    surprise: lines(`
      Well, I'll be.
      Huh. How about that.
      You don't say.
    `),
    weather: {
      fog: lines(`
        Fog's sitting in the river valley again.
        The fog never left today.
        Can't see the ridge this morning.
      `),
      heat: lines(`
        Hot and dry. That means fire weather.
        {temp} and the river's the only place to be.
        Old houses up here don't have AC, so we just suffer.
      `),
      rain: lines(`
        @m11-3 Rain on top of rain. Must be winter.
        The river's coming up fast.
        Every storm, somewhere the highway's got a slide on it.
      `),
      wind: lines(`
        Wind's taking down limbs everywhere. Watch the power lines.
        Big wind. The power's going to go out, watch.
      `),
      cold: lines(`
        Frost on everything this morning.
        Woodstove weather.
        Cold enough for the heavy coat.
      `),
      smoke: lines(`
        Smoke in the canyons so thick you can't see the ridge.
        @m6-11 Fire season again. Everybody's got the scanner on.
        The smoke's been sitting here for days.
      `),
      snow: lines(`
        Snow on the passes, chains required.
        Snow down low this morning.
        @m10-12 First snow on the mountain. Winter's here.
      `),
      clear: lines(`
        Clear day, you can see {landmark}.
        Blue sky after a storm. Nothing like it.
        A day like this, you remember why you live up here.
      `),
    },
    traffic: lines(`
      @drives Got stuck behind a logging truck on the two-lane.
      There's one road in and one road out, and when it closes, that's it.
      {road} is all curves. Somebody always gets carsick.
      The construction flagger had us waiting twenty minutes.
      One slide on {road} and it's the long way around for weeks.
      Traffic up here is three cars and a tractor.
      Deer on the road at dusk, every single night.
      Driving down to the city is a whole-day trip from up here.
      Tourists stopping in the middle of {road} to take pictures.
    `),
    prideLines: lines(`
      Up here, you know your neighbors and they know you.
      The rivers, the forests, the quiet. That's why I stay.
      Best fishing in the state, and I won't tell you where.
      We take care of our own up here.
      People leave and they always come back.
      You can't buy what we've got up here.
      {place} is the best-kept secret in California.
      Clean air, dark skies, real stars.
    `),
    complaintLines: lines(`
      Sacramento doesn't know we exist.
      The specialists are all hours away.
      @adult Fire insurance is impossible to get anymore.
      There's no jobs for the kids, so they leave.
      @adult Gas costs more up here and we drive twice as far.
      @anytime The roads close every winter and nobody fixes them fast.
      Internet out here is a joke.
      Tourists don't know how to drive these roads.
    `),
    food: lines(`
      Fresh-caught salmon on the grill. Best meal there is.
      @anytime Dungeness crab from the docks when the season opens.
      @anytime Venison chili all winter.
      @anytime Blackberries along every road in August.
      There's one good taco truck in town and everybody knows it.
      Pie at the diner on the highway.
    `),
    elder: {
      farewells: lines(`
        Drive safe, those roads get slick.
      `),
    },
    slang: slang(`
      hella | 1 | 12-45 | very; a lot of (NorCal) | That river's hella cold.
    `),
    teams: ['the Niners', 'the Giants', 'the Warriors', 'the Kings'],
  },
};

/** Northern California dialect keys and their own material. */
export const KEYS = {
  sf: {
    family: 'bay', name: 'San Francisco', region: 'Bay Area', areaCodes: ['415', '628'],
    words: words(`
      the city | place | San Francisco itself; "going into the city" means SF and nowhere else
      Muni | transit | the city's buses, light rail and cable cars
      the Avenues | place | the foggy western neighborhoods out toward Ocean Beach
      the 415 | identity | the area code, worn as a badge by natives
      the hills | place | every walk is a workout
      cable cars | transit | mostly for visitors; locals know which lines to skip
    `),
    greetings: lines(`
      Hey! You get any sun on your side of town?
    `),
    farewells: lines(`
      Okay, I gotta catch the bus before it gets packed.
      Later! Don't let the hills get you.
    `),
    weather: {
      fog: lines(`
        Most days it's sunny in the Mission and socked in out in the Avenues.
        @m6-9 It's {month} and I'm wearing a puffer.
        Ocean Beach is fogged in, as usual.
        The fog's swallowing the top of Twin Peaks.
      `),
      cold: lines(`
        @anytime Summer in the city means a jacket. Locals know.
      `),
      clear: lines(`
        @m9-10 Fall heat, finally. October is our July.
      `),
    },
    traffic: lines(`
      Muni was late and packed, so, normal.
      Parking in this city is a full-contact sport.
      @drives Took me twenty minutes to find a spot, then I walked anyway.
      Double-parked delivery trucks on every block.
    `),
    prideLines: lines(`
      There's no city like the city.
      Every neighborhood here is its own little town.
      Walk two blocks and the whole view changes.
      I've lived all over and nowhere feels like here.
      You can see the whole bay from the top of the hill on a clear day.
    `),
    complaintLines: lines(`
      @adult A burrito costs what a whole dinner used to.
      These hills are killing my knees.
      @drives @rents Parking tickets are basically my second rent.
      @rents My studio costs more than my parents' mortgage ever did.
      @anytime Tourists in shorts, freezing, every single summer.
    `),
    food: lines(`
      Mission burrito, end of discussion.
      Dim sum in the Richmond, early, before the line.
      Clam chowder in a bread bowl is for tourists. I still love it.
      Late-night taqueria after a long night, that's tradition.
      Dumplings on a cold foggy night.
    `),
  },
  eastbay: {
    family: 'bay', name: 'East Bay', region: 'Bay Area', areaCodes: ['510', '341', '925'],
    words: words(`
      the town | place | Oakland, to the people who love it
      the 510 | identity | the inner East Bay area code: Oakland, Berkeley, Richmond, Hayward, Fremont
      the 925 | identity | the inland East Bay: Walnut Creek, Concord, the Tri-Valley, East County
      the Lake | place | Lake Merritt in Oakland
      the hills | place | the Oakland and Berkeley hills, with the fire history to match
      the Tri-Valley | place | Pleasanton, Livermore, Dublin and San Ramon
      East County | place | Antioch, Pittsburg, Brentwood and the Delta side
      AC Transit | transit | the East Bay's buses
    `),
    greetings: lines(`
      Hey! You coming out to the lake this weekend?
    `),
    farewells: lines(`
      All right, I'm gonna go catch BART.
      Later! Stay up.
    `),
    weather: {
      heat: lines(`
        {temp} out here, and I bet it's foggy in the city. Classic.
        Over the hill it's always hotter. Every time.
      `),
      wind: lines(`
        @offshore Diablo winds and dry hills. Everybody up in the hills is nervous.
      `),
    },
    traffic: lines(`
      880 was nothing but big rigs from the port.
      BART was delayed again, so I'm late again.
      The Caldecott was backed up both ways.
      580 through the Tri-Valley at rush hour, forget about it.
      680 in the morning is a slow-moving parking lot.
    `),
    prideLines: lines(`
      The town is home. Always will be.
      Oakland gets a bad rap and it's the realest city in the Bay.
      Lake Merritt on a sunny Sunday, everybody's out. Nothing like it.
      Berkeley's got its quirks, but I love it.
      The East Bay has the best weather. Sun without the fog.
      Out in the 925 you still get a backyard.
    `),
    complaintLines: lines(`
      @adult Rent in the East Bay is catching up with the city.
      @adult Everybody from the city moved here, and now we can't afford it either.
      The commute from East County is two hours some days.
      Living by the freeway means the trucks shake the windows.
      @drives My car got towed for street sweeping. Again.
    `),
    food: lines(`
      Taco trucks on International Boulevard, the best in the Bay.
      Ethiopian food on Telegraph is worth the trip.
      Fried chicken and waffles on a Sunday.
      Dim sum in Oakland Chinatown on a Saturday morning.
    `),
    youth: {
      agreement: lines(`
        That's hella real.
      `),
      surprise: lines(`
        Bro, that's dumb crazy.
      `),
    },
    slang: slang(`
      the town | 1 | 13-70 | Oakland | I'm going back to the town for the weekend.
      scraper | 3 | 25-48 | a big American sedan on custom rims, an East Bay car-culture classic | He's got the scraper out today.
    `),
    teams: ['the Warriors', 'the Niners', 'Cal', 'the Valkyries', 'the Giants'],
  },
  southbay: {
    family: 'bay', name: 'South Bay', region: 'Bay Area (Silicon Valley)', areaCodes: ['408', '669'],
    words: words(`
      the 408 | identity | San Jose and the Santa Clara Valley's area code
      Silicon Valley | place | the valley's tech-industry name; locals often just say "the valley"
      VTA | transit | the Santa Clara Valley's buses and light rail
      Diridon | transit | San Jose's main train station
      the campus | work | whichever tech company you, or your roommate, work for
      South County | place | Morgan Hill, San Martin and Gilroy
    `),
    greetings: lines(`
      @h5-11 Hey! You working from home today or going in?
    `),
    farewells: lines(`
      @works @h7-18 Okay, I gotta jump on a call.
      @drives All right, I'm gonna beat the traffic on 85.
    `),
    weather: {
      heat: lines(`
        {temp} here, and I bet they're wearing jackets in the city.
      `),
    },
    traffic: lines(`
      101 from San Jose to anywhere is a crawl.
      85 at rush hour is its own little nightmare.
      Took the light rail. It's slow, but it beats parking.
      Everybody's back in the office, so the traffic's back too.
      The tech buses are on every corner in the morning.
    `),
    prideLines: lines(`
      Half the stuff on your phone started around here.
      San Jose's bigger than the city and nobody knows it.
      The weather here is honestly the best in the Bay.
      Best pho in Northern California, right here.
      The orchards used to be everywhere. Some of us still remember.
      Sharks games get loud. Love it.
    `),
    complaintLines: lines(`
      @adult A starter home here costs more than a mansion anywhere else.
      @adult Everyone talks about stock options at the barbecue.
      @works Layoffs one month, hiring the next. Hard to plan anything.
      Downtown empties out at night.
      You need a car for everything down here.
    `),
    food: lines(`
      Pho and banh mi on Story Road, that's the move.
      Garlic everything in Gilroy.
      @works The dosa place by the office is packed every lunch.
      Korean barbecue in Santa Clara on a Friday night.
    `),
    teams: ['the Sharks', 'the Earthquakes', 'the Warriors', 'the Niners', 'the Giants', 'San Jose State'],
  },
  peninsula: {
    family: 'bay', name: 'the Peninsula', region: 'Bay Area', areaCodes: ['650'],
    words: words(`
      the 650 | identity | the Peninsula's area code
      the Peninsula | place | everything between the city and San Jose
      280 | road | the "pretty" freeway through the hills, which locals swear by
      the Bayshore | road | US 101 along the bay side; mostly just "101" now
      the coastside | place | Pacifica and Half Moon Bay, over the hill on Highway 1 and 92
      Skyline | road | Skyline Boulevard along the ridge: fog and redwoods
      Midpen | place | Palo Alto, Menlo Park and the towns around them
    `),
    weather: {
      fog: lines(`
        Daly City fog is a whole other level.
        @anytime Over the hill on the coastside it's fogged in all summer.
        The fog's spilling over Skyline again.
      `),
    },
    traffic: lines(`
      280 is so much nicer than 101. Prettier and faster.
      Caltrain was standing room only.
      92 to the coast on a pumpkin weekend, forget it.
      The 101 merge by the airport is a mess.
    `),
    prideLines: lines(`
      Best of both worlds, close to the city and the South Bay.
      Half Moon Bay on a clear day is unreal.
      Quiet little towns, good schools, five minutes from everything.
      {place} is home, and I wouldn't trade it.
      Pacifica's the best-kept secret on the coast.
    `),
    complaintLines: lines(`
      @adult Everything costs a fortune, even in the small towns.
      @anytime The fog in Daly City never leaves in summer.
      @adult Teachers and nurses can't afford to live where they work.
      Somebody's always tearing down a house to build a bigger one.
    `),
    food: lines(`
      Ramen on the Peninsula is the best in the Bay. I said what I said.
      Fresh fish right off the boats in Half Moon Bay.
      There's a Filipino bakery in Daly City with the best ube anything.
      Artichoke bread from the coast.
    `),
    youth: {
      greetings: lines(`
        Yo, what's up, you heading to the city later?
      `),
    },
    teams: ['the Giants', 'the Warriors', 'the Niners', 'Stanford'],
  },
  northbay: {
    family: 'bay', name: 'North Bay', region: 'Bay Area (North Bay)', areaCodes: ['707', '415'],
    words: words(`
      the 707 | identity | Sonoma, Napa, Solano and the North Coast's area code
      wine country | place | Napa and Sonoma's valleys of vineyards
      harvest | season | late summer into fall, when the grapes come in; "crush"
      SMART | transit | the Sonoma-Marin commuter train
      the ferry | transit | Larkspur, Sausalito and Vallejo to the city by water
      the Golden Gate | road | the bridge into the city
      Highway 37 | road | the marsh road between Novato and Vallejo, slow and flood-prone
      the coast | place | Bodega Bay, Point Reyes, Jenner
      go-bag | fire | the packed bag by the door in fire season
    `),
    weather: {
      smoke: lines(`
        @anytime @adult Every fall I pack the go-bag and hope I don't need it.
        Smoke's settling in again. You can taste it.
      `),
      wind: lines(`
        @offshore Diablo winds at night, nobody sleeps.
        @offshore When the wind comes out of the northeast like this, I check the fire map every hour.
      `),
      heat: lines(`
        @inland {temp} here, and the coast is probably socked in. Pick your poison.
      `),
    },
    traffic: lines(`
      Highway 37 was backed up from Vallejo.
      Golden Gate traffic coming back on a Sunday, forget it.
      @anytime Tourist traffic on Highway 12 every weekend in harvest.
      The ferry's the only civilized way into the city.
    `),
    prideLines: lines(`
      @anytime Wine country in the fall is the most beautiful place in the world.
      Petaluma's still got that small-town thing.
      Point Reyes on a clear day is unreal.
      Marin's got the redwoods and the beach ten minutes apart.
      Since {fire}, people up here look out for each other differently.
    `),
    complaintLines: lines(`
      @adult Insurance companies don't want to cover anybody up here anymore.
      @anytime Tourists drive like they're the only ones on the road during harvest.
      @anytime The fires changed everything. You feel it every fall.
      @adult The people who work the vineyards can't afford to live near them.
      @drives The bridge toll keeps going up.
    `),
    food: lines(`
      Oysters out by the coast on a Sunday.
      Fresh cheese and bread from the farm stand.
      @anytime Harvest dinner out in the vineyard. That's the life.
      Taco trucks by the vineyards at lunch, best food in the valley.
    `),
    teams: ['the Giants', 'the Warriors', 'the Niners', 'Sonoma State'],
  },

  sacramento: {
    family: 'sac', name: 'Sacramento', region: 'Sacramento Valley', areaCodes: ['916', '279', '530'],
    words: words(`
      the 916 | identity | Sacramento's area code, said with pride
      Sactown | identity | Sacramento, affectionately
      the Grid | place | downtown and Midtown's lettered and numbered streets
      Midtown | place | the walkable heart of the city
      the Capitol | place | the state capitol; plenty of people here work for the state
      state worker | work | a job with the State of California, the classic Sacramento career
      farm-to-fork | food | Sacramento's own name for its food scene
      the Causeway | road | I-80 across the Yolo Bypass to Davis
      light rail | transit | SacRT's trains downtown and out to Folsom and Elk Grove
      the American River | place | rafting, the bike trail, the summer float
    `),
    weather: {
      heat: lines(`
        {temp} out here. Pray for the Delta breeze.
        {temp} and no Delta breeze tonight. Ugh.
        @anytime When the Delta breeze kicks in at night, that's the best part of summer.
        Float the American when it's this hot. That's the only answer.
      `),
    },
    farewells: lines(`
      @m5-9 @h10-20 See you around, enjoy the Delta breeze tonight.
      All right, see you downtown.
      Okay, go Kings.
    `),
    traffic: lines(`
      The Causeway was backed up to Davis.
      I-5 through downtown backs up for no reason at all.
      Business 80 is a parking lot by four.
      Light rail's fine if you're going downtown.
      Everybody leaves the Grid at five at once.
    `),
    prideLines: lines(`
      @county:Sacramento City of trees, and we mean it.
      Farm-to-fork capital, and it's not just a slogan.
      Midtown on a warm night is the best.
      The 916 doesn't get enough credit.
      Kings fans are the loudest fans around.
      The American River bike trail is the best thing about living here.
    `),
    complaintLines: lines(`
      Everybody thinks we're just state workers and lobbyists.
      Downtown parking is a nightmare when there's a game.
      @adult Rent here used to be cheap. Used to be.
    `),
    food: lines(`
      Farm-to-fork restaurants everywhere now.
      Taco trucks on Franklin Boulevard, you can't go wrong.
      Pho on Stockton Boulevard is the best in town.
      Tomatoes from Yolo County are the best in the world.
    `),
    slang: slang(`
      Sactown | 2 | 15-50 | Sacramento | Sactown, all day.
    `),
    teams: ['the Kings', 'the Niners', 'Sac State', 'Republic FC', 'the Aggies'],
  },
  'valley-north': {
    family: 'sac', name: 'Upper Sacramento Valley', region: 'Sacramento Valley (Chico, Oroville, Yuba City)', areaCodes: ['530'],
    words: words(`
      the 530 | identity | the north state's area code
      the North State | identity | the upper valley and the mountains north of Sacramento
      the Buttes | place | the Sutter Buttes, the little mountain range in the middle of the valley
      the orchards | ag | almonds, walnuts, prunes and peaches in rows to the horizon
      the rice | ag | flooded fields in spring and again in winter, full of ducks and geese
      Bidwell Park | place | Chico's huge park along the creek
      the Feather River | place | Oroville, the dam, the salmon
      the Ridge | place | Paradise, Magalia and the towns up the hill from Chico
      Chico State | school | the university that runs half of Chico's life
    `),
    farewells: lines(`
      All right, see you at the Saturday market.
      Okay, watch for tractors on the way home.
    `),
    weather: {
      heat: lines(`
        {temp} in the shade, and the shade's not helping.
        @m7-8 Creek swimming, that's the only way through {month}.
      `),
      clear: lines(`
        Clear enough to see the Buttes.
        Clear enough to see {landmark} from the orchard.
      `),
      rain: lines(`
        @m11-2 The rice fields are flooded and the ducks are back.
      `),
    },
    traffic: lines(`
      @drives Stuck behind a tractor on the two-lane again.
      99 between here and Yuba City needs another lane.
      @m8-10 Harvest trucks hauling almonds, so you just wait.
      70 down to Sacramento, and people pass like crazy on the two-lane parts.
    `),
    prideLines: lines(`
      Small-town life, and you still know everybody's name.
      @anytime The orchards in bloom in February. Nothing prettier.
      We grow the food. Simple as that.
      @anytime Chico in the spring is the best place in the state.
      Up here people help each other. After {fire}, everybody showed up.
    `),
    complaintLines: lines(`
      Nobody south of Sacramento even knows we're here.
      @adult Fire insurance up here is impossible now.
      Water's always a fight between the farms and the cities.
      Jobs are hard to come by unless you farm.
    `),
    food: lines(`
      Peaches from the stand in Yuba City. Nothing better.
      Walnuts and almonds from the neighbor's orchard.
      Olive oil from right down the road.
      Tamales at the Saturday market.
    `),
    teams: ['the Kings', 'the Niners', 'Chico State', 'the Giants'],
  },

  'valley-south': {
    family: 'sjv', name: 'Northern San Joaquin Valley', region: 'San Joaquin Valley (Stockton, Modesto, Merced)', areaCodes: ['209', '350'],
    words: words(`
      the 209 | identity | Stockton, Modesto, Merced and the foothills' area code, worn proudly
      the Altamont | road | I-580 over the hills to the Bay Area, the super-commute
      the Delta | place | the Sacramento-San Joaquin Delta's sloughs and levees
      the almond orchards | ag | rows of almonds, pink and white every February
      cruising | culture | slow laps down the main drag, a Modesto tradition
      the Bay commute | work | the drive over the Altamont to a Bay Area job
      ACE | transit | the Altamont Corridor Express train to the Bay Area
    `),
    weather: {
      fog: lines(`
        Tule fog on the Altamont commute. The worst.
      `),
    },
    traffic: lines(`
      The Altamont at five in the morning is already full.
      Half of Tracy is on 580 by six.
      @drives @works The 205 to 580 merge, every single morning.
      ACE train's the only way to keep your sanity over the hill.
    `),
    prideLines: lines(`
      The 209 is the heart of the state.
      Modesto knows how to cruise.
      Stockton gets a bad rap. Come see it for yourself.
      The Delta's a whole world most people never see.
      @anytime Almond blossoms in February. It looks like snow.
    `),
    complaintLines: lines(`
      @works @drives Half my paycheck goes to gas for the Bay commute.
      @adult Bay Area prices followed everybody over the hill.
      @works @parent I see my kids for an hour a day because of the commute.
    `),
    food: lines(`
      @anytime Asparagus season in Stockton, you put it on everything.
      Taco trucks by the packing houses at lunch.
      Fresh cherries from Lodi.
      Walnuts from the orchard, still in the shell.
    `),
    teams: ['the Niners', 'the Giants', 'the Warriors', 'the Kings', 'the Pacific Tigers'],
  },
  fresno: {
    family: 'sjv', name: 'Fresno and the 559', region: 'San Joaquin Valley (Fresno, Visalia, Hanford, Madera)', areaCodes: ['559'],
    words: words(`
      the 559 | identity | Fresno, Madera, Tulare and Kings counties' area code, a point of pride
      Fresyes | identity | Fresno, said by the people who refuse to say "Fresno, no"
      the Tower District | place | Fresno's old neighborhood of theaters and cafés
      Fresno State | school | the Bulldogs; the whole valley turns out for football
      the Blossom Trail | place | orchard roads that bloom in late February
      raisins | ag | grapes drying on paper trays between the vine rows in late summer
      Yosemite | place | up Highway 41, close enough for a day trip
      the Sierra | place | the mountains east of town: Shaver, Huntington, Kings Canyon
    `),
    weather: {
      heat: lines(`
        @m5-9 {temp} in the 559 is just a normal summer day.
        @m8-9 Raisin trays are out in the vineyards. Drying weather.
      `),
    },
    traffic: lines(`
      @anytime 41 to Yosemite on a summer weekend, bring snacks.
      Herndon at rush hour is the worst road in town.
      99 through town is always under construction.
    `),
    prideLines: lines(`
      Go Dogs! Fresno State is the whole Valley's team.
      @county:Fresno Fresno, yes. Fresyes.
      Yosemite's practically our backyard.
      @anytime The Blossom Trail in February is gorgeous.
      There's more culture here than people think.
      The 559 forever.
    `),
    complaintLines: lines(`
      @county:Fresno People make Fresno jokes without ever coming here.
      @anytime The summer air here is rough on your lungs.
      Nothing to do in the heat but stay inside.
      Water for the farms, water for the city, never enough water.
    `),
    food: lines(`
      Armenian bakery on the east side, the best lavash anywhere.
      There's a Hmong market with the best papaya salad in town.
      Tri-tip sandwiches at the game.
      @anytime Fresh figs in summer, right off the tree.
      Raisins, almonds, pistachios, all grown right here.
    `),
    slang: slang(`
      Fresyes | 2 | 15-50 | Fresno pride (from "Fresno, yes") | Fresyes, baby.
    `),
    teams: ['Fresno State', 'the Niners', 'the Dodgers', 'the Giants'],
  },
  kern: {
    family: 'sjv', name: 'Bakersfield and Kern', region: 'San Joaquin Valley (Bakersfield, Delano, Tehachapi)', areaCodes: ['661'],
    words: words(`
      the 661 | identity | Bakersfield and Kern County's area code
      Bako | identity | Bakersfield, to locals
      the Grapevine | road | I-5 over the mountains to LA; closes when it snows
      the oil fields | work | pumpjacks out on the west side, a living for a lot of families
      the Kern River | place | cold, fast and dangerous; people here respect it
      the Bakersfield sound | culture | the twangy country music this town is famous for
      Basque dinner | food | family-style Basque meals, a Bakersfield tradition
    `),
    weather: {
      heat: lines(`
        @m5-9 {temp} in {place}, so, a normal summer day.
      `),
      snow: lines(`
        Snow on the Grapevine! They'll close it, watch.
        When it snows, the Grapevine closes and the whole state notices.
      `),
      fog: lines(`
        @m11-3 Fog in the valley, maybe snow on the Grapevine. Pick a direction.
      `),
    },
    traffic: lines(`
      The Grapevine was backed up for miles.
      Everybody from LA drives through here on the way to somewhere else.
      The truck traffic on 99 never stops.
      Highway 58 to Tehachapi is all big rigs.
    `),
    prideLines: lines(`
      Bako's got the best Basque food anywhere.
      The Bakersfield sound came from right here.
      Oil and ag built this town, and we're proud of it.
      LA's a couple hours away, and that's exactly the right distance.
      People here say what they mean.
      Kern County is its own thing. Not LA, not the Bay.
    `),
    complaintLines: lines(`
      People only ever see Bakersfield from the freeway.
      @anytime Summers are brutal and getting worse.
      The air's bad from the dust and the oil fields.
      Nobody plans for us. The state forgets we exist.
    `),
    food: lines(`
      Basque family dinner: the bread, the soup, the beans, all of it.
      Tri-tip on a Sunday, Kern County style.
      Taco trucks in East Bakersfield, can't beat them.
      Carrots from out by Arvin, the sweetest you'll ever have.
      Fruit stand on the way up to the lake.
    `),
    slang: slang(`
      Bako | 1 | 13-70 | Bakersfield | Back in Bako for the weekend.
    `),
    teams: ['the Dodgers', 'the Rams', 'the Condors', 'CSUB', 'the Lakers'],
  },

  'north-coast': {
    family: 'north', name: 'North Coast', region: 'Humboldt, Del Norte and the Mendocino coast', areaCodes: ['707'],
    words: words(`
      the 707 | identity | the North Coast's area code
      Humboldt | place | the county, and a state of mind
      the Lost Coast | place | the roadless coast south of Eureka
      the Avenue | road | the Avenue of the Giants, old 101 through the redwoods
      SoHum | place | Southern Humboldt: Garberville, Redway and the hills
      the bay | place | Humboldt Bay
      crab season | food | the Dungeness season, eagerly awaited
      the mill | work | the lumber mills, past and present
      the Plaza | place | Arcata's town square
    `),
    weather: {
      fog: lines(`
        @m6-9 Fog's in, fog's out, fog's in. That's summer here.
        @m6-9 Foggy and cool in {month}, and I bet the rest of the state is baking.
      `),
      rain: lines(`
        Sideways rain off the ocean.
        It rains here like it means it.
        The rivers are up and running brown.
      `),
      heat: lines(`
        When it hits {temp} here, people act like the world is ending.
      `),
    },
    traffic: lines(`
      101 through the redwoods, somebody's always stopped to take pictures.
      Highway 299 to Redding is curves the whole way.
      Logging trucks on the Avenue in the morning.
    `),
    prideLines: lines(`
      Nothing on earth like the redwoods.
      Arcata Plaza on a Saturday is the best.
      Humboldt's weird and we like it that way.
      The coast up here is wild. No crowds, just ocean.
      @anytime Crab season is basically a holiday.
    `),
    complaintLines: lines(`
      It takes all day to get anywhere else.
      @adult Housing up here got expensive and the wages didn't.
      @anytime The fog rolls in and stays all summer.
      Every big storm knocks the power out for days.
    `),
    food: lines(`
      @anytime Crab feed in winter, the whole town shows up.
      Smoked salmon from the docks.
      Oysters from the bay.
      Clam chowder on a foggy day.
    `),
    teams: ['the Niners', 'the Giants', 'the Warriors', 'the Lumberjacks'],
  },
  'north-inland': {
    family: 'north', name: 'Inland Mendocino and Lake County', region: 'North Coast interior (Ukiah, Willits, Clear Lake)', areaCodes: ['707'],
    words: words(`
      the lake | place | Clear Lake, the big lake at the heart of Lake County
      the 707 | identity | the area code shared with the coast and wine country
      pears | ag | the old orchard crop, still around
      the vineyards | ag | inland Mendocino and Lake County grapes
      Highway 20 | road | the road across to the coast or over to I-5
      Highway 29 | road | down to Napa and the Bay
      the Mayacamas | place | the mountains between here and Napa
    `),
    weather: {
      heat: lines(`
        {temp} out here, and the lake's the only place to be.
        We're baking, and I bet the coast is foggy and cool.
      `),
      smoke: lines(`
        Smoke again. It just sits in these valleys.
      `),
    },
    traffic: lines(`
      Highway 20 along the lake is slow when the boats are out.
      Down 29 to Napa, and then it's wine traffic.
      Logging trucks and tourists. That's our traffic.
    `),
    prideLines: lines(`
      The lake at sunset. That's my spot.
      Real small towns, real people.
      Bass fishing on the lake is the best in the West.
      Pears, grapes and walnuts. This is farm country.
    `),
    complaintLines: lines(`
      We've been through so many fires, people are worn out.
      Everything's a long drive from here.
      @adult Insurance up here, forget it.
      There's no work unless it's the vineyards or the county.
    `),
    food: lines(`
      @anytime Pears from the orchard in August.
      Fried catfish at the place by the lake.
      Saturday farmers market in town.
    `),
    teams: ['the Niners', 'the Giants', 'the Warriors'],
  },
  'far-north': {
    family: 'north', name: 'Far North (the North State)', region: 'Redding, Shasta, Siskiyou, Modoc, Lassen and the upper valley', areaCodes: ['530'],
    words: words(`
      the 530 | identity | the north state's area code
      Mount Shasta | place | the mountain that's always in the corner of your eye
      Shasta Lake | place | houseboats, wakeboards and summer
      Lassen | place | the volcano park east of Redding
      the Trinity Alps | place | the wilderness west of Redding
      the high desert | place | Modoc and Lassen counties' sagebrush plateau
      I-5 | road | the lifeline north to Oregon and south to everything
      the ranch | work | cattle, hay and long days
    `),
    weather: {
      heat: lines(`
        {temp} in {place}. Lake day.
        @anytime Summers here are the hottest in the state. I'll swear to it.
      `),
      snow: lines(`
        When it snows up by Mount Shasta, it's chain control on I-5.
        Snow out in the high desert, and the cattle don't care.
      `),
      cold: lines(`
        Cold enough to freeze the stock tanks out on the ranches.
      `),
    },
    traffic: lines(`
      I-5 through the canyon at Lakehead is all curves and trucks.
      The only traffic jam up here is when they shut down I-5 for snow.
      Logging trucks on 299 in the morning.
      Highway 44 to Lassen, you'll see more deer than cars.
    `),
    prideLines: lines(`
      {peak} out the kitchen window. Can't beat it.
      @anytime Houseboat on Shasta Lake. That's summer.
      Up here we hunt, fish and mind our own business.
      Real ranch country, real cowboys.
      The Sundial Bridge at sunset, I'll take that over any city.
    `),
    complaintLines: lines(`
      The heat's brutal and the smoke's worse.
      @adult Insurance after the fires is out of reach.
      Kids move to Sacramento and don't come back.
      Sacramento writes the rules and we live with them.
    `),
    food: lines(`
      Steak and potatoes, no apologies.
      Trout from the river, cooked right there.
      @anytime Blackberry pie in August.
      Huckleberries, if you know where to look.
    `),
    teams: ['the Niners', 'the Giants', 'the Kings'],
  },
};
