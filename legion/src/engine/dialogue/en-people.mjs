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
    @kids Trying to keep the kids out of trouble.
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
  'about.cameHere': `
    I've been in {county} County since {countySince}.
    I came out to {county} County in {countySince}.
    I moved here in {countySince} and never left.
  `,
  'about.fromAbroad': `
    I was born in {birthplace}.
    I'm from {birthplace}, originally.
    I came here from {birthplace}.
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
    I've been in {place} {yearsHere} years now.
    {yearsHere} years in {place}.
    I've lived here since {zipSince}.
    Since {zipSince}. So, {yearsHere} years.
  `,
  'about.newHere': `
    I'm pretty new here, actually. Since {zipSince}.
    I only moved here in {zipSince}. Still learning my way around.
    New-ish. I got here in {zipSince}.
  `,
  'about.interestsIntro': `
    When I'm not working, you can usually find me {doingThing}.
    In my free time? {interestLine}
    {interestLine}
    Mostly? {interestLine}
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
    @funny I work from home. My coworkers are the dog and the fridge.
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
    @teen I'm in {school}. Counting the days.
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
    Every year I say I'll retire, and every year I come back.
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
    {partnerName}, my {partnerWord}, and me.
  `,
  'fam.married': `
    {partnerName} and I got married in {weddingYear}.
    We've been married since {weddingYear}.
    {partnerName} and I have been together since {weddingYear}. Married, I mean.
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
  'fam.parentsAdult': `
    I'm back with my {parentsWord} for now. It's the only way to save anything.
    I live with my {parentsWord}. Rent around here, you know.
    Still at home with my {parentsWord}. We make it work.
  `,
  'fam.siblings': `
    And {sibWords} at home too.
    Plus {sibWords}.
    I've got {sibWords} in the house too.
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
    I've got {roomCount} roommates.
    I share the place with {roomCount} roommates. It's the only way to afford it.
  `,
  'fam.relatives': `
    I live with some of my relatives.
    Family. Extended family. A full house.
  `,
  'fam.abroad': `
    Most of my family is still back in {homeland}.
    I've got family back in {homeland}. I call them every week.
    My parents are still in {homeland}. I miss them.
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
  'fam.kidSelfNo': `
    Kids? I'm {age}!
    Ha, no. I'm {age}.
    @kid No! I'm a kid!
  `,

  // ---------------------------------------------------------------- home
  'home.ownHouse': `
    We own a house here. Bought it in {yearMoved}.
    I own my place. Have since {yearMoved}.
    We bought the house in {yearMoved}.
    Our house is here. We've had it since {yearMoved}.
  `,
  'home.ownOther': `
    I own a {homeWord} here. Since {yearMoved}.
    We own our {homeWord}. Got it in {yearMoved}.
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
    {yearsHere} years in the same {homeWord}.
    We moved in back in {yearMoved}.
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
    We're in a mobile home park. Good people.
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
  'small.sports': `
    Did you catch the {teamName} game?
    {team}, man. They're going to give me a heart attack.
    I'm a {teamName} fan. It's a lifelong condition.
    Don't get me started on {team}.
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
    I've got a drive ahead of me.
    I'd better get going if I want to beat the traffic.
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
  'ask.howAreYou': `
    How about you?
    And you?
    How are you doing?
    How's your day going?
    @plain And how are you?
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
});
