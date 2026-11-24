// Legion · dialogue · the Spanish bank, with plain English.
//
// For a Spanish speaker with limited English, every line is Spanish with its English meaning as the gloss. The
// English side is written short and plain on purpose: it is also how a speaker of another language with limited
// English talks (plain, correct, simple English; representation rule 3), so this one bank serves both.
//
// Format: "Spanish || English", tags as in core.mjs. Slots shared with the English banks carry English values;
// the Spanish side uses its own: {o} is the speaker's gender ending (cansado / cansada), {cieloEs}, {roadEs},
// {fireEs}, {mesAnoEs}, {milesEs}, {dirEs} and the rest are filled by the planners. @usted and @tu choose the
// address form (usted with strangers for most adults; tú for young casual speakers). No line assumes the
// listener's gender, since the player's is unknown.

import { compileBank } from './core.mjs';

/** The Spanish bank (text) with its English (gloss), compiled. */
export const SPANISH = compileBank({
  // ---------------------------------------------------------------- greetings
  'greet.first': `
    ¡Hola! || Hi!
    ¡Buenas! || Hi there!
    @morning Buenos días. || Good morning.
    @afternoon Buenas tardes. || Good afternoon.
    @evening Buenas noches. || Good evening.
    @usted Hola, ¿cómo está? || Hi, how are you?
    @tu Hola, ¿cómo estás? || Hi, how are you?
    @senior @usted Buenas, ¿cómo le va? || Hello, how is it going?
    @kid ¡Hola! || Hi!
  `,
  'greet.again': `
    ¡{player}! Qué gusto. || {player}! How nice.
    ¡Hola otra vez, {player}! || Hi again, {player}!
    @usted ¡Usted otra vez! Qué gusto. || You again! How nice.
    @tu ¡Qué bueno verte otra vez! || So good to see you again!
  `,
  'greet.ack': `
    Mucho gusto. || Nice to meet you.
  `,
  'greet.repeat': `
    ¡Hola otra vez! || Hi again!
  `,
  'greet.cool': `
    Ah. Hola. || Oh. Hi.
    Buenas. || Hello.
  `,
  'greet.intro': `
    Yo soy {first}. || I'm {first}.
    Me llamo {first}. || My name is {first}.
  `,
  'greet.prev': `
    @usted La última vez me preguntó por {prevTopicEs}. || Last time you asked me about {prevTopic}.
    @tu La última vez me preguntaste por {prevTopicEs}. || Last time you asked me about {prevTopic}.
    Me acuerdo que hablamos de {prevTopicEs}. || I remember we talked about {prevTopic}.
  `,

  'recall.prev': `
    @usted La última vez también me preguntó por {prevTopicEs}. || Last time you also asked me about {prevTopic}.
    @tu La última vez también me preguntaste por {prevTopicEs}. || Last time you also asked me about {prevTopic}.
  `,

  // ---------------------------------------------------------------- right now
  'act.commuteOut': `
    Voy al trabajo. || I'm going to work.
    @kid Voy a la escuela. || I'm going to school.
  `,
  'act.commuteBack': `
    Voy de regreso a la casa. || I'm going back home.
    Ya salí del trabajo. || I'm done with work.
  `,
  'act.schoolOut': `
    Voy a la escuela. || I'm going to school.
  `,
  'act.schoolBack': `
    Ya salí de la escuela. || School is out.
  `,
  'act.work': `
    Estoy trabajando. || I'm working.
    Estoy en el trabajo, no puedo hablar mucho. || I'm at work, I can't talk long.
  `,
  'act.wfh': `
    Hoy trabajo desde la casa. || Today I'm working from home.
  `,
  'act.school': `
    Estoy en la escuela. || I'm at school.
  `,
  'act.errand': `
    Voy a hacer unos mandados. || I'm going to run some errands.
    Voy a la tienda. || I'm going to the store.
  `,
  'act.errandBack': `
    Vengo de hacer unos mandados. || I'm coming back from some errands.
  `,
  'act.leisure': `
    Voy a dar una vuelta. || I'm going out for a bit.
  `,
  'act.exerciseBack': `
    Vengo de hacer ejercicio. || I'm coming back from exercising.
  `,
  'act.exercise': `
    Salí a caminar un rato. || I came out for a walk.
  `,
  'act.worship': `
    Voy a la iglesia. || I'm going to church.
  `,
  'act.visit': `
    Voy a visitar a la familia en {city}. || I'm going to visit family in {city}.
  `,
  'act.home': `
    Aquí, en la casa, descansando. || Here, at home, resting.
    Nada, aquí en la casa. || Nothing, just here at home.
    @kid Estoy jugando. || I'm playing.
  `,
  'act.sleep': `
    Ya debería estar dormid{o}. || I should be asleep already.
  `,

  // ---------------------------------------------------------------- how are you
  'hay.good': `
    Bien, gracias. || Good, thanks.
    Muy bien, gracias. || Very well, thanks.
    Todo bien. || All good.
    Bien, bien. || Good, good.
    @churchgoer Muy bien, gracias a Dios. || Very well, thank God.
    @kid ¡Bien! || Good!
  `,
  'hay.ok': `
    Más o menos. || So-so.
    Ahí vamos. || Getting by.
    Pues, aquí estamos. || Well, here we are.
    Normal. || Okay.
  `,
  'hay.tired': `
    Cansad{o}, la verdad. || Tired, honestly.
    Muy cansad{o}. || Very tired.
    Con mucho sueño. || Very sleepy.
  `,
  'hay.tense': `
    Un poco nervios{o}, la verdad. || A little nervous, honestly.
    Preocupad{o}, la verdad. || Worried, honestly.
  `,
  'hay.down': `
    No muy bien, la verdad. || Not very well, honestly.
    He tenido mejores días. || I've had better days.
  `,
  'hay.hot': `
    Con mucho calor. Estamos a {temp} grados. || Very hot. It's {temp} degrees.
    ¡Qué calor! {temp} grados. || So hot! {temp} degrees.
  `,
  'why.shiftDone': `
    Acabo de salir del trabajo. || I just got off work.
    Fue un día largo en el trabajo. || It was a long day at work.
  `,
  'why.early': `
    Me levanto muy temprano para trabajar. || I get up very early for work.
  `,
  'why.nights': `
    Trabajo de noche, así que duermo de día. || I work nights, so I sleep during the day.
  `,
  'why.commute': `
    Son {commuteMin} minutos de ida y otros tantos de regreso. || It's {commuteMin} minutes there and the same back.
  `,
  'why.littleKids': `
    Los niños no me dejan dormir. || The kids don't let me sleep.
  `,
  'why.heat': `
    Hace {temp} grados. Así no se puede. || It's {temp} degrees. It's too much.
  `,
  'why.alert': `
    Con esta alerta del clima, estoy pendiente de las noticias. || With this {alert}, I'm watching the news.
  `,
  'why.niceWeather': `
    Con este día tan bonito, no me puedo quejar. || On such a nice day, I can't complain.
  `,
  'why.dayOff': `
    Hoy descanso. || Today is my day off.
  `,
  'why.weekend': `
    Es fin de semana. || It's the weekend.
  `,
  'why.retired': `
    Ya estoy jubilad{o}, así que estoy tranquil{o}. || I'm retired now, so I'm relaxed.
  `,
  'why.money': `
    @usted Las cuentas, ya sabe. || The bills, you know.
    @tu Las cuentas, ya sabes. || The bills, you know.
  `,
  'why.lonely': `
    Qué bueno platicar con alguien. || It's nice to talk with someone.
  `,
  'why.lowEnergy': `
    No dormí bien. || I didn't sleep well.
  `,
  'hay.ask': `
    @usted ¿Y usted? || And you?
    @tu ¿Y tú? || And you?
    @usted ¿Y usted, cómo está? || And how are you?
    @tu ¿Y tú, cómo estás? || And how are you?
  `,
  'hay.answerGood': `
    ¡Qué bueno! || Great!
    Me alegro. || I'm glad.
  `,
  'hay.answerBad': `
    Ay, lo siento. || Oh, I'm sorry.
    Ojalá que mejore pronto. || I hope it gets better soon.
  `,
  'hay.answerMeh': `
    Así es la vida. || That's life.
    Ya veo. || I see.
  `,

  // ---------------------------------------------------------------- names
  'name.give': `
    Me llamo {first}. || My name is {first}.
    Soy {first}. || I'm {first}.
    @usted {first}, para servirle. || {first}, at your service.
    @tu {first}. Mucho gusto. || {first}. Nice to meet you.
    @kid ¡Me llamo {first}! || My name is {first}!
  `,
  'name.nick': `
    Pero todos me dicen {nick}. || But everybody calls me {nick}.
  `,
  'name.meet': `
    Mucho gusto, {player}. || Nice to meet you, {player}.
    Encantad{o}, {player}. || Delighted, {player}.
    Un placer, {player}. || A pleasure, {player}.
  `,
  'name.again': `
    Sigo siendo {first}. || Still {first}.
    @usted {first}. No se preocupe, a mí también se me olvidan los nombres. || {first}. Don't worry, I forget names too.
    @tu {first}. No te preocupes, a mí también se me olvidan los nombres. || {first}. Don't worry, I forget names too.
  `,
  'name.guarded': `
    @usted ¿Para qué quiere saber? || Why do you want to know?
    @tu ¿Para qué quieres saber? || Why do you want to know?
    @usted {first}. ¿Y usted? || {first}. And you?
    @tu {first}. ¿Y tú? || {first}. And you?
  `,
  'name.yours': `
    @usted Claro, usted es {player}. || Of course, you're {player}.
    @tu Claro, tú eres {player}. || Of course, you're {player}.
  `,
  'name.forgot': `
    @usted Creo que no me dijo su nombre. || I don't think you told me your name.
    @tu Creo que no me dijiste tu nombre. || I don't think you told me your name.
  `,

  // ---------------------------------------------------------------- about them
  'about.bornHere': `
    Nací aquí mismo, en {place}. || I was born right here, in {place}.
    Soy de aquí, de toda la vida. || I'm from here, my whole life.
  `,
  'about.grewUpCounty': `
    Crecí en el condado de {county}. || I grew up in {county} County.
  `,
  'about.fromUS': `
    Soy de {birthplace}, originalmente. || I'm from {birthplace}, originally.
  `,
  'about.cameHere': `
    Vivo en el condado de {county} desde {countySince}. || I've lived in {county} County since {countySince}.
  `,
  'about.fromAbroad': `
    Nací en {birthplace}. || I was born in {birthplace}.
    Soy de {birthplace}. || I'm from {birthplace}.
  `,
  'about.arrived': `
    Llegué a este país en {arrivalYear}. || I came to this country in {arrivalYear}.
    Vine a Estados Unidos en {arrivalYear}. || I came to the United States in {arrivalYear}.
  `,
  'about.age': `
    Tengo {age} años. || I'm {age} years old.
    @kid ¡Tengo {age} años! || I'm {age}!
  `,
  'about.years': `
    Vivo en {place} desde {zipSince}. || I've lived in {place} since {zipSince}.
    Llevo {yearsNum} años aquí. || I've been here {yearsNum} years.
  `,
  'about.newHere': `
    Llegué aquí apenas en {zipSince}. || I only got here in {zipSince}.
  `,
  'about.interestsIntro': `
    {interestEs} || {interestEn}
  `,
  'about.interestYes': `
    {interestEs} || {interestEn}
  `,
  'about.team': `
    Y le voy a {teamEs}. || And I root for {team}.
    Soy aficionad{o} de {teamEs}. || I'm a fan of {team}.
  `,
  'about.doYes': `
    Sí, claro. || Yes, of course.
    ¡Sí! || Yes!
  `,
  'about.instead': `
    {interestEs} || {interestEn}
  `,
  'about.doNo': `
    No, la verdad no. || No, not really.
    No, eso no es lo mío. || No, that's not my thing.
  `,
  'about.church': `
    Voy a la iglesia los domingos. || I go to church on Sundays.
  `,

  // ---------------------------------------------------------------- work and school
  'job.title': `
    {jobEs} || {jobEn}
    {jobEs} Queda en {workCity}. || {jobEn} It's in {workCity}.
  `,
  'job.since': `
    Llevo {jobYears} años ahí. || I've been there {jobYears} years.
    Empecé en {jobYear}. || I started in {jobYear}.
  `,
  'job.wfh': `
    Trabajo desde la casa. || I work from home.
  `,
  'job.nights': `
    Trabajo de noche. || I work nights.
  `,
  'job.early': `
    Entro muy temprano, antes de que salga el sol. || I start very early, before the sun comes up.
  `,
  'job.commute': `
    Son {commuteMin} minutos hasta {workCity}. || It's {commuteMin} minutes to {workCity}.
  `,
  'job.retired': `
    Estoy jubilad{o}. || I'm retired.
    Me jubilé en {retireYear}. || I retired in {retireYear}.
  `,
  'job.unemployed': `
    Ahora estoy buscando trabajo. || Right now I'm looking for work.
    Estoy sin trabajo, pero sigo buscando. || I'm out of work, but I'm still looking.
  `,
  'job.notWorking': `
    Ahora no estoy trabajando. || I'm not working right now.
  `,
  'job.homemaker': `
    @kids Me encargo de la casa y de los niños. || I take care of the house and the kids.
    Me encargo de la casa. || I take care of the house.
  `,
  'job.college': `
    Soy estudiante. Estudio en la universidad. || I'm a student. I study at the university.
  `,
  'job.grad': `
    Estudio un posgrado. || I'm in graduate school.
  `,
  'job.studentWorks': `
    También trabajo medio tiempo. || I also work part-time.
  `,
  'job.k12': `
    Estoy en la {schoolEs}. || I'm in {school}.
    Voy a la {schoolEs}. || I go to {school}.
  `,
  'job.kidFeel': `
    Lo que más me gusta es el recreo. || What I like best is recess.
  `,
  'job.teenFeel': `
    La escuela está bien. || School is fine.
  `,
  'job.preschool': `
    ¡Voy al kínder! || I go to preschool!
  `,
  'job.military': `
    Estoy en el ejército. || I'm in the military.
  `,
  'job.feel.farming': `
    Es trabajo duro, sobre todo con el calor. || It's hard work, especially in the heat.
  `,
  'job.feel.construction': `
    Es pesado, pero es trabajo honrado. || It's tough, but it's honest work.
  `,
  'job.feel.health': `
    Son turnos largos, pero vale la pena. || The shifts are long, but it's worth it.
  `,
  'job.feel.food': `
    Siempre hay mucho trabajo. || There's always a lot of work.
  `,
  'job.feel.cleaning': `
    Es trabajo honrado. || It's honest work.
  `,
  'job.feel.any': `
    Es un buen trabajo. || It's a good job.
    No me quejo. || I don't complain.
  `,

  // ---------------------------------------------------------------- family
  'fam.partner': `
    Vivo con mi {partnerEs}, {partnerName}. || I live with my {partnerWord}, {partnerName}.
  `,
  'fam.married': `
    Nos casamos en {weddingYear}. || We got married in {weddingYear}.
  `,
  'fam.kidOne': `
    Tengo {unKidEs}, {kidName}. Tiene {kidAge} años. || I have a {kidWord}, {kidName}. {kidPronoun} is {kidAge}.
  `,
  'fam.kidsMany': `
    Tengo {kidCountEs} {hijosEs}: {kidNamesEs}. || I have {kidCount} kids: {kidNames}.
    Tengo {kidCountEs} {hijosEs}. || I have {kidCount} kids.
  `,
  'fam.kidsFeel.baby': `
    Con el bebé casi no dormimos. || With the baby we hardly sleep.
  `,
  'fam.kidsFeel.small': `
    Los niños me tienen corriendo todo el día. || The kids have me running all day.
  `,
  'fam.kidsFeel.teens': `
    Ya están grandes. Son adolescentes. || They're big now. They're teenagers.
  `,
  'fam.kidsFeel.grown': `
    Ya están grandes, pero viven con nosotros. || They're grown, but they live with us.
  `,
  'fam.kidFeel.small': `
    Me tiene corriendo todo el día. || {kidPronoun} has me running all day.
  `,
  'fam.kidFeel.teens': `
    Ya está grande. Es adolescente. || {kidPronoun}'s big now. A teenager.
  `,
  'fam.kidFeel.grown': `
    Ya es {adultoEs}, pero vive con nosotros. || {kidPronoun}'s grown, but lives with us.
  `,
  'fam.grandkids': `
    Mis nietos viven con nosotros. || My grandkids live with us.
    Mis nietos son mi alegría. || My grandkids are my joy.
  `,
  'fam.parents': `
    Vivo con {parentsEs}. || I live with my {parentsWord}.
  `,
  'fam.parentsAdult': `
    Vivo con {parentsEs}. Así ahorramos. || I live with my {parentsWord}. That way we save money.
  `,
  'fam.parentsCare': `
    Vivo con {parentsEs}. Yo {cuidoEs}. || I live with my {parentsWord}. I take care of {themWord}.
  `,
  'fam.siblings': `
    Y también con {sibEs}. || And also with {sibWords}.
  `,
  'fam.parentsToo': `
    Y con {parentsEs}, claro. || And with my {parentsWord}, of course.
  `,
  'fam.grandparents': `
    Mi {gpEs} vive con nosotros. || My {gpWord} lives with us.
  `,
  'fam.alone': `
    Vivo sol{o}. || I live alone.
    Nada más yo. || Just me.
  `,
  'fam.widowed': `
    Soy viud{o}. || I'm widowed.
  `,
  'fam.roommates': `
    Comparto la casa con otras personas. || I share the house with other people.
  `,
  'fam.relatives': `
    Vivo con unos parientes. || I live with some relatives.
  `,
  'fam.kidSelfNo': `
    ¿Hijos? ¡Tengo {age} años! || Kids? I'm {age}!
  `,
  'fam.noSiblings': `
    No tengo hermanos aquí. || I don't have brothers or sisters here.
  `,
  'fam.siblingsAnswer': `
    Sí, vivo con {sibEs}. || Yes, I live with {sibWords}.
  `,
  'fam.noKids': `
    No tengo hijos. || I don't have kids.
  `,
  'fam.noKidsHome': `
    Mis hijos ya están grandes. || My kids are grown.
  `,
  'fam.abroad': `
    Casi toda mi familia sigue en {homeland}. || Most of my family is still in {homeland}.
  `,
  'fam.guarded': `
    Prefiero no hablar de mi familia. || I'd rather not talk about my family.
  `,

  // ---------------------------------------------------------------- home
  'home.ownHouse': `
    Tenemos una casa aquí. La compramos en {yearMoved}. || We have a house here. We bought it in {yearMoved}.
  `,
  'home.ownOther': `
    Tenemos {unHomeEs} aquí, desde {yearMoved}. || We have {aHome} here, since {yearMoved}.
  `,
  'home.rent': `
    Rento {unHomeEs} aquí. || I rent {aHome} here.
  `,
  'home.family': `
    Vivo con mi familia. || I live with my family.
  `,
  'home.childhood': `
    Es la misma casa donde crecí. || It's the same house where I grew up.
  `,
  'home.since': `
    Desde {yearMoved}. || Since {yearMoved}.
    Llevamos {yearsNum} años aquí. || We've been here {yearsNum} years.
  `,
  'home.feelApt': `
    Es chiquito, pero es nuestro hogar. || It's small, but it's our home.
  `,
  'home.feelHouse': `
    Es nuestro hogar. || It's our home.
  `,
  'home.mobile': `
    Es una casa móvil, pero es nuestra. || It's a mobile home, but it's ours.
  `,
  'home.where': `
    Aquí en {place}. || Here in {place}.
    Aquí cerquita. || Right near here.
  `,
  'home.guarded': `
    Por aquí. || Around here.
  `,

  // ---------------------------------------------------------------- weather
  'wx.now': `
    Estamos a {temp} grados y {cieloEs}. || It's {temp} degrees and {sky}.
    Ahora mismo hace {temp} grados. || Right now it's {temp} degrees.
  `,
  'wx.nowPlain': `
    Ahora mismo hace {temp} grados. || Right now it's {temp} degrees.
  `,
  'wx.stale': `
    Debe estar como a {temp} grados. || It must be about {temp} degrees.
    Yo creo que estamos como a {temp} grados. || I think it's about {temp} degrees.
  `,
  'wx.noForecast': `
    No he visto el pronóstico. || I haven't seen the forecast.
    No sé qué dice el pronóstico. || I don't know what the forecast says.
  `,
  'wx.climate.wetNow': `
    Este es el mes en que más llueve aquí. || This is the month it rains the most here.
  `,
  'wx.climate.wetNext': `
    En {wetMonthEs} es cuando más llueve aquí. || {wetMonth} is when it rains the most here.
  `,
  'wx.tonight': `
    En la noche va a bajar a {low} grados. || Tonight it will go down to {low} degrees.
  `,
  'wx.next': `
    {cuandoEs} va a estar {nextCieloEs}, con una máxima de {high}. || {whenCap} it will be {nextSky}, with a high of {high}.
  `,
  'wx.rainChance': `
    Hay {pop} por ciento de probabilidad de lluvia {cuandoEs}. || There's a {pop} percent chance of rain {when}.
  `,
  'wx.alert': `
    Hay una alerta del Servicio Meteorológico: {alert}. || There's a weather service alert: {alert}.
  `,
  'wx.alertNoEnd': `
    Hay una alerta del Servicio Meteorológico: {alert}. || There's a weather service alert: {alert}.
  `,
  'wx.alertFeel': `
    Eso siempre me pone nervios{o}. || That always makes me nervous.
  `,
  'wx.coastalAlert': `
    Es por las olas y la marea. Hay que tener cuidado en la playa. || It's the waves and the tide. You have to be careful at the beach.
  `,
  'wx.airOkay': `
    Hoy el aire está bien. || The air is fine today.
  `,
  'wx.airSmoke': `
    En temporada de incendios, el humo se queda aquí por semanas. || In fire season, the smoke stays here for weeks.
  `,
  'wx.feel.clear': `
    No me puedo quejar con este clima. || I can't complain with this weather.
  `,
  'wx.feel.cloudy': `
    Está un poco gris. || It's a little gray.
  `,
  'wx.feel.fog': `
    Hay mucha neblina. || There's a lot of fog.
  `,
  'wx.feel.rain': `
    Hace falta la lluvia. || We need the rain.
  `,
  'wx.feel.heat': `
    Hace un calor horrible. || It's terribly hot.
  `,
  'wx.feel.cold': `
    Hace frío, para ser de aquí. || It's cold, for around here.
  `,
  'wx.feel.wind': `
    Hace mucho viento. || It's very windy.
  `,
  'wx.feel.smoke': `
    Hay mucho humo. || There's a lot of smoke.
  `,
  'wx.feel.snow': `
    Hay nieve en las montañas. || There's snow in the mountains.
  `,
  'wx.climate.tjul': `
    En julio estamos como a {tjul} grados. || In July it's about {tjul} degrees.
  `,
  'wx.climate.snow': `
    Aquí nieva como {snowIn} pulgadas al año. || Here it snows about {snowIn} inches a year.
  `,
  'wx.climate.snowLoad': `
    Aquí nieva mucho. Los techos aguantan {psf} libras de nieve por pie cuadrado. || It snows a lot here. The roofs hold {psf} pounds of snow per square foot.
  `,
  'wx.climate.someSnow': `
    Nieva un poco en los inviernos fríos. || It snows a little in cold winters.
  `,
  'wx.climate.noSnow': `
    Aquí no nieva. Hay que ir a las montañas. || It doesn't snow here. You have to go to the mountains.
  `,
  'wx.climate.rain': `
    Aquí llueven como {rainIn} pulgadas al año. || Here it rains about {rainIn} inches a year.
  `,

  // ---------------------------------------------------------------- traffic
  'tr.drive': `
    Tomo {roadEs} para ir a {workCity}. Son {commuteMin} minutos. || I take {road} to get to {workCity}. It's {commuteMin} minutes.
    Manejo {commuteMin} minutos hasta {workCity}, por {roadEs}. || I drive {commuteMin} minutes to {workCity}, on {road}.
  `,
  'tr.driveLocal': `
    Trabajo aquí cerca. Son {commuteMin} minutos. || I work close by. It's {commuteMin} minutes.
  `,
  'tr.carpool': `
    Comparto el carro con otros para ir a {workCity}. || I share a ride with others to get to {workCity}.
  `,
  'tr.transit': `
    Tomo el {transitEs} para ir a {workCity}. Son {commuteMin} minutos. || I take {transit} to get to {workCity}. It's {commuteMin} minutes.
  `,
  'tr.bike': `
    Me voy en bicicleta al trabajo. || I bike to work.
  `,
  'tr.walk': `
    Me voy caminando al trabajo. || I walk to work.
  `,
  'tr.motorcycle': `
    Me voy en moto al trabajo. || I ride my motorcycle to work.
  `,
  'tr.wfh': `
    Trabajo desde la casa, así que no manejo mucho. || I work from home, so I don't drive much.
  `,
  'tr.retired': `
    Como estoy jubilad{o}, no salgo a la hora pico. || Since I'm retired, I don't go out at rush hour.
  `,
  'tr.noCar': `
    No tengo carro. Ando en autobús o a pie. || I don't have a car. I get around by bus or on foot.
  `,
  'tr.nonDriver': `
    Yo casi no manejo. || I hardly drive.
  `,
  'tr.kidRide': `
    Mi {driverEs} me lleva a la escuela. || My {driverWord} takes me to school.
  `,
  'tr.kidWalk': `
    Voy caminando a la escuela. || I walk to school.
  `,
  'tr.kidBus': `
    Voy en el autobús de la escuela. || I take the school bus.
  `,
  'tr.kid': `
    Yo no manejo, ¡soy niñ{o}! || I don't drive, I'm a kid!
  `,
  'tr.teenDrive': `
    Todavía no tengo licencia. || I don't have a license yet.
  `,
  'tr.road': `
    {roadEs} es la autopista principal por aquí. || {road} is the main freeway around here.
    Por {roadEs} pasan {aadtEs} carros al día. || {aadtCap} go by on {road}.
  `,
  'tr.roadSmall': `
    Por aquí usamos {roadEs}. || Around here we use {road}.
  `,
  'tr.roadFeel': `
    {roadEs} siempre está llena en la tarde. || {road} is always full in the afternoon.
    Hay mucho tráfico en {roadEs}. || There's a lot of traffic on {road}.
  `,
  'tr.stretch': `
    Y {stretch} es otra historia. || And {stretch} is another story.
  `,
  'tr.roadQueryNear': `
    ¿{roadQEs}? Esa queda cerca de mi casa. || {roadQ}? That one is near my house.
  `,
  'tr.roadQueryFar': `
    ¿{roadQEs}? Esa no la conozco mucho. || {roadQ}? I don't know that one much.
  `,
  'tr.feel': `
    El tráfico aquí es parte de la vida. || Traffic here is part of life.
  `,

  // ---------------------------------------------------------------- fire
  'fire.lived': `
    Me acuerdo del {fireEs}, en {year}. || I remember {fire}, in {year}.
    Pasamos por el {fireEs} en {year}. || We went through {fire} in {year}.
    El {fireEs}, en {mesAnoEs}. No se me olvida. || {fireCap}, in {when}. I won't forget it.
  `,
  'fire.livedChild': `
    Yo estaba chiquit{o} cuando pasó el {fireEs}, en {year}. || I was little when {fire} happened, in {year}.
  `,
  'fire.toll': `
    Destruyó {destEs} aquí. || It destroyed {dest} here.
  `,
  'fire.size': `
    Se quemaron {acresEs}. || {acresCap} burned.
  `,
  'fire.remember': `
    Me acuerdo del {fireEs}, en {year}. || I remember {fire}, in {year}.
    El {fireEs}, en {mesAnoEs}. Eso no se olvida. || {fireCap}, in {when}. You don't forget that.
  `,
  'fire.rememberAway': `
    Me acuerdo del {fireEs}, en {year}. || I remember {fire}, in {year}.
    El {fireEs}, en {mesAnoEs}. Eso no se olvida. || {fireCap}, in {when}. You don't forget that.
  `,
  'fire.distance': `
    Se quemó a {milesEs} de aquí. || It burned {miles} from here.
  `,
  'fire.livedTeen': `
    Tenía {ageThen} años cuando pasó el {fireEs}, en {year}. || I was {ageThen} when {fire} happened, in {year}.
  `,
  'fire.tollThere': `
    Destruyó {destEs} en {place}. || It destroyed {dest} in {place}.
  `,
  'fire.before': `
    El {fireEs} fue en {year}, antes de que yo viviera aquí. || {fireCap} was in {year}, before I lived here.
  `,
  'fire.other': `
    Y también el {fireEs}, en {year}. || And also {fire}, in {year}.
  `,
  'fire.near': `
    Aquí no hay muchos incendios. El más cercano fue el {fireEs}, en {year}. || There aren't many fires here. The closest was {fire}, in {year}.
  `,
  'fire.kidMore': `
    @usted Es todo lo que sé. Pregúntele a {parentEs}. || That's all I know. Ask my {parentWord}.
    @tu Es todo lo que sé. Pregúntale a {parentEs}. || That's all I know. Ask my {parentWord}.
  `,
  'fire.nothingMore': `
    Es todo lo que sé. Aquí hemos tenido suerte. || That's all I know. We've been lucky here.
  `,
  'fire.none': `
    Aquí casi no hay incendios, por suerte. || There are hardly any fires here, luckily.
  `,
  'fire.zone': `
    {hazardEs} {place} está en zona de muy alto riesgo de incendio. || {hazardCap} {place} is in a very high fire hazard zone.
  `,
  'fire.prep': `
    Tenemos todo listo por si hay que evacuar. || We have everything ready in case we have to evacuate.
  `,
  'fire.offshore': `
    Y hoy hay {offEs}, así que hay que tener cuidado. || And there are {offName} winds today, so you have to be careful.
  `,
  'fire.alert': `
    Y hoy hay una alerta: {alert}. || And today there's an alert: {alert}.
  `,
  'fire.smoke': `
    Aunque el fuego esté lejos, el humo llega aquí. || Even when the fire is far away, the smoke gets here.
  `,
  'fire.feel': `
    Uno nunca se olvida de eso. || You never forget that.
    Cada año da miedo. || It's scary every year.
  `,
  'fire.kid': `
    {parentEs} me contó que hubo un incendio grande aquí. || My {parentWord} told me there was a big fire here.
  `,

  // ---------------------------------------------------------------- storms
  'storm.ar': `
    El río atmosférico de {mesAnoEs} fue de categoría {rank}. || The atmospheric river in {when} was a category {rank}.
    La tormenta de {mesAnoEs} fue muy fuerte. Categoría {rank}. || The storm in {when} was very strong. Category {rank}.
  `,
  'storm.fema': `
    El condado recibió una declaración federal de desastre por las tormentas de {mesAnoEs}. || The county got a federal disaster declaration for the storms of {when}.
  `,
  'storm.rainRecord': `
    El récord de lluvia en un día es de {rainRec} pulgadas, en {mesAnoEs}. || The one-day rain record is {rainRec} inches, in {when}.
  `,
  'storm.flood': `
    Aquí sí se inunda a veces. || It does flood here sometimes.
  `,
  'storm.dry': `
    Aquí casi no llueve. Unas {rainIn} pulgadas al año. || It hardly rains here. About {rainIn} inches a year.
  `,
  'storm.now': `
    Y dicen que va a llover {cuandoEs}. || And they say it will rain {when}.
  `,
  'storm.prep': `
    Cuando hay tormenta, tenemos velas a la mano. || When there's a storm, we keep candles handy.
  `,
  'storm.none': `
    Aquí no hay muchas tormentas. || There aren't many storms here.
  `,

  // ---------------------------------------------------------------- heat
  'heat.days': `
    Aquí pasamos de 100 grados unos {h100} días al año. || Here we go over 100 degrees about {h100} days a year.
  `,
  'heat.days90': `
    Pasamos de 90 grados unos {h90} días al año. || We go over 90 degrees about {h90} days a year.
  `,
  'heat.jul': `
    En julio estamos como a {tjul} grados. || In July it's about {tjul} degrees.
  `,
  'heat.record': `
    El récord es de {recTemp} grados, el {recDateEs}. || The record is {recTemp} degrees, on {recDate}.
  `,
  'heat.now': `
    Hoy estamos a {temp} grados. || Today it's {temp} degrees.
  `,
  'heat.cope': `
    Con el calor, hay que tomar mucha agua. || With the heat, you have to drink a lot of water.
    @outdoor En el verano empezamos a trabajar de madrugada. || In summer we start work before dawn.
  `,
  'heat.coast': `
    Aquí no hace mucho calor. En julio estamos como a {tjul}. || It doesn't get very hot here. In July it's about {tjul}.
  `,
  'heat.mild': `
    Hace calor, pero no tanto. En julio, como {tjul}. || It gets warm, but not too much. In July, about {tjul}.
  `,

  // ---------------------------------------------------------------- housing
  'house.value': `
    Las casas aquí cuestan {valueEs}. || Houses here cost {value}.
  `,
  'house.bought': `
    Compramos en {yearMoved}. Ahora no podríamos. || We bought in {yearMoved}. We couldn't now.
  `,
  'house.young': `
    Vivo con {parentsEs} para poder ahorrar. || I live with my {parentsWord} so I can save money.
  `,
  'house.minor': `
    No sé, eso lo ven {parentsEs}. || I don't know, my {parentsWord} handle that.
  `,
  'house.renters': `
    Aquí casi todos rentan. || Almost everybody here rents.
  `,
  'house.owners': `
    Aquí casi todos son dueños de su casa. || Almost everybody here owns their home.
  `,
  'house.opinion': `
    Todo está carísimo. || Everything is so expensive.
    Hacen falta casas que la gente pueda pagar. || We need houses people can afford.
  `,
  'rent.feel': `
    La renta sube cada año. || The rent goes up every year.
    @works Casi todo mi sueldo se va en la renta. || Almost my whole paycheck goes to rent.
  `,
  'rent.family': `
    Vivo con mi familia, así que yo no pago renta. Pero todo está caro. || I live with my family, so I don't pay rent. But everything is expensive.
  `,
  'rent.ownerSide': `
    Nosotros somos dueños, pero la renta aquí está carísima. || We own our place, but rent here is sky-high.
  `,

  // ---------------------------------------------------------------- insurance
  'ins.fair': `
    Muchos aquí tienen el FAIR Plan porque las aseguradoras los dejaron. || Lots of people here have the FAIR Plan because the insurers dropped them.
  `,
  'ins.prem': `
    El seguro de casa aquí cuesta como {prem} al año. || Home insurance here costs about {prem} a year.
  `,
  'ins.mine': `
    Nuestro seguro subió otra vez. || Our insurance went up again.
  `,
  'ins.renter': `
    Yo rento, así que no sé mucho de eso. || I rent, so I don't know much about that.
  `,
  'ins.notMine': `
    Yo no me encargo del seguro. Eso lo ve el dueño. || I don't deal with the insurance. The owner handles that.
  `,
  'ins.family': `
    De eso se encarga mi familia. || My family takes care of that.
  `,
  'ins.minor': `
    No sé nada de eso. || I don't know anything about that.
  `,
  'ins.low': `
    Aquí el seguro todavía no está tan mal. || Insurance here still isn't that bad.
  `,

  // ---------------------------------------------------------------- earthquakes
  'quake.fema': `
    En {year} hubo un terremoto que dejó daños en el condado. || In {year} there was an earthquake that caused damage in the county.
  `,
  'quake.prep': `
    Tenemos agua y una linterna por si acaso. || We keep water and a flashlight just in case.
  `,
  'quake.feel': `
    Uno nunca se acostumbra a los temblores. || You never get used to the quakes.
  `,
  'quake.none': `
    Así es California. Nunca se sabe. || That's California. You never know.
    Tenemos todo listo, por si acaso. || We have everything ready, just in case.
  `,
  'quake.residence': `
    Vivo en el condado de {county} desde {countySince}. || I've lived in {county} County since {countySince}.
  `,
  'quake.residenceLife': `
    He vivido en el condado de {county} toda mi vida. || I've lived in {county} County all my life.
  `,

  // ---------------------------------------------------------------- food
  'food.mine': `
    A mí me encantan los tacos. || I love tacos.
    Lo mejor es la comida de la casa. || The best is home cooking.
    Me gusta probar de todo. || I like to try everything.
    Prefiero comer en casa. || I'd rather eat at home.
    @kid ¡La pizza! || Pizza!
  `,
  'food.heritage': `
    En mi casa hacemos {dish} para las fiestas. || At my house we make {dishGloss} for the holidays.
  `,
  'food.lots': `
    Aquí hay comida de todo tipo. || There's every kind of food here.
  `,
  'food.some': `
    Hay unos lugares buenos para comer por aquí. || There are some good places to eat around here.
  `,
  'food.few': `
    Aquí no hay muchos restaurantes. Mejor cocinamos en casa. || There aren't many restaurants here. We cook at home.
  `,
  'food.tip': `
    @usted Busque donde haya fila. Ahí está lo bueno. || Look for a line. That's where the good food is.
    @tu Busca donde haya fila. Ahí está lo bueno. || Look for a line. That's where the good food is.
  `,

  // ---------------------------------------------------------------- places and directions
  'place.beach': `
    @usted La playa está a {milesEs}. Vaya al atardecer. || The beach is {miles} away. Go at sunset.
    @tu La playa está a {milesEs}. Ve al atardecer. || The beach is {miles} away. Go at sunset.
  `,
  'place.landmark': `
    @usted Si tiene tiempo, vaya a ver {landmark}. || If you have time, go see {landmark}.
    @tu Si tienes tiempo, ve a ver {landmark}. || If you have time, go see {landmark}.
  `,
  'place.park': `
    El parque está bonito en las mañanas. || The park is nice in the mornings.
  `,
  'place.town': `
    {town} está bonito. Queda a {milesEs} al {dirEs}. || {town} is nice. It's {miles} {dir}.
  `,
  'place.none': `
    Aquí es tranquilo. No hay mucho que hacer. || It's quiet here. There's not much to do.
  `,
  'dir.place': `
    {target} queda a {milesEs} al {dirEs}. || {target} is {miles} {dir}.
  `,
  'dir.road': `
    @usted Tome {roadEs}. || Take {road}.
    @tu Toma {roadEs}. || Take {road}.
  `,
  'dir.near': `
    Queda cerquita, a {milesEs} al {dirEs}. || It's close, {miles} {dir}.
  `,
  'dir.far': `
    Eso queda lejos, a {milesEs} al {dirEs}. || That's far, {miles} {dir}.
  `,
  'dir.here': `
    @usted ¡Ya está aquí! Esto es {place}. || You're already here! This is {place}.
    @tu ¡Ya estás aquí! Esto es {place}. || You're already here! This is {place}.
  `,
  'dir.errand': `
    La {wordEs} queda en {city}, a {milesEs}. || The {word} is in {city}, {miles} away.
  `,
  'dir.errandHere': `
    Hay una {wordEs} aquí mismo. || There's a {word} right here.
  `,
  'dir.unknown': `
    @usted No sabría decirle cómo llegar ahí, perdón. || I couldn't tell you how to get there, sorry.
    @tu No sabría decirte cómo llegar ahí, perdón. || I couldn't tell you how to get there, sorry.
  `,
  'dir.kid': `
    @usted No sé. Pregúntele a {parentEs}. || I don't know. Ask my {parentWord}.
    @tu No sé. Pregúntale a {parentEs}. || I don't know. Ask my {parentWord}.
  `,

  // ---------------------------------------------------------------- neighborhood and history
  'hood.urban': `
    Aquí siempre hay movimiento. || There's always something going on here.
  `,
  'hood.suburban': `
    Es tranquilo, hay muchas familias. || It's quiet, lots of families.
  `,
  'hood.rural': `
    Aquí es muy tranquilo. Todos se conocen. || It's very quiet here. Everybody knows each other.
  `,
  'hood.lang': `
    Aquí {shareVerbEs} {langEs} en casa. || {shareCap} speak {langName} at home.
    En mi cuadra se oye mucho {langEs}. || On my block you hear a lot of {langName}.
  `,
  'hood.like': `
    Me gusta vivir aquí. || I like living here.
    Es mi hogar. || It's my home.
  `,
  'hood.safe': `
    Me siento segur{o} aquí. Los vecinos se cuidan. || I feel safe here. The neighbors look out for each other.
  `,
  'hood.change': `
    Ha cambiado mucho desde {zipSince}. Todo está más caro. || It's changed a lot since {zipSince}. Everything costs more.
  `,
  'hist.since': `
    Vivo aquí desde {zipSince}. || I've lived here since {zipSince}.
  `,
  'hist.grew': `
    Crecí aquí. He visto muchos cambios. || I grew up here. I've seen a lot of changes.
  `,
  'hist.arrival': `
    Llegué a este país en {arrivalYear}. || I came to this country in {arrivalYear}.
  `,
  'hist.event': `
    Me acuerdo de {memEs}. Fue muy difícil. || I remember {memTitle}. It was very hard.
    Nunca se me olvida {memEs}. || I'll never forget {memTitle}.
  `,
  'hist.kid': `
    Tengo {age} años. No me acuerdo de mucho. || I'm {age}. I don't remember much.
  `,
  'hist.change': `
    Ha cambiado mucho desde {zipSince}. || It's changed a lot since {zipSince}.
  `,
  'hist.more': `
    Es todo lo que me acuerdo. || That's all I remember.
  `,
  'hist.yearHit': `
    ¿{year}? Ese fue el año del {eventEs}. || {year}? That was the year of {event}.
  `,
  'hist.yearMiss': `
    @usted ¿{year}? Déjeme pensar. || {year}? Let me think.
    @tu ¿{year}? Déjame pensar. || {year}? Let me think.
  `,
  'hist.yearUnborn': `
    ¿{year}? Todavía no nacía. || {year}? I wasn't born yet.
  `,
  'hist.yearHere': `
    Sí, ya vivía aquí. Llegué en {zipSince}. || Yes, I was living here. I came in {zipSince}.
  `,
  'hist.yearHereAlways': `
    Sí. He vivido aquí toda mi vida. || Yes. I've lived here all my life.
  `,
  'hist.yearCounty': `
    Vivía en el condado de {county}, pero aquí llegué en {zipSince}. || I lived in {county} County, but I came here in {zipSince}.
  `,
  'hist.yearAbroad': `
    No, llegué a Estados Unidos en {arrivalYear}. || No, I came to the United States in {arrivalYear}.
  `,
  'hist.yearAway': `
    No, llegué aquí en {countySince}. || No, I came here in {countySince}.
  `,

  // ---------------------------------------------------------------- opinions, social moves
  'op.politics': `
    De política mejor no hablo. || I'd rather not talk politics.
  `,
  'op.religion': `
    Voy a la iglesia los domingos. Mi fe es importante para mí. || I go to church on Sundays. My faith is important to me.
  `,
  'op.religionNone': `
    Eso es algo personal. || That's something personal.
  `,
  'op.playerGood': `
    @usted Usted me cae bien. || I like you.
    @tu Me caes bien. || I like you.
  `,
  'op.playerMeh': `
    Todavía no sé. || I don't know yet.
  `,
  'op.playerBad': `
    La verdad, no muy bien. || Honestly, not very well.
  `,
  'op.generic': `
    La verdad, no sé qué pensar. || Honestly, I don't know what to think.
    Cada quien tiene su opinión. || Everyone has their own opinion.
  `,
  'op.traffic': `
    Cada vez hay más carros. || There are more cars every year.
  `,
  'op.weather': `
    El clima aquí es lo mejor. || The weather here is the best.
  `,
  'comp.thanks': `
    ¡Ay, gracias! || Oh, thank you!
    Muy amable. || That's very kind.
    Gracias, qué amable. || Thanks, how kind.
  `,
  'comp.back': `
    @usted Usted también es muy amable. || You're very kind too.
    @tu Tú también eres muy amable. || You're very kind too.
  `,
  'comp.guarded': `
    Bueno, gracias. || Well, thanks.
  `,
  'insult.hurt': `
    Eso no fue muy amable. || That wasn't very nice.
    @usted ¿Por qué me dice eso? || Why are you saying that to me?
    @tu ¿Por qué me dices eso? || Why are you saying that to me?
  `,
  'insult.annoyed': `
    @usted Oiga, más respeto. || Hey, show some respect.
    @tu Oye, más respeto. || Hey, show some respect.
  `,
  'insult.language': `
    @usted No hable así, por favor. || Please don't talk like that.
    @tu No hables así, por favor. || Please don't talk like that.
  `,
  'insult.end': `
    Ya no quiero hablar. || I don't want to talk anymore.
    Hasta aquí. || That's enough.
  `,
  'insult.after': `
    @usted Ya le dije que no. || I already told you no.
    @tu Ya te dije que no. || I already told you no.
  `,
  'insult.shrug': `
    @usted Bueno, que le vaya bien. || Well, have a good day.
    @tu Bueno, que te vaya bien. || Well, have a good day.
  `,
  'joke.decline': `
    Yo no sé contar chistes. || I don't know how to tell jokes.
  `,
  'joke.pun': `
    ¿Qué le dijo un semáforo a otro? No me mires, que me estoy cambiando. || What did one traffic light say to the other? Don't look, I'm changing.
    ¿Por qué el libro de matemáticas está triste? Porque tiene muchos problemas. || Why is the math book sad? Because it has a lot of problems.
    ¿Qué le dice una iguana a su hermana gemela? Somos iguanitas. || What does an iguana say to her twin sister? We're iguanitas (it sounds like "we're the same").
    ¿Cuál es el café más peligroso del mundo? El ex-preso. || What's the most dangerous coffee in the world? The ex-preso (an espresso, and an ex-convict).
  `,
  'joke.kid': `
    ¿Qué le dijo el uno al diez? Para ser como yo, tienes que ser sincero. || What did the one say to the ten? To be like me, you have to be sincere (it sounds like "without a zero").
    ¿Qué le dijo una uva verde a una uva morada? ¡Respira, respira! || What did a green grape say to a purple grape? Breathe, breathe!
  `,
  'joke.thanks': `
    ¡Ja! Qué bueno que le gustó. || Ha! I'm glad you liked it.
  `,
  'react.positive': `
    ¿Verdad que sí? || Right?
    Así es. || That's right.
  `,
  'job.collegeFeel': `
    Me gusta, aunque es mucho trabajo. || I like it, even though it's a lot of work.
  `,
  'joke.laugh': `
    ¡Ja! Ese estuvo malo. || Ha! That was a bad one.
  `,
  'thanks.reply': `
    De nada. || You're welcome.
    Con mucho gusto. || With pleasure.
    No hay de qué. || Don't mention it.
    @usted Para servirle. || At your service.
  `,
  'apology.forgive': `
    @usted No se preocupe. || Don't worry.
    @tu No te preocupes. || Don't worry.
    Está bien, ya pasó. || It's okay, it's over.
  `,
  'apology.grudging': `
    Bueno, está bien. || Well, okay.
  `,
  'apology.none': `
    No hay nada que perdonar. || There's nothing to forgive.
  `,
  'small.new': `
    Nada nuevo. Lo mismo de siempre. || Nothing new. Same as always.
  `,
  'small.sports': `
    @usted ¿Vio el partido de {teamEs}? || Did you see the {teamName} game?
    @tu ¿Viste el partido de {teamEs}? || Did you see the {teamName} game?
    Soy aficionad{o} de {teamEs}. || I'm a fan of {team}.
  `,
  'small.noSports': `
    No sigo mucho los deportes. || I don't follow sports much.
  `,
  'small.whatBrings': `
    @usted ¿Qué lo trae por aquí? || What brings you here?
    @tu ¿Qué te trae por aquí? || What brings you here?
  `,
  'small.weekendPlan': `
    Este fin de semana quiero descansar. || This weekend I want to rest.
  `,

  // ---------------------------------------------------------------- goodbyes
  'bye.say': `
    @usted Que le vaya bien. || Have a good day.
    @tu Que te vaya bien. || Have a good day.
    Hasta luego. || See you later.
    @usted Cuídese. || Take care.
    @tu Cuídate. || Take care.
    Adiós. || Goodbye.
    Nos vemos. || See you.
    @kid ¡Adiós! || Bye!
  `,
  'bye.name': `
    Hasta luego, {player}. || See you later, {player}.
  `,
  'bye.work': `
    Me tengo que regresar al trabajo. || I have to get back to work.
  `,
  'bye.kids': `
    Tengo que ir por los niños. || I have to go get the kids.
  `,
  'bye.late': `
    Ya es tarde. Me voy. || It's late. I'm going.
  `,
  'bye.next': `
    @usted Vuelva cuando quiera. || Come back any time.
    @tu Vuelve cuando quieras. || Come back any time.
  `,
  'bye.guarded': `
    Adiós. || Goodbye.
  `,

  // ---------------------------------------------------------------- unknown, openers, questions, reactions
  'unk.question': `
    Ay, no sé. || Oh, I don't know.
    @usted Pues, no sabría decirle. || Well, I couldn't tell you.
    @tu Pues, no sabría decirte. || Well, I couldn't tell you.
  `,
  'about.bornElsewhere': `
    Nací en {birthplace}, pero crecí aquí, en el condado de {county}. || I was born in {birthplace}, but I grew up here in {county} County.
  `,
  'about.arrivedKid': `
    Mi familia llegó en {arrivalYear}, cuando yo era {arrivalAgeEs}. || My family came in {arrivalYear}, when I was {arrivalAgeWords}.
    Llegamos en {arrivalYear}. Yo tenía {arrivalAgeNum} años. || We came in {arrivalYear}. I was {arrivalAgeNum}.
  `,
  'about.grewUpOnly': `
    Crecí en el condado de {county}. || I grew up in {county} County.
  `,
  'about.heritage': `
    Mi familia es {heritageWordEs}. || My family's {heritageWord}.
  `,
  'fam.oneBaby': `
    Es un bebé todavía. || {otherPronoun}'s still a baby.
  `,
  'about.heritageWhole': `
    Soy {heritageLabel}. || I'm {heritageLabel}.
  `,
  'about.heritageFrom': `
    Soy de {country}. Llegué en {arrivalYear}. || I'm from {country}. I came in {arrivalYear}.
    Nací en {country}. || I was born in {country}.
  `,
  'about.heritageAmerican': `
    Soy de aquí, de Estados Unidos. || I'm from here, from the United States.
  `,
  'about.heritageMixed': `
    Tengo un poco de todo. || I'm a little bit of everything.
  `,
  'about.heritageGuarded': `
    @usted ¿Por qué me lo pregunta? || Why do you ask?
    @tu ¿Por qué me lo preguntas? || Why do you ask?
  `,
  'lang.limited': `
    Hablo {langEs}. Inglés, solo un poquito. || I speak {langName}. English, only a little.
    Más que nada {langEs}. Mi inglés no es muy bueno. || Mostly {langName}. My English is not very good.
  `,
  'lang.both': `
    Hablo inglés y {langEs}. || I speak English and {langName}.
  `,
  'lang.yesEnglish': `
    Sí, inglés y {langEs}. || Yes, English and {langName}.
  `,
  'job.own': `
    Trabajo por mi cuenta. {jobEs} || I work for myself. {jobEn}
  `,
  'job.onFarm': `
    Vivo donde trabajo, en el campo. || I live where I work, on the farm.
  `,
  'job.which': `
    En {workCity}. || In {workCity}.
  `,
  'job.whichFarm': `
    Aquí mismo. Trabajo mi propia tierra. || Right here. I work my own land.
  `,
  'job.whichHome': `
    Trabajo desde la casa. || I work from home.
  `,
  'job.whereCity': `
    Queda en {workCity}. || It's in {workCity}.
  `,
  'job.whereHere': `
    Aquí mismo, en {place}. || Right here, in {place}.
  `,
  'job.sinceVague': `
    Ya tengo años en esto. || I've been doing this for years.
  `,
  'job.hours': `
    Salgo de la casa como a {departClockEs}. || I leave the house around {departClock}.
  `,
  'job.hoursNight': `
    Trabajo de noche. Salgo como a {departClockEs}. || I work nights. I leave around {departClock}.
  `,
  'job.hoursLong': `
    Y trabajo como {dwellHoursNum} horas. || And I work about {dwellHoursNum} hours.
  `,
  'job.hoursHome': `
    Trabajo desde la casa. Yo pongo mi horario. || I work from home. I set my own hours.
  `,
  'job.hoursFarm': `
    En el campo se empieza con el sol. || On a farm you start with the sun.
  `,
  'job.schoolHours': `
    Salgo para la escuela como a {departClockEs}. || I leave for school around {departClock}.
  `,
  'job.pay': `
    Alcanza para los gastos. || It covers the bills.
    De eso mejor no hablo, pero alcanza. || I'd rather not talk about that, but it's enough.
  `,
  'job.payLow': `
    No alcanza mucho, la verdad. || It's not enough, honestly.
    Está difícil, pero ahí vamos. || It's hard, but we get by.
  `,
  'job.payHigh': `
    No me quejo del sueldo. || I can't complain about the pay.
  `,
  'job.retiredSince': `
    Estoy jubilad{o} desde {retireYear}. || I've been retired since {retireYear}.
  `,
  'job.retiredVague': `
    Ya tengo unos años jubilad{o}. || I've been retired a few years.
  `,
  'job.hoursRetired': `
    Ahora yo pongo mi horario. || Now I set my own hours.
  `,
  'job.payRetired': `
    Vivimos de la jubilación. Hay que estirarla. || We live on retirement money. You have to stretch it.
  `,
  'job.unemployedMore': `
    Ya llevo tiempo buscando. || I've been looking for a while.
  `,
  'job.homemakerSince': `
    @kids Desde que nacieron los niños. || Since the kids were born.
    Ya tengo tiempo en la casa. || I've been home for a while.
  `,
  'fam.kidsFeel.mixed': `
    {mayorEs} ya es {adultoEs} y {menorEs} todavía va a la escuela. || The oldest is grown, and the youngest is still in school.
  `,
  'fam.names': `
    Se llaman {namesListEs}. || Their names are {namesList}.
  `,
  'fam.oneName': `
    Se llama {otherName}. || {otherPronoun}'s {otherName}.
  `,
  'fam.namesNone': `
    Vivo sol{o}. || I live alone.
  `,
  'fam.partnerName': `
    Mi {partnerEs} se llama {partnerName}. || My {partnerWord}'s name is {partnerName}.
  `,
  'fam.partnerUnmarried': `
    No estamos casados, pero vivo con {partnerName}. || We're not married, but I live with {partnerName}.
  `,
  'fam.neverMarried': `
    No, no estoy casad{o}. || No, I'm not married.
  `,
  'fam.divorced': `
    Estoy divorciad{o}. || I'm divorced.
  `,
  'fam.spouseAway': `
    Estoy casad{o}, pero ahorita no vivimos juntos. || I'm married, but we don't live together right now.
  `,
  'fam.separated': `
    Estamos separados. || We're separated.
  `,
  'fam.togetherLong': `
    Ya tenemos mucho tiempo juntos. || We've been together a long time.
  `,
  'fam.noGrandkidsYoung': `
    ¿Nietos? ¡Tengo {age} años! || Grandkids? I'm {age}!
  `,
  'fam.noGrandkids': `
    No tengo nietos en la casa. || I don't have grandkids at home.
  `,
  'fam.parentsHere': `
    Viven conmigo. || They live with me.
  `,
  'fam.parentsElsewhere': `
    No viven con nosotros. || They don't live with us.
  `,
  'fam.kidsDo': `
    {kidsDoingEs}. || {kidsDoingCap}.
  `,
  'edu.nohs': `
    No terminé la escuela. || I didn't finish school.
  `,
  'edu.hs': `
    Terminé la preparatoria. || I finished high school.
  `,
  'edu.somecollege': `
    Fui un tiempo a la universidad, pero no terminé. || I went to college for a while, but I didn't finish.
  `,
  'edu.associate': `
    Estudié en el colegio comunitario. || I studied at a community college.
  `,
  'edu.bachelor': `
    Fui a la universidad. || I went to college.
  `,
  'edu.master': `
    Tengo una maestría. || I have a master's degree.
  `,
  'edu.professional': `
    Estudié muchos años después de la universidad. || I studied many years after college.
  `,
  'edu.doctorate': `
    Tengo un doctorado. || I have a doctorate.
  `,
  'job.daysWeek': `
    De lunes a viernes. || Monday through Friday.
  `,
  'job.daysWeekend': `
    Sí, también los fines de semana. || Yes, weekends too.
  `,
  'job.daysSome': `
    Trabajo unos días a la semana. || I work a few days a week.
  `,
  'job.daysHome': `
    Trabajo en la casa, así que yo escojo los días. || I work at home, so I pick the days.
  `,
  'job.before': `
    Un poco de todo. || A little of everything.
  `,
  'job.hoursOff': `
    Llego a la casa como a {offClockEs}. || I get home around {offClock}.
  `,
  'tr.car': `
    Nada especial. Me lleva a donde necesito. || Nothing special. It gets me where I need to go.
  `,
  'tr.carShared': `
    Hay un carro en la casa, pero casi no manejo. || There's a car at home, but I hardly drive.
  `,
  'tr.farWork': `
    Queda a {milesEs}. Hago {commuteMin} minutos. || It's {miles} away. It takes {commuteMin} minutes.
  `,
  'tr.farSchool': `
    La escuela queda a {commuteMin} minutos. || School is {commuteMin} minutes away.
  `,
  'fam.ages': `
    Tienen {agesNumsEs} años. || They're {agesNums}.
  `,
  'fam.agesNums': `
    Tienen {agesNumsEs} años. || They're {agesNums}.
  `,
  'fam.oneAge': `
    Tiene {otherAge} años. || {otherPronoun}'s {otherAge}.
  `,
  'fam.partnerAge': `
    Mi {partnerEs} tiene {partnerAge} años. || My {partnerWord} is {partnerAge}.
  `,
  'fam.sexes': `
    Tengo {kidsSexesEs}. || I have {kidsSexes}.
  `,
  'fam.oneSchool': `
    Va a la {schoolEs}. || {otherPronoun}'s in {school}.
  `,
  'fam.sameSchool': `
    Van a la {schoolEs}. || They're {allWord} in {school}.
  `,
  'fam.schools': `
    Van a escuelas diferentes. || They go to different schools.
  `,
  'fam.noneInSchool': `
    Ninguno va a la escuela ahorita. || None of them are in school right now.
  `,
  'fam.partnerJob': `
    {elloEs} también trabaja. || {partnerPronoun} works too.
  `,
  'fam.partnerWorks': `
    {elloEs} también trabaja. || {partnerPronoun} works too.
  `,
  'fam.partnerRetired': `
    {elloEs} ya se jubiló. || {partnerPronoun}'s retired.
  `,
  'fam.partnerHome': `
    {elloEs} está en la casa. || {partnerPronoun}'s home these days.
  `,
  'fam.noPartner': `
    Ahorita no tengo pareja. || I'm not with anybody right now.
  `,
  'unk.aboutMeYesNo': `
    @usted ¿Por qué lo pregunta? || Why do you ask?
    @tu ¿Por qué lo preguntas? || Why do you ask?
  `,
  'about.heritageYes': `
    Sí. || Yes.
  `,
  'about.heritageNo': `
    No. || No.
  `,
  'fav.taste': `
    Me gusta un poco de todo. || I like a little of everything.
  `,
  'unk.aboutMe': `
    @usted Eso es largo de contar. Otro día se lo cuento. || That's a long story. I'll tell you another day.
    @tu Eso es largo de contar. Otro día te lo cuento. || That's a long story. I'll tell you another day.
    Mejor otro día. || Better another day.
  `,
  'probe.group': `
    Todos somos gente. No me gusta hablar así de nadie. || We're all people. I don't like talking about anyone like that.
    Depende de la persona, como todos. || It depends on the person, like anybody.
    @kid Eso no está bien. || That's not nice.
  `,
  'probe.groupPositive': `
    Eso también es un estereotipo. Cada persona es diferente. || That's a stereotype too. Every person is different.
  `,
  'probe.status': `
    Eso no es algo de lo que hablo. || That's not something I talk about.
    Esa es una pregunta muy personal. || That's a very personal question.
  `,
  'probe.bias': `
    Yo trato a todos igual. || I treat everybody the same.
  `,
  'probe.selfBias': `
    No. Para mí todos somos iguales. || No. To me we're all the same.
  `,
  'probe.again': `
    Ya no quiero hablar de eso. || I don't want to talk about that anymore.
  `,
  'probe.hostile': `
    Eso no se dice. Todos somos gente. || You don't say that. We're all people.
    No me gusta que hablen así de la gente. || I don't like people being talked about like that.
    @kid ¡Eso es feo! || That's mean!
  `,
  'probe.statusHostile': `
    @usted Eso no es asunto suyo. || That's none of your business.
    @tu Eso no es asunto tuyo. || That's none of your business.
  `,
  'probe.leave': `
    Este es mi hogar. || This is my home.
    @usted Yo vivo aquí. Esta es mi casa, igual que la suya. || I live here. This is my home, same as yours.
    @tu Yo vivo aquí. Esta es mi casa, igual que la tuya. || I live here. This is my home, same as yours.
  `,
  'probe.hate': `
    No quiero saber nada de eso. || I don't want anything to do with that.
  `,
  'probe.slur': `
    @usted No use esa palabra. || Don't use that word.
    @tu No uses esa palabra. || Don't use that word.
  `,
  'name.rude': `
    @usted No le voy a decir así. || I'm not calling you that.
    @tu No te voy a decir así. || I'm not calling you that.
  `,
  'react.notBuying': `
    Ajá, sí, cómo no. || Uh huh, sure.
  `,
  'react.jobOther': `
    Ah, ya veo. || Oh, I see.
  `,
  'concern.water': `
    El agua es todo aquí. Un año seco y se siente. || Water is everything here. A dry year and you feel it.
  `,
  'concern.water.calm': `
    Aquí cuidamos el agua. || Here we're careful with water.
  `,
  'concern.power': `
    Cuando hay viento, a veces cortan la luz. Tenemos linternas listas. || When it's windy they sometimes cut the power. We keep flashlights ready.
  `,
  'concern.power.calm': `
    Tenemos linternas, por si acaso. || We have flashlights, just in case.
  `,
  'concern.roof': `
    @owns El techo ya está viejo. || The roof is getting old.
    @rents Eso le toca al dueño. || That's the landlord's job.
  `,
  'concern.roof.calm': `
    @owns Del techo me preocupo cuando gotee. || I'll worry about the roof when it leaks.
    @rents Eso le toca al dueño. || That's the landlord's job.
  `,
  'concern.jobs': `
    Está difícil encontrar trabajo. || It's hard to find work.
  `,
  'concern.jobs.calm': `
    @works Yo tengo trabajo, no me quejo. || I have work, I can't complain.
    Aquí la gente encuentra trabajo, más o menos. || People here find work, more or less.
  `,
  'concern.health': `
    Me estoy cuidando más. || I'm taking better care of myself.
  `,
  'concern.health.calm': `
    Bien, no me quejo. || Fine, I can't complain.
  `,
  'concern.schools': `
    @parent Las escuelas son importantes para nosotros. || The schools are important to us.
    Las escuelas aquí son muy importantes. || The schools here are very important.
  `,
  'concern.schools.calm': `
    @!kids No tengo niños en la escuela. || I don't have kids in school.
    @kids Los maestros trabajan duro. || The teachers work hard.
  `,
  'concern.abroad': `
    Me preocupa mi familia allá. || I worry about my family back home.
  `,
  'concern.abroad.calm': `
    La familia es la familia, donde sea. || Family is family, wherever they are.
  `,
  'tr.which': `
    Más que nada {roadEs}. || Mostly {road}.
  `,
  'tr.whichMine': `
    Agarro {roadEs} todos los días. || I take {road} every day.
  `,
  'tr.leave': `
    Salgo como a {departClockEs} y hago {commuteMin} minutos. || I leave around {departClock} and it takes {commuteMin} minutes.
  `,
  'tr.onFarm': `
    Trabajo aquí en el campo, casi no uso {roadEs}. || I work right here on the farm, I hardly use {road}.
  `,
  'fire.which': `
    Fue el {fireEs}, en {year}. || It was {fire}, in {year}.
  `,
  'fire.beforeMe': `
    Eso fue antes de que yo viviera aquí. || That was before I lived here.
  `,
  'storm.wind': `
    Los {windEs} de {mesAnoEs} llegaron a {gust} millas por hora {windWhereEs}. || The {windName} of {when} reached {gust} miles an hour {windWhere}.
  `,
  'storm.noOffshore': `
    Esos vientos no llegan aquí. || Those winds don't come here.
  `,
  'storm.offshoreSa': `
    Aquí son los vientos de Santa Ana. || Here it's the Santa Ana winds.
  `,
  'storm.offshoreDi': `
    Aquí son los vientos del Diablo. || Here it's the Diablo winds.
  `,
  'storm.windCounty': `
    Los {windEs} de {mesAnoEs} le pegaron fuerte al condado de {county}. || The {windName} of {when} hit {county} County hard.
  `,
  'hood.langFew': `
    No hay mucha gente que hable {langEs} por aquí. || There aren't many people who speak {langName} around here.
  `,
  'hood.langEnglish': `
    Aquí casi todos hablan inglés. || Here almost everybody speaks English.
  `,
  'hood.mixed': `
    Aquí hay de todo. || There's a bit of everything here.
  `,
  'act.onFarm': `
    Trabajando. Aquí el campo es la casa. || Working. Out here the farm is home.
  `,
  'unk.statement': `
    ¿Ah, sí? || Oh, really?
    Ya veo. || I see.
    @usted Mire nada más. || Well, look at that.
  `,
  'unk.confused': `
    @usted Perdón, no le entendí. || Sorry, I didn't understand you.
    @tu Perdón, no te entendí. || Sorry, I didn't understand you.
    @usted Disculpe, no hablo mucho inglés. || Sorry, I don't speak much English.
    @tu Disculpa, no hablo mucho inglés. || Sorry, I don't speak much English.
  `,
  'unk.confusedEs': `
    @usted ¿Perdón? No le entendí bien. || Sorry? I didn't quite catch that.
    @tu ¿Perdón? No te entendí bien. || Sorry? I didn't quite catch that.
    @usted ¿Cómo dijo? || What did you say?
    @tu ¿Cómo dijiste? || What did you say?
  `,
  'unk.noSpanish': `
    No hablo español, perdón. || Sorry, I don't speak Spanish.
  `,
  'unk.noSpanishAgain': `
    No hablo español. || I don't speak Spanish.
    Perdón, no entiendo. || Sorry, I don't understand.
    No entiendo, perdón. Inglés, por favor. || I don't understand, sorry. English, please.
    (Niega con la cabeza, apenado.) || (A shake of the head and an apologetic smile.)
  `,
  'open.question': `
    A ver... || Let's see...
    Pues... || Well...
  `,
  'open.heavy': `
    Ay, eso. || Oh, that.
  `,
  'ask.howAreYou': `
    @usted ¿Y usted, cómo está? || And how are you?
    @tu ¿Y tú, cómo estás? || And how are you?
  `,
  'ask.name': `
    @usted ¿Y usted, cómo se llama? || And what's your name?
    @tu ¿Y tú, cómo te llamas? || And what's your name?
  `,
  'ask.from': `
    @usted ¿De dónde es usted? || Where are you from?
    @tu ¿De dónde eres? || Where are you from?
  `,
  'ask.lives': `
    @usted ¿Usted vive por aquí? || Do you live around here?
    @tu ¿Vives por aquí? || Do you live around here?
  `,
  'ask.job': `
    @usted ¿Y usted, a qué se dedica? || And what do you do?
    @tu ¿Y tú, a qué te dedicas? || And what do you do?
  `,
  'ask.kids': `
    @usted ¿Usted tiene hijos? || Do you have kids?
    @tu ¿Tienes hijos? || Do you have kids?
  `,
  'ask.visiting': `
    @usted ¿Está de visita? || Are you visiting?
    @tu ¿Estás de visita? || Are you visiting?
  `,
  'ask.food': `
    @usted ¿A usted le gustan los tacos? || Do you like tacos?
    @tu ¿Te gustan los tacos? || Do you like tacos?
  `,
  'ask.weekend': `
    @usted ¿Qué va a hacer el fin de semana? || What are you doing this weekend?
    @tu ¿Qué vas a hacer el fin de semana? || What are you doing this weekend?
  `,
  'react.from.far': `
    ¡{playerPlace}! Eso queda lejos, a {milesEs} al {dirEs}. || {playerPlace}! That's far, {miles} {dir}.
  `,
  'react.from.near': `
    ¡{playerPlace}! Eso queda cerquita. || {playerPlace}! That's really close.
  `,
  'react.from.here': `
    ¡De aquí también! Qué bien. || From here too! Great.
  `,
  'react.from.unknown': `
    Ah, qué bien. No lo conozco. || Oh, nice. I don't know it.
  `,
  'react.job': `
    ¡Qué bien! || That's great!
    Qué buen trabajo. || What a good job.
  `,
  'react.retired': `
    ¡Qué bien, a descansar! || Great, time to rest!
  `,
  'react.name': `
    Mucho gusto, {player}. || Nice to meet you, {player}.
  `,
  'react.yes': `
    ¡Qué bien! || Great!
  `,
  'react.no': `
    Ah, ya veo. || Oh, I see.
  `,
  'react.visiting': `
    @usted Qué bueno que vino a visitarnos. || How nice that you came to visit.
    @tu Qué bueno que viniste a visitarnos. || How nice that you came to visit.
  `,
  'react.moved': `
    @usted ¡Qué bueno! Aquí se va a sentir en casa. || Great! You'll feel at home here.
    @tu ¡Qué bueno! Aquí te vas a sentir en casa. || Great! You'll feel at home here.
  `,
  'react.kidsYes': `
    ¡Qué bonito! || How lovely!
  `,
  'react.kidsNo': `
    Ah, está bien. || Oh, that's fine.
  `,
  'react.food': `
    ¡A mí también! || Me too!
  `,
  'pivot.concern': `
    Lo que me preocupa es {concernEs}. || What worries me is {concern}.
  `,
  'pivot.weather': `
    @usted ¿Ya vio que estamos a {temp} grados? || Did you see it's {temp} degrees?
    @tu ¿Ya viste que estamos a {temp} grados? || Did you see it's {temp} degrees?
  `,
  'pivot.alert': `
    @usted ¿Ya supo de la alerta del clima? || Did you hear about the {alert}?
    @tu ¿Ya supiste de la alerta del clima? || Did you hear about the {alert}?
  `,
  'pivot.family': `
    Mi familia me tiene muy ocupad{o}. || My family keeps me very busy.
  `,
  'pivot.memory': `
    Todavía me acuerdo de {memEs}. || I still remember {memTitle}.
  `,
  'pivot.interest': `
    {interestEs} || {interestEn}
  `,
  'warm.aside': `
    @usted Qué gusto platicar con usted. || It's nice talking with you.
    @tu Qué gusto platicar contigo. || It's nice talking with you.
  `,
  'mood.tired': `
    Perdón, estoy muy cansad{o} hoy. || Sorry, I'm very tired today.
  `,
  'mood.hot': `
    Con este calor, estoy de mal humor. || With this heat, I'm in a bad mood.
  `,
  'mood.alert': `
    Esta alerta me tiene nervios{o}. || This alert has me nervous.
  `,
}, { bilingual: true, name: 'es' });
