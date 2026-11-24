// Legion · lexicon · the statewide bank.
//
// What any Californian might say anywhere: the small talk underneath every regional voice. Each regional
// dialect is built from this bank plus its family's bank plus its own lines (see dialects.mjs). Lines are
// templates whose {slots} come from SLOTS (slots.mjs) and are filled from the world pack by the dialogue
// engine, so no line here states a fact about a place on its own.

import { lines, slang } from './text.mjs';

/** The statewide phrase bank shared by every dialect. */
export const COMMON = {
  greetings: lines(`
    Hey, how's it going?
    Hi there.
    Hey! How are you?
    @h4-11 Morning!
    @h4-11 Good morning.
    @h12-17 Afternoon.
    @h17-23 Evening.
    Hey, good to see you.
    Oh, hi!
    Hi, how's your day going?
    How are you doing?
    Hey there, how's everything?
    Well, look who it is.
    Hey, long time no see.
    How's your week been?
    Hi! You doing okay?
  `),
  farewells: lines(`
    Take care.
    See you around.
    Have a good one.
    Good talking to you.
    All right, I'll let you go.
    Catch you later.
    Okay, see you.
    @h5-17 Have a good rest of your day.
    Drive safe.
    Bye now.
    Nice running into you.
    Okay, I gotta run.
    Talk soon.
    Take it easy.
    @h16-3 Have a good night.
    Stay out of trouble.
    All right, take care. Go {teamName}!
  `),
  fillers: lines(`
    I mean
    you know
    honestly
    anyway
    so
    well
    I guess
    kind of
    pretty much
    actually
    to be fair
    the thing is
  `),
  intensifiers: lines(`
    really
    so
    super
    pretty
    totally
    seriously
    way
    crazy
  `),
  agreement: lines(`
    Yeah, totally.
    For sure.
    Right?
    Exactly.
    True.
    I know, right?
    Yeah, no, you're right.
    Absolutely.
    That's fair.
    Can't argue with that.
    Tell me about it.
    You said it.
    Definitely.
  `),
  surprise: lines(`
    No way.
    Seriously?
    Wait, really?
    Get out.
    Oh wow.
    Huh. I didn't know that.
    You're kidding.
    Whoa.
    Are you serious?
    Oh my gosh.
    No kidding?
    Wow, okay.
  `),
  weather: {
    fog: lines(`
      Pretty foggy this morning.
      Can barely see the end of the block.
      @h4-11 The fog's supposed to burn off by noon.
      Drive careful, the fog's thick out there.
      Gray and damp. Classic.
      @drives Fog this thick, I keep my headlights on all day.
      Couldn't even see {landmark} this morning.
      @h4-11 Foggy morning. Everybody's driving with their lights on.
    `),
    heat: lines(`
      It's already {temp} out there.
      Too hot to do anything but sit in the shade.
      {temp} degrees. I'm melting.
      Stay hydrated, it's brutal out.
      @drives My steering wheel is too hot to touch.
      Nobody's walking anywhere in this heat.
      @adult I swore I wasn't running the AC today. I'm running the AC.
      Earthquake weather, my grandma would've called this.
    `),
    rain: lines(`
      Finally some rain.
      Bring an umbrella, it's coming down.
      Everybody forgets how to drive the second it rains.
      We need the rain. I'll take it.
      @owns My gutters are not ready for this.
      Roads are slick, take it easy.
      @m9-12 First rain of the season and the freeway's like an ice rink.
      The storm drains can't keep up with this.
    `),
    wind: lines(`
      Wind's crazy today.
      Hold onto your hat.
      My trash cans ended up across the street.
      Wind like this always makes me nervous about fires.
      Patio umbrella's down for the day.
      Gusty out there. Watch for branches.
      The wind knocked the power out for a bit.
      Leaves and branches everywhere after that wind.
    `),
    cold: lines(`
      It's cold! Well, cold for here.
      Had to dig out a jacket this morning.
      I know it's not real cold, but I'm freezing.
      Frost on the windshield this morning.
      Somebody's out there in shorts in this. There's always one.
      Sweatshirt weather.
      Cold snap. Bring the plants in.
      @drives I had to scrape ice off the car. In California.
    `),
    smoke: lines(`
      Air's bad today, I'm staying in.
      You can smell the smoke.
      The sky's that weird orange again. Never gets less creepy.
      Ash on the cars this morning.
      Keep your windows shut, the air quality's awful.
      Every time it smells like smoke I check the fire map.
      @h16-20 The sunset's gorgeous, and I know it's because of the smoke.
      @adult I bought an air purifier and it's been running nonstop.
    `),
    snow: lines(`
      You can see snow on {peak}.
      Snow on the mountains this morning. Beautiful.
      @drives Chains in the trunk, just in case.
      Fresh snow up high. Everybody's going to head up this weekend.
      Somebody's going to try to drive up in the snow without chains. Every time.
      Snow up high means more water later. Hopefully.
      Everybody's posting pictures of the snow on {peak}.
    `),
    clear: lines(`
      Gorgeous out today.
      Can't complain about weather like this.
      @adult Blue sky, not a cloud. This is why we pay what we pay.
      Perfect day to be outside.
      One of those days you remember why you live here.
      Clear enough to see {landmark}.
      {weather} and {temp}. Not bad at all.
      Not a cloud in the sky.
    `),
  },
  traffic: lines(`
    {road} was a parking lot this morning.
    @drives Took me forever on {road}.
    There was an accident on {road}, total mess.
    @drives I'm avoiding {road} today.
    Construction on {road} again.
    {road} was stop and go the whole way.
    Somebody stalled on {road} right at rush hour.
    @drives I left early and still hit traffic.
    The map app said twenty minutes. It lied.
    @drives Took the long way just to stay off {road}.
    Every time I think {road} can't get worse, it does.
    {road} at five o'clock? No thank you.
    Somebody's always cutting across three lanes to make their exit on {road}.
    @drives Took me forty minutes to go five miles on {road}.
    @drives I'll take the side streets over {road} any day.
  `),
  prideLines: lines(`
    I complain about it, but I'd never leave.
    Where else can you hit the beach and the mountains the same weekend?
    People here look out for each other when it counts.
    {place} is home. Simple as that.
    Best produce in the country, right here.
    My whole life is here. My people are here.
    You can't beat the weather. You just can't.
    Say what you want, {place} has heart.
    @adult I've been all over, and there's nowhere I'd rather wake up.
    The people here are what make it.
    We've been through fires, floods and earthquakes, and we're still here.
    Any kind of food, any kind of people, any kind of weekend. That's California.
    @parent My kids are growing up with the ocean and the mountains in reach.
    When something bad happens here, everybody shows up to help.
    {team} all the way.
    I watch every {teamName} game, win or lose.
  `),
  complaintLines: lines(`
    @adult Gas prices are out of control.
    @rents @works Rent keeps going up and my paycheck doesn't.
    @owns My homeowner's insurance went up again.
    @adult Everything costs more and nothing works better.
    @drives You can't find a parking spot anywhere.
    They tore up the road again and I don't see anything getting fixed.
    @adult Groceries are ridiculous now.
    @adult Nobody can afford to buy a house anymore.
    @adult The kids who grew up here can't afford to stay here.
    @adult The power bill this month made me sit down.
    @adult Waiting on hold for an hour just to talk to a person. Every time.
    @adult The DMV line was out the door.
    @anytime Every year the summers feel hotter.
    @drives @adult Registration, insurance, gas. Just owning a car costs a fortune.
    @adult Childcare costs more than rent for some people I know.
    The freeway's always under construction and it never gets any faster.
    There's always construction somewhere around here.
    Everything takes forever to get fixed around here.
    It's way too crowded everywhere on the weekends.
  `),
  food: lines(`
    There's a taco truck near my place that's better than any restaurant.
    Farmers market on the weekend, that's my thing.
    I've been on a boba kick lately.
    Nothing beats a good burrito after a long day.
    We do a big barbecue every Fourth.
    @works There's a little pho spot near work I go to way too often.
    I'm always hunting for good tacos.
    Fresh strawberries from a fruit stand. Can't beat it.
  `),
  youth: {
    greetings: lines(`
      Yo, what's up?
      Hey, what's good?
      Sup.
      Heyyy.
      What's up, what's up.
      Ayy, what's going on?
    `),
    farewells: lines(`
      Later.
      Peace.
      All right, I'm out.
      See ya.
      Text me.
      Catch you later.
    `),
    agreement: lines(`
      Facts.
      Bet.
      Fr.
      Literally.
      Real.
      No cap.
      Valid.
      Same.
    `),
    surprise: lines(`
      Wait, what?
      No shot.
      Bro, what?
      That's crazy.
      Stop.
      Nah, for real?
    `),
    intensifiers: lines(`
      lowkey
      highkey
      literally
      so
      super
    `),
    fillers: lines(`
      like
      literally
      lowkey
      bro
      dude
      honestly
    `),
  },
  elder: {
    greetings: lines(`
      @h4-11 Well, good morning to you.
      Hello there.
      @h12-17 Good afternoon!
      Well, hello!
      How do you do?
    `),
    farewells: lines(`
      You take care now.
      Drive safely.
      Don't be a stranger.
      Give my best to your folks.
      All right, you have a nice day.
    `),
    agreement: lines(`
      That's the truth.
      You're darn right.
      I'll say.
      Isn't that the truth.
      Can't argue with you there.
    `),
    surprise: lines(`
      Well, I'll be.
      My goodness.
      Good heavens.
      Is that right?
      You don't say.
      Oh, for heaven's sake.
    `),
  },
  slang: slang(`
    stoked | 1 | 13-75 | excited, happy (California surf slang gone statewide) | I'm so stoked for the weekend.
    dude | 1 | 12-70 | buddy; also an all-purpose exclamation | Dude, look at that sunset.
    gnarly | 2 | 35-75 | intense, rough, or impressive | That wipeout was gnarly.
    rad | 2 | 40-70 | great, cool | That's a rad old truck.
    dope | 2 | 20-45 | great | That mural is dope.
    lowkey | 2 | 13-32 | kind of, secretly, honestly | I lowkey want tacos again.
    highkey | 2 | 13-28 | openly, very much | I'm highkey tired.
    bet | 2 | 13-32 | okay, deal | Bet, see you at six.
    slaps | 2 | 13-32 | is really good (music, food) | This burrito slaps.
    fire | 2 | 13-32 | excellent | That playlist is fire.
    mid | 2 | 13-26 | mediocre | The new place is kind of mid.
    salty | 2 | 13-35 | bitter, annoyed | He's still salty about the game.
    sus | 2 | 12-26 | suspicious | That parking spot is sus.
    extra | 2 | 15-35 | over the top | That's a little extra.
    no cap | 3 | 13-24 | no lie, for real | That was the best show, no cap.
    bussin | 3 | 13-22 | really delicious | These tacos are bussin.
    it's giving | 3 | 13-26 | it has the vibe of | It's giving summer.
    goated | 3 | 13-24 | the greatest | That coach is goated.
    touch grass | 3 | 13-24 | go outside, get off your phone | You need to touch grass.
    ate | 3 | 13-26 | did it perfectly | She ate that presentation.
  `),
};
