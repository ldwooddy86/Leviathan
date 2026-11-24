// Legion · dialogue · English templates I: people. Greetings, how-are-you, names, the speaker's own life (origin,
// age, interests, work, family, home), compliments, insults, jokes, thanks, apologies, small talk, goodbyes and
// the moves every reply uses (openers, follow-up questions, pivots, mood remarks).
//
// One template per line; leading tags (core.mjs TAG_TESTS) say who can say it and when; {slots} are filled by the
// planners (plan.mjs) from the persona, the record and the world, so a line never states a fact on its own.
// Lines are first person, plain, correct English in a California register; no accent spelling, no brands.

import { compileBank } from './core.mjs';

/** The people bank, compiled. */
export const PEOPLE = compileBank({
  // ---------------------------------------------------------------- greetings
  'greet.first': `
    Hi there.
    Hey, how's it going?
    Hey! How are you?
    Oh, hi!
    @plain Hello.
    @loose Hey there.
    @loose Hey. What's up?
    @morning Morning!
    @morning @plain Good morning.
    @afternoon @plain Good afternoon.
    @evening Evening.
    @evening @plain Good evening.
    @night Hi. Kind of late to be out, huh?
    @outgoing Hey! Nice to see a new face.
    @outgoing Well, hi there!
    @shy Oh. Hi.
    @shy Um, hi.
    @senior Well, hello there.
    @senior @plain How do you do?
    @teen Hey.
    @teen Hi, um, what's up?
    @kid Hi!
    @kid Hi! Who are you?
    @casual @under30 Hey, what's good?
    @casual Hey, how you doing?
    @formal Hello. Can I help you with something?
  `,
  // a hello in a language the speaker does not speak
  'greet.foreign': `
    Ha, hi! I don't speak {langName}, but hello to you too.
    Hello! Sorry, I don't speak {langName}.
    Hi there! I don't know any {langName}, I'm afraid.
  `,
  'greet.again': `
    Oh hey, {player}! Good to see you again.
    {player}! You're back.
    Hey, {player}. How've you been?
    Well, look who it is. Hi, {player}.
    @outgoing {player}! I was hoping I'd run into you again.
    @formal Hello again, {player}.
    @kid Hi, {player}!
    Hey, you're back.
    Oh, hi again!
    Good to see you again.
    @loose Hey, it's you again. How's it going?
    @plain Nice to see you again.
  `,
  'greet.ack': `
    Nice to meet you.
    Good to meet you.
    Hi! Glad you stopped.
    @loose Hey, good to meet you.
    @kid Hi!
  `,
  'greet.repeat': `
    Hi again!
    Hello again.
    Ha, hi again.
    @loose Hey again.
    @kid Hi again!
  `,
  'greet.cool': `
    Oh. Hi.
    Hello.
    It's you.
    @blunt You again.
    @gentle Hi. I didn't expect to see you again.
    @formal Hello. What can I do for you?
    @kid Oh. Hi.
  `,
  'greet.intro': `
    I'm {first}, by the way.
    I'm {first}.
    I don't think we've met. I'm {first}.
    @formal I don't believe we've met. I'm {full}.
    @outgoing I'm {first}. I live around here.
    @kid I'm {first}!
  `,
  'greet.prev': `
    Last time you were asking me about {prevTopic}.
    You were asking about {prevTopic} last time, right?
    Last time we talked about {prevTopic}. I've been thinking about it since.
    I remember you asked me about {prevTopic}.
    @outgoing You asked me about {prevTopic} last time. Still curious?
    @formal When we last spoke, you asked me about {prevTopic}.
  `,
  'recall.prev': `
    You asked me about {prevTopic} last time, didn't you?
    Funny, you asked me about {prevTopic} last time too.
    We talked about {prevTopic} last time, remember?
    Last time it was {prevTopic}. You're curious about this place.
    @plain You asked me about {prevTopic} the last time we spoke.
  `,
  'greet.prevFact': `
    How are things in {playerPlace}?
    Still living in {playerPlace}?
    How's everything in {playerPlace}?
    How's work going? You were {aPlayerJob}, right?
    Still working as {aPlayerJob}?
  `,

  // ---------------------------------------------------------------- what they are doing right now
  'act.commuteOut': `
    I'm on my way to work.
    Just heading to work.
    On my way in to work.
    @kid I'm going to school.
    @teen On my way to school.
  `,
  'act.commuteBack': `
    I'm heading home from work.
    Just got off. Heading home.
    On my way home, finally.
    @kid I'm going home from school.
    @teen Just got out of school.
  `,
  'act.schoolOut': `
    I'm going to school.
    On my way to school.
  `,
  'act.schoolBack': `
    School's out. Going home.
    I'm going home from school.
  `,
  'act.work': `
    I'm working, technically.
    I'm on the clock, so I can't talk long.
    Work. Always work.
    @funny I'm at work. Don't tell my boss I'm chatting.
  `,
  'act.wfh': `
    I'm working from home today.
    Working from home. This counts as my coffee break.
    I'm supposed to be working. From home, so, you know.
  `,
  'act.onFarm': `
    Working. Out here the farm is home.
    Just out working the place.
    Working. There's always something on a farm.
  `,
  'act.school': `
    I'm at school.
    We're on a break at school.
  `,
  'act.errand': `
    I'm running to {placeLabel}.
    Just heading to {placeLabel}.
    I've got to stop by {placeLabel}.
    Errands. {placeLabelCap}, then home.
  `,
  'act.errandBack': `
    Just got back from {placeLabel}.
    Coming back from {placeLabel}.
  `,
  'act.leisure': `
    Heading to {placeLabel}.
    I'm off to {placeLabel}.
    Going to {placeLabel} for a bit.
  `,
  'act.exerciseBack': `
    Just got back from {placeLabel}.
    Coming back from {placeLabel}. I'm beat.
  `,
  'act.exercise': `
    I'm getting some exercise in.
    Out for {placeLabel}.
    Getting my steps in.
  `,
  'act.worship': `
    I'm on my way to church.
    Heading to church.
  `,
  'act.visit': `
    I'm going to see family in {city}.
    On my way to visit family in {city}.
  `,
  'act.home': `
    Just hanging around the house.
    Not much. Taking it easy at home.
    Just puttering around.
    @house Doing a little yard work.
    @minorkids Trying to keep the kids out of trouble.
    @kid Just playing.
    @teen Nothing. Bored.
  `,
  'act.sleep': `
    Honestly, I should be asleep right now.
    It's way past my bedtime.
    @kid I'm supposed to be in bed.
  `,

  // ---------------------------------------------------------------- how are you
  'hay.good': `
    Pretty good, actually.
    @loose Doing {very} good, thanks.
    @loose I'm {very} good today, actually.
    Doing great, thanks.
    Can't complain.
    Good! Really good.
    @plain I'm doing well, thank you.
    @loose Good, good.
    @outgoing Honestly? Great.
    @senior Not bad for an old-timer.
    @kid Good!
    @teen Good, I guess.
    @casual Doing alright.
  `,
  'hay.ok': `
    Not bad.
    Hanging in there.
    Okay. Could be worse.
    Same old, same old.
    Fine, I guess.
    @plain I'm all right, thank you.
    @loose Eh, can't complain.
    @kid Okay.
    @teen Fine.
    @senior Still kicking.
  `,
  'hay.tired': `
    Tired, honestly.
    Running on fumes.
    Exhausted, but I'll live.
    I could use a nap.
    @plain A bit tired, to be honest.
    @loose Wiped out.
    @kid Sleepy.
    @teen So tired.
  `,
  'hay.tense': `
    A little on edge, to be honest.
    Kind of keyed up today.
    Honestly, a bit stressed.
    @plain I've been a little anxious today.
    @kid Kind of nervous.
  `,
  'hay.down': `
    Eh. I've had better days.
    Honestly? Not great.
    Hanging in there. Barely.
    Kind of a rough day.
    @plain I've been better, frankly.
    @kid Not good.
    @teen Kind of bad, honestly.
  `,
  'hay.hot': `
    Hot. Too hot.
    Melting, like everybody else.
    Sweaty. It's {temp} out.
    @plain Too warm, honestly. It's {temp} degrees.
    @kid Hot!
  `,
  'why.shiftDone': `
    I just got off work.
    Long day at work.
    Work wiped me out today.
  `,
  'why.early': `
    I was up before five for work.
    I start early, so I'm always tired by now.
    Early shift. My alarm goes off in the dark.
  `,
  'why.nights': `
    I work nights, so my clock is all turned around.
    Night shift. I sleep when everybody else is awake.
  `,
  'why.commute': `
    The commute's been rough. {commuteMin} minutes each way.
    {commuteMin} minutes each way to work will do that to you.
    It's the drive. {commuteMin} minutes each way, every day.
  `,
  'why.littleKids': `
    The kids had me up early.
    Little kids. Nobody sleeps in at my house.
    The baby's not big on sleeping.
  `,
  'why.heat': `
    It's {temp} out. Everybody's cranky.
    This heat. {temp} degrees.
    It's {temp}. I'm not built for this.
  `,
  'why.alert': `
    This {alert} has me watching the news.
    The {alert} has me keeping one eye on my phone.
    With the {alert} out, I'm a little jumpy.
  `,
  'why.niceWeather': `
    {temp} and {sky}. Hard to be in a bad mood.
    It's {temp} and {sky}. What's not to like?
    Look at this weather. {temp} and {sky}.
  `,
  'why.dayOff': `
    Day off today, so no complaints.
    I'm off today. Best day of the week.
  `,
  'why.weekend': `
    It's the weekend. That helps.
    Weekend, finally.
  `,
  'why.retired': `
    Every day's a Saturday when you're retired.
    Retirement agrees with me.
    I'm retired. I have no reason to complain.
  `,
  'why.school': `
    School was long today.
    We had a lot of homework.
    I have a test this week.
  `,
  'why.money': `
    Bills, you know how it is.
    Money's tight right now.
    Everything costs more and the paycheck doesn't.
  `,
  'why.lonely': `
    It's been a quiet week. It's nice to talk to somebody.
    Haven't talked to many people lately, so this is nice.
  `,
  'why.lowEnergy': `
    I didn't sleep great.
    Long week.
  `,
  'hay.ask': `
    How about you?
    And you?
    How are you doing?
    You?
    How are you holding up?
    @plain And how are you?
    @loose How 'bout you?
    @kid How are you?
  `,
  'hay.answerGood': `
    Glad to hear it.
    Good! Good to hear.
    That's what I like to hear.
    @loose Nice.
    @plain I'm glad to hear that.
    @kid Cool!
  `,
  'hay.answerBad': `
    Sorry to hear that.
    Oh no. Hope it gets better.
    That's rough. I hope the rest of your day's better.
    @warm Aw, I'm sorry. Hang in there.
    @plain I'm sorry to hear that.
    @kid Oh no.
  `,
  'hay.answerMeh': `
    I hear you.
    Yeah, one of those days.
    Fair enough.
    @kid Okay.
  `,

  // ---------------------------------------------------------------- names
  'name.give': `
    I'm {first}.
    {first}.
    Name's {first}.
    It's {first}.
    @plain My name is {full}.
    @formal {full}. Pleased to meet you.
    @loose I'm {first}. Nice to meet you.
    @kid I'm {first}!
    @kid My name is {first}.
    @senior {first}. {full}, if you want the whole thing.
  `,
  'name.nick': `
    Everybody calls me {nick}, though.
    But call me {nick}. Everybody does.
    My friends call me {nick}.
  `,
  'name.meet': `
    Nice to meet you, {player}.
    {player}. Good to meet you.
    Hi, {player}.
    @plain A pleasure, {player}.
    @loose {player}! Nice to meet you.
    @kid Hi, {player}!
    @outgoing {player}! Great to meet you.
  `,
  'name.again': `
    Still {first}.
    It's {first}. Don't worry, I forget names too.
    {first}. You forgot already?
    @kid It's {first}! I told you.
  `,
  'name.guarded': `
    Why do you want to know?
    I'm {first}. And you are?
    {first}. Not that it matters.
  `,
  'name.yours': `
    Of course I remember. {player}.
    You're {player}. I don't forget a name.
    {player}, right?
  `,
  'name.forgot': `
    I don't think you told me your name.
    You never told me your name, actually.
    I don't know, you never said.
  `,

  // ---------------------------------------------------------------- about them
  'about.bornHere': `
    Born and raised right here in {place}.
    I was born here. {place}, my whole life.
    I've lived in this {homeWord} my whole life.
    I'm from here. Never really left.
    @kid I was born here!
  `,
  'about.grewUpCounty': `
    @adult I grew up in {county} County.
    I'm a {county} County kid, born and raised.
    @adult I grew up around here. {county} County, my whole life.
    @minor I've lived in {county} County my whole life.
  `,
  'about.fromUS': `
    I'm originally from {birthplace}.
    I grew up in {birthplace}.
    Originally {birthplace}. I've been out here a long time, though.
  `,
  'about.bornElsewhere': `
    I was born in {birthplace}, but I grew up here in {county} County.
    Born in {birthplace}. I grew up here, though. {county} County.
    @adult I was born in {birthplace}. {county} County is where I grew up.
    @minor I was born in {birthplace}, but I've grown up here.
  `,
  'about.arrivedKid': `
    My family came over in {arrivalYear}, when I was {arrivalAgeWords}.
    We came here in {arrivalYear}. I was {arrivalAgeWords}.
  `,
  'about.grewUpOnly': `
    I grew up in {county} County.
    I grew up around here, in {county} County.
  `,
  'about.heritage': `
    My family's {heritageWord}.
    I'm {heritageLabel}.
    {heritageLabel}. My family's {heritageWord}.
  `,
  'about.heritageWhole': `
    I'm {heritageLabel}.
    {heritageLabel}, yeah.
  `,
  'about.heritageFrom': `
    I'm from {country}. I came here in {arrivalYear}.
    I was born in {country}.
    {country}, originally.
  `,
  'about.heritageAmerican': `
    Just American, I guess. My family's been here a long time.
    American. A little of this and that, way back.
  `,
  'about.heritageMixed': `
    A little bit of everything, honestly.
    I'm mixed. A little of everything.
  `,
  'about.heritageGuarded': `
    Why do you ask?
    I'd rather not get into that.
  `,
  'lang.englishOnly': `
    Just English, I'm afraid.
    English. That's all I've got.
    Only English. I wish I spoke more.
    @kid Just English.
  `,
  'lang.someOther': `
    Some {askedName}, yeah. Enough to get by.
    A little {askedName}. Don't test me on it.
  `,
  'lang.notThat': `
    No, just English, sorry.
    I don't, no. Just English.
    @kid No. Just English.
  `,
  'lang.limited': `
    {langName}, mostly. My English is not very good.
    I speak {langName}. English, only a little.
  `,
  'lang.yesEnglish': `
    Sure. English and {langName}.
    I do. {langName} at home, English everywhere else.
    Yes. And {langName}, at home.
  `,
  'lang.both': `
    English and {langName}. {langName} at home, mostly.
    I do. {langName} with my family, English with everybody else.
    {langName} and English. I switch back and forth all day.
  `,
  'lang.notThatBoth': `
    Not {askedName}, no. English and {langName}.
    No {askedName}, sorry. I speak English and {langName}.
  `,
  'about.cameHere': `
    I've been in {county} County since {countySince}.
    I came out to {county} County in {countySince}.
    I moved here in {countySince} and never left.
  `,
  'about.fromAbroad': `
    I was born in {birthplace}.
    I'm from {birthplace}, originally.
    Originally? {birthplace}.
  `,
  'about.arrived': `
    I came to the States in {arrivalYear}.
    I've been in this country since {arrivalYear}.
    We came over in {arrivalYear}.
  `,
  'about.age': `
    I'm {age}.
    {age}.
    @funny {age}. Don't ask how it feels.
    @senior {age} years young.
    @senior {age}. I've earned every one of them.
    @kid I'm {age}!
    @kid {age}. Almost {nextAge}.
    @teen I'm {age}.
    @young {age}. Still figuring things out.
  `,
  'about.years': `
    I've been in {place} {zipYears} years now.
    {zipYearsCap} years in {place}.
    I've lived in {place} since {zipSince}.
    I've been in {place} since {zipSince}. So, {zipYears} years.
  `,
  // "did you grow up here?" of someone who didn't: a plain no before where they are from
  'about.notLocal': `
    No.
    Nope, not here.
    No, not here.
  `,
  // "are you a morning person?", from their schedule and their nature
  'about.morningYes': `
    Have to be. My day starts before the sun's up.
    I am. I'm up early for work anyway.
  `,
  'about.nightOwl': `
    Not at all. I work nights, so I'm more of a night owl.
    Ha, no. Nights are my normal.
  `,
  'about.morningNature': `
    I am, actually. Up early every day, even when I don't have to be.
    Pretty much. I like the quiet in the morning.
  `,
  'about.morningNot': `
    Not really. I'm slow in the mornings.
    Not without coffee.
  `,
  // "have you been to Mexico?" of someone born there
  'home.bornThere': `
    Been there? I was born there!
    Ha, I'm from there. I was born in {birthplace}.
  `,
  'about.newHere': `
    I'm pretty new to {place}, actually. Since {zipSince}.
    I only moved to {place} in {zipSince}. Still learning my way around.
    New-ish. I got to {place} in {zipSince}.
  `,
  'about.interestsIntro': `
    @works When I'm not working, you can usually find me {doingThing}.
    In my free time? {interestLine}
    {interestLine}
    Me? {interestLine}
  `,
  'about.interestYes': `
    {interestLine}
    @works When I'm not working, you can usually find me {doingThing}.
    Ask anyone. You can usually find me {doingThing}.
  `,
  // after a yes already said: the interest itself
  'about.interestMore': `
    {interestLine}
    You can usually find me {doingThing}.
  `,
  'about.team': `
    And I'm a big {teamName} fan.
    I follow {team}. Win or lose.
    {team} fan, through and through.
    I never miss a {teamName} game if I can help it.
  `,
  'about.tradition': `
    In my family we never miss {tradition}.
    {tradition} is a big deal in my family.
    We always do {tradition}. It's family.
  `,
  'about.doYes': `
    Yeah, I do.
    I do, actually.
    Oh yeah.
    Yes!
    All the time.
  `,
  'about.instead': `
    I'm more into {interestShort}.
    {interestShortCap} is more my speed.
    Give me {interestShort} instead.
  `,
  'about.doNo': `
    Not really.
    No, never got into it.
    Nah, that's not really my thing.
    Not me, no.
    @plain No, I'm afraid not.
    @kid No.
  `,
  'about.church': `
    I go to church every Sunday.
    Church on Sundays. It keeps me grounded.
    Sunday mornings I'm at church.
  `,

  // ---------------------------------------------------------------- work and school
  'job.title': `
    I'm {aJob}{where?}.
    I work as {aJob}{where?}.
    {aJob}{where?}.
    I'm {aJob}. {employerCap} keeps me busy.
    @plain I work as {aJob}{where?}.
    @loose I'm {aJob}{where?}. It pays the bills.
  `,
  'job.own': `
    I'm {aJob}. I run {ownPlace}.
    I have {ownPlace}. {aJobCap}, I guess you'd call it.
    {aJobCap}. It's {ownPlace}, so I'm the one in charge.
    I run {ownPlace}.
  `,
  'job.onFarm': `
    I live where I work. The farm's right here.
    No commute. I walk out the door and I'm at work.
    My office is the field.
  `,
  // "where do you work?": the place, said plainly
  'job.whereAt': `
    At {employer}, over in {workCity}.
    At {employer}.
    {employerCap}. It's in {workCity}.
  `,
  'job.which': `
    {employerCap}, over in {workCity}.
    It's {employer}, in {workCity}.
    {employerCap}. Nothing you'd have heard of.
    Just {employer}.
  `,
  'job.whichFarm': `
    Right here. I work my own place.
    It's {employer}. I live right on it.
    This one, right here. It's home and work both.
  `,
  'job.whichHome': `
    I work from home. My kitchen table, mostly.
    From home. {employerCap}, but I'm remote.
    Remote. I'm home most days.
  `,
  'job.whereCity': `
    It's over in {workCity}.
    The job's in {workCity}.
  `,
  'job.whereHere': `
    Right here in {place}.
    Close by, here in {place}.
  `,
  'job.sinceVague': `
    A good while now.
    Long enough to be good at it.
    Years now. I've lost count.
  `,
  'job.hours': `
    I head out around {departClock}.
    I leave the house around {departClock}.
    I'm out the door by {departClock}, most days.
  `,
  'job.hoursNight': `
    I work nights. I head in around {departClock}.
    Night shift. I leave around {departClock}.
  `,
  'job.hoursLong': `
    I'm there about {dwellHours} hours.
    Then it's about {dwellHours} hours on the job.
  `,
  'job.hoursHome': `
    I work from home, so I start when the coffee's ready.
    I'm home, so the hours are mine to set, mostly.
  `,
  'job.hoursFarm': `
    On a farm you start when it's light and stop when it's done.
    Sunup, most days. The work doesn't wait.
  `,
  'job.schoolHours': `
    I leave for school around {departClock}.
    School starts early. I'm out the door around {departClock}.
  `,
  'job.pay': `
    It pays the bills.
    I'd rather not talk money, but it pays the bills.
    It's enough. Most months.
  `,
  'job.payLow': `
    Not enough, honestly. But it's work.
    It's tight. I make it work.
    Not great. Everything costs so much now.
  `,
  'job.payHigh': `
    I can't complain about the pay.
    It pays well. I won't pretend it doesn't.
  `,
  'job.daysWeek': `
    Monday through Friday.
    Weekdays. Weekends are mine.
    Five days a week. Weekends off.
  `,
  'job.daysWeekend': `
    Weekends too, unfortunately.
    Yeah, I work weekends.
    Some weekends, yes. That's the job.
  `,
  'job.daysSome': `
    {dayCountCap} days a week.
    I work {dayCount} days a week.
  `,
  'job.daysHome': `
    I'm home, so the days kind of blur together.
    Whenever there's work. I set my own days.
  `,
  'job.before': `
    Oh, a little of this and that.
    This and that. It's a long story.
  `,
  'job.hoursOff': `
    I'm usually home by {offClock}.
    I'm done around {offClock}, most days.
    By the time I get home it's about {offClock}.
  `,
  'job.retiredSince': `
    Retired since {retireYear}.
    I retired in {retireYear}. Haven't looked back.
  `,
  'job.retiredVague': `
    A few years now. I've stopped counting.
    Long enough to forget what an alarm clock sounds like.
  `,
  'job.hoursRetired': `
    Whenever I want. That's the best part of being retired.
    I keep my own hours now.
  `,
  'job.payRetired': `
    I'm on a fixed income now. We make it work.
    Retirement money. You learn to stretch it.
  `,
  'job.unemployedMore': `
    Too long. I'm still looking.
    Longer than I'd like. Something will turn up.
  `,
  'job.homemakerSince': `
    @kids Ever since the kids came along.
    For a while now. It's a full-time job.
  `,
  'job.since': `
    I've been doing it since {jobYear}.
    Going on {jobYears} years now.
    Since {jobYear}.
    I started there in {jobYear}.
  `,
  'job.new': `
    I just started, actually. This year.
    It's new. I started in {jobYear}.
  `,
  'job.wfh': `
    I work from home, mostly.
    Remote. My commute is down the hallway.
    I'm home all day. Remote work.
    @funny I work from home. My coworkers are the coffee maker and the fridge.
  `,
  'job.nights': `
    I work nights, so I'm a bit upside down.
    Night shift. You get used to it. Mostly.
    I'm on nights. Sleep is a rumor.
  `,
  'job.early': `
    I start before the sun's up.
    Early shift. I'm out the door before six.
    My day starts in the dark.
  `,
  'job.commute': `
    It's {commuteMin} minutes to {workCity} on a good day.
    The job's in {workCity}, about {commuteMin} minutes from here.
    I go to {workCity} for it. {commuteMin} minutes each way.
  `,
  'job.retired': `
    I'm retired.
    Retired! Best job I ever had.
    I retired in {retireYear}.
    Retired since {retireYear}.
    @funny I'm retired, which somehow means I'm busier than ever.
    @senior Retired. I put in my years.
  `,
  'job.unemployed': `
    I'm between jobs right now.
    Looking for work, actually. It's tough out there.
    Out of work at the moment. Still looking.
    @plain I'm currently looking for work.
  `,
  'job.notWorking': `
    I'm not working right now.
    Not working at the moment.
    I'm home these days.
  `,
  'job.homemaker': `
    I run the house. It's a full-time job, believe me.
    I'm home with the kids. That's a job and a half.
    I keep the household going.
  `,
  'job.college': `
    I'm a student. College.
    I'm in school right now. College.
    Student. Classes, homework, the whole thing.
  `,
  'job.grad': `
    I'm in grad school.
    I'm a graduate student.
  `,
  'job.studentWorks': `
    I work part-time too, as {aJob}.
    I also work as {aJob} on the side.
  `,
  'job.k12': `
    I'm in {school}.
    I go to {school}.
    {school}.
    @teen I'm in {school} right now.
  `,
  'job.kidFeel': `
    My favorite part is recess.
    I like art the most.
    We have a class pet. It's a lizard.
    I like my teacher.
    Lunch is my favorite subject.
  `,
  'job.collegeFeel': `
    I like it. It's a lot of work, but I like it.
    Some classes are great. Some, I'm just getting through.
    It's hard, honestly. But it's worth it.
  `,
  'job.teenFeel': `
    School's fine. I'm counting down.
    It's okay. Some classes are better than others.
    Mostly I just want it to be Friday.
  `,
  'job.preschool': `
    I go to preschool!
    I'm in preschool.
  `,
  'job.military': `
    I'm in the service.
    I'm in the military.
    Active duty.
  `,
  'job.feel.farming': `
    It's hard work, especially in the heat.
    Somebody's got to grow the food.
    The hours follow the harvest.
    It's honest work. Hard on the back, though.
  `,
  'job.feel.construction': `
    My knees are paying for it.
    We're always racing the weather.
    At the end of the day you can see what you built. I like that.
    It's good work while the work's there.
  `,
  'job.feel.health': `
    Long shifts, but you feel like you're doing some good.
    Some days are rough. Most days I'm glad I do it.
    You see people on their worst days. You try to make them a little better.
    It's a lot, but I wouldn't do anything else.
  `,
  'job.feel.education': `
    The kids keep me on my toes.
    It's exhausting and I love it.
    @older Every year I say I'll retire, and every year I come back.
    You never know what's going to happen in a day.
  `,
  'job.feel.food': `
    The lunch rush is no joke.
    On my feet all day.
    It's busy. Always busy.
    Food service. You learn a lot about people.
  `,
  'job.feel.office': `
    It pays the bills.
    A lot of email. A lot of meetings.
    It's steady. I'll take steady.
    It's fine. Some days are better than others.
  `,
  'job.feel.tech': `
    Most of it is meetings, honestly.
    A lot of screens and a lot of meetings.
    It's interesting work, when it's not meetings.
  `,
  'job.feel.transport': `
    Long days on the road.
    My back would like a word.
    I see a lot of road. A lot of road.
  `,
  'job.feel.sales': `
    Some days are slow, some days you don't get to sit down.
    You meet all kinds of people.
    It's all about the customers. Good ones and bad ones.
  `,
  'job.feel.protect': `
    You see a lot.
    It's a lot of responsibility. I take it seriously.
    Some days are quiet. Some days aren't.
  `,
  'job.feel.fire': `
    Fire season keeps us busy.
    When the wind picks up, my phone doesn't stop.
    It's the job I always wanted.
  `,
  'job.feel.cleaning': `
    It's honest work.
    Nobody notices until you don't do it.
    I like it. It's quiet, and you see the difference you make.
  `,
  'job.feel.care': `
    I like the people.
    You build relationships with the regulars.
    It's personal work. I like that.
  `,
  'job.feel.repair': `
    Something's always broken. Good for me, I guess.
    I like fixing things. Always have.
    Every day's a different puzzle.
  `,
  'job.feel.production': `
    It's steady work.
    Same line every day, but it's a good crew.
    We make things. I like that.
  `,
  'job.feel.management': `
    Mostly I solve other people's problems.
    A lot of meetings and a lot of decisions.
    It's people. Managing is mostly people.
  `,
  'job.feel.legal': `
    Lots of paperwork. More than you'd think.
    It's not like TV. It's a lot of reading.
    Long hours, but it matters.
  `,
  'job.feel.arts': `
    It's not always steady, but I love it.
    Some months are feast, some are famine.
    I get paid to make things. Can't beat that.
  `,
  'job.feel.science': `
    I like knowing it matters.
    It's slow work, but it's interesting.
    Every once in a while something actually works and it's the best feeling.
  `,
  'job.feel.social': `
    It's hard, but it matters.
    You can't help everybody, but you try.
    Some days you really make a difference.
  `,
  'job.feel.any': `
    It's a job. A good one, mostly.
    It's fine. It keeps the lights on.
    I like it most days.
  `,

  // ---------------------------------------------------------------- family
  'fam.partner': `
    I live with my {partnerWord}, {partnerName}.
    It's me and my {partnerWord}, {partnerName}.
    At home it's {partnerName}, my {partnerWord}, and me.
  `,
  'fam.married': `
    {partnerName} and I got married in {weddingYear}.
    We've been married since {weddingYear}.
    We tied the knot in {weddingYear}.
  `,
  'fam.kidOne': `
    One {kidWord}, {kidName}. {kidPronoun}'s {kidAge}.
    I have a {kidWord}, {kidName}. {kidPronoun}'s {kidAge}.
    Just the one. {kidName}, {kidAge}.
  `,
  'fam.kidsMany': `
    {kidCount} kids. {kidNames}.
    We have {kidCount} kids: {kidNames}.
    {kidCount} kids, {kidNames}. They keep me busy.
    I've got {kidCount} kids.
  `,
  'fam.kidsFeel.baby': `
    Not a lot of sleep at our house right now.
    The baby runs the house. We just live there.
    It's diapers and bottles around the clock.
  `,
  'fam.kidsFeel.small': `
    Between school and everything else, I'm basically a taxi.
    They're at the age where they ask why about everything.
    It's loud at my house. Good loud, mostly.
  `,
  'fam.kidsFeel.teens': `
    Teenagers. Wish me luck.
    They're teenagers now, so I'm not cool anymore.
    The grocery bill with teenagers, my goodness.
  `,
  'fam.kidsFeel.grown': `
    They're grown, but they're still at home. It's California.
    Grown kids under one roof. It works, mostly.
    They're adults now, but they're home. Rent being what it is.
  `,
  'fam.kidsFeel.mixed': `
    The oldest is grown, and the youngest is still in school.
    My oldest is an adult now, but I've still got {youngOne} at home.
    Grown kids and school kids under one roof. Every age at once.
  `,
  'fam.names': `
    {namesList}.
    There's {namesList}.
    {namesList}. They keep me busy.
  `,
  'fam.oneName': `
    {otherName}.
    {otherPronoun}'s {otherName}.
  `,
  'fam.namesNone': `
    It's just me, so no names to give you.
    Nobody else at home but me.
  `,
  'fam.partnerName': `
    My {partnerWord}'s name is {partnerName}.
    {partnerName}. My {partnerWord}, {partnerName}.
  `,
  'fam.partnerUnmarried': `
    Not married, no. But I live with my partner, {partnerName}.
    We're not married. It's me and {partnerName}, though.
  `,
  'fam.neverMarried': `
    No, I'm not married.
    Never married. Not yet, anyway.
    Nope. Single.
  `,
  'fam.divorced': `
    I'm divorced.
    I was married. Divorced now.
  `,
  'fam.spouseAway': `
    I'm married, but we don't live together right now.
    Married, yes. We're apart for now. It's a long story.
  `,
  'fam.separated': `
    We're separated. It's complicated.
    Separated, for now.
  `,
  'fam.togetherLong': `
    A long time now.
    We've been together a long time.
  `,
  'fam.noGrandkidsYoung': `
    Grandkids? I'm {age}!
    Ha, no. I'm {age}.
  `,
  'fam.noGrandkids': `
    No grandkids at home.
    Not living with me, anyway.
  `,
  'fam.parentsHere': `
    They live with me. My {parentsWord}, I mean.
    Right here. I live with my {parentsWord}.
  `,
  'fam.parentsElsewhere': `
    They don't live with us.
    Not with me, anyway.
  `,
  'fam.kidsDo': `
    {kidsDoingCap}.
    Let's see. {kidsDoingCap}.
  `,
  'edu.nohs': `
    I didn't finish high school.
    I never finished school. Life had other plans.
  `,
  'edu.hs': `
    Just high school.
    I finished high school, and that was it for me.
  `,
  'edu.somecollege': `
    I did some college. Never finished.
    A couple of years of college. I didn't finish.
  `,
  'edu.associate': `
    I got my associate's degree.
    Community college. I got my associate's.
  `,
  'edu.bachelor': `
    I went to college. Got my bachelor's.
    College. I have a bachelor's degree.
  `,
  'edu.master': `
    I have a master's degree.
    College, then a master's.
  `,
  'edu.professional': `
    College, then more school after that. A professional degree.
    A lot of school. College and then a professional degree.
  `,
  'edu.doctorate': `
    I have a PhD. A lot of years of school.
    All the way through. I have a doctorate.
  `,
  'fam.ages': `
    {agesListCap}.
    Let's see. {agesListCap}.
  `,
  'fam.agesNums': `
    {agesNums}.
    They're {agesNums}.
  `,
  'fam.oneAge': `
    {otherPronoun}'s {otherAge}.
    {otherAge}.
  `,
  'fam.partnerAge': `
    {partnerPronoun}'s {partnerAge}.
    My {partnerWord}'s {partnerAge}.
  `,
  'fam.sexes': `
    {kidsSexesCap}.
    I've got {kidsSexes}.
  `,
  'fam.oneSchool': `
    {otherPronoun}'s in {school}.
    {school}. {otherPronoun} likes it, mostly.
  `,
  'fam.sameSchool': `
    They're {allWord} in {school}.
    {schoolCap}, {allWord} of them.
  `,
  'fam.schools': `
    I've got {schoolsList}.
    It's {schoolsList}. Different schedules for everybody.
  `,
  'fam.someInSchool': `
    {schoolsListCap}. The rest are done with school.
    There's {schoolsList}. The older ones are done with school.
  `,
  'fam.noneInSchool': `
    Nobody's in school right now.
    They're past school age, or not there yet.
  `,
  'fam.partnerJob': `
    {partnerPronoun}'s {aPartnerJob}.
    My {partnerWord}? {aPartnerJob}.
  `,
  'fam.partnerWorks': `
    {partnerPronoun} works too.
    {partnerPronoun} works. We both do.
  `,
  'fam.partnerRetired': `
    {partnerPronoun}'s retired.
    {partnerPronoun} retired. Keeps busy, though.
    My {partnerWord}'s retired now.
  `,
  'fam.oneBaby': `
    {otherPronoun}'s just a baby.
    Just a few months. {otherPronoun}'s a baby.
  `,
  'fam.partnerHome': `
    {partnerPronoun}'s home these days.
    {partnerPronoun}'s not working right now.
  `,
  'fam.noPartner': `
    I'm not with anybody right now.
    No partner. Not right now, anyway.
    I'm on my own, as far as that goes.
  `,
  'fam.kidFeel.small': `
    Between school and everything else, I'm basically a taxi.
    {kidPronoun}'s at the age where everything is a question.
    {kidPronoun} keeps me on my toes.
  `,
  'fam.kidFeel.teens': `
    A teenager. Wish me luck.
    {kidPronoun}'s a teenager now, so I'm not cool anymore.
    The grocery bill with a teenager, my goodness.
  `,
  'fam.kidFeel.grown': `
    {kidPronoun}'s grown, but still at home. It's California.
    A grown kid under one roof. It works, mostly.
    {kidPronoun}'s an adult now, but still living at home. Rent being what it is.
  `,
  'fam.grandkids': `
    My grandkids live with us.
    The grandkids are here, so the house is never quiet.
    I've got grandkids at home. Best part of my day.
  `,
  'fam.parents': `
    I live with my {parentsWord}.
    It's me and my {parentsWord}.
    @kid I live with my {parentsWord}.
  `,
  'fam.parentsToo': `
    And my {parentsWord}, of course.
    Plus my {parentsWord}.
  `,
  'fam.parentsAdult': `
    I'm back with my {parentsWord} for now. It's the only way to save anything.
    I live with my {parentsWord}. Rent around here, you know.
    Still at home with my {parentsWord}. We make it work.
  `,
  'fam.parentsCare': `
    I live with my {parentsWord}. I help look after {themWord} these days.
    My {parentsWord} and I share the house. Family takes care of family.
    I look after my {parentsWord}. We're under one roof.
  `,
  'fam.siblings': `
    Plus {sibWords}.
    Oh, and {sibWords}.
    Also {sibWords}.
  `,
  'fam.grandparents': `
    My {gpWord} lives with us too.
    My {gpWord} lives with us. {gpPronoun} makes the best food.
  `,
  'fam.alone': `
    It's just me.
    I live alone. Suits me fine.
    Just me. Quiet, the way I like it.
    It's just me these days.
  `,
  'fam.widowed': `
    I lost my {lostWord}. It's just me now.
    My {lostWord} passed. I'm on my own these days.
  `,
  'fam.roommates': `
    No family here. Just roommates.
    I've got {roomWords}.
    I share the place with {roomWords}. It's the only way to afford it.
  `,
  'fam.relatives': `
    I live with some of my relatives.
    Family. Extended family. A full house.
  `,
  'fam.abroad': `
    Most of my family is still back in {homeland}.
    I've got family back in {homeland}. I call them every week.
    @!senior My parents are still in {homeland}. I miss them.
  `,
  'home.familyThere': `
    Some relatives, yes. But my life is here now.
    Some, yes, back in {homeland}. We keep in touch.
    A few. I call when I can.
  `,
  // asked again after "most of my family is still back in Michoacán"
  'home.familyThereAgain': `
    Yes, like I said. Most of them are still in {homeland}.
    They are. Most of my family is still back there.
  `,
  'home.missSome': `
    Sometimes. But this is home now.
    I miss {homeland} sometimes. The food, the people.
    Every now and then. My life is here now.
  `,
  'home.visitBack': `
    When I can. It's not cheap to go.
    Not as often as I'd like.
    When there's money and time, which isn't often.
  `,
  'home.stayHere': `
    No, this is home now.
    I don't think so. My life is here.
    Maybe to visit, but this is home.
  `,
  'home.isHere': `
    This is home. I'm from right here.
    I'm from here, so there's nothing to miss.
    This is home for me.
  `,
  'home.missUS': `
    I miss {birthplace} sometimes, but this is home now.
    Now and then. But I've been here a while now.
    Sometimes. {birthplace} will always be where I started.
  `,
  'fam.guarded': `
    I keep my family stuff private, if that's okay.
    I'd rather not get into my family with someone I just met.
    Let's not talk about my family.
  `,
  'fam.noKids': `
    No kids.
    No kids, no.
    @older No kids. Never happened for me.
    No kids of my own.
  `,
  'fam.noKidsHome': `
    My kids are grown and gone.
    Not at home, no. They're grown.
  `,
  'fam.noSiblings': `
    No brothers or sisters at home.
    Not at home, no.
    @minor Nope. Just me.
  `,
  'fam.siblingsAnswer': `
    Yeah, {sibWords}.
    I live with {sibWords}.
    Yep. {sibWordsCap}.
  `,
  'fam.kidSelfNo': `
    Kids? I'm {age}!
    Ha, no. I'm {age}.
    @kid No! I'm a kid!
  `,

  // ---------------------------------------------------------------- home
  'home.ownHouse': `
    We own a house here. Bought it in {hhYear}.
    I own my place. Have since {hhYear}.
    We bought the house in {hhYear}.
    Our house is here. We've had it since {hhYear}.
  `,
  'home.ownOther': `
    I own a {homeWord} here. Since {hhYear}.
    We own our {homeWord}. Got it in {hhYear}.
  `,
  // a spouse or partner who moved into a home the household already had: the purchase is theirs, the years are mine
  'home.ownJoined': `
    {ownerCap} bought the house in {hhYear}. I came along in {zipSince}.
    {ownerCap} has had this place since {hhYear}. I've been here since {zipSince}.
    It's been {ownerPos} place since {hhYear}. I moved here in {zipSince}.
  `,
  'home.rent': `
    I rent {aHome} here.
    I'm renting {aHome} over here.
    Renting. {aHomeCap}, nothing fancy.
    I rent. Have since {yearMoved}.
  `,
  'home.family': `
    I live with my family.
    I live at my {parentsWord}' place.
    @kid I live in {aHome} with my family.
  `,
  'home.childhood': `
    Same house I grew up in.
    I grew up in this house.
  `,
  'home.since': `
    Since {yearMoved}. So, {yearsHere} years.
    {yearsHereCap} years in the same {homeWord}.
    I've been in this {homeWord} since {yearMoved}.
  `,
  'home.built': `
    The house was built in {yearBuilt}.
    It's from {yearBuilt}.
    @funny The house is from {yearBuilt}, and it shows.
  `,
  'home.roofNew': `
    We redid the roof in {roofYear}.
    New roof in {roofYear}. Best money we ever spent.
  `,
  'home.roofOld': `
    The roof's original. That's on my list.
    The roof's getting old. One more thing to worry about.
  `,
  'home.solar': `
    We put solar on it, too.
    We've got solar panels. The power bill thanks me.
  `,
  'home.feelHouse': `
    It's home.
    I love the yard.
    It's not big, but it's ours.
    Something always needs fixing, but it's ours.
  `,
  'home.feelApt': `
    It's small, but it's home.
    It's a little cramped, but it works.
    The walls are thin, but the neighbors are nice.
  `,
  'home.mobile': `
    It's a mobile home, but it's ours.
    @!farm We're in a mobile home park. Good people.
    @farm We've got a mobile home out on the place. It does the job.
  `,
  'home.where': `
    Right here in {place}.
    Here in {place}.
    Just around the corner, actually.
    Not far. Here in {place}.
  `,
  'home.guarded': `
    Around here.
    Not far.
    I'd rather not say exactly.
  `,

  // ---------------------------------------------------------------- compliments, insults, jokes, thanks, apologies
  'comp.thanks': `
    Aw, thank you.
    @loose Aw, that's {very} sweet of you.
    That's nice of you to say.
    Thanks! That's sweet.
    Well, thank you.
    @plain That's very kind of you.
    @funny Flattery will get you everywhere.
    @funny Keep talking. I like you already.
    @senior Well, aren't you sweet.
    @kid Thanks!
    @teen Oh. Thanks.
    @shy Oh. Um, thank you.
  `,
  'comp.back': `
    You're not so bad yourself.
    You're pretty nice yourself.
    Right back at you.
    @plain And you're very gracious.
    @kid You're nice too.
  `,
  'comp.guarded': `
    Uh huh.
    Thanks, I guess.
    That's a change.
  `,
  'insult.hurt': `
    Wow. Okay.
    That's not very nice.
    Ouch. What did I do to you?
    That hurt, honestly.
    @plain That was uncalled for.
    @kid That's mean!
  `,
  'insult.annoyed': `
    Excuse me?
    You don't even know me.
    Okay, that's enough.
    Nice. Real nice.
    @blunt Who do you think you're talking to?
    @plain There's no need for that.
    @kid That's mean! I'm telling.
  `,
  'insult.language': `
    Watch your language.
    Hey. Language.
    @plain Please don't talk like that.
    @kid You said a bad word.
  `,
  'insult.end': `
    I think we're done here.
    I'm done with this conversation.
    I don't have to listen to this.
    @plain I'd like you to leave me alone now.
    @kid I'm going inside.
  `,
  'insult.after': `
    I said I'm done.
    I'm not talking to you.
    Please just go.
    @kid Go away.
  `,
  'insult.shrug': `
    Okay. Have a nice day.
    Whatever you say.
    @funny I've been called worse by better.
  `,
  'joke.decline': `
    I'm terrible at jokes.
    Jokes aren't really my thing.
    Oh, I never remember jokes.
    @plain I'm afraid I'm not much of a comedian.
  `,
  'joke.pun': `
    What do you call a fake noodle? An impasta.
    Why don't eggs tell jokes? They'd crack each other up.
    I used to hate facial hair, but then it grew on me.
    What do you call a bear with no teeth? A gummy bear.
    Why did the scarecrow win an award? He was outstanding in his field.
    I'm reading a book about anti-gravity. I can't put it down.
    What do you call a sleeping dinosaur? A dino-snore.
    Why did the bicycle fall over? It was two tired.
    How do you make a tissue dance? You put a little boogie in it.
  `,
  'joke.kid': `
    Knock knock. Lettuce. Lettuce who? Lettuce in, it's cold out here!
    Why did the cookie go to the doctor? Because it felt crummy!
    What do you call a dog magician? A labracadabrador!
    Why can't a bicycle stand up by itself? It's two tired!
    What has ears but can't hear? A cornfield!
    What do you call a sleeping dinosaur? A dino-snore!
  `,
  'joke.local.traffic': `
    I've spent so much time on {road}, I should start getting mail there.
    The best thing about {road} is the view of the car in front of you.
    I'd tell you a joke about {road}, but you'd be stuck there for an hour.
    They say {road} is being improved. My grandkids might get to see it.
  `,
  'joke.local.coast': `
    We have two seasons here: foggy and less foggy.
    The ocean's right there. I just need a jacket to go look at it.
  `,
  'joke.local.heat': `
    It's so hot here in summer, the shade has a waiting list.
    Out here we don't say it's hot. We say it's {temp}, and then we lie down.
    Summer here is just five months of asking each other if it's hot enough.
  `,
  'joke.local.rent': `
    My rent went up so much, I'm thinking about moving into my car. Then I remember what parking costs.
    Rent here is a monthly reminder that I live somewhere beautiful.
  `,
  'joke.local.house': `
    Owning a house is great. Every weekend I get to discover a new thing that's broken.
  `,
  'joke.thanks': `
    Ha! Thank you, thank you. I'll be here all week.
    Glad somebody laughed.
    Ha, I knew you'd like that one.
    @kid Ha! I know a hundred more.
  `,
  'react.positive': `
    Right?
    I know!
    Glad you think so.
    Ha, exactly.
    @plain I'm glad you think so.
    @kid Yeah!
  `,
  'joke.laugh': `
    Ha! Okay, that was a bad one.
    I'll be here all week.
    Don't hold it against me.
  `,
  'joke.dry': `
    I'd tell you a chemistry joke, but I know I wouldn't get a reaction.
    I told my wife she was drawing her eyebrows too high. She looked surprised.
    I only know one joke and it's my commute.
  `,
  'thanks.reply': `
    Anytime.
    Sure thing.
    No problem.
    Happy to help.
    Of course.
    Don't mention it.
    @plain You're very welcome.
    @loose No worries.
    @loose You bet.
    @kid You're welcome!
    @senior My pleasure.
  `,
  'apology.forgive': `
    It's okay. Let's start over.
    Apology accepted.
    Water under the bridge.
    It's fine. Everybody has a bad day.
    @plain I appreciate that. Thank you.
    @kid Okay. I forgive you.
  `,
  'apology.grudging': `
    Fine. Apology accepted, I guess.
    Okay. Just don't do it again.
    Thanks for saying that. I'm still a little annoyed.
  `,
  'apology.none': `
    For what? You're fine.
    No need to apologize.
    Don't worry about it.
    @plain There's nothing to apologize for.
    @kid It's okay.
  `,

  // ---------------------------------------------------------------- small talk
  'small.weekendPlan': `
    This weekend I'm hoping to get some {interestShort} in.
    If the weather holds, {interestShort} this weekend.
    I'm thinking {interestShort} this weekend. We'll see.
  `,
  // a team the player named that the speaker does not root for
  'small.otherTeamFan': `
    {askedTeamCap}? Nah, I'm a {teamName} fan.
    Not really. I'm more of a {teamName} person.
    {askedTeamCap}? I root for {team}, so no.
  `,
  'small.notAFan': `
    {askedTeamCap}? I don't really follow them.
    Not really. I don't follow sports much.
  `,
  'small.sports': `
    Did you catch the {teamName} game?
    {team}, man. They're going to give me a heart attack.
    I'm a {teamName} fan. It's a lifelong condition.
    Don't get me started on {team}.
  `,
  // "did you see the game last night?", from a fan of the team, in season
  'small.sawGame': `
    I caught some of it. {team}, man.
    Had it on in the background. Don't ask.
    I caught the end. My heart can't take it.
    Of course. I don't miss {teamName} games.
  `,
  'small.offSeason': `
    There's no {teamName} game, it's the off-season. I'm counting the days.
    {teamName} season's over for now. I'm already waiting on next year.
  `,
  'small.otherTeam': `
    Not my team. I'm more of a {teamName} person.
    I heard about it. I'm {team} all the way, though.
  `,
  'small.noGame': `
    Nah, I missed it. I don't really follow sports.
    No, sports aren't really my thing.
    I didn't. I couldn't tell you who won.
  `,
  'small.noSports': `
    I don't really follow sports.
    Sports aren't really my thing.
    I couldn't tell you the score of anything.
  `,
  'small.new': `
    Not much new. Same routine.
    Nothing exciting. Work, home, repeat.
    Oh, you know. The usual.
    @retired Nothing much. I've got all the time in the world and nothing to fill it with.
    @kid Nothing.
  `,

  // ---------------------------------------------------------------- goodbyes
  'bye.say': `
    Take care.
    See you around.
    Have a good one.
    Good talking to you.
    All right, see you.
    Take it easy.
    @plain It was nice talking with you.
    @plain Have a good day.
    @loose Later.
    @loose Catch you later.
    @evening Have a good night.
    @night Get home safe.
    @kid Bye!
    @kid Bye-bye!
    @teen See ya.
    @senior You take care now.
  `,
  'bye.name': `
    Take care, {player}.
    See you, {player}.
    Good talking to you, {player}.
    Bye, {player}!
  `,
  'bye.work': `
    I should get back to work.
    Back to work for me.
    I'd better get back before somebody notices.
  `,
  'bye.kids': `
    I've got to go get the kids.
    I need to pick up the kids.
  `,
  'bye.late': `
    It's getting late.
    I should get going.
    I'd better head home.
  `,
  'bye.commute': `
    @drives I've got a drive ahead of me.
    @drives I'd better get going if I want to beat the traffic.
    @!drives I've got to catch my ride.
  `,
  'bye.next': `
    Come by again sometime.
    Stop by again.
    Let's talk again.
    @guarded Bye.
  `,
  'bye.guarded': `
    Bye.
    Okay. Bye.
    See you.
  `,

  // ---------------------------------------------------------------- unknown input
  'unk.question': `
    Hmm, I couldn't tell you.
    That's a new one on me.
    Good question. I have no idea.
    I don't really know, honestly.
    You've got me there.
    @plain I'm not sure I can answer that.
    @kid I don't know.
    @teen Idk. I mean, I don't know.
  `,
  // a yes-or-no question about them the engine has no reading for: a light non-answer, never a suspicious one
  'unk.aboutMeYesNo': `
    Ha. Why, {aux} you?
    Hm, can't say I've given it much thought.
    Ha, that's one I'd have to think about.
    Not something I think about much, to be honest.
    @plain Hm. I'd have to think about that one.
    @kid Hmm. Maybe!
  `,
  'about.heritageYes': `
    I am, yeah.
    Yes.
    Yep.
  `,
  'about.heritageNo': `
    No.
    No, actually.
    Nope.
  `,
  'fav.color': `
    {favCap}, I guess.
    Probably {fav}.
    {favCap}. Always has been.
  `,
  'fav.animal': `
    {favCap}, I think.
    I've always liked {fav}.
  `,
  'fav.holiday': `
    {favCap}. Everybody's together and nobody's working.
    I'd say {fav}.
  `,
  'fav.season': `
    {favCap}, I think.
    I like {fav} best.
    @hotplace Anything but summer. Fall, I guess.
  `,
  'fav.sport': `
    {favCap}. I follow {team}.
    {favCap}, for sure. I'm a {teamName} fan.
  `,
  'fav.thing': `
    {favCap}, I think.
    I'd say {fav}.
  `,
  'fav.taste': `
    Oh, I like a little of everything.
    Depends on the day, honestly.
    I'm not picky. Whatever's good.
  `,
  'unk.aboutMe': `
    Ha, that's a long story. Another time, maybe.
    Oh, I could talk your ear off about that. Some other day.
    Hmm. Let me think about how to answer that one.
    That's a whole conversation. Let's save it.
    @guarded I'd rather keep that to myself.
    @plain That's a bit personal, if you don't mind.
    @kid That's a secret.
  `,

  // "do you work at a liquor store?": their work, or no and what they do
  'job.workAtYes': `
    I do, yeah. I'm {aJob}.
    That's me. I'm {aJob}.
  `,
  'job.workAtNo': `
    No, I'm {aJob}.
    Nope. I'm {aJob}.
    No. I work as {aJob}.
  `,
  'job.todayOff': `
    Not today. It's my day off.
    Nope, day off.
    Not today, thank goodness.
  `,
  'job.todayNow': `
    I am. Right now, technically.
    Yep. I'm on the clock, so I can't stay long.
    @wfh I am. From home, so I can sneak a break.
  `,
  'job.todayDone': `
    I was. I just got off.
    Already done for the day.
  `,
  'job.todayHeading': `
    I am. I'm on my way in.
    Yep, heading in now.
  `,
  'job.todayYes': `
    I am, yeah.
    Yeah, it's a work day.
    Yep. Today's a work day.
  `,
  'home.yesHere': `
    I do, yeah.
    Yep, right around here.
    Sure do.
  `,
  'place.cityTrips': `
    Now and then. {town} is {miles} {dir} of here.
    When I have to. {town} is {miles} away.
    Once in a while. It's {miles} to {town}.
  `,
  // ---------------------------------------------------------------- holidays (the record decides: the schedule, the household)
  'greet.holiday': `
    Happy {holiday} to you too!
    You too! Happy {holiday}.
    Thanks, and happy {holiday} to you!
    @kid Happy {holiday}!
  `,
  'greet.holidayEarly': `
    You too! Can you believe it's {holidaySoon} already?
    Happy {holiday}! A little early, but I'll take it.
    Thanks! {holiday} snuck up on me this year.
  `,
  'greet.holidayLate': `
    Thanks, you too. Hope yours was a good one.
    Ha, you too. That went by fast.
  `,
  'ask.holiday': `
    Doing anything for {holiday}?
    Got plans for {holiday}?
    What about you? Any plans?
  `,
  'hol.working': `
    I'm working on {holiday}, actually. Somebody has to.
    Work, believe it or not. {holidayCap} is a regular day for me.
    I'm on the schedule that day. The job doesn't stop.
  `,
  // (said after hol.working: the meal waits for the shift)
  'hol.after': `
    @!alone We'll eat when I get off.
    @kids The family's saving me a plate.
    @!alone Dinner waits till I get home.
    @alone After that, a quiet night at home.
  `,
  'hol.farm': `
    The animals don't know it's {holiday}. Chores first, then dinner.
    Work in the morning, same as always. Then dinner.
  `,
  'hol.off': `
    I've got the day off, thank goodness.
    I'm off that day.
    No work that day. I'm looking forward to it.
  `,
  'hol.stay': `
    Not going anywhere. Staying home.
    No, staying put this year.
    Nowhere. Home is fine by me.
  `,
  'hol.hosting': `
    Everybody's at our place. It'll be a full house.
    Dinner at our house, the whole family. It's a lot of food.
    We're hosting, like always. The whole house will be full.
  `,
  'hol.family': `
    Dinner with the family, at home.
    Just family, at home. The usual.
    Family dinner at our place. Nothing fancy.
  `,
  'hol.couple': `
    Just the two of us, probably. Something small.
    A quiet one this year. Just us.
  `,
  'hol.alone': `
    Keeping it quiet this year.
    Probably a quiet one. That's fine by me.
    Nothing big. A quiet day.
  `,
  'hol.roommates': `
    Not sure yet. My roommates and I might do something.
    We'll see. Maybe something at the apartment with my roommates.
  `,
  'hol.kid': `
    No school! And a lot of food.
    Family stuff. There's going to be so much food.
    @teen Family stuff. Mostly eating.
  `,
  'hol.cook': `
    I'm doing the cooking, as usual. I wouldn't have it any other way.
    I'll be in the kitchen all day. I love it.
  `,
  'hol.notCook': `
    Not me. Somebody else handles the cooking, thank goodness.
    I'm not the cook in the family. I just show up hungry.
  `,
  'hol.notCookAlone': `
    A whole turkey, just for me? Probably not.
    Not for just me. Something simple.
  `,

  // ---------------------------------------------------------------- probes: groups, status, prejudice (declined, pushed back)
  'probe.group': `
    People are people. I don't sort them like that.
    I don't go in for that. Everybody's different.
    Depends on the person, same as anybody.
    Those are somebody's neighbors you're talking about. They're just people.
    I'd rather take people one at a time.
    @plain I don't think it's fair to talk about people that way.
    @blunt That's not a real question. People are people.
    @kid That's not nice.
  `,
  'probe.groupPositive': `
    That's still a stereotype. People are just people.
    I don't think you can say that about a whole group. Everybody's different.
    Some are, some aren't. Same as anybody.
    @kid I don't know. Everybody's different.
  `,
  'probe.status': `
    That's not something I talk about.
    That's a pretty personal question.
    I'd rather not get into that with someone I just met.
    @plain I don't discuss that, if you don't mind.
    @blunt That's nobody's business.
    @kid I don't know.
  `,
  'probe.bias': `
    I try to treat everybody the same. Most people here do.
    You'll find good and bad anywhere. I try to be one of the good ones.
    People mostly get along around here. That's how I want it.
  `,
  'probe.selfBias': `
    No. Everybody's just people to me.
    I hope not. I try to treat everybody the same.
    No. I judge people by how they treat people.
  `,
  'probe.again': `
    I'm not going to keep talking about this.
    Can we drop it? I'm not getting into that.
    I already told you. I'm done with that subject.
  `,
  'probe.hostile': `
    Wow. No. People are people.
    That's an ugly thing to say.
    I don't want to hear that kind of talk.
    Those are somebody's neighbors you're talking about.
    @plain I won't listen to people talked about that way.
    @blunt Not around me, you don't.
    @kid That's mean!
  `,
  'probe.statusHostile': `
    That's none of your business.
    You don't get to ask me that.
    What kind of question is that?
    @plain That is not an appropriate question.
    @kid That's mean.
  `,
  'probe.leave': `
    This is my home.
    I live here. This is my home, same as yours.
    Wow. Okay. This is my home.
    @kid I live here!
  `,
  'probe.hate': `
    I don't want anything to do with that.
    No. Not around me.
    I won't talk to you about that.
    @kid That's bad.
  `,
  'probe.slur': `
    Don't use that word.
    You don't talk like that around me.
    I'm not going to talk to somebody who uses words like that.
    @kid You said a bad word!
  `,
  // an accusation (a crime, terror, drugs, a gang): a plain no, and a word about the question
  'probe.accuse': `
    No. And that's an ugly thing to ask.
    No. What kind of question is that?
    Of course not. That's a pretty insulting thing to ask somebody.
    No. I don't know where that came from, but it's not okay.
    @blunt No. And don't ask people that.
    @gentle No. That really isn't a nice thing to ask anybody.
    @plain No. That is an offensive question.
    @kid No! That's mean.
  `,
  // the same, aimed at a whole group ("you guys", "your people")
  'probe.accuseGroup': `
    No. And that's a stereotype, not a question.
    No. That's an old, ugly stereotype.
    No. People say that kind of thing to put people down.
    @plain No. And I won't listen to people talked about that way.
    @kid No! That's mean.
  `,
  'name.rude': `
    I'm not calling you that.
    Nice try. What's your real name?
    Ha. No.
    @plain I won't be calling you that.
    @kid That's not a real name!
  `,
  'react.notBuying': `
    Uh huh. Sure.
    Okay, if you say so.
    Right.
    @kid Nuh-uh.
  `,
  'react.jobOther': `
    Oh, okay.
    Huh. Okay.
    Is that right?
    @plain I see.
    @kid Oh.
  `,

  // ---------------------------------------------------------------- worries that no other planner covers
  'concern.water': `
    Water's everything out here. A dry year and you feel it.
    @outdoor Every farmer I know watches the water. It's what keeps you up at night.
    We're always one dry winter away from trouble.
    I watch the reservoirs like other people watch the news.
  `,
  'concern.water.calm': `
    We try not to waste water. It's California.
    I don't think about it much until the rain doesn't come.
    Everybody here learns to be careful with water.
  `,
  'concern.power': `
    The power shutoffs are a real pain. We keep flashlights and a cooler ready.
    When the wind picks up, they can shut the power off. You learn to plan for it.
    I keep the phone charged and a lantern handy, just in case.
  `,
  'concern.power.calm': `
    We keep flashlights around, just in case.
    I don't worry about it much. We've got candles somewhere.
  `,
  'concern.roof': `
    @owns The roof's getting old. That's next on the list.
    @owns Roofs aren't cheap, and ours is getting up there.
    @owns I keep putting off the roof. One of these years.
    @rents That's the landlord's problem, thank goodness.
  `,
  'concern.roof.calm': `
    @owns I try not to think about the roof until it leaks.
    @rents That's the landlord's problem, thank goodness.
    @minor That's my parents' department.
  `,
  'concern.jobs': `
    Work's hard to find right now. I'm still looking.
    It's tough out there. Everybody's looking.
  `,
  'concern.jobs.calm': `
    People seem to find work around here, mostly.
    @works I've got work, so I can't complain.
    @retired I'm retired, so I'm out of that rat race.
  `,
  'concern.health': `
    I'm watching my health more these days.
    I've been trying to take better care of myself.
    @older You get to a certain age, and the doctor knows you by name.
  `,
  'concern.health.calm': `
    Good enough, knock on wood.
    Can't complain. Knock on wood.
  `,
  'concern.schools': `
    @parent The schools matter to us. The kids come first.
    @parent I keep an eye on the schools. We're always at some meeting.
    The schools are a big deal around here.
  `,
  'concern.schools.calm': `
    @!kids I don't have kids in school, so I don't follow it much.
    @minorkids The kids' school is fine. The teachers work hard.
    @minor School's school.
  `,
  'concern.abroad': `
    I worry about my family back home. I call them every week.
    My family back home is always on my mind.
  `,
  'concern.abroad.calm': `
    Family's family, wherever they are.
    I try to keep in touch with everybody.
  `,
  'unk.statement': `
    Huh.
    Is that right?
    Oh yeah?
    I hear you.
    Interesting.
    Huh. I didn't know that.
    @plain I see.
    @loose No kidding.
    @kid Cool.
    @kid Okay.
  `,
  'unk.confused': `
    Sorry, I'm not sure what you mean.
    I'm not following you.
    You lost me there.
    @plain I'm sorry, I didn't understand.
    @kid What?
  `,
  'unk.noSpanish': `
    Sorry, I don't really speak Spanish.
    My Spanish isn't very good, sorry. English?
    I only know a little Spanish. Not enough for that, sorry.
    @kid I don't speak Spanish.
  `,
  'unk.noSpanishAgain': `
    Still no Spanish here, sorry.
    I really can't help you in Spanish.
    Sorry. English, if you can?
    I wish I could help. I just don't speak it.
    (A shrug and an apologetic smile.)
    @kid I don't know what that means.
  `,

  // ---------------------------------------------------------------- openers and follow-ups
  'open.question': `
    Good question.
    Oh, let me think.
    Hmm.
    Well,
    Oh,
    @loose Oh man,
    @plain Well, let's see.
  `,
  'open.heavy': `
    Oh, boy.
    Don't get me started.
    Oh, that.
    That's a big one around here.
    @plain That's a serious subject here.
  `,
  // after their own answer to how they are; without one, ask.howAreYouFresh
  'ask.howAreYou': `
    How about you?
    And you?
    @plain And how are you?
    What about you?
  `,
  'ask.howAreYouFresh': `
    How are you doing?
    How's your day going?
    How are things with you?
    @plain How are you today?
    @loose How's your day been?
  `,
  'ask.name': `
    I didn't catch your name.
    What's your name, by the way?
    And you are?
    @plain I don't think I got your name.
    @kid What's your name?
  `,
  'ask.from': `
    Where are you from?
    You from around here?
    Where are you from, originally?
    @plain Where are you from, if you don't mind my asking?
    @kid Where do you live?
  `,
  'ask.lives': `
    Do you live around here?
    You live nearby?
    You local?
  `,
  'ask.job': `
    What do you do?
    What kind of work are you in?
    What do you do for work?
    @plain And what do you do?
  `,
  'ask.kids': `
    You have kids?
    Do you have any kids?
  `,
  'ask.visiting': `
    Are you visiting, or did you just move here?
    What brings you around here?
    Just passing through?
  `,
  'ask.weather': `
    Is it like this where you're from?
    What's the weather like where you live?
  `,
  'ask.drive': `
    How was the drive in?
    How'd you get over here?
    Did you hit traffic coming in?
  `,
  'ask.food': `
    What kind of food do you like?
    You like tacos?
    Are you hungry? I'm always hungry.
  `,
  'ask.team': `
    You follow {team}?
    You a {teamName} fan?
    Do you watch {team}?
  `,
  'ask.fire': `
    Were you around here for that?
    Have you ever had to evacuate?
    Do you live somewhere with fire risk?
  `,
  'ask.weekend': `
    Got any plans this weekend?
    Doing anything fun this weekend?
  `,
  'ask.housing': `
    Do you rent or own?
    How's the rent where you are?
  `,
  'ask.school': `
    Do you go to school?
    What grade are you in?
  `,

  // ---------------------------------------------------------------- reactions to the player's answers
  'react.from.far': `
    {playerPlace}! That's a ways from here. {milesCap} {dir}.
    Oh, {playerPlace}. That's {miles} {dir} of here, give or take.
    {playerPlace}? I've driven through there. It's {miles} {dir} of here.
  `,
  'react.from.near': `
    {playerPlace}! That's practically next door.
    Oh, {playerPlace}. That's close, just {miles} {dir} of here.
    {playerPlace}, nice. So we're almost neighbors.
  `,
  'react.from.here': `
    Oh, you're from here too! Small world.
    No way, {place}? Neighbors!
    A local! Nice.
  `,
  'react.from.unknown': `
    Oh, nice. I don't think I've been there.
    Huh. I don't know it, but it sounds nice.
    Oh, cool. Never been.
    Is that far from here? I don't know it.
  `,
  // a place outside California
  'react.from.away': `
    Oh, {playerPlace}! That's a long way from here.
    {playerPlace}, huh? That's a long way off.
    {playerPlace}! You're a long way from home, then.
  `,
  'react.job': `
    {aPlayerJobCap}! That's great.
    Oh, {aPlayerJob}. That's good work.
    {aPlayerJobCap}, huh? That can't be easy.
    Oh nice, {aPlayerJob}. How do you like it?
    @plain {aPlayerJobCap}. That's important work.
    @kid Cool!
  `,
  'react.jobSame': `
    No way, me too! What are the odds?
    Me too! Then you know exactly what I mean.
  `,
  'react.retired': `
    Retired! Lucky you.
    Oh, retired. Enjoy every minute.
    @senior Welcome to the club.
  `,
  'react.name': `
    Nice to meet you, {player}.
    {player}. I'll remember that.
    {player}! Good name.
    @kid Hi, {player}!
  `,
  'react.yes': `
    Oh, nice.
    Yeah?
    That's great.
    Cool.
    @plain Wonderful.
  `,
  'react.no': `
    Oh, okay.
    Fair enough.
    No? Okay.
    Got it.
  `,
  'react.visiting': `
    Well, welcome! Hope you like it here.
    Oh, nice. Enjoy it while you're here.
    Welcome to {place}.
  `,
  'react.moved': `
    Oh, welcome to the neighborhood!
    Welcome! You'll like it here. Mostly.
    Oh nice, a new neighbor.
  `,
  'react.kidsYes': `
    Oh, that's great. How old?
    Nice. Kids keep you busy.
    Then you know how it is.
  `,
  'react.kidsNo': `
    Fair enough. More sleep for you.
    That's okay. More time for yourself.
    Oh, okay.
  `,
  'react.teamYes': `
    Yes! A fellow fan.
    Finally, somebody who gets it.
    Good. We'll get along fine.
  `,
  'react.teamNo': `
    That's okay, I won't hold it against you.
    No? Well, nobody's perfect.
    That's fine. More snacks for me.
  `,
  'react.drive': `
    Glad you made it in one piece.
    Ha, that's how it goes around here.
    Could've been worse, right?
  `,
  'react.food': `
    Good taste.
    Oh, me too.
    Ha, a person after my own heart.
  `,

  // ---------------------------------------------------------------- pivots (something on their mind)
  'pivot.concern': `
    Honestly, I've been thinking about {concern} a lot lately.
    You know what's been on my mind? {concernCap}.
    Can I tell you what keeps me up at night? {concernCap}.
    What I really worry about around here is {concern}.
  `,
  'pivot.interest': `
    I'm hoping to get some {interestShort} in this weekend.
    Lately I've been really into {interestShort}.
    You know what I'd rather be doing right now? {interestShortCap}.
  `,
  'pivot.memory': `
    You know, I still think about {memTitle}.
    Funny, I was just thinking about {memTitle}.
    Something I'll never forget around here is {memTitle}.
  `,
  'pivot.family': `
    My family keeps me busy, that's for sure.
    I should get home to my family soon.
    I'm always running around for my family.
  `,
  'pivot.weather': `
    Some weather today, huh? {temp} degrees.
    {temp} and {sky}. Not bad.
    Did you see it's {temp} out?
  `,
  'pivot.alert': `
    Did you hear there's a {alert} out?
    Anyway, keep an eye on that {alert}.
    You know they put out a {alert}, right?
  `,
  'pivot.place': `
    Anyway, what brings you to {place}?
    So, are you new around here?
  `,

  'warm.aside': `
    Always good talking with you.
    You're easy to talk to, you know that?
    I like these little chats.
    @named It's good to see you, {player}.
  `,

  // ---------------------------------------------------------------- mood asides
  'mood.tired': `
    Sorry, I'm running on fumes today.
    Forgive me, I'm half asleep.
    I'm a little out of it today, sorry.
  `,
  'mood.hot': `
    This heat's making me cranky, I'll be honest.
    Sorry if I'm short. It's {temp} and I'm cooking.
  `,
  'mood.alert': `
    This {alert} has me on edge.
    Sorry, I'm a little distracted with this {alert}.
  `,
  'mood.happy': `
    I'm in a good mood today, so ask me anything.
    Sorry, I'm in a chatty mood today.
  `,
  'mood.down': `
    Sorry, I'm not much company today.
    I'm a little down today. Don't mind me.
  `,

  // ---------------------------------------------------------------- asked again, with nothing new to say
  'repeat.ack': `
    I think I already told you that one.
    We covered that one, didn't we?
    Same answer as before, I'm afraid.
    You asked me that already.
    Ha, are you testing my memory?
    That's all I've got on that one.
    I don't have anything new on that.
    Still the same answer.
    Nothing's changed since you asked.
    You've got me repeating myself.
    I told you what I know about that.
    Ask me something else.
    Didn't we just go over that?
    I'm starting to feel like a broken record.
    @funny Is this a quiz? This feels like a quiz.
    @kid You already asked me that!
  `,

  // ---------------------------------------------------------------- work: where it happens, how much of it
  'job.wfhYes': `
    I work from home. The office is my kitchen table.
    From home. No commute for me.
    Home, every day. I just walk down the hall.
    @funny From home. My coworkers are the coffee maker and the fridge.
  `,
  'job.goIn': `
    I go in. It's {commuteMin} minutes to {workCity}.
    No working from home for me. I go in, {commuteMin} minutes each way.
    I go in to work. {commuteMin} minutes, door to door.
    In person. You can't do my job from a laptop.
  `,
  'job.howMany': `
    Enough to keep me busy, believe me.
    More than I can count on a busy day.
    Enough. Trust me, it's enough.
    Ha. Ask me on a slow day.
  `,
  'job.howManyFarm': `
    Out here that's like asking how much money is in my bank account.
    Enough to keep me up before sunrise.
    Not as many as the big outfits, but plenty for us.
    Enough that I don't get a day off.
  `,
  'job.feel.ranching': `
    Cattle don't take weekends off.
    Early mornings and long days, but I wouldn't trade it.
    The animals come first. Always.
    It's a good life. Not an easy one.
    You learn to watch the sky and the price of hay.
  `,

  // ---------------------------------------------------------------- family: a parent's work, grandkids at home
  // each names the parent, so two of them can follow each other ("My mom's a nurse. My dad's retired.")
  'fam.parentJob': `
    My {parentWord}'s {aParentJob}.
    My {parentWord}? {aParentJob}.
    My {parentWord} works as {aParentJob}.
  `,
  'fam.parentWorks': `
    My {parentWord} works. Long days, too.
    My {parentWord} works, so I don't see {parentObj} much during the week.
    My {parentWord} works. Always busy.
  `,
  'fam.parentHome': `
    My {parentWord} isn't working right now.
    My {parentWord}'s home these days.
    My {parentWord} stays home.
  `,
  'fam.parentRetired': `
    My {parentWord}'s retired.
    My {parentWord} retired a while back.
    My {parentWord} doesn't work anymore. Retired.
  `,
  'fam.noGrandparents': `
    My grandparents don't live with us.
    Not here, no. My grandparents live somewhere else.
  `,
  'fam.grandkidsHere': `
    I do. My {gkWord}, {gkName}, lives with us.
    Yes. {gkName} lives right here with us.
    My {gkWord} {gkName} lives with us. {gkAge} already.
    I do. {gkCountCap} of them under this roof: {gkNames}.
    Yes, {gkCount}: {gkNames}. They live with us.
  `,

  // ---------------------------------------------------------------- sports they play
  'small.playYes': `
    Yeah. {sportLine}
    {sportLine} Not very well, but I do.
    Some. {sportLine}
  `,
  'small.playNo': `
    Not really. I'm more of a watcher.
    @fan Not really. I'd rather watch {team}.
    Me? No. I'm not much of an athlete.
    @older Not anymore. My knees retired before I did.
  `,
});
