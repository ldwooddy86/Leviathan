// Legion · lexicon · the Central Coast and the mountains: the coast between the Bay and LA (Santa Cruz to
// Santa Barbara, with the Salinas Valley) and California's mountain towns from Tahoe to Big Bear.

import { lines, words, slang } from './text.mjs';

/** The Central Coast and mountain families. */
export const FAMILIES = {
  cc: {
    name: 'Central Coast',
    register: 'Relaxed, outdoorsy, small-town friendly even in the bigger towns. Talks the marine layer and the afternoon wind, the drive on 101 or Highway 1, the fields and the vineyards, tourists, and housing.',
    words: words(`
      the Central Coast | identity | the coast between the Bay Area and LA
      the marine layer | weather | the low gray cloud off the ocean, mornings and evenings
      101 | road | the spine of the coast; "the 101" the farther south you go
      Highway 1 | road | the coast road; closes in Big Sur when the hillsides slide
      the fields | ag | row crops: lettuce, strawberries, broccoli, artichokes
      the vineyards | ag | wine grapes from Paso to the Santa Ynez Valley
      the coast | place | the beaches, the cliffs, the cold water
      tourists | identity | they come for the coast, the wine and the drive
      Amtrak | transit | the Coast Starlight and the Pacific Surfliner, the trains along the coast
    `),
    greetings: lines(`
      @wx:fog,clear Hey! Did the fog burn off where you are?
      @h4-11 @wx:clear Morning! Beautiful one, huh?
      Hey, how's it going? Staying busy?
      Oh hey, I didn't expect to see you here.
      Hey there! You get down to the beach yet?
      @h4-11 @wx:wind Morning! Windy one today.
      Hey! How was the drive up the coast?
      Hi! Long time, how's everybody?
    `),
    farewells: lines(`
      @wx:clear,heat All right, enjoy the sunshine while it lasts.
      Okay, drive safe on 101.
      See you at the market.
      Take it easy, catch some waves for me.
      Okay, bring a jacket, it gets cold by the water.
      All right, see you around town.
      @wx:wind Later! Don't let the wind blow you away.
      Okay, have a good one, say hi to everybody.
    `),
    fillers: lines(`
      like
      honestly
      I mean
    `),
    intensifiers: lines(`
      super
      way
    `),
    agreement: lines(`
      Totally.
      Yeah, for sure.
      Right on.
    `),
    surprise: lines(`
      No way.
      Whoa, really?
      Huh, I had no idea.
    `),
    weather: {
      fog: lines(`
        @h4-11 The marine layer's in until noon, as usual.
        Fog in the morning, sun by lunch, wind by three. That's the coast.
        @coast You can see the fog bank sitting just offshore.
        The fog's hugging the hills today.
      `),
      heat: lines(`
        {temp} out here. The beach is the easy call.
        Hot days here mean everybody's at the beach.
        It's warm, but there's always a breeze.
      `),
      rain: lines(`
        Highway 1 will close if this keeps up.
        The hills will turn green overnight after this.
        Rain's good for the vineyards and bad for the fields.
      `),
      wind: lines(`
        @h12-19 The afternoon wind's howling again.
        The wind comes up every afternoon like clockwork.
      `),
      cold: lines(`
        Cold and foggy. Jacket weather all year here.
        The ocean's freezing no matter what month it is.
      `),
      smoke: lines(`
        @coast Smoke's blowing out over the coast. Must be a fire inland.
        @h6-17 Hazy and smoky. The sunset's going to be red.
      `),
      snow: lines(`
        Snow on the mountains inland! Doesn't happen often.
        @coast You can see snow on {peak} from the beach. Wild.
      `),
      clear: lines(`
        @coast Clear day, you can see all the way down the coast.
        A day like this, the coast is the best place on earth.
        Blue sky, flat water, perfect.
      `),
    },
    traffic: lines(`
      {road} through town was backed up with tourists again.
      @anytime Every winter there's a slide somewhere on Highway 1, and then it's the long way around.
      @m4-11 Tractor on the road. Harvest season.
      Farm trucks on {road} every morning.
      @anytime Every holiday weekend, everybody from LA and the Bay is here.
      Traffic here means waiting for one light twice.
      {stretch} was slow behind a truck again.
      @anytime Summer weekends, {road} is just a line of rental cars.
      @drives Took the back roads through the fields to skip {road}.
    `),
    prideLines: lines(`
      The coast here is the prettiest in the state, and it's not close.
      Small towns, big ocean.
      We grow the food the rest of the country eats.
      Halfway between LA and the Bay, and far enough from both.
      You can surf in the morning and taste wine in the afternoon.
      The sunsets here are unreal.
      {place} is a real community. People know each other.
      @coast Whale watching from the cliffs, right in my backyard.
    `),
    complaintLines: lines(`
      @adult Housing here is out of reach for anybody who works here.
      @anytime Tourists clog up everything all summer.
      Everything closes early.
      The wind every afternoon gets old.
      Water's always tight.
      Retirees with big money bought up every house with a view.
      There's one road along the coast, and when it closes, that's it.
    `),
    food: lines(`
      Fresh strawberries from the stand by the field.
      Fish tacos by the pier.
      Wine tasting on the weekend.
      Farmers market downtown on a Thursday night.
      Clam chowder on a foggy day.
      Fresh avocados from a friend's tree.
    `),
    youth: {
      farewells: lines(`
        @coast Later, I'm gonna go catch some waves.
      `),
      agreement: lines(`
        Stoked.
        Totally, dude.
      `),
    },
    slang: slang(`
      dawn patrol | 2 | 15-70 | an early-morning surf session | Dawn patrol tomorrow?
    `),
    teams: ['the Giants', 'the Dodgers', 'the Niners', 'the Rams'],
  },

  mountain: {
    name: 'Mountains',
    register: 'Friendly, weather-wise and practical. Mountain towns talk snow, roads, fire, power outages, tourists and going "down the hill". Says "the plow", "the berm", "chain control", "bluebird day".',
    words: words(`
      chain control | road | Caltrans checkpoints where you put chains on or turn around
      R1, R2 | road | chain control levels: R1 means chains or snow tires; R2 means chains unless it's four-wheel drive with snow tires
      the plow | weather | the snowplow; you plan your morning around it
      the berm | weather | the wall of snow the plow leaves across your driveway
      down the hill | place | to the valley, the city, the store, the doctor
      up the hill | place | home, to the mountains
      flatlanders | identity | visitors from the valley or the coast (said fondly, mostly)
      bluebird day | weather | a clear, sunny day right after a storm
      powder day | weather | a morning of fresh, deep snow; nobody shows up to work on time
      Sierra cement | weather | heavy, wet snow
      fire season | fire | late summer and fall: red flag warnings, evacuations, smoke
      power shutoffs | fire | the utility cuts the power on high-wind days so the lines can't start fires
      defensible space | fire | the cleared ground around your house, inspected every year
    `),
    greetings: lines(`
      Hey! You make it up okay?
      @h4-11 Morning! Roads clear coming up?
      @wx:snow,cold Hey there, you get snowed in?
      Well, look who made it up the hill.
      @h4-11 @wx:wind,snow,rain Morning! You get your power back?
      @wx:snow Hey! Did the plow come by your street yet?
      Hi there! Quiet week up here.
      @wx:cold,snow,wind,rain,fog Hey, how's it going? Staying warm?
    `),
    farewells: lines(`
      Drive safe going down the hill.
      @m10-4 All right, watch for ice on the curves.
      Okay, see you next storm.
      @m10-4 Take care, keep your chains handy.
      All right, see you at the post office.
      @wx:snow,cold Okay, get home before it starts snowing again.
      Later! Watch for deer on the way down.
      Take it easy, stay warm.
    `),
    fillers: lines(`
      well
      anyway
      honestly
    `),
    intensifiers: lines(`
      super
      dang
    `),
    agreement: lines(`
      Yep.
      You bet.
      Sure is.
    `),
    surprise: lines(`
      No kidding.
      Huh. Really?
      Well, I'll be.
    `),
    weather: {
      fog: lines(`
        The clouds are sitting right on the ridge.
        Can't see the trees across the road this morning.
      `),
      heat: lines(`
        {temp} up here? The valley must be on fire.
        Hot and dry. That's fire weather, plain and simple.
      `),
      rain: lines(`
        Rain up high means mud everywhere.
        Rain on top of the snow. That's flood weather.
      `),
      wind: lines(`
        Big wind on the ridge. The power's going to go out.
        @alert:redflag Red flag warning. Everybody's packed and ready.
      `),
      cold: lines(`
        Below freezing every night now.
        The woodstove's going full time.
      `),
      smoke: lines(`
        Smoke in the canyon so thick you can't see across.
        Ash coming down like snow this morning.
      `),
      snow: lines(`
        Fresh snow! The plow better come early.
        @adult The berm at the end of my driveway is up to my waist.
        Sierra cement, heavy and wet. Your back will feel it.
        This much snow, there'll be chain control on {road}.
      `),
      clear: lines(`
        Blue sky over the mountains. Can't beat it.
        @m11-4 Bluebird day after the storm. Perfect.
        Clear and crisp. Best air in the state.
        A day like this, I'll never move.
      `),
    },
    traffic: lines(`
      @wx:snow Chain control on {road} again.
      @m11-4 Everybody from down the hill came up for the snow and nobody can drive in it.
      @drives Stuck behind a camper on the two-lane.
      When a big storm hits, they close {road} and that's that.
      @drives Took me two hours to get down the hill.
      @anytime Holiday weekends, half the state is on {road}.
      One road in and one road out, and it's always the one that's closed.
      Snow-play traffic is the worst traffic.
      {stretch} was a mess again.
    `),
    prideLines: lines(`
      I wake up to the mountains every day.
      Up here, people show up for each other.
      @anytime Fresh air, real seasons, dark skies.
      Tourists come for a weekend. We get it all year.
      When the power goes out, the neighbors check on you.
      {place} is the best mountain town there is.
      You learn to respect the weather up here.
      Quiet, clean and beautiful. I'm spoiled.
    `),
    complaintLines: lines(`
      Tourists park anywhere and leave trash everywhere.
      @adult Fire insurance up here is impossible.
      The power goes out every time the wind blows.
      Second homes sit empty while locals can't find a rental.
      @adult Everything costs more up here, even groceries.
      @anytime Winter's beautiful until you have to shovel it.
      @anytime Every fall the smoke comes in and stays.
    `),
    food: lines(`
      Chili after a day in the snow.
      Pie from the place by the highway.
      Breakfast burrito before first chair.
      Coffee and a donut at the general store.
      Trout from the creek, cooked over the fire.
    `),
    youth: {
      farewells: lines(`
        @m12-4 @h5-10 Later, I'm gonna catch first chair.
      `),
      agreement: lines(`
        Send it.
      `),
      surprise: lines(`
        That's gnarly.
      `),
    },
    slang: slang(`
      powder day | 1 | 12-65 | a morning of fresh, deep snow; work can wait | It's a powder day, I'm calling in.
      send it | 2 | 14-35 | go for it all the way | Just send it.
      gnar | 2 | 15-40 | gnarly terrain or conditions | That chute is pure gnar.
      pow | 2 | 15-45 | powder snow | Fresh pow on the ridge.
      shred | 2 | 13-40 | ski or ride hard and well | We shredded all morning.
    `),
    teams: ['the Kings', 'the Niners', 'the Giants'],
  },
};

/** Central Coast and mountain dialect keys. */
export const KEYS = {
  'central-coast': {
    family: 'cc', name: 'Central Coast (SLO County and Santa Maria)', region: 'Central Coast', areaCodes: ['805', '820'],
    words: words(`
      SLO | place | San Luis Obispo, said "slow"
      Paso | place | Paso Robles and its wine country
      the Five Cities | place | Arroyo Grande, Grover Beach, Pismo Beach, Oceano and Shell Beach
      Santa Maria-style | food | tri-tip grilled over red oak, with pinquito beans and salsa
      pinquito beans | food | small pink beans, the Santa Maria barbecue side
      the 805 | identity | the coast's area code from SLO to Ventura
      Cal Poly | school | the university in SLO
      the Cuesta Grade | road | 101 over the hill north of SLO
    `),
    weather: {
      wind: lines(`
        Santa Maria wind every afternoon. You can set a clock by it.
      `),
    },
    traffic: lines(`
      The Cuesta Grade was crawling behind a truck.
      @anytime Pismo on a summer weekend, good luck parking.
      101 through Santa Maria at five is a mess.
    `),
    prideLines: lines(`
      SLO might be the happiest town anywhere.
      Paso wine is as good as Napa with half the attitude.
      Santa Maria tri-tip. Nothing else counts as barbecue.
      Thursday night market in SLO, everybody's there.
      Morro Rock at sunset.
    `),
    complaintLines: lines(`
      Every retiree from LA moved here.
      Students take every rental in town.
      @adult You can't buy a house in SLO on a teacher's salary.
    `),
    food: lines(`
      Tri-tip over red oak with pinquito beans. That's the Santa Maria way.
      Strawberries in Santa Maria, right from the field.
      Clam chowder in Pismo.
      Wine country picnic in Paso.
    `),
    teams: ['Cal Poly', 'the Dodgers', 'the Giants', 'the Rams'],
  },
  'santa-barbara': {
    family: 'cc', name: 'Santa Barbara', region: 'Central Coast (Santa Barbara south coast)', areaCodes: ['805', '820'],
    words: words(`
      sundowner | weather | the hot, gusty evening wind that roars down the mountains toward town
      the 805 | identity | the area code from SLO to Ventura
      IV | place | Isla Vista, UCSB's beach town
      the Riviera | place | the hillside neighborhood above the mission
      the Funk Zone | place | the old warehouse blocks by the beach
      the 154 | road | the San Marcos Pass road over the mountains
      the Mission | place | the old mission on the hill
      UCSB | school | the university by the lagoon; the Gauchos
    `),
    weather: {
      wind: lines(`
        @offshore @h8-22 Sundowner tonight. Everybody's watching the hills.
        When the sundowner kicks up, the fire danger goes through the roof.
      `),
      fog: lines(`
        @m5 May Gray here is real. The mountains just vanish.
        @m6-7 June Gloom, and then the sun finally comes out in September.
      `),
    },
    traffic: lines(`
      The 101 through Montecito was backed up again.
      Taking the 154 over the pass to skip the traffic.
      Weekend traffic from LA comes up the Rincon all day.
    `),
    prideLines: lines(`
      Mountains on one side, ocean on the other. That's Santa Barbara.
      State Street on a Saturday. Perfect.
      The American Riviera, and it lives up to it.
      Go Gauchos!
      The Mission at sunset, with the mountains behind it.
    `),
    complaintLines: lines(`
      @adult Nobody who works here can afford to live here.
      @adult Rent in IV for a shared room is insane.
      Every time there's a sundowner, I think about the fires.
      Half the town commutes in from Ventura.
    `),
    food: lines(`
      Fish tacos at the harbor.
      Uni from the boats, if you can get it.
      Wine from the Santa Ynez Valley.
      The taco spots on the east side are the real deal.
    `),
    teams: ['UCSB', 'the Dodgers', 'the Lakers', 'the Rams'],
  },
  salinas: {
    family: 'cc', name: 'Salinas Valley', region: 'Central Coast (Salinas Valley, Watsonville, Hollister)', areaCodes: ['831'],
    words: words(`
      the Salad Bowl | ag | the Salinas Valley's nickname, for the lettuce it grows for the country
      the fields | ag | lettuce, broccoli, strawberries, celery, spinach
      the 831 | identity | Monterey, Santa Cruz and San Benito counties' area code
      the packing shed | work | where the harvest gets cooled, packed and shipped
      artichokes | food | Castroville grows them; fried artichokes are the snack
      the rodeo | culture | the big summer rodeo in Salinas
      Highway 68 | road | the road over the hill to Monterey
      the wind | weather | it comes up the valley every afternoon
    `),
    weather: {
      wind: lines(`
        @h12-19 The afternoon wind's tearing down the valley again.
        Wind and dust off the fields by three o'clock.
      `),
      fog: lines(`
        The fog comes up the valley from the bay at night.
      `),
    },
    traffic: lines(`
      68 to Monterey was backed up the whole way.
      Farm buses on the road at five in the morning.
      @m4-11 Harvest trucks everywhere. You just wait your turn.
      101 through Salinas at rush hour is slow.
    `),
    prideLines: lines(`
      We grow the salad the whole country eats.
      Salinas is a working town and proud of it.
      Rodeo week is the best week of the year.
      Watsonville strawberries are the sweetest anywhere.
      Hollister's got that small-town thing going.
    `),
    complaintLines: lines(`
      @adult Monterey's right over the hill and costs twice as much.
      @adult Field work is hard and the rent's still high.
      Everybody drives through and nobody stops.
      A lot of families out here worry about the spraying in the fields.
    `),
    food: lines(`
      Fried artichokes in Castroville.
      Strawberries from the stand, still warm from the sun.
      Taco trucks by the fields at lunch, the best in the county.
      Tri-tip at the rodeo.
    `),
    teams: ['the Giants', 'the Niners', 'the Dodgers', 'the Warriors'],
  },
  'monterey-bay': {
    family: 'cc', name: 'Monterey Bay', region: 'Central Coast (Santa Cruz and the Monterey Peninsula)', areaCodes: ['831'],
    words: words(`
      the 831 | identity | the Monterey Bay's area code
      over the hill | place | Santa Cruz speak for the Santa Clara Valley, across Highway 17
      Highway 17 | road | the twisty mountain highway to San Jose; respect it
      the Boardwalk | place | the beachfront amusement park in Santa Cruz
      the Wharf | place | the old piers in Santa Cruz and Monterey
      the Peninsula | place | Monterey, Pacific Grove, Carmel and Pebble Beach
      Big Sur | place | the coast south of Carmel on Highway 1
      Banana Slugs | school | UC Santa Cruz's mascot, beloved
      otters | wildlife | sea otters in the kelp, every day
    `),
    weather: {
      fog: lines(`
        Fog's sitting on the bay this morning.
        @m6-9 Summer fog here, and sun over the hill.
      `),
    },
    traffic: lines(`
      Highway 17 was a mess, somebody spun out again.
      Beach traffic from over the hill every sunny weekend.
      Highway 1 through Santa Cruz at five is a parking lot.
      When Highway 1 closes in Big Sur, everything down there grinds to a halt.
    `),
    prideLines: lines(`
      Best surf town in California, right here.
      Watching the otters off the wharf never gets old.
      Big Sur is the most beautiful drive in the world.
      Go Slugs!
      Carmel and Pacific Grove, quiet and beautiful.
    `),
    complaintLines: lines(`
      Tech people from over the hill bought every house.
      Highway 17 is dangerous, and everybody drives it like a racetrack.
      @adult Rent here is as bad as the Bay.
      Tourists all over the Boardwalk every weekend.
    `),
    food: lines(`
      Fresh calamari at the wharf.
      Artichokes from Castroville, steamed with butter.
      Clam chowder on Cannery Row.
      A burrito after surfing, every time.
    `),
    slang: slang(`
      kook | 2 | 14-60 | a clueless beginner, usually in the water | Some kook dropped in on me.
    `),
    teams: ['the Giants', 'the Warriors', 'the Niners', 'the Sharks', 'the Banana Slugs'],
  },

  tahoe: {
    family: 'mountain', name: 'Lake Tahoe and Truckee', region: 'Sierra (Tahoe basin and Truckee)', areaCodes: ['530'],
    words: words(`
      the lake | place | Lake Tahoe, simply "the lake"
      the basin | place | the Tahoe Basin, everything that drains into the lake
      North Shore, South Shore | place | the two ends of the lake and their two personalities
      the summit | road | Donner Summit on 80, or Echo Summit on 50
      powder day | weather | fresh deep snow; nobody shows up to work on time
      locals | identity | year-rounders, as opposed to weekenders
      weekend warriors | identity | Bay Area skiers driving up on Friday night
    `),
    weather: {
      snow: lines(`
        Huge dump overnight. The summit's buried.
        Snow like this means chain control on 80 and 50. Nobody's coming up today.
        Powder day. The whole town called in sick.
      `),
    },
    traffic: lines(`
      80 on a Friday night is the whole Bay Area moving to Tahoe.
      Sunday afternoon on 50 coming down the hill is brutal.
      When the summit closes, the whole town fills up with stuck travelers.
      @anytime 89 around the lake in July is bumper to bumper.
    `),
    prideLines: lines(`
      Nothing on earth is as blue as the lake.
      @anytime Ski in the morning, paddle in the afternoon, in the spring.
      @anytime Locals are tough. Winters here aren't for everybody.
      @anytime The lake in summer is the best place in the world.
    `),
    complaintLines: lines(`
      Short-term rentals ate up all the housing.
      Bay Area traffic every weekend, all year.
      @adult Workers can't afford to live in the town they work in.
      @anytime Parking anywhere near the beach in July, forget it.
    `),
    food: lines(`
      Breakfast burrito in the lift line.
      Après at the lodge after a long day.
      Pizza after skiing, every single time.
    `),
    teams: ['the Kings', 'the Warriors', 'the Niners', 'the Giants'],
  },
  'gold-country': {
    family: 'mountain', name: 'Gold Country', region: 'Sierra foothills (the Mother Lode)', areaCodes: ['530', '209'],
    words: words(`
      the Mother Lode | place | the gold rush belt of foothill towns along Highway 49
      Highway 49 | road | the old road through every gold rush town
      Apple Hill | place | the orchards above Placerville, packed every fall
      the foothills | place | oak, pine and red dirt between the valley and the high Sierra
      the river | place | the American, the Yuba, the Stanislaus: rafting and swimming holes
      the wineries | ag | Amador, El Dorado and Calaveras wine country
    `),
    weather: {
      heat: lines(`
        {temp} up here, but at least it cools off at night.
      `),
      snow: lines(`
        Snow down to the foothills this morning! The kids are losing it.
      `),
    },
    traffic: lines(`
      Highway 49 through town on a Saturday is all tourists.
      Apple Hill weekends, don't even try 50.
      @drives Stuck behind a logging truck on 49.
      Everybody going to Tahoe drives right past us.
    `),
    prideLines: lines(`
      Gold rush towns that never stopped being towns.
      @anytime Apple Hill in October, best day of the year.
      Wine country without the Napa prices.
      @anytime River days all summer.
      Real community. People here show up.
    `),
    complaintLines: lines(`
      @adult Fire insurance up here is almost impossible to get now.
      @anytime The power shutoffs every fall are a nightmare.
      Commuting down to Sacramento eats your whole day.
      Retirees from the Bay bought up everything.
    `),
    food: lines(`
      Apple pie at Apple Hill.
      Pasties, a gold rush thing that never went away.
      Zinfandel from Amador.
      Burgers at the old saloon on Main Street.
    `),
    teams: ['the Kings', 'the Niners', 'the Giants', 'the Warriors'],
  },
  'sierra-foothills': {
    family: 'mountain', name: 'Southern Sierra foothills', region: 'Sierra and Tehachapi foothills (Oakhurst and Three Rivers to the Kern River Valley and Tehachapi)', areaCodes: ['559', '760', '661'],
    words: words(`
      the big trees | place | the giant sequoias, a short drive up the hill
      the park | place | Yosemite, Sequoia or Kings Canyon, whichever is closest
      Highway 41 | road | the road up to Yosemite through Oakhurst
      the Kern | place | the Kern River; swimming in it can kill you
      the lake | place | Bass Lake, Shaver Lake or Lake Isabella
      Tehachapi Pass | road | Highway 58 over the mountains between Bakersfield and the Mojave: wind farms, freight trains, chain control
    `),
    weather: {
      heat: lines(`
        {temp} up here, so the valley must be cooking.
      `),
      snow: lines(`
        Snow up high, and the whole valley's coming up to play in it.
      `),
    },
    traffic: lines(`
      @anytime Summer weekends, everybody from down in the valley comes up the hill.
      Half the cars up here on a weekend are visitors passing through.
      {road} down to the valley is a nice drive until it isn't.
      When they close the road for a fire, it's the long way around for everybody.
    `),
    prideLines: lines(`
      Pines, clean air, and the valley's an hour down the road.
      @anytime Lake days all summer.
      Quiet mountain town, and we like it that way.
      {place} is the prettiest place nobody's heard of.
    `),
    complaintLines: lines(`
      @anytime Every fire season we wonder if this is the one.
      Visitors come up in flip-flops and don't respect the mountains.
      The nearest big hospital is a long drive down the hill.
      @adult Fire insurance, power shutoffs, smoke. Every year.
    `),
    food: lines(`
      Coffee and pie on the drive up the hill.
      Trout from the lake.
      Barbecue at the campground.
    `),
    teams: ['Fresno State', 'the Dodgers', 'the Giants', 'the Niners'],
  },
  'eastern-sierra': {
    family: 'mountain', name: 'Eastern Sierra', region: 'Owens Valley and Mono County (Bishop, Mammoth, Lone Pine)', areaCodes: ['760', '442'],
    words: words(`
      395 | road | the only highway: north to Reno, south to LA
      the Owens Valley | place | the long desert valley under the east face of the Sierra
      Mammoth | place | the ski town and the mountain
      the opener | outdoors | the opening day of trout season, a holiday here
      the Buttermilks | place | Bishop's boulder fields under the mountains
      Whitney | place | Mount Whitney, the highest peak in the lower forty-eight, above Lone Pine
      the aqueduct | place | the water that runs south from here to Los Angeles
    `),
    weather: {
      wind: lines(`
        Wind blowing dust up the valley again.
        The wind's coming over the crest so hard the trucks are rocking.
      `),
      snow: lines(`
        Snow on the crest. The whole wall of the Sierra is white.
        Mammoth's going to get buried this storm.
      `),
    },
    traffic: lines(`
      395 on a Friday night is LA coming up to ski.
      @anytime Every holiday weekend, everybody from the city is on 395.
      Somebody's always passing on the two-lane.
      @anytime Once Tioga closes for the winter, it's the long way around.
    `),
    prideLines: lines(`
      The east side of the Sierra is the best side.
      @anytime The opener is a bigger deal than Christmas here.
      {landmark} out my window every morning.
      The stars out here are unreal.
    `),
    complaintLines: lines(`
      LA owns the water and half the land out here.
      @anytime Ski season brings the city, and the city brings traffic.
      The nearest big town is hours away.
      Housing in Mammoth is all second homes now.
    `),
    food: lines(`
      Sheepherder bread from the bakery.
      Jerky from the stand on 395.
      Trout from the creek.
    `),
    teams: ['the Dodgers', 'the Lakers', 'the Rams', 'the Kings'],
  },
  'socal-mountains': {
    family: 'mountain', name: 'Southern California mountains', region: 'San Bernardino, San Jacinto and San Diego mountains', areaCodes: ['909', '951', '760', '442'],
    words: words(`
      down the hill | place | San Bernardino, the valley, the real grocery store
      the Rim | road | Rim of the World Highway along the mountain crest
      snow play | identity | city families who drive up to play in the snow and park wherever
      the lake | place | Big Bear Lake or Lake Arrowhead
      the pines | place | the forest, and a state of mind
      Julian | food | the apple-pie town in the San Diego mountains
    `),
    weather: {
      snow: lines(`
        @h4-9 Fresh snow, so half of LA will be up here by ten.
        Snow on the Rim, so it'll be chains required.
      `),
      wind: lines(`
        @offshore Santa Anas up here knock the trees down.
        Wind's howling through the pines tonight.
      `),
      fog: lines(`
      `),
    },
    traffic: lines(`
      @m11-4 The road up the hill was bumper to bumper with snow-play people.
      One way up, one way down, and when it's closed, you're stuck.
      Down the hill for anything big, that's an hour.
      @m11-4 Everybody from LA came up for the snow and parked in the road.
    `),
    prideLines: lines(`
      I'm close to LA and I've got snow and pine trees.
      Above the smog and above the fog.
      Small mountain town, and everybody knows everybody.
      Julian apple pie is worth the drive.
    `),
    complaintLines: lines(`
      Weekend crowds trash the forest.
      The fire risk up here never goes away.
      The power goes out with every storm.
      @adult Insurance companies won't write policies up here anymore.
    `),
    food: lines(`
      Apple pie in Julian.
      Hot chocolate after sledding.
      Breakfast at the diner in the village.
    `),
    teams: ['the Dodgers', 'the Lakers', 'the Rams', 'the Angels', 'the Padres'],
  },
};
