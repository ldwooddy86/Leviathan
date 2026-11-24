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
  'greet.foreign': `
    ¡Hola! No hablo {langNameEs}, perdón. || Hi! I don't speak {langName}, sorry.
    ¡Hola! Yo no sé {langNameEs}. || Hi! I don't know {langName}.
  `,
  'greet.again': `
    ¡{player}! Qué gusto. || {player}! How nice.
    ¡Hola otra vez, {player}! || Hi again, {player}!
    @usted ¡Usted otra vez! Qué gusto. || You again! How nice.
    @tu ¡Qué bueno verte otra vez! || So good to see you again!
  `,
  // the player said "Buenos días": the hour's own greeting back
  'ask.drive': `
    @usted ¿Cómo le fue en el camino? || How was the drive in?
    @tu ¿Cómo te fue en el camino? || How was the drive in?
    ¿Había mucho tráfico? || Was there a lot of traffic?
  `,
  'ask.fire': `
    @usted ¿Usted estaba por aquí en ese entonces? || Were you around here back then?
    @tu ¿Tú estabas por aquí en ese entonces? || Were you around here back then?
    @usted ¿Alguna vez ha tenido que evacuar? || Have you ever had to evacuate?
    @tu ¿Alguna vez has tenido que evacuar? || Have you ever had to evacuate?
  `,
  'ask.housing': `
    @usted ¿Usted renta o tiene casa propia? || Do you rent or own?
    @tu ¿Rentas o tienes casa propia? || Do you rent or own?
    @usted ¿Y cómo está la renta donde vive? || How's the rent where you live?
    @tu ¿Y cómo está la renta donde vives? || How's the rent where you live?
  `,
  'ask.school': `
    @usted ¿Va a la escuela? || Do you go to school?
    @tu ¿Vas a la escuela? || Do you go to school?
    @tu ¿En qué grado vas? || What grade are you in?
    @usted ¿En qué grado va? || What grade are you in?
  `,
  'ask.team': `
    @usted ¿Le va a {teamEs}? || Do you root for {team}?
    @tu ¿Le vas a {teamEs}? || Do you root for {team}?
    @usted ¿Ve los partidos de {teamEs}? || Do you watch {team}?
    @tu ¿Ves los partidos de {teamEs}? || Do you watch {team}?
  `,
  'ask.weather': `
    @usted ¿Allá de donde es usted también hace así? || Is it like this where you're from?
    @tu ¿Allá de donde eres también hace así? || Is it like this where you're from?
    @usted ¿Y cómo está el clima donde vive? || What's the weather like where you live?
    @tu ¿Y cómo está el clima donde vives? || What's the weather like where you live?
  `,
  'bye.commute': `
    @drives Me queda un buen camino a la casa. || I've got a drive ahead of me.
    @drives Ya me voy, antes de que se llene el tráfico. || I'd better get going before the traffic.
    @drives Todavía me falta el camino de regreso. || I've still got the drive home.
    @!drives Ya me voy, me están esperando. || I'd better go, they're waiting for me.
  `,
  'dir.map': `
    @usted Para lo demás, mejor use un mapa. || For the rest, better use a map.
    @tu Para lo demás, mejor usa un mapa. || For the rest, better use a map.
    @usted De ahí en adelante, el teléfono le ayuda más que yo. || After that, your phone will do better than me.
    @tu De ahí en adelante, el teléfono te ayuda más que yo. || After that, your phone will do better than me.
  `,
  'dir.mapAll': `
    @usted Para eso, mejor use un mapa. || For that one, better use a map.
    @tu Para eso, mejor usa un mapa. || For that one, better use a map.
    @usted El teléfono le va a ayudar más que yo. || Your phone will do better than me on that one.
    @tu El teléfono te va a ayudar más que yo. || Your phone will do better than me on that one.
  `,
  'fire.named': `
    El {fireEs}, en {mesAnoEs}. || {fireCap}, {month} {year}.
    Ese fue el {fireEs}, en {year}. || That was {fire}, back in {year}.
    Me acuerdo del {fireEs}, en {mesAnoEs}. || I remember {fire}, in {month} {year}.
  `,
  'food.cook': `
    Prefiero cocinar en casa, la verdad. || I'd rather cook at home, honestly.
    Me gusta más cocinar que comer fuera. || I like cooking more than eating out.
    Yo cocino en casa casi siempre. || I cook at home almost always.
  `,
  'food.good': `
    La comida de por aquí es muy buena. || The food around here is very good.
    Aquí se come bien. || You eat well around here.
    Los tacos de por aquí son muy buenos. || The tacos around here are really good.
  `,
  'greet.prevFact': `
    ¿Cómo están las cosas en {playerPlace}? || How are things in {playerPlace}?
    @usted ¿Sigue viviendo en {playerPlace}? || Still living in {playerPlace}?
    @tu ¿Sigues viviendo en {playerPlace}? || Still living in {playerPlace}?
  `,
  'heat.alert': `
    Y hay una alerta de calor, así que cuidado. || And there's a {alert} out, so be careful.
    Además hay una alerta por el calor. || And there's a {alert} out, too.
  `,
  'home.built': `
    La casa es de {yearBuilt}. || The house is from {yearBuilt}.
    La construyeron en {yearBuilt}. || It was built in {yearBuilt}.
    Es una casa de {yearBuilt}, y se nota. || It's a house from {yearBuilt}, and it shows.
  `,
  'home.roofNew': `
    Cambiamos el techo en {roofYear}. || We redid the roof in {roofYear}.
    El techo es nuevo, de {roofYear}. || The roof is new, from {roofYear}.
  `,
  'home.roofOld': `
    El techo ya está viejo. Hay que cambiarlo. || The roof's getting old. It needs replacing.
    El techo es el original. Ya le toca. || The roof's original. It's about time.
  `,
  'home.solar': `
    También le pusimos paneles solares. || We put solar panels on it, too.
    Tenemos paneles solares. Se nota en el recibo de la luz. || We've got solar panels. You can tell on the power bill.
  `,
  'hood.landmark': `
    En un día despejado se ve {peak} desde aquí. || On a clear day you can see {peak} from here.
    Desde por aquí se ve {peak} cuando el aire está limpio. || You can see {peak} from around here when the air's clean.
  `,
  'hood.old': `
    Casi todas las casas de aquí son de {decadeEs}. || Most of the houses here went up in {decade}.
    Muchas casas de mi calle son de {decadeEs}. || A lot of the houses on my street are from {decade}.
  `,
  'house.boughtJoined': `
    {ownerEsCap} compró en {hhYear}. Con los precios de hoy, no se podría. || {ownerCap} bought in {hhYear}. At today's prices, you couldn't.
    {ownerEsCap} compró la casa en {hhYear}, cuando todavía se podía. || {ownerCap} bought the house in {hhYear}, back when you still could.
  `,
  'house.boughtLong': `
    Compramos la casa en {hhYear}, cuando todavía se podía. || We bought our place in {hhYear}, back when you still could.
    En {hhYear} compramos. Era otro mundo. || We bought in {hhYear}. It was a different world.
  `,
  'house.kidsFuture': `
    Mis hijos nunca van a poder comprar aquí, con estos precios. || My kids will never be able to afford to live here, with these prices.
    Me preocupa que mis hijos no se puedan quedar aquí. || I worry my kids won't be able to stay here.
  `,
  'ins.feel': `
    Es por el riesgo de incendio. Las aseguradoras no lo quieren cubrir. || It's the fire risk. The companies don't want to cover it.
    Nadie habla de eso hasta que le llega la carta. || Nobody talks about it until the letter comes.
  `,
  'job.new': `
    Apenas empecé, este año. || I just started, this year.
    Es nuevo. Empecé en {jobYear}. || It's new. I started in {jobYear}.
  `,
  'mood.down': `
    Perdón, hoy no estoy de muy buen ánimo. || Sorry, I'm not in a great mood today.
    Hoy ando un poco triste. No me haga caso. || I'm a little down today. Don't mind me.
  `,
  'mood.happy': `
    Hoy estoy de buen humor. || I'm in a good mood today.
    Perdón, hoy tengo ganas de platicar. || Sorry, I'm in a chatty mood today.
  `,
  'pivot.place': `
    @usted ¿Y qué le trae por {place}? || So what brings you to {place}?
    @tu ¿Y qué te trae por {place}? || So what brings you to {place}?
    @usted ¿Acaba de llegar por aquí? || Did you just get here?
    @tu ¿Acabas de llegar por aquí? || Did you just get here?
  `,
  'place.game': `
    @usted Si puede, vaya a un partido de {teamEs}. || Catch a {teamName} game if you can.
    @tu Si puedes, ve a un partido de {teamEs}. || Catch a {teamName} game if you can.
    Un partido de {teamEs} vale la pena. || A {teamName} game is worth it.
  `,
  'place.mine': `
    ¿Yo? {interestEs} || Me? {interestEn}
    Pues yo... {interestEs} || Well, me... {interestEn}
  `,
  'place.trail': `
    Está {trailEs}, a {milesEs}. Tiene muy buena vista. || There's {trail}, {miles} from here. Great views.
    @usted Si le gusta caminar, {trailEs} queda a {milesEs}. || If you like hiking, {trail} is {miles} from here.
    @tu Si te gusta caminar, {trailEs} queda a {milesEs}. || If you like hiking, {trail} is {miles} from here.
  `,
  'place.water': `
    Vale la pena ir a {waterEs} una tarde. || {water} is nice for an afternoon.
    @usted Vaya a {waterEs}. Queda a {milesEs}. || Go out to {water}. It's {miles} from here.
    @tu Ve a {waterEs}. Queda a {milesEs}. || Go out to {water}. It's {miles} from here.
  `,
  'quake.femaAfter': `
    Después de ese, el condado recibió ayuda federal. || The county got federal disaster help after that one.
    Hubo declaración de desastre federal para el condado. || There was a federal disaster declaration for the county.
  `,
  'react.drive': `
    @usted Qué bueno que llegó bien. || Glad you made it in one piece.
    @tu Qué bueno que llegaste bien. || Glad you made it in one piece.
    Así es aquí, ni modo. || That's how it goes around here.
  `,
  'react.jobSame': `
    @usted ¡No me diga! ¡Yo también! || No way, me too!
    @tu ¡No me digas! ¡Yo también! || No way, me too!
  `,
  'react.teamNo': `
    No pasa nada, nadie es perfecto. || That's okay, nobody's perfect.
    Bueno, ni modo. || Oh well.
  `,
  'react.teamYes': `
    ¡Eso! Ya somos dos. || Yes! That makes two of us.
    Bueno, nos vamos a llevar bien. || Good, we'll get along fine.
  `,
  'rent.noNumber': `
    @usted Mejor no le digo cuánto pago. Da tristeza. || I won't say what I pay. Too depressing.
    @tu Mejor no te digo cuánto pago. Da tristeza. || I won't say what I pay. Too depressing.
    Lo que pago de renta, mejor ni decirlo. || What I pay in rent, better not to say.
  `,
  'storm.arRank': `
    Fue un río atmosférico de categoría {rank}. || It was a category {rank} atmospheric river.
    Fue de categoría {rank}. La más alta es cinco. || That was a category {rank}. Five is the top.
  `,
  'storm.gustRecord': `
    La ráfaga más fuerte registrada aquí fue de {gust} millas por hora, en {mesAnoEs}. || The strongest gust on record here was {gust} miles an hour, in {when}.
  `,
  'why.school': `
    La escuela estuvo larga hoy. || School was long today.
    Tuvimos mucha tarea. || We had a lot of homework.
    Tengo un examen esta semana. || I have a test this week.
  `,
  'greet.saludo': `
    ¡{saludoEs}! || {saludo}!
    @usted ¡{saludoEs}! ¿Cómo está? || {saludo}! How are you?
    @tu ¡{saludoEs}! ¿Cómo estás? || {saludo}! How are you?
    {saludoEs}. Qué gusto. || {saludo}. Nice to see you.
  `,
  'greet.ack': `
    Mucho gusto. || Nice to meet you.
    Igualmente, mucho gusto. || Likewise, nice to meet you.
    Encantad{o}. || Pleased to meet you.
    Un placer. || A pleasure.
  `,
  'greet.repeat': `
    ¡Hola otra vez! || Hi again!
    Hola de nuevo. || Hello again.
    Sí, aquí sigo. || Yes, I'm still here.
    ¡Hola, hola! || Hi, hi!
  `,
  'greet.cool': `
    Ah. Hola. || Oh. Hi.
    Buenas. || Hello.
    Sí, buenas. || Yes, hello.
    @usted ¿Qué se le ofrece? || What can I do for you?
    @tu ¿Qué se te ofrece? || What can I do for you?
  `,
  'greet.intro': `
    Yo soy {first}. || I'm {first}.
    Me llamo {first}. || My name is {first}.
    Mi nombre es {first}. || My name is {first}.
    @usted Me llamo {first}, para servirle. || My name is {first}, at your service.
    @tu Me llamo {first}, mucho gusto. || My name is {first}, nice to meet you.
  `,
  'greet.prev': `
    @usted La última vez me preguntó por {prevTopicEs}. || Last time you asked me about {prevTopic}.
    @tu La última vez me preguntaste por {prevTopicEs}. || Last time you asked me about {prevTopic}.
    Me acuerdo que hablamos de {prevTopicEs}. || I remember we talked about {prevTopic}.
    La otra vez platicamos de {prevTopicEs}. || Last time we talked about {prevTopic}.
  `,

  'recall.prev': `
    @usted La última vez también me preguntó por {prevTopicEs}. || Last time you also asked me about {prevTopic}.
    @tu La última vez también me preguntaste por {prevTopicEs}. || Last time you also asked me about {prevTopic}.
    Ya habíamos platicado de {prevTopicEs} la otra vez. || We already talked about {prevTopic} last time.
    @usted De {prevTopicEs} ya hablamos, ¿se acuerda? || We already talked about {prevTopic}, remember?
    @tu De {prevTopicEs} ya hablamos, ¿te acuerdas? || We already talked about {prevTopic}, remember?
  `,

  // ---------------------------------------------------------------- right now
  'act.commuteOut': `
    Voy al trabajo. || I'm going to work.
    @kid Voy a la escuela. || I'm going to school.
    Voy camino al trabajo. || I'm on my way to work.
    Ya voy para el trabajo. || I'm heading to work now.
  `,
  'act.commuteBack': `
    Voy de regreso a la casa. || I'm going back home.
    Ya salí del trabajo. || I'm done with work.
    Ya voy para la casa. || I'm heading home now.
  `,
  'act.schoolOut': `
    Voy a la escuela. || I'm going to school.
    Voy para la escuela. || I'm heading to school.
    Ya me voy a la escuela. || I'm off to school.
  `,
  'act.schoolBack': `
    Ya salí de la escuela. || School is out.
    Voy de regreso de la escuela. || I'm coming back from school.
    Ya terminaron las clases. || Classes are over.
  `,
  'act.work': `
    Estoy trabajando. || I'm working.
    Estoy en el trabajo, no puedo hablar mucho. || I'm at work, I can't talk long.
    Aquí, trabajando. || Here, working.
  `,
  'act.wfh': `
    Hoy trabajo desde la casa. || Today I'm working from home.
    Estoy trabajando desde la casa. || I'm working from home.
    Aquí en la casa, trabajando en la computadora. || Here at home, working on the computer.
  `,
  'act.school': `
    Estoy en la escuela. || I'm at school.
    Ando en clases. || I'm in class.
    Aquí en la escuela. || Here at school.
  `,
  'act.errand': `
    Voy a hacer unos mandados. || I'm going to run some errands.
    Voy a la tienda. || I'm going to the store.
    Ando haciendo mandados. || I'm running errands.
  `,
  'act.errandBack': `
    Vengo de hacer unos mandados. || I'm coming back from some errands.
    Ya hice mis mandados. || I already ran my errands.
    Voy de regreso de la tienda. || I'm on my way back from the store.
  `,
  'act.leisure': `
    Voy a dar una vuelta. || I'm going out for a bit.
    Salí a distraerme un rato. || I came out to relax for a bit.
    Ando paseando. || I'm out for a stroll.
  `,
  'act.exerciseBack': `
    Vengo de hacer ejercicio. || I'm coming back from exercising.
    Ya terminé de hacer ejercicio. || I'm done exercising.
    Vengo de mi ejercicio. || I'm coming back from my exercise.
  `,
  'act.exercise': `
    Salí a caminar un rato. || I came out for a walk.
    Estoy haciendo un poco de ejercicio. || I'm getting some exercise.
    Aquí, haciendo ejercicio. || Here, exercising.
  `,
  'act.worship': `
    Voy a la iglesia. || I'm going to church.
    Voy a mi iglesia. || I'm going to my church.
    Ya casi empieza el servicio en la iglesia. || The church service is about to start.
  `,
  'act.visit': `
    Voy a visitar a la familia en {city}. || I'm going to visit family in {city}.
    Voy a ver a la familia en {city}. || I'm going to see family in {city}.
    Voy a casa de unos parientes en {city}. || I'm going to some relatives' house in {city}.
  `,
  'act.home': `
    Aquí, en la casa, descansando. || Here, at home, resting.
    Nada, aquí en la casa. || Nothing, just here at home.
    @kid Estoy jugando. || I'm playing.
    Aquí en la casa, nomás. || Just here at home.
  `,
  'act.sleep': `
    Ya debería estar dormid{o}. || I should be asleep already.
    Ya es tarde para mí. || It's late for me.
    Ya me iba a dormir. || I was about to go to sleep.
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
    Algo inquiet{o}. || A bit uneasy.
  `,
  'hay.down': `
    No muy bien, la verdad. || Not very well, honestly.
    He tenido mejores días. || I've had better days.
    Un poco triste, la verdad. || A little sad, honestly.
  `,
  'hay.hot': `
    Con mucho calor. Estamos a {temp} grados. || Very hot. It's {temp} degrees.
    ¡Qué calor! {temp} grados. || So hot! {temp} degrees.
    Acalorad{o}. Hace {temp} grados. || Overheated. It's {temp} degrees.
  `,
  'why.shiftDone': `
    Acabo de salir del trabajo. || I just got off work.
    Fue un día largo en el trabajo. || It was a long day at work.
    Vengo saliendo del trabajo. || I'm just getting out of work.
  `,
  'why.early': `
    Me levanto muy temprano para trabajar. || I get up very early for work.
    Madrugo todos los días por el trabajo. || I get up at dawn every day for work.
    El trabajo empieza tempranísimo. || Work starts very early.
  `,
  'why.nights': `
    Trabajo de noche, así que duermo de día. || I work nights, so I sleep during the day.
    Con el turno de noche, ando al revés. || With the night shift, I'm upside down.
    El turno de noche cansa. || The night shift wears you out.
  `,
  'why.commute': `
    Son {commuteMin} minutos de ida y otros tantos de regreso. || It's {commuteMin} minutes there and the same back.
    Son {commuteMin} minutos nomás para llegar al trabajo. || It's {commuteMin} minutes just to get to work.
    Se me va mucho tiempo en el camino: {commuteMin} minutos de ida. || A lot of my time goes to the trip: {commuteMin} minutes each way.
  `,
  'why.littleKids': `
    Los niños no me dejan dormir. || The kids don't let me sleep.
    Con los niños chiquitos, uno no descansa. || With little kids, you don't rest.
    Los niños me tienen cansad{o}. || The kids have me tired.
  `,
  'why.heat': `
    Hace {temp} grados. Así no se puede. || It's {temp} degrees. It's too much.
    Con {temp} grados, nadie anda de buenas. || At {temp} degrees, nobody's in a good mood.
    Este calor no me deja hacer nada. || This heat won't let me do anything.
  `,
  'why.alert': `
    Con esta alerta del clima, estoy pendiente de las noticias. || With this {alert}, I'm watching the news.
    Estoy al pendiente de la alerta del clima. || I'm keeping an eye on the {alert}.
    Con la alerta, uno no se puede relajar. || With the {alert}, you can't relax.
  `,
  'why.niceWeather': `
    Con este día tan bonito, no me puedo quejar. || On such a nice day, I can't complain.
    Con este clima, ¿cómo no? || With this weather, how could I not be?
    El día está precioso. || The day is beautiful.
  `,
  'why.dayOff': `
    Hoy descanso. || Today is my day off.
    Hoy no trabajo. || I'm not working today.
    Es mi día libre. || It's my day off.
  `,
  'why.weekend': `
    Es fin de semana. || It's the weekend.
    Por fin es fin de semana. || It's finally the weekend.
    Fin de semana, ya era hora. || The weekend, about time.
  `,
  'why.retired': `
    Ya estoy jubilad{o}, así que estoy tranquil{o}. || I'm retired now, so I'm relaxed.
    Ya no trabajo, así que no tengo prisa. || I don't work anymore, so I'm in no hurry.
    La jubilación me sienta bien. || Retirement suits me.
  `,
  'why.money': `
    @usted Las cuentas, ya sabe. || The bills, you know.
    @tu Las cuentas, ya sabes. || The bills, you know.
    El dinero no alcanza. || The money doesn't stretch.
    Todo está tan caro. || Everything is so expensive.
  `,
  'why.lonely': `
    Qué bueno platicar con alguien. || It's nice to talk with someone.
    Casi no tengo con quién platicar. || I hardly have anyone to talk to.
    Me hacía falta platicar. || I needed to talk.
  `,
  'why.lowEnergy': `
    No dormí bien. || I didn't sleep well.
    Estoy cansad{o}, nada más. || I'm tired, that's all.
    No tengo mucha energía hoy. || I don't have much energy today.
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
    ¡Qué bien! || How nice!
  `,
  'hay.answerBad': `
    Ay, lo siento. || Oh, I'm sorry.
    Ojalá que mejore pronto. || I hope it gets better soon.
    @usted Ánimo, ya verá que mejora. || Chin up, you'll see it gets better.
    @tu Ánimo, ya verás que mejora. || Chin up, you'll see it gets better.
  `,
  'hay.answerMeh': `
    Así es la vida. || That's life.
    Ya veo. || I see.
    Bueno, así son los días. || Well, that's how days go.
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
    Mis amigos me dicen {nick}. || My friends call me {nick}.
    @usted Dígame {nick}, si quiere. || Call me {nick}, if you like.
    @tu Dime {nick}, si quieres. || Call me {nick}, if you like.
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
    {first}. Ese sigue siendo mi nombre. || {first}. That's still my name.
  `,
  'name.guarded': `
    @usted ¿Para qué quiere saber? || Why do you want to know?
    @tu ¿Para qué quieres saber? || Why do you want to know?
    @usted {first}. ¿Y usted? || {first}. And you?
    @tu {first}. ¿Y tú? || {first}. And you?
    Me llamo {first}. || My name's {first}.
  `,
  'name.yours': `
    @usted Claro, usted es {player}. || Of course, you're {player}.
    @tu Claro, tú eres {player}. || Of course, you're {player}.
    Sí me acuerdo: {player}. || I do remember: {player}.
    {player}, ¿verdad? || {player}, right?
  `,
  'name.forgot': `
    @usted Creo que no me dijo su nombre. || I don't think you told me your name.
    @tu Creo que no me dijiste tu nombre. || I don't think you told me your name.
    @usted Perdón, ¿cómo me dijo que se llamaba? || Sorry, what did you say your name was?
    @tu Perdón, ¿cómo me dijiste que te llamabas? || Sorry, what did you say your name was?
    @usted Se me fue su nombre, perdón. || Your name slipped my mind, sorry.
    @tu Se me fue tu nombre, perdón. || Your name slipped my mind, sorry.
  `,

  // ---------------------------------------------------------------- about them
  'about.bornHere': `
    Nací aquí mismo, en {place}. || I was born right here, in {place}.
    Soy de aquí, de toda la vida. || I'm from here, my whole life.
    Aquí nací y aquí crecí. || I was born and raised here.
  `,
  'about.grewUpCounty': `
    Crecí en el condado de {county}. || I grew up in {county} County.
    Me crié aquí en el condado de {county}. || I was raised here in {county} County.
    Toda mi niñez fue aquí, en el condado de {county}. || My whole childhood was here, in {county} County.
  `,
  'about.fromUS': `
    Soy de {birthplace}, originalmente. || I'm from {birthplace}, originally.
    Nací en {birthplace}. || I was born in {birthplace}.
    Vengo de {birthplace}. || I come from {birthplace}.
  `,
  'about.cameHere': `
    Vivo en el condado de {county} desde {countySince}. || I've lived in {county} County since {countySince}.
    Llegué al condado de {county} en {countySince}. || I came to {county} County in {countySince}.
    Desde {countySince} vivo por acá. || I've lived around here since {countySince}.
  `,
  'about.fromAbroad': `
    Nací en {birthplace}. || I was born in {birthplace}.
    Soy de {birthplace}. || I'm from {birthplace}.
    Soy de allá, de {birthplace}. || I'm from over there, from {birthplace}.
  `,
  'about.arrived': `
    Llegué a este país en {arrivalYear}. || I came to this country in {arrivalYear}.
    Vine a Estados Unidos en {arrivalYear}. || I came to the United States in {arrivalYear}.
    Me vine para acá en {arrivalYear}. || I came over here in {arrivalYear}.
  `,
  'about.age': `
    Tengo {age} años. || I'm {age} years old.
    @kid ¡Tengo {age} años! || I'm {age}!
    Ya tengo {age} años. || I'm {age} already.
    Tengo {age} años cumplidos. || I'm a full {age} years old.
  `,
  'about.years': `
    Vivo en {place} desde {zipSince}. || I've lived in {place} since {zipSince}.
    Llevo {zipYearsNum} años en {place}. || I've been in {place} {zipYearsNum} years.
    Ya son {zipYearsNum} años en {place}. || It's been {zipYearsNum} years in {place}.
  `,
  'about.whyHere': `
    Es una historia larga. Llegué en {cameYear} y aquí me quedé. || Long story. I came in {cameYear} and stayed.
    Así se dio. Llegué en {cameYear} y ya no me fui. || That's how it went. I came in {cameYear} and never left.
  `,
  'about.cameWhen': `
    En {cameYear}. || In {cameYear}.
    @usted En {cameYear}, como le decía. || In {cameYear}, like I was saying.
    @tu En {cameYear}, como te decía. || In {cameYear}, like I was saying.
  `,
  'about.whyHereLocal': `
    Nada, yo crecí aquí. || Nothing, I grew up here.
    Nunca me fui. Aquí crecí. || I never left. I grew up here.
  `,
  'about.yearsHood': `
    Vivo en este barrio desde {zipSince}. || I've lived in this neighborhood since {zipSince}.
    Ya llevo {zipYearsNum} años en este barrio. || I've been in this neighborhood {zipYearsNum} years now.
  `,
  'about.notLocal': `
    No, no soy de aquí. || No, I'm not from here.
    No, yo no crecí aquí. || No, I didn't grow up here.
  `,
  'about.morningYes': `
    A fuerzas. Mi día empieza antes de que salga el sol. || I have to be. My day starts before the sun comes up.
    Sí. De todos modos me levanto temprano para el trabajo. || Yes. I get up early for work anyway.
  `,
  'about.nightOwl': `
    Para nada. Trabajo de noche. || Not at all. I work nights.
  `,
  'about.morningNature': `
    Sí, la verdad. Me levanto temprano todos los días. || Yes, honestly. I get up early every day.
    Sí. Me gusta la tranquilidad de la mañana. || Yes. I like the quiet in the morning.
  `,
  'about.morningNot': `
    No mucho. En las mañanas ando lent{o}. || Not really. I'm slow in the mornings.
    Sin café, no. || Not without coffee.
  `,
  'home.bornThere': `
    ¡Si yo nací allá! || I was born there!
    Claro, yo soy de allá. Nací en {birthplace}. || Of course, I'm from there. I was born in {birthplace}.
  `,
  'about.newHere': `
    Llegué a {place} apenas en {zipSince}. || I only got to {place} in {zipSince}.
    Soy nuev{o} en {place}. Llegué en {zipSince}. || I'm new in {place}. I arrived in {zipSince}.
    Llevo poco tiempo en {place}, desde {zipSince}. || I've only been in {place} a little while, since {zipSince}.
  `,
  'about.interestsIntro': `
    {interestEs} || {interestEn}
    En mi tiempo libre, pues... {interestEs} || In my free time, well... {interestEn}
    ¿Lo que más me gusta? {interestEs} || What I like most? {interestEn}
  `,
  'about.interestYes': `
    {interestEs} || {interestEn}
    Sí. {interestEs} || Yes. {interestEn}
    ¡Claro! {interestEs} || Of course! {interestEn}
  `,
  // after a yes already said: the interest itself
  'about.interestMore': `
    {interestEs} || {interestEn}
    La verdad, {interestEsLow} || Honestly, {interestEnLow}
  `,
  'about.team': `
    Y le voy a {teamEs}. || And I root for {team}.
    Soy aficionad{o} de {teamEs}. || I'm a fan of {team}.
    No me pierdo un partido de {teamEs}. || I don't miss a {team} game.
  `,
  'about.doYes': `
    Sí, claro. || Yes, of course.
    ¡Sí! || Yes!
    Sí, me encanta. || Yes, I love it.
  `,
  'about.instead': `
    {interestEs} || {interestEn}
    Lo mío es otra cosa. {interestEs} || My thing is something else. {interestEn}
    Más bien... {interestEs} || Rather... {interestEn}
  `,
  'about.doNo': `
    No, la verdad no. || No, not really.
    No, eso no es lo mío. || No, that's not my thing.
    La verdad, no mucho. || Honestly, not much.
  `,
  'about.church': `
    Voy a la iglesia los domingos. || I go to church on Sundays.
    Cada domingo voy a la iglesia. || Every Sunday I go to church.
    La iglesia del domingo es sagrada para mí. || Sunday church is sacred to me.
  `,

  // ---------------------------------------------------------------- work and school
  'job.title': `
    {jobEs} || {jobEn}
    {jobEs} Queda en {workCity}. || {jobEn} It's in {workCity}.
    {jobEs} Es lo que hago. || {jobEn} That's what I do.
    {jobEs} Es trabajo, y hay que hacerlo. || {jobEn} It's work, and it has to be done.
  `,
  'job.since': `
    Llevo {jobYears} años ahí. || I've been there {jobYears} years.
    Empecé en {jobYear}. || I started in {jobYear}.
    Desde {jobYear} estoy ahí. || I've been there since {jobYear}.
  `,
  'job.wfh': `
    Trabajo desde la casa. || I work from home.
    Trabajo en la casa, en la computadora. || I work at home, on the computer.
    Mi trabajo es desde la casa. || My job is from home.
  `,
  'job.nights': `
    Trabajo de noche. || I work nights.
    Me toca el turno de noche. || I'm on the night shift.
    Trabajo de noche, cuando todos duermen. || I work at night, when everyone's asleep.
  `,
  'job.early': `
    Entro muy temprano, antes de que salga el sol. || I start very early, before the sun comes up.
    Empiezo de madrugada. || I start at dawn.
    Entro tempranísimo. || I start very early.
  `,
  'job.commute': `
    Son {commuteMin} minutos hasta {workCity}. || It's {commuteMin} minutes to {workCity}.
    El trabajo queda en {workCity}, a {commuteMin} minutos. || Work is in {workCity}, {commuteMin} minutes away.
    Voy hasta {workCity}. Son {commuteMin} minutos. || I go all the way to {workCity}. It's {commuteMin} minutes.
  `,
  'job.retired': `
    Estoy jubilad{o}. || I'm retired.
    Me jubilé en {retireYear}. || I retired in {retireYear}.
    Ya me retiré. || I've already retired.
  `,
  'job.unemployed': `
    Ahora estoy buscando trabajo. || Right now I'm looking for work.
    Estoy sin trabajo, pero sigo buscando. || I'm out of work, but I'm still looking.
    Me quedé sin trabajo. Estoy buscando. || I lost my job. I'm looking.
  `,
  'job.notWorking': `
    Ahora no estoy trabajando. || I'm not working right now.
    Por ahora no trabajo. || For now I don't work.
    Ahorita estoy en la casa, sin trabajar. || Right now I'm home, not working.
  `,
  'job.homemaker': `
    @minorkids Me encargo de la casa y de los niños. || I take care of the house and the kids.
    Me encargo de la casa. || I take care of the house.
    Mi trabajo es la casa. || My work is the house.
    Me quedo en la casa. Hay mucho que hacer. || I stay home. There's a lot to do.
  `,
  'job.college': `
    Soy estudiante. Estudio en la universidad. || I'm a student. I study at the university.
    Estoy en la universidad. || I'm in college.
    Estudio. Voy a la universidad. || I study. I go to college.
  `,
  'job.grad': `
    Estudio un posgrado. || I'm in graduate school.
    Sigo estudiando, en el posgrado. || I'm still studying, in grad school.
    Hago estudios de posgrado. || I'm doing graduate studies.
  `,
  'job.studentWorks': `
    También trabajo medio tiempo. || I also work part-time.
    Y trabajo unas horas a la semana. || And I work a few hours a week.
    Aparte, tengo un trabajo de medio tiempo. || Besides, I have a part-time job.
  `,
  'job.k12': `
    Estoy en la {schoolEs}. || I'm in {school}.
    Voy a la {schoolEs}. || I go to {school}.
    Ando en la {schoolEs}. || I'm in {school}.
  `,
  'job.kidFeel': `
    Lo que más me gusta es el recreo. || What I like best is recess.
    Me gusta jugar con mis amigos en la escuela. || I like playing with my friends at school.
    Mi clase favorita es arte. || My favorite class is art.
  `,
  'job.teenFeel': `
    La escuela está bien. || School is fine.
    Ahí la llevo con la escuela. || I'm getting by in school.
    La escuela, pues... ya quiero que sea viernes. || School, well... I just want it to be Friday.
  `,
  'job.preschool': `
    ¡Voy al kínder! || I go to preschool!
    ¡Voy a la escuelita! || I go to the little school!
    En el kínder jugamos mucho. || At preschool we play a lot.
  `,
  'job.military': `
    Estoy en el ejército. || I'm in the military.
    Sirvo en las fuerzas armadas. || I serve in the armed forces.
    Soy militar. || I'm in the service.
  `,
  'job.feel.farming': `
    Es trabajo duro, sobre todo con el calor. || It's hard work, especially in the heat.
    Alguien tiene que cosechar la comida. || Somebody has to harvest the food.
    Es trabajo honrado, aunque la espalda lo sufre. || It's honest work, though the back pays for it.
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
    Ahí vamos, poco a poco. || We get by, little by little.
  `,

  // ---------------------------------------------------------------- family
  'fam.partner': `
    Vivo con mi {partnerEs}, {partnerName}. || I live with my {partnerWord}, {partnerName}.
    Mi {partnerEs} se llama {partnerName}. || My {partnerWord}'s name is {partnerName}.
    Vivo con {partnerName}, mi {partnerEs}. || I live with {partnerName}, my {partnerWord}.
  `,
  'fam.married': `
    Nos casamos en {weddingYear}. || We got married in {weddingYear}.
    Llevamos casados desde {weddingYear}. || We've been married since {weddingYear}.
    {partnerName} y yo nos casamos en {weddingYear}. || {partnerName} and I got married in {weddingYear}.
  `,
  'fam.kidOne': `
    Tengo {unKidEs}, {kidName}. Tiene {kidAge} años. || I have a {kidWord}, {kidName}. {kidPronoun} is {kidAge}.
    Tengo {unKidEs} de {kidAge} años, {kidName}. || I have a {kidAge}-year-old {kidWord}, {kidName}.
    Nada más {unKidEs}: {kidName}, de {kidAge} años. || Just one {kidWord}: {kidName}, {kidAge} years old.
  `,
  'fam.kidsMany': `
    Tengo {kidCountEs} {hijosEs}: {kidNamesEs}. || I have {kidCount} kids: {kidNames}.
    Tengo {kidCountEs} {hijosEs}. || I have {kidCount} kids.
    Son {kidCountEs}: {kidNamesEs}. || There are {kidCount}: {kidNames}.
  `,
  'fam.kidsFeel.baby': `
    Con el bebé casi no dormimos. || With the baby we hardly sleep.
    Con un bebé en la casa, no hay descanso. || With a baby at home, there's no rest.
    El bebé nos tiene desvelados. || The baby keeps us up at night.
  `,
  'fam.kidsFeel.small': `
    Los niños me tienen corriendo todo el día. || The kids have me running all day.
    Están chiquitos todavía. Mucho trabajo, pero mucha alegría. || They're still little. A lot of work, but a lot of joy.
    Con niños chiquitos no hay día tranquilo. || With little kids there's no quiet day.
  `,
  'fam.kidsFeel.teens': `
    Ya están grandes. Son adolescentes. || They're big now. They're teenagers.
    Con adolescentes en la casa, hay que tener paciencia. || With teenagers at home, you need patience.
    Ya casi no me hacen caso. Son adolescentes. || They hardly listen to me anymore. They're teenagers.
  `,
  'fam.kidsFeel.grown': `
    Ya están grandes, pero viven con nosotros. || They're grown, but they live with us.
    Ya son adultos, pero todavía viven en la casa. || They're adults now, but they still live at home.
    Ya están grandes. Con lo que cuesta la renta, siguen en la casa. || They're grown. With what rent costs, they're still at home.
  `,
  'fam.kidFeel.small': `
    Me tiene corriendo todo el día. || {kidPronoun} has me running all day.
    Me da mucho trabajo, pero vale la pena. || {kidPronoun} keeps me busy, but it's worth it.
    Es mi alegría. || {kidPronoun}'s my joy.
  `,
  'fam.kidFeel.teens': `
    Ya está grande. Es adolescente. || {kidPronoun}'s big now. A teenager.
    Ya casi no me hace caso. Cosas de la edad. || {kidPronoun} hardly listens to me anymore. That's the age.
    Está en esa edad difícil. || {kidPronoun}'s at that difficult age.
  `,
  'fam.kidFeel.grown': `
    Ya es {adultoEs}, pero vive con nosotros. || {kidPronoun}'s grown, but lives with us.
    Ya es {adultoEs}. Con lo cara que está la renta, sigue en la casa. || {kidPronoun}'s an adult. With rent this expensive, still at home.
    Ya es {adultoEs} y sigue en la casa. || {kidPronoun}'s an adult and still at home.
  `,
  'fam.grandkids': `
    Mis nietos viven con nosotros. || My grandkids live with us.
    Mis nietos son mi alegría. || My grandkids are my joy.
    Tengo nietos en la casa. Nunca hay silencio. || I have grandkids at home. It's never quiet.
  `,
  'fam.parents': `
    Vivo con {parentsEs}. || I live with my {parentsWord}.
    Vivo con {parentsEs}, en la misma casa. || I live with my {parentsWord}, in the same house.
    En la casa somos {parentsEs} y yo. || At home it's my {parentsWord} and me.
  `,
  'fam.parentsAdult': `
    Vivo con {parentsEs}. Así ahorramos. || I live with my {parentsWord}. That way we save money.
    Todavía vivo con {parentsEs}. La renta está muy cara. || I still live with my {parentsWord}. Rent is too expensive.
    Sigo viviendo con {parentsEs}. || I'm still living with my {parentsWord}.
  `,
  'fam.parentsCare': `
    Vivo con {parentsEs}. Yo {cuidoEs}. || I live with my {parentsWord}. I take care of {themWord}.
    Yo me encargo de {parentsEs}. || I look after my {parentsWord}.
    {parentsEsCap} y yo vivimos en la misma casa. Yo {cuidoEs}. || My {parentsWord} and I live in the same house. I take care of {themWord}.
  `,
  // goes right after the line it adds to, whichever it is ("Vivo con mis papás.", "En la casa somos mis papás y yo.")
  'fam.siblings': `
    Y también {sibEs}. || And {sibWords} too.
    Ah, y {sibEs}. || Oh, and {sibWords}.
    Y {sibEs} también. || {sibWordsCap} too.
  `,
  'fam.parentsToo': `
    Y con {parentsEs}, claro. || And with my {parentsWord}, of course.
  `,
  'fam.grandparents': `
    Mi {gpEs} vive con nosotros. || My {gpWord} lives with us.
    Con nosotros vive mi {gpEs}. || My {gpWord} lives with us.
    Mi {gpEs} también vive en la casa. || My {gpWord} lives in the house too.
  `,
  'fam.alone': `
    Vivo sol{o}. || I live alone.
    Nada más yo. || Just me.
    Vivo yo sol{o}, nada más. || I live by myself, that's all.
  `,
  'fam.widowed': `
    Soy viud{o}. || I'm widowed.
    Me quedé viud{o}. || I was widowed.
    Soy viud{o}. Ya me acostumbré, más o menos. || I'm widowed. I've gotten used to it, more or less.
  `,
  'fam.roommates': `
    Comparto la casa con otras personas. || I share the house with other people.
    Vivo con compañeros de cuarto. || I live with roommates.
    Vivimos varios en la casa. || A few of us live in the house.
  `,
  'fam.relatives': `
    Vivo con unos parientes. || I live with some relatives.
    Vivo con parte de mi familia. || I live with some of my family.
    En la casa vivimos varios parientes. || A few relatives live in the house.
  `,
  'fam.kidSelfNo': `
    ¿Hijos? ¡Tengo {age} años! || Kids? I'm {age}!
    ¡No! Todavía estoy en la escuela. || No! I'm still in school.
    ¿Yo? ¡No! || Me? No!
  `,
  'fam.noSiblings': `
    No tengo hermanos aquí. || I don't have brothers or sisters here.
    Hermanos aquí conmigo, no. || Brothers or sisters here with me, no.
    Aquí no vive ningún hermano mío. || No brother or sister of mine lives here.
  `,
  'fam.siblingsAnswer': `
    Sí, vivo con {sibEs}. || Yes, I live with {sibWords}.
    Sí: {sibEs}. || Yes: {sibWords}.
    Sí, tengo a {sibEs} aquí conmigo. || Yes, I have {sibWords} here with me.
  `,
  'fam.noKids': `
    No tengo hijos. || I don't have kids.
    Hijos no tengo. || I don't have kids.
    No, no tengo hijos. || No, I don't have kids.
  `,
  'fam.noKidsHome': `
    Mis hijos ya están grandes. || My kids are grown.
    Ya no tengo niños en la casa. || I don't have kids at home anymore.
    Mis hijos ya hicieron su vida. || My kids have their own lives now.
  `,
  'fam.abroad': `
    Casi toda mi familia sigue en {homeland}. || Most of my family is still in {homeland}.
    Mucha de mi familia sigue en {homeland}. || A lot of my family is still in {homeland}.
    Extraño a mi familia en {homeland}. || I miss my family in {homeland}.
  `,
  'home.familyThereAgain': `
    @usted Sí, como le decía. Casi todos siguen en {homeland}. || Yes, like I was saying. Almost all of them are still in {homeland}.
    @tu Sí, como te decía. Casi todos siguen en {homeland}. || Yes, like I was saying. Almost all of them are still in {homeland}.
    Sí, la mayoría sigue allá. || Yes, most of them are still there.
  `,
  'home.familyThere': `
    Algunos parientes, sí. Pero mi vida ya está aquí. || Some relatives, yes. But my life is here now.
    Sí, tengo familia en {homeland}. Hablamos por teléfono. || Yes, I have family in {homeland}. We talk on the phone.
    Algunos, sí. Les hablo cuando puedo. || Some, yes. I call them when I can.
  `,
  'home.missSome': `
    A veces. Pero ya mi casa es aquí. || Sometimes. But this is home now.
    Extraño {homeland} a veces. La comida, la gente. || I miss {homeland} sometimes. The food, the people.
    De vez en cuando. Mi vida ya está aquí. || Every now and then. My life is here now.
  `,
  'home.visitBack': `
    Cuando se puede. No es barato ir. || When I can. It's not cheap to go.
    No tan seguido como quisiera. || Not as often as I'd like.
    Cuando hay dinero y tiempo, que no es muy seguido. || When there's money and time, which isn't often.
  `,
  'home.stayHere': `
    No, mi casa ya está aquí. || No, this is home now.
    No creo. Mi vida está aquí. || I don't think so. My life is here.
    De visita tal vez, pero mi casa es aquí. || Maybe to visit, but this is home.
  `,
  'home.isHere': `
    Yo soy de aquí mismo. Esta es mi casa. || I'm from right here. This is home.
    Soy de aquí, no hay nada que extrañar. || I'm from here, so there's nothing to miss.
    Aquí es mi casa. || This is home for me.
  `,
  'home.missUS': `
    Extraño {birthplace} a veces, pero mi casa ya es aquí. || I miss {birthplace} sometimes, but this is home now.
    De vez en cuando. Pero ya llevo tiempo aquí. || Now and then. But I've been here a while now.
    A veces. {birthplace} siempre va a ser donde empecé. || Sometimes. {birthplace} will always be where I started.
  `,
  'fam.guarded': `
    Prefiero no hablar de mi familia. || I'd rather not talk about my family.
    Eso es cosa mía. || That's my business.
    Mejor hablemos de otra cosa. || Let's talk about something else.
  `,

  // ---------------------------------------------------------------- home
  'home.ownHouse': `
    Tenemos una casa aquí. La compramos en {hhYear}. || We have a house here. We bought it in {hhYear}.
    Somos dueños de la casa desde {hhYear}. || We've owned the house since {hhYear}.
    Compramos la casa en {hhYear}. || We bought the house in {hhYear}.
  `,
  'home.ownOther': `
    Tenemos {unHomeEs} aquí, desde {hhYear}. || We have {aHome} here, since {hhYear}.
    Somos dueños de {unHomeEs} aquí. || We own {aHome} here.
    Desde {hhYear} tenemos {unHomeEs} aquí. || Since {hhYear} we've had {aHome} here.
  `,
  'home.ownJoined': `
    {ownerEsCap} compró la casa en {hhYear}. Yo llegué en {zipSince}. || {ownerCap} bought the house in {hhYear}. I came in {zipSince}.
    La casa es de {ownerEs} desde {hhYear}. Yo vivo aquí desde {zipSince}. || It's been {ownerPos} house since {hhYear}. I've lived here since {zipSince}.
    {ownerEsCap} tiene la casa desde {hhYear}. Yo llegué en {zipSince}. || {ownerCap} has had the house since {hhYear}. I came in {zipSince}.
  `,
  'home.rent': `
    Rento {unHomeEs} aquí. || I rent {aHome} here.
    Rento aquí cerca. || I rent near here.
    Estamos rentando aquí. || We're renting here.
  `,
  'home.family': `
    Vivo con mi familia. || I live with my family.
    Vivo en la casa de mi familia. || I live in my family's house.
    Con mi familia, aquí cerca. || With my family, near here.
  `,
  'home.childhood': `
    Es la misma casa donde crecí. || It's the same house where I grew up.
    Aquí crecí, en esta misma casa. || I grew up here, in this same house.
    Toda mi vida he vivido en esta casa. || I've lived in this house my whole life.
  `,
  'home.since': `
    Desde {yearMoved}. || Since {yearMoved}.
    Llevo {yearsNum} años en esta casa. || I've been in this house {yearsNum} years.
    Vivo aquí desde {yearMoved}. || I've lived here since {yearMoved}.
  `,
  'home.feelApt': `
    Es chiquito, pero es nuestro hogar. || It's small, but it's our home.
    No es grande, pero estamos bien. || It's not big, but we're fine.
    Está chiquito, pero es nuestro. || It's small, but it's ours.
  `,
  'home.feelHouse': `
    Es nuestro hogar. || It's our home.
    Siempre hay algo que arreglar, pero es nuestra casa. || There's always something to fix, but it's our house.
    Aquí estamos a gusto. || We're comfortable here.
  `,
  'home.mobile': `
    Es una casa móvil, pero es nuestra. || It's a mobile home, but it's ours.
    Es una casa móvil. Es sencilla, pero cómoda. || It's a mobile home. It's simple, but comfortable.
    Vivimos en una casa móvil. || We live in a mobile home.
  `,
  'home.where': `
    Aquí en {place}. || Here in {place}.
    Aquí cerquita. || Right near here.
    Por aquí cerca, en {place}. || Near here, in {place}.
  `,
  'home.guarded': `
    Por aquí. || Around here.
    Aquí cerca. || Near here.
    Por el rumbo. || Around the area.
  `,

  // ---------------------------------------------------------------- weather
  'wx.now': `
    Estamos a {temp} grados y {cieloEs}. || It's {temp} degrees and {sky}.
    Ahora mismo hace {temp} grados. || Right now it's {temp} degrees.
    Hace {temp} grados ahorita, y {cieloEs}. || It's {temp} degrees right now, and {sky}.
  `,
  'wx.nowPlain': `
    Ahora mismo hace {temp} grados. || Right now it's {temp} degrees.
    Andamos en {temp} grados. || We're at {temp} degrees.
    Hace como {temp} grados. || It's about {temp} degrees.
  `,
  'wx.stale': `
    Debe estar como a {temp} grados. || It must be about {temp} degrees.
    Yo creo que estamos como a {temp} grados. || I think it's about {temp} degrees.
    Yo diría que unos {temp} grados. || I'd say about {temp} degrees.
  `,
  'wx.noForecast': `
    No he visto el pronóstico. || I haven't seen the forecast.
    No sé qué dice el pronóstico. || I don't know what the forecast says.
    El pronóstico no lo he revisado. || I haven't checked the forecast.
  `,
  'wx.climate.wetNow': `
    Este es el mes en que más llueve aquí. || This is the month it rains the most here.
    Ahorita es cuando más llueve aquí. || Right now is when it rains most here.
    Este mes es el más lluvioso aquí. || This month is the rainiest here.
  `,
  'wx.climate.wetNext': `
    En {wetMonthEs} es cuando más llueve aquí. || {wetMonth} is when it rains the most here.
    La lluvia fuerte viene en {wetMonthEs}. || The heavy rain comes in {wetMonth}.
    En {wetMonthEs} es cuando llueve de verdad. || {wetMonth} is when it really rains.
  `,
  'wx.tonight': `
    En la noche va a bajar a {low} grados. || Tonight it will go down to {low} degrees.
    Esta noche baja a {low}. || Tonight it drops to {low}.
    En la noche andará por los {low} grados. || Tonight it'll be around {low} degrees.
  `,
  'wx.next': `
    {cuandoEs} va a estar {nextCieloEs}, con una máxima de {high}. || {whenCap} it will be {nextSky}, with a high of {high}.
    {cuandoEs}: {nextCieloEs}, con máxima de {high}. || {whenCap}: {nextSky}, with a high of {high}.
    {cuandoEs} sube a {high} grados, {nextCieloEs}. || {whenCap} it goes up to {high} degrees, {nextSky}.
  `,
  'wx.rainChance': `
    Hay {pop} por ciento de probabilidad de lluvia {cuandoEs}. || There's a {pop} percent chance of rain {when}.
    Dicen que hay {pop} por ciento de que llueva {cuandoEs}. || They say there's a {pop} percent chance of rain {when}.
    Puede que llueva {cuandoEs}: {pop} por ciento. || It might rain {when}: {pop} percent.
  `,
  'wx.rainLikely': `
    Sí, va a llover {cuandoEs}. Dicen que {pop} por ciento. || Yes, it's going to rain {when}. They're saying {pop} percent.
    Parece que sí. {pop} por ciento de lluvia {cuandoEs}. || Looks like it. {pop} percent chance of rain {when}.
    Lluvia {cuandoEs}, {pop} por ciento. Hay que sacar el paraguas. || Rain {when}, {pop} percent. Time to get the umbrella out.
  `,
  'wx.rainLikelyFc': `
    Viene lluvia {cuandoEs}, {pop} por ciento. || Rain's coming {when}, {pop} percent.
    Dicen que va a llover {cuandoEs}. {pop} por ciento. || They're calling for rain {when}. {pop} percent.
    {pop} por ciento de lluvia {cuandoEs}, así que sí viene. || {pop} percent chance of rain {when}, so it's coming.
  `,
  'wx.noRain': `
    No se ve lluvia en el pronóstico, por lo menos hasta mañana. || No rain in the forecast, at least through tomorrow.
    Parece que no. Seco hasta mañana en la noche. || Doesn't look like it. Dry through tomorrow night.
    Que yo sepa, no. El pronóstico está seco por ahora. || Not that I know of. The forecast's dry for now.
  `,
  'wx.notReally': `
    Ahorita no. Estamos a {temp} grados, {cieloEs}. || Not right now. It's {temp} degrees, {sky}.
    Hoy no, la verdad. Estamos a {temp} grados. || Not today, actually. It's {temp} degrees.
    Por ahora no. Hace {temp} grados y {cieloEs}. || Not for now. It's {temp} degrees and {sky}.
  `,
  'wx.alert': `
    Hay una alerta del Servicio Meteorológico: {alert}. || There's a weather service alert: {alert}.
    El Servicio Meteorológico tiene una alerta: {alert}. || The weather service has an alert out: {alert}.
    Ojo, hay una alerta: {alert}. || Heads up, there's an alert: {alert}.
  `,
  'wx.alertNoEnd': `
    Hay una alerta del Servicio Meteorológico: {alert}. || There's a weather service alert: {alert}.
    Pusieron una alerta: {alert}. || They put out an alert: {alert}.
    Hay alerta del clima: {alert}. || There's a weather alert: {alert}.
  `,
  'wx.alertFeel': `
    Eso siempre me pone nervios{o}. || That always makes me nervous.
    Estoy al pendiente de las noticias. || I'm keeping an eye on the news.
    Ojalá que no pase nada. || I hope nothing happens.
  `,
  'wx.coastalAlert': `
    Es por las olas y la marea. Hay que tener cuidado en la playa. || It's the waves and the tide. You have to be careful at the beach.
    En la playa hay que tener cuidado con las olas. || At the beach you have to watch out for the waves.
    Mejor no acercarse a las rocas. || Better not go near the rocks.
  `,
  'wx.airOkay': `
    Hoy el aire está bien. || The air is fine today.
    El aire está limpio hoy. || The air is clean today.
    Hoy se respira bien. || You can breathe fine today.
  `,
  'wx.airSmoke': `
    En temporada de incendios, el humo se queda aquí por semanas. || In fire season, the smoke stays here for weeks.
    Cuando hay incendios, el humo no deja respirar. || When there are fires, the smoke makes it hard to breathe.
    El humo de los incendios es lo peor. || The smoke from the fires is the worst.
  `,
  'wx.feel.clear': `
    No me puedo quejar con este clima. || I can't complain with this weather.
    @cloudless No hay ni una nube. || There's not a cloud.
    Está precioso el día. || The day is lovely.
    Qué bonito día. || What a nice day.
  `,
  'wx.feel.cloudy': `
    Está un poco gris. || It's a little gray.
    Está nublado, pero no está mal. || It's cloudy, but not bad.
    Día gris, de quedarse en la casa. || A gray day, for staying home.
  `,
  'wx.feel.fog': `
    Hay mucha neblina. || There's a lot of fog.
    No se ve nada con esta neblina. || You can't see anything with this fog.
    Con la neblina, hay que manejar con cuidado. || With the fog, you have to drive carefully.
  `,
  'wx.feel.rain': `
    Hace falta la lluvia. || We need the rain.
    Con la lluvia, todos manejan como locos. || With the rain, everybody drives like crazy.
    Buen día para quedarse en la casa. || Good day to stay home.
  `,
  'wx.feel.heat': `
    Hace un calor horrible. || It's terribly hot.
    Hay que tomar mucha agua. || You have to drink a lot of water.
    Mejor quedarse en la sombra. || Better to stay in the shade.
  `,
  'wx.feel.cold': `
    Hace frío, para ser de aquí. || It's cold, for around here.
    Hay que abrigarse. || You have to bundle up.
    Hoy sí hace frío. || It really is cold today.
  `,
  'wx.feel.wind': `
    Hace mucho viento. || It's very windy.
    El viento está fuerte hoy. || The wind is strong today.
    Con este viento, hay que agarrar bien el sombrero. || With this wind, hold on to your hat.
  `,
  'wx.feel.smoke': `
    Hay mucho humo. || There's a lot of smoke.
    El aire está muy feo hoy. || The air is really bad today.
    Mejor quedarse adentro con este humo. || Better to stay inside with this smoke.
  `,
  'wx.feel.snow': `
    Hay nieve en las montañas. || There's snow in the mountains.
    Se ve bonita la nieve en la sierra. || The snow looks pretty in the mountains.
    Con nieve, hay que traer cadenas en el carro. || With snow, you have to carry chains in the car.
  `,
  'wx.climate.tjul': `
    En julio estamos como a {tjul} grados. || In July it's about {tjul} degrees.
    En el verano, como {tjul} grados en julio. || In summer, about {tjul} degrees in July.
    Julio anda por los {tjul} grados. || July runs around {tjul} degrees.
  `,
  'wx.climate.snow': `
    Aquí nieva como {snowIn} pulgadas al año. || Here it snows about {snowIn} inches a year.
    Cae nieve, unas {snowIn} pulgadas al año. || Snow falls, about {snowIn} inches a year.
    Sí nieva aquí: como {snowIn} pulgadas en un año normal. || It does snow here: about {snowIn} inches in a normal year.
  `,
  'wx.climate.snowLoad': `
    Aquí nieva mucho. Los techos aguantan {psf} libras de nieve por pie cuadrado. || It snows a lot here. The roofs hold {psf} pounds of snow per square foot.
    Nieva bastante. Los techos están hechos para {psf} libras por pie cuadrado. || It snows quite a bit. The roofs are built for {psf} pounds per square foot.
    Aquí la nieve es seria: los techos aguantan {psf} libras por pie cuadrado. || Snow is serious here: roofs hold {psf} pounds per square foot.
  `,
  'wx.climate.someSnow': `
    Nieva un poco en los inviernos fríos. || It snows a little in cold winters.
    A veces nieva poquito, pero no dura. || Sometimes it snows a little, but it doesn't last.
    Nieve, poquita, cuando hace mucho frío. || Snow, a little, when it's very cold.
  `,
  'wx.climate.noSnow': `
    Aquí no nieva. Hay que ir a las montañas. || It doesn't snow here. You have to go to the mountains.
    ¿Nieve? Aquí no. || Snow? Not here.
    Para ver nieve hay que manejar a la sierra. || To see snow you have to drive to the mountains.
  `,
  'wx.climate.rain': `
    Aquí llueven como {rainIn} pulgadas al año. || Here it rains about {rainIn} inches a year.
    Al año llueven unas {rainIn} pulgadas. || About {rainIn} inches of rain fall in a year.
    Llueve como {rainIn} pulgadas en un año. || It rains about {rainIn} inches in a year.
  `,
  'wx.climate.fog': `
    Aquí sí hay neblina, sobre todo en el verano. || We do get fog here, mostly in the summer.
    La neblina entra seguido, más en las mañanas de verano. || The fog comes in a lot, especially summer mornings.
    El verano es la temporada de neblina aquí. || Summer's the foggy season here.
  `,

  // ---------------------------------------------------------------- traffic
  'tr.drive': `
    Tomo {roadEs} para ir a {workCity}. Son {commuteMin} minutos. || I take {road} to get to {workCity}. It's {commuteMin} minutes.
    Manejo {commuteMin} minutos hasta {workCity}, por {roadEs}. || I drive {commuteMin} minutes to {workCity}, on {road}.
    Voy por {roadEs} hasta {workCity}. {commuteMin} minutos, si no hay tráfico. || I go on {road} to {workCity}. {commuteMin} minutes, if there's no traffic.
  `,
  'tr.driveLocal': `
    Trabajo aquí cerca. Son {commuteMin} minutos. || I work close by. It's {commuteMin} minutes.
    El trabajo me queda cerca: {commuteMin} minutos. || Work is close to me: {commuteMin} minutes.
    Son nomás {commuteMin} minutos en carro. || It's just {commuteMin} minutes by car.
  `,
  'tr.carpool': `
    Comparto el carro con otros para ir a {workCity}. || I share a ride with others to get to {workCity}.
    Nos vamos varios en un carro hasta {workCity}. Son {commuteMin} minutos. || A few of us go in one car to {workCity}. It's {commuteMin} minutes.
    Voy de raite con compañeros a {workCity}. || I ride with coworkers to {workCity}.
  `,
  'tr.transit': `
    Tomo el {transitEs} para ir a {workCity}. Son {commuteMin} minutos. || I take {transit} to get to {workCity}. It's {commuteMin} minutes.
    Me voy en {transitEs} hasta {workCity}. || I ride {transit} to {workCity}.
    En {transitEs}, {commuteMin} minutos hasta {workCity}. || On {transit}, {commuteMin} minutes to {workCity}.
  `,
  'tr.bike': `
    Me voy en bicicleta al trabajo. || I bike to work.
    Al trabajo me voy en bici. || I ride my bike to work.
    En bicicleta, {commuteMin} minutos. || By bike, {commuteMin} minutes.
  `,
  'tr.walk': `
    Me voy caminando al trabajo. || I walk to work.
    Me voy a pie. Queda cerca. || I go on foot. It's close.
    Camino al trabajo todos los días. || I walk to work every day.
  `,
  'tr.motorcycle': `
    Me voy en moto al trabajo. || I ride my motorcycle to work.
    En moto llego más rápido a {workCity}. || On the motorcycle I get to {workCity} faster.
    Voy en mi moto, {commuteMin} minutos. || I go on my motorcycle, {commuteMin} minutes.
  `,
  'tr.wfh': `
    Trabajo desde la casa, así que no manejo mucho. || I work from home, so I don't drive much.
    Como trabajo en la casa, casi no uso {roadEs}. || Since I work at home, I hardly use {road}.
    Yo me salvo del tráfico: trabajo desde la casa. || I'm spared the traffic: I work from home.
  `,
  'tr.retired': `
    Como estoy jubilad{o}, no salgo a la hora pico. || Since I'm retired, I don't go out at rush hour.
    Ya jubilad{o}, salgo cuando no hay tráfico. || Now that I'm retired, I go out when there's no traffic.
    Como ya no trabajo, evito {roadEs} en las horas pesadas. || Since I don't work anymore, I avoid {road} at the busy hours.
  `,
  'tr.noCar': `
    No tengo carro. Ando en autobús o a pie. || I don't have a car. I get around by bus or on foot.
    Ando en autobús. No tengo carro. || I take the bus. I don't have a car.
    Sin carro, uno camina mucho. || Without a car, you walk a lot.
  `,
  'tr.nonDriver': `
    Yo casi no manejo. || I hardly drive.
    No manejo mucho, la verdad. || I don't drive much, honestly.
    Casi no salgo en carro. || I hardly go out by car.
  `,
  'tr.kidRide': `
    Mi {driverEs} me lleva a la escuela. || My {driverWord} takes me to school.
    Me lleva mi {driverEs} en el carro. || My {driverWord} drives me.
    Mi {driverEs} me deja en la escuela. || My {driverWord} drops me off at school.
  `,
  'tr.kidWalk': `
    Voy caminando a la escuela. || I walk to school.
    Me voy a pie a la escuela. Queda cerca. || I go to school on foot. It's close.
    Camino a la escuela. || I walk to school.
  `,
  'tr.kidBus': `
    Voy en el autobús de la escuela. || I take the school bus.
    Tomo el autobús escolar. || I take the school bus.
    Me voy en el autobús amarillo. || I go on the yellow bus.
  `,
  'tr.kid': `
    Yo no manejo, ¡soy niñ{o}! || I don't drive, I'm a kid!
    ¡No puedo manejar, estoy chiquit{o}! || I can't drive, I'm little!
    Los grandes manejan, yo no. || The grown-ups drive, not me.
  `,
  'tr.teenDrive': `
    Todavía no tengo licencia. || I don't have a license yet.
    Todavía no manejo. Me falta la licencia. || I don't drive yet. I still need my license.
    Todavía no tengo edad para manejar. || I'm not old enough to drive yet.
  `,
  'tr.road': `
    {roadEs} es la autopista principal por aquí. || {road} is the main freeway around here.
    Por {roadEs} pasan {aadtEs} carros al día. || {aadtCap} go by on {road}.
    La más grande por aquí es {roadEs}. || The biggest one around here is {road}.
  `,
  'tr.roadSmall': `
    Por aquí usamos {roadEs}. || Around here we use {road}.
    La carretera principal aquí es {roadEs}. || The main road here is {road}.
    Casi todos usamos {roadEs}. || Almost all of us use {road}.
  `,
  'tr.roadFeel': `
    {roadEs} siempre está llena en la tarde. || {road} is always full in the afternoon.
    Hay mucho tráfico en {roadEs}. || There's a lot of traffic on {road}.
    En {roadEs} a la hora pico, mejor ni ir. || On {road} at rush hour, better not even go.
  `,
  'tr.stretch': `
    Y {stretch} es otra historia. || And {stretch} is another story.
    Y por {stretch}, mejor salir temprano. || And for {stretch}, better leave early.
    Y en {stretch} siempre hay tráfico. || And on {stretch} there's always traffic.
  `,
  'tr.roadQueryNear': `
    ¿{roadQEs}? Esa queda cerca de mi casa. || {roadQ}? That one is near my house.
    ¿{roadQEs}? Sí, la conozco bien. Pasa cerca. || {roadQ}? Yes, I know it well. It's close.
    ¡Claro, {roadQEs}! Queda aquí cerca. || Sure, {roadQ}! It's near here.
  `,
  'tr.roadQueryFar': `
    ¿{roadQEs}? Esa no la conozco mucho. || {roadQ}? I don't know that one much.
    ¿{roadQEs}? Esa queda lejos de aquí. || {roadQ}? That's far from here.
    Por {roadQEs} casi no ando. || I hardly ever go on {roadQ}.
  `,
  'tr.feel': `
    El tráfico aquí es parte de la vida. || Traffic here is part of life.
    El tráfico aquí no tiene remedio. || There's no fixing the traffic here.
    Hay que tenerle paciencia al tráfico. || You need patience with the traffic.
  `,

  // ---------------------------------------------------------------- fire
  'fire.lived': `
    Me acuerdo del {fireEs}, en {year}. || I remember {fire}, in {year}.
    Pasamos por el {fireEs} en {year}. || We went through {fire} in {year}.
    El {fireEs}, en {mesAnoEs}. No se me olvida. || {fireCap}, in {when}. I won't forget it.
  `,
  'fire.livedChild': `
    Yo estaba chiquit{o} cuando pasó el {fireEs}, en {year}. || I was little when {fire} happened, in {year}.
    Era niñ{o} cuando fue el {fireEs}, en {year}. || I was a kid when {fire} happened, in {year}.
    Me acuerdo poquito del {fireEs}. Yo era chic{o}. Fue en {year}. || I remember {fire} a little. I was a kid. It was in {year}.
  `,
  'fire.toll': `
    Destruyó {destEs} aquí. || It destroyed {dest} here.
    Aquí se quemaron {destEs}. || {destCap} burned here.
    Acabó con {destEs} aquí. || It took out {dest} here.
  `,
  'fire.size': `
    Se quemaron {acresEs}. || {acresCap} burned.
    En total se quemaron {acresEs}. || In all, {acres} burned.
    Quemó {acresEs}. || It burned {acres}.
  `,
  'fire.remember': `
    Me acuerdo del {fireEs}, en {year}. || I remember {fire}, in {year}.
    El {fireEs}, en {mesAnoEs}. Eso no se olvida. || {fireCap}, in {when}. You don't forget that.
    El {fireEs}, en {year}. Todavía me acuerdo. || {fireCap}, in {year}. I still remember it.
  `,
  'fire.rememberAway': `
    Me acuerdo del {fireEs}, en {year}. || I remember {fire}, in {year}.
    El {fireEs}, en {mesAnoEs}. Eso no se olvida. || {fireCap}, in {when}. You don't forget that.
  `,
  'fire.distance': `
    Se quemó a {milesEs} de aquí. || It burned {miles} from here.
    Fue a {milesEs} de aquí. || It was {miles} from here.
    El fuego llegó a {milesEs} de aquí. || The fire got within {miles} of here.
  `,
  'fire.livedTeen': `
    Tenía {ageThen} años cuando pasó el {fireEs}, en {year}. || I was {ageThen} when {fire} happened, in {year}.
    Yo tenía {ageThen} años cuando el {fireEs}, en {year}. || I was {ageThen} at the time of {fire}, in {year}.
    Con {ageThen} años, me tocó ver el {fireEs}, en {year}. || At {ageThen}, I saw {fire}, in {year}.
  `,
  'fire.tollThere': `
    Destruyó {destEs} en {place}. || It destroyed {dest} in {place}.
    En {place} se quemaron {destEs}. || In {place}, {dest} burned.
    Acabó con {destEs} en {place}. || It took out {dest} in {place}.
  `,
  'fire.before': `
    El {fireEs} fue en {year}, antes de que yo viviera aquí. || {fireCap} was in {year}, before I lived here.
    El {fireEs} fue en {year}. Yo todavía no vivía aquí. || {fireCap} was in {year}. I didn't live here yet.
    Del {fireEs}, en {year}, sé poco. Yo no vivía aquí. || I know little about {fire}, in {year}. I didn't live here.
  `,
  'fire.other': `
    Y también el {fireEs}, en {year}. || And also {fire}, in {year}.
    También hubo el {fireEs}, en {year}. || There was also {fire}, in {year}.
    Ah, y el {fireEs}, en {year}. || Oh, and {fire}, in {year}.
  `,
  'fire.near': `
    Aquí no hay muchos incendios. El más cercano fue el {fireEs}, en {year}. || There aren't many fires here. The closest was {fire}, in {year}.
    Aquí no se quema seguido. El más cercano fue el {fireEs}, en {year}, a {milesEs}. || It doesn't burn here often. The closest was {fire}, in {year}, {miles} away.
    En el pueblo, no. El {fireEs} de {year} fue el más cercano. || Not in town. {fireCap} in {year} was the closest.
  `,
  'fire.kidMore': `
    @usted Es todo lo que sé. Pregúntele a {parentEs}. || That's all I know. Ask my {parentWord}.
    @tu Es todo lo que sé. Pregúntale a {parentEs}. || That's all I know. Ask my {parentWord}.
    Es todo lo que me acuerdo. || That's all I remember.
    De eso no sé más. || I don't know more about that.
  `,
  'fire.nothingMore': `
    Es todo lo que sé. Aquí hemos tenido suerte. || That's all I know. We've been lucky here.
    Eso es lo que me acuerdo de los incendios. || That's what I remember about the fires.
    De incendios, eso es todo. || As for fires, that's all.
  `,
  'fire.none': `
    Aquí casi no hay incendios, por suerte. || There are hardly any fires here, luckily.
    Por suerte, aquí el fuego no ha sido problema. || Luckily, fire hasn't been a problem here.
    Incendios aquí, casi no. || Fires here, hardly any.
  `,
  'fire.zone': `
    {hazardEs} {place} está en zona de muy alto riesgo de incendio. || {hazardCap} {place} is in a very high fire hazard zone.
    {hazardEs} {place} tiene riesgo muy alto de incendio, según el estado. || {hazardCap} {place} has a very high fire risk, according to the state.
    {hazardEs} {place} cae en zona de muy alto riesgo. || {hazardCap} {place} falls in a very high hazard zone.
  `,
  'fire.prep': `
    Tenemos todo listo por si hay que evacuar. || We have everything ready in case we have to evacuate.
    Tenemos las cosas importantes listas, por si acaso. || We have the important things ready, just in case.
    Siempre tenemos una mochila lista para salir. || We always have a bag ready to go.
  `,
  'fire.offshore': `
    Y hoy hay {offEs}, así que hay que tener cuidado. || And there are {offName} winds today, so you have to be careful.
    Hoy soplan los {offEs}. Hay que tener cuidado. || The {offName} winds are blowing today. You have to be careful.
    Con los {offEs} de hoy, hay que tener mucho cuidado con el fuego. || With today's {offName} winds, you have to be very careful with fire.
  `,
  'fire.alert': `
    Y hoy hay una alerta: {alert}. || And today there's an alert: {alert}.
    Hoy está la alerta: {alert}. || Today there's the alert: {alert}.
    Ojo, que hoy hay alerta: {alert}. || Careful, there's an alert today: {alert}.
  `,
  'fire.smoke': `
    Aunque el fuego esté lejos, el humo llega aquí. || Even when the fire is far away, the smoke gets here.
    El humo de los incendios llega hasta aquí. || The smoke from the fires reaches us here.
    Cuando hay fuego cerca, el aire se pone feo. || When there's fire nearby, the air gets bad.
  `,
  'fire.feel': `
    Uno nunca se olvida de eso. || You never forget that.
    Cada año da miedo. || It's scary every year.
    Da mucho miedo cuando hay incendios. || It's very scary when there are fires.
  `,
  'fire.kid': `
    {parentEs} me contó que hubo un incendio grande aquí. || My {parentWord} told me there was a big fire here.
    {parentEsCap} dice que hubo un incendio grande aquí. || My {parentWord} says there was a big fire here.
    Me contaron que hubo un incendio muy grande. || They told me there was a really big fire.
  `,

  // ---------------------------------------------------------------- storms
  'storm.ar': `
    El río atmosférico de {mesAnoEs} fue de categoría {rank}. || The atmospheric river in {when} was a category {rank}.
    La tormenta de {mesAnoEs} fue muy fuerte. Categoría {rank}. || The storm in {when} was very strong. Category {rank}.
    En {mesAnoEs} llegó un río atmosférico de categoría {rank}. || In {when} a category {rank} atmospheric river came in.
  `,
  'storm.fema': `
    El condado recibió una declaración federal de desastre por las tormentas de {mesAnoEs}. || The county got a federal disaster declaration for the storms of {when}.
    Por las tormentas de {mesAnoEs} hubo declaración de desastre en el condado. || For the storms of {when} there was a disaster declaration in the county.
    Las tormentas de {mesAnoEs} fueron un desastre aquí. Hasta el gobierno federal ayudó. || The storms of {when} were a disaster here. Even the federal government helped.
  `,
  'storm.rainRecord': `
    El récord de lluvia en un día es de {rainRec} pulgadas, en {mesAnoEs}. || The one-day rain record is {rainRec} inches, in {when}.
    Lo más que ha llovido en un día aquí: {rainRec} pulgadas, en {mesAnoEs}. || The most it has rained here in a day: {rainRec} inches, in {when}.
    En {mesAnoEs} cayeron {rainRec} pulgadas en un solo día. || In {when}, {rainRec} inches fell in a single day.
  `,
  'storm.flood': `
    Aquí sí se inunda a veces. || It does flood here sometimes.
    Cuando llueve fuerte, se inundan las calles. || When it rains hard, the streets flood.
    Inundaciones sí hemos tenido. || We've had floods, sure.
  `,
  'storm.dry': `
    Aquí casi no llueve. Unas {rainIn} pulgadas al año. || It hardly rains here. About {rainIn} inches a year.
    Llueve poquito: como {rainIn} pulgadas al año. || It rains very little: about {rainIn} inches a year.
    Aquí es seco. Unas {rainIn} pulgadas de lluvia al año. || It's dry here. About {rainIn} inches of rain a year.
  `,
  'storm.now': `
    Y dicen que va a llover {cuandoEs}. || And they say it will rain {when}.
    Y {cuandoEs} viene lluvia, dicen. || And rain's coming {when}, they say.
    Parece que {cuandoEs} va a llover. || It looks like it will rain {when}.
  `,
  'storm.prep': `
    Cuando hay tormenta, tenemos velas a la mano. || When there's a storm, we keep candles handy.
    Siempre tenemos linternas y agua por si se va la luz. || We always have flashlights and water in case the power goes out.
    Cuando viene tormenta, nos preparamos. || When a storm is coming, we get ready.
  `,
  'storm.none': `
    Aquí no hay muchas tormentas. || There aren't many storms here.
    Tormentas fuertes, casi no. || Big storms, hardly any.
    Aquí el clima es tranquilo casi siempre. || The weather here is calm almost always.
  `,

  // ---------------------------------------------------------------- heat
  'heat.days': `
    Aquí pasamos de 100 grados unos {h100} días al año. || Here we go over 100 degrees about {h100} days a year.
    Unos {h100} días al año pasamos de 100. || About {h100} days a year we go over 100.
    Más de 100 grados, unos {h100} días cada año. || Over 100 degrees, about {h100} days every year.
  `,
  'heat.days90': `
    Pasamos de 90 grados unos {h90} días al año. || We go over 90 degrees about {h90} days a year.
    Unos {h90} días al año pasan de 90. || About {h90} days a year go over 90.
    Más de 90 grados, como {h90} días al año. || Over 90 degrees, about {h90} days a year.
  `,
  'heat.jul': `
    En julio estamos como a {tjul} grados. || In July it's about {tjul} degrees.
    Julio anda en {tjul} grados, más o menos. || July is around {tjul} degrees, more or less.
    En pleno verano, como {tjul} grados. || In the middle of summer, about {tjul} degrees.
  `,
  'heat.record': `
    El récord es de {recTemp} grados, el {recDateEs}. || The record is {recTemp} degrees, on {recDate}.
    Lo más caliente fue {recTemp} grados, el {recDateEs}. || The hottest it got was {recTemp} degrees, on {recDate}.
    El {recDateEs} llegó a {recTemp} grados. Es el récord. || On {recDate} it hit {recTemp} degrees. That's the record.
  `,
  'heat.now': `
    Hoy estamos a {temp} grados. || Today it's {temp} degrees.
    Ahorita hace {temp} grados. || Right now it's {temp} degrees.
    Hoy andamos en {temp} grados. || Today we're at {temp} degrees.
  `,
  'heat.cope': `
    Con el calor, hay que tomar mucha agua. || With the heat, you have to drink a lot of water.
    @outdoor En el verano empezamos a trabajar de madrugada. || In summer we start work before dawn.
    Con este calor, mejor quedarse en la sombra. || In this heat, better to stay in the shade.
    Cuando hace mucho calor, no salgo a medio día. || When it's very hot, I don't go out at midday.
  `,
  'heat.coast': `
    Aquí no hace mucho calor. En julio estamos como a {tjul}. || It doesn't get very hot here. In July it's about {tjul}.
    Aquí el verano es fresco. Julio anda en {tjul}. || Summer here is cool. July is around {tjul}.
    Aquí el verano no es muy caluroso. || Summer here isn't very hot.
  `,
  'heat.mild': `
    Hace calor, pero no tanto. En julio, como {tjul}. || It gets warm, but not too much. In July, about {tjul}.
    El verano es caluroso, pero aguantable. Como {tjul} en julio. || Summer is hot, but bearable. About {tjul} in July.
    No es tan caluroso: {tjul} en julio, más o menos. || It's not that hot: {tjul} in July, more or less.
  `,

  // ---------------------------------------------------------------- housing
  'house.value': `
    Las casas aquí cuestan {valueEs}. || Houses here cost {value}.
    Por aquí una casa cuesta {valueEs}. || Around here a house costs {value}.
    Las casas cuestan {valueEs} por aquí. || Houses cost {value} around here.
  `,
  'house.bought': `
    Compramos en {hhYear}. Ahora no podríamos. || We bought in {hhYear}. We couldn't now.
    La compramos en {hhYear}. Hoy no podríamos comprarla. || We bought it in {hhYear}. Today we couldn't afford it.
    Tuvimos suerte de comprar en {hhYear}. || We were lucky to buy in {hhYear}.
  `,
  'house.young': `
    Vivo con {parentsEs} para poder ahorrar. || I live with my {parentsWord} so I can save money.
    Por eso sigo con {parentsEs}: no alcanza para más. || That's why I'm still with my {parentsWord}: money doesn't stretch.
    Con {parentsEs} ahorro un poco. || With my {parentsWord} I save a little.
  `,
  'house.minor': `
    No sé, eso lo ven {parentsEs}. || I don't know, my {parentsWord} handle that.
    Eso le toca a {parentsEs}. || That's for my {parentsWord} to worry about.
    Yo no sé de eso. Soy chic{o}. || I don't know about that. I'm a kid.
  `,
  'house.renters': `
    Aquí casi todos rentan. || Almost everybody here rents.
    Aquí la mayoría renta. || Most people here rent.
    Aquí hay más gente rentando que con casa propia. || There are more people renting here than owning.
  `,
  'house.owners': `
    Aquí casi todos son dueños de su casa. || Almost everybody here owns their home.
    Aquí la mayoría es dueña de su casa. || Most people here own their home.
    Por aquí casi todos tienen casa propia. || Around here almost everyone owns their home.
  `,
  'house.opinion': `
    Todo está carísimo. || Everything is so expensive.
    Hacen falta casas que la gente pueda pagar. || We need houses people can afford.
    Que construyan más casas, digo yo. || They should build more houses, I say.
  `,
  'rent.feel': `
    La renta sube cada año. || The rent goes up every year.
    @works Casi todo mi sueldo se va en la renta. || Almost my whole paycheck goes to rent.
    Pagar la renta cada mes es lo más difícil. || Paying the rent every month is the hardest part.
    La renta no para de subir. || The rent keeps going up.
  `,
  'rent.family': `
    Vivo con mi familia, así que yo no pago renta. Pero todo está caro. || I live with my family, so I don't pay rent. But everything is expensive.
    Como vivo con mi familia, no pago renta, pero sé que está carísima. || Since I live with my family, I don't pay rent, but I know it's very expensive.
    La renta la pagan en la casa, no yo. || The rent's paid at home, not by me.
  `,
  'rent.ownerSide': `
    Nosotros somos dueños, pero la renta aquí está carísima. || We own our place, but rent here is sky-high.
    Somos dueños, por suerte. La renta aquí está carísima. || We own, luckily. Rent here is very expensive.
    No pagamos renta, pero los vecinos sí, y está carísima. || We don't pay rent, but the neighbors do, and it's very expensive.
  `,

  // ---------------------------------------------------------------- insurance
  'ins.fair': `
    Muchos aquí tienen el FAIR Plan porque las aseguradoras los dejaron. || Lots of people here have the FAIR Plan because the insurers dropped them.
    Como {fair} de cada 100 casas aquí tienen el FAIR Plan. || About {fair} in every 100 homes here are on the FAIR Plan.
    A muchos los dejó la aseguradora y tuvieron que irse al FAIR Plan. || Many were dropped by their insurer and had to go to the FAIR Plan.
  `,
  'ins.prem': `
    El seguro de casa aquí cuesta como {prem} al año. || Home insurance here costs about {prem} a year.
    Aquí se paga como {prem} al año de seguro de casa. || Here you pay about {prem} a year for home insurance.
    El seguro de la casa sale en {prem} al año, más o menos. || Home insurance runs {prem} a year, more or less.
  `,
  'ins.mine': `
    Nuestro seguro subió otra vez. || Our insurance went up again.
    Cada año pagamos más de seguro. || Every year we pay more for insurance.
    El seguro ya no es lo que era. || Insurance isn't what it used to be.
  `,
  'ins.renter': `
    Yo rento, así que no sé mucho de eso. || I rent, so I don't know much about that.
    Como rento, eso no me toca a mí. || Since I rent, that's not my problem.
    El seguro de la casa lo ve el dueño. || The owner handles the home insurance.
  `,
  'ins.notMine': `
    Yo no me encargo del seguro. Eso lo ve el dueño. || I don't deal with the insurance. The owner handles that.
    El seguro no me toca a mí. || The insurance isn't my concern.
    De eso se encarga el dueño de la casa. || The owner of the house takes care of that.
  `,
  'ins.family': `
    De eso se encarga mi familia. || My family takes care of that.
    Eso lo ve mi familia, no yo. || My family handles that, not me.
    Yo no pago el seguro. Lo paga la familia. || I don't pay the insurance. The family does.
  `,
  'ins.minor': `
    No sé nada de eso. || I don't know anything about that.
    Soy chic{o}, de eso no sé. || I'm a kid, I don't know about that.
    Eso es cosa de los grandes. || That's grown-up stuff.
  `,
  'ins.low': `
    Aquí el seguro todavía no está tan mal. || Insurance here still isn't that bad.
    Aquí el seguro no ha subido tanto, por suerte. || Insurance here hasn't gone up that much, luckily.
    No nos quejamos del seguro, por ahora. || We don't complain about insurance, for now.
  `,

  // ---------------------------------------------------------------- earthquakes
  'quake.fema': `
    En {year} hubo un terremoto que dejó daños en el condado. || In {year} there was an earthquake that caused damage in the county.
    El terremoto de {year} dejó daños en el condado. || The {year} earthquake left damage in the county.
    En {year} tembló fuerte y hubo declaración de desastre. || In {year} there was a strong quake and a disaster declaration.
  `,
  'quake.prep': `
    Tenemos agua y una linterna por si acaso. || We keep water and a flashlight just in case.
    Tenemos un kit de emergencia en la casa. || We have an emergency kit at home.
    Siempre tengo agua guardada, por si tiembla. || I always keep water stored, in case there's a quake.
  `,
  'quake.feel': `
    Uno nunca se acostumbra a los temblores. || You never get used to the quakes.
    Cada vez que tiembla, me asusto. || Every time there's a tremor, I get scared.
    Con los temblores no se juega. || You don't mess around with earthquakes.
  `,
  'quake.none': `
    Así es California. Nunca se sabe. || That's California. You never know.
    Tenemos todo listo, por si acaso. || We have everything ready, just in case.
    Uno nunca sabe cuándo va a temblar. || You never know when it'll shake.
  `,
  'quake.residence': `
    Vivo en el condado de {county} desde {countySince}. || I've lived in {county} County since {countySince}.
    Desde {countySince} vivo en el condado de {county}. || I've lived in {county} County since {countySince}.
    Llegué al condado de {county} en {countySince}. || I came to {county} County in {countySince}.
  `,
  'quake.residenceLife': `
    He vivido en el condado de {county} toda mi vida. || I've lived in {county} County all my life.
    Toda mi vida he vivido en el condado de {county}. || I've lived in {county} County my whole life.
    Nací y crecí en el condado de {county}. || I was born and raised in {county} County.
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
    Lo mejor es {dish} hecho en casa. || The best is homemade {dishGloss}.
    Para mí, nada como {dish}. || For me, nothing beats {dishGloss}.
  `,
  'food.lots': `
    Aquí hay comida de todo tipo. || There's every kind of food here.
    Para comer, aquí hay de todo. || For eating, there's everything here.
    Hay restaurantes en cada cuadra. || There are restaurants on every block.
  `,
  'food.some': `
    Hay unos lugares buenos para comer por aquí. || There are some good places to eat around here.
    Hay buenos lugares, no muchos, pero buenos. || There are good places, not many, but good ones.
    Hay de dónde escoger para comer. || There's some choice of where to eat.
  `,
  'food.dishAsk': `
    @usted ¿{dishEs}? Busque el lugar con fila. || {dishCap}? Look for the place with a line.
    @tu ¿{dishEs}? Busca el lugar con fila. || {dishCap}? Look for the place with a line.
    @usted Para {dishEs}, pregunte por ahí. Cada quien tiene su lugar. || For {dish}, ask around. Everybody has their spot.
    @tu Para {dishEs}, pregunta por ahí. Cada quien tiene su lugar. || For {dish}, ask around. Everybody has their spot.
    ¿{dishEs}? Donde hay mucha gente, ahí está lo bueno. || {dishCap}? Wherever there's a crowd, that's where the good stuff is.
  `,
  // after the where: a word for home cooking (never the answer itself)
  'food.dishHome': `
    Aunque, para mí, lo mejor es lo de la casa. || Though for me, homemade is best.
    Pero como lo que se hace en casa, nada. || But nothing beats what's made at home.
    Aunque, la verdad, como en casa no hay. || Though honestly, there's nothing like home.
  `,
  'food.dishCook': `
    Yo, la verdad, prefiero hacer {dishEs} en la casa. || Me, honestly, I'd rather make {dish} at home.
    Yo casi siempre hago {dishEs} en la casa. || I usually make {dish} at home.
    Yo prefiero cocinar en la casa, la verdad. || I'd rather cook at home, honestly.
  `,
  'food.few': `
    Aquí no hay muchos restaurantes. Mejor cocinamos en casa. || There aren't many restaurants here. We cook at home.
    Restaurantes, pocos. Aquí se cocina en casa. || Restaurants, few. Here people cook at home.
    Para comer fuera hay que ir a otro pueblo. || To eat out you have to go to another town.
  `,
  'food.tip': `
    @usted Busque donde haya fila. Ahí está lo bueno. || Look for a line. That's where the good food is.
    @tu Busca donde haya fila. Ahí está lo bueno. || Look for a line. That's where the good food is.
    Los mejores lugares no se ven bonitos por fuera. || The best places don't look nice from outside.
    Donde comen los trabajadores, ahí es bueno. || Where the workers eat, that's where it's good.
  `,

  // ---------------------------------------------------------------- places and directions
  'place.beach': `
    @usted La playa está a {milesEs}. Vaya al atardecer. || The beach is {miles} away. Go at sunset.
    @tu La playa está a {milesEs}. Ve al atardecer. || The beach is {miles} away. Go at sunset.
    La playa queda a {milesEs}. || The beach is {miles} away.
    A {milesEs} está la playa. Vale la pena. || The beach is {miles} away. It's worth it.
  `,
  'place.landmark': `
    @usted Si tiene tiempo, vaya a ver {landmark}. || If you have time, go see {landmark}.
    @tu Si tienes tiempo, ve a ver {landmark}. || If you have time, go see {landmark}.
    Vale la pena ver {landmark}. || {landmark} is worth seeing.
    Por aquí está {landmark}. || {landmark} is around here.
  `,
  'place.park': `
    El parque está bonito en las mañanas. || The park is nice in the mornings.
    Al parque van muchas familias los fines de semana. || A lot of families go to the park on weekends.
    El parque es un buen lugar para caminar. || The park is a good place to walk.
  `,
  'place.town': `
    {town} está bonito. Queda a {milesEs} al {dirEs}. || {town} is nice. It's {miles} {dir}.
    Vale la pena ir a {town}, a {milesEs} al {dirEs}. || {town} is worth a visit, {miles} {dir}.
    {town} queda a {milesEs}. Es un lugar bonito. || {town} is {miles} away. It's a nice place.
  `,
  'place.none': `
    Aquí es tranquilo. No hay mucho que hacer. || It's quiet here. There's not much to do.
    Aquí no hay mucho que ver, la verdad. Es tranquilo. || There isn't much to see here, honestly. It's quiet.
    Lo bueno de aquí es la tranquilidad. || The good thing about here is the peace and quiet.
  `,
  'dir.place': `
    {targetEsCap} queda a {milesEs} al {dirEs}. || {target} is {miles} {dir}.
    Para {targetEs} son {milesEs} al {dirEs}. || To {target} it's {miles} {dir}.
    {targetEsCap} está a {milesEs}, hacia el {dirEs}. || {target} is {miles} away, to the {dir}.
  `,
  'dir.road': `
    @usted Tome {roadEs}. || Take {road}.
    @tu Toma {roadEs}. || Take {road}.
    Se va por {roadEs}. || You go on {road}.
    Lo más fácil es {roadEs}. || The easiest is {road}.
  `,
  'dir.near': `
    Queda cerquita, a {milesEs} al {dirEs}. || It's close, {miles} {dir}.
    Está aquí nomás, a {milesEs}. || It's right here, {miles} away.
    No está lejos: {milesEs} al {dirEs}. || It's not far: {miles} {dir}.
  `,
  'dir.far': `
    Eso queda lejos, a {milesEs} al {dirEs}. || That's far, {miles} {dir}.
    Está lejitos: {milesEs} al {dirEs}. || It's pretty far: {miles} {dir}.
    Es un viaje largo: {milesEs}. || It's a long trip: {miles}.
  `,
  'dir.here': `
    @usted ¡Ya está aquí! Esto es {place}. || You're already here! This is {place}.
    @tu ¡Ya estás aquí! Esto es {place}. || You're already here! This is {place}.
    Esto ya es {place}. || This is already {place}.
    Aquí es {place}. || This is {place}.
  `,
  'dir.errand': `
    La {wordEs} queda en {city}, a {milesEs}. || The {word} is in {city}, {miles} away.
    Hay una {wordEs} en {city}, a {milesEs}. || There's a {word} in {city}, {miles} away.
    La {wordEs} más cercana está en {city}. || The closest {word} is in {city}.
  `,
  'dir.errandHere': `
    Hay una {wordEs} aquí mismo. || There's a {word} right here.
    Aquí mismo hay una {wordEs}. || There's a {word} right here.
    Hay una {wordEs} aquí cerquita. || There's a {word} right near here.
  `,
  'dir.unknown': `
    @usted No sabría decirle cómo llegar ahí, perdón. || I couldn't tell you how to get there, sorry.
    @tu No sabría decirte cómo llegar ahí, perdón. || I couldn't tell you how to get there, sorry.
    No sé bien cómo llegar ahí. || I don't really know how to get there.
    Eso no lo conozco, perdón. || I don't know that one, sorry.
  `,
  'dir.kid': `
    @usted No sé. Pregúntele a {parentEs}. || I don't know. Ask my {parentWord}.
    @tu No sé. Pregúntale a {parentEs}. || I don't know. Ask my {parentWord}.
    No sé. Yo no manejo. || I don't know. I don't drive.
    No sé llegar sol{o}. || I don't know how to get there by myself.
  `,

  // ---------------------------------------------------------------- neighborhood and history
  'hood.urban': `
    Aquí siempre hay movimiento. || There's always something going on here.
    Aquí hay mucha gente y mucho ruido. || There are a lot of people and a lot of noise here.
    Aquí todo está cerca. || Everything is close here.
  `,
  'hood.suburban': `
    Es tranquilo, hay muchas familias. || It's quiet, lots of families.
    Es un barrio tranquilo, de familias. || It's a quiet neighborhood, a family one.
    Aquí es calmado. La gente trabaja y regresa a su casa. || It's calm here. People work and come home.
  `,
  'hood.rural': `
    Aquí es muy tranquilo. Todos se conocen. || It's very quiet here. Everybody knows each other.
    Aquí hay mucho espacio y poca gente. || There's a lot of space and few people here.
    Es campo. Todo queda lejos, pero es tranquilo. || It's the country. Everything is far, but it's quiet.
  `,
  'hood.lang': `
    Aquí {shareVerbEs} {langEs} en casa. || {shareCap} speak {langName} at home.
    En mi cuadra se oye mucho {langEs}. || On my block you hear a lot of {langName}.
    Aquí se habla mucho {langEs}. || A lot of {langName} is spoken here.
  `,
  'hood.like': `
    Me gusta vivir aquí. || I like living here.
    Es mi hogar. || It's my home.
    Aquí estoy a gusto. || I'm comfortable here.
    Sí, me gusta. Ya me acostumbré. || Yes, I like it. I've gotten used to it.
    Me gusta. Aquí ya es mi casa. || I like it. This is home now.
  `,
  'hood.safe': `
    Me siento segur{o} aquí. Los vecinos se cuidan. || I feel safe here. The neighbors look out for each other.
    Es un barrio tranquilo. Me siento segur{o}. || It's a calm neighborhood. I feel safe.
    Aquí los vecinos se conocen y se cuidan. || Here the neighbors know each other and look out for each other.
  `,
  'hood.change': `
    Ha cambiado mucho desde {zipSince}. Todo está más caro. || It's changed a lot since {zipSince}. Everything costs more.
    Ha cambiado mucho desde que llegué. Todo está más caro. || It's changed a lot since I got here. Everything costs more.
    Ya no es lo mismo que cuando llegué. || It's not the same as when I got here.
    El barrio ha cambiado bastante, y todo cuesta más. || The neighborhood has changed quite a bit, and everything costs more.
  `,
  'hist.since': `
    Vivo aquí desde {zipSince}. || I've lived here since {zipSince}.
    Aquí estoy desde {zipSince}. || I've been here since {zipSince}.
    Llegué aquí en {zipSince}. || I came here in {zipSince}.
  `,
  'hist.grew': `
    Crecí aquí. He visto muchos cambios. || I grew up here. I've seen a lot of changes.
    Aquí me crié. Ha cambiado mucho. || I was raised here. It's changed a lot.
    Crecí en este rumbo. Todo era diferente. || I grew up around here. Everything was different.
  `,
  'hist.arrival': `
    Llegué a este país en {arrivalYear}. || I came to this country in {arrivalYear}.
    Me vine a este país en {arrivalYear}. || I came to this country in {arrivalYear}.
    Llegué en {arrivalYear}. Todo era nuevo para mí. || I arrived in {arrivalYear}. Everything was new to me.
  `,
  'hist.event': `
    Me acuerdo de {memEs}. Fue muy difícil. || I remember {memTitle}. It was very hard.
    Nunca voy a olvidar {memEs}. || I'll never forget {memTitle}.
    Todavía me acuerdo bien de {memEs}. || I still remember {memTitle} well.
    Lo que más recuerdo es {memEs}. || What I remember most is {memTitle}.
  `,
  'hist.kid': `
    Tengo {age} años. No me acuerdo de mucho. || I'm {age}. I don't remember much.
    Soy chic{o}. No me acuerdo de mucho. || I'm a kid. I don't remember much.
    Yo apenas tengo {age} años. || I'm only {age}.
  `,
  'hist.change': `
    Ha cambiado mucho desde {zipSince}. || It's changed a lot since {zipSince}.
    Ha cambiado mucho desde que llegué. || It's changed a lot since I arrived.
    Ya no es como antes. || It's not like before.
  `,
  'hist.more': `
    Es todo lo que me acuerdo. || That's all I remember.
    De eso es lo que me acuerdo. || That's what I remember about it.
    Ya no me acuerdo de más. || I don't remember more.
  `,
  'hist.yearHit': `
    ¿{year}? Ese fue el año del {eventEs}. || {year}? That was the year of {event}.
    En {year} fue el {eventEs}. || In {year} there was {event}.
    ¿{year}? El {eventEs}, me acuerdo. || {year}? {eventCap}, I remember.
  `,
  'hist.yearMiss': `
    @usted ¿{year}? Déjeme pensar. || {year}? Let me think.
    @tu ¿{year}? Déjame pensar. || {year}? Let me think.
    ¿{year}? A ver si me acuerdo. || {year}? Let's see if I remember.
    ¿En {year}? Tendría que pensarlo. || In {year}? I'd have to think about it.
  `,
  'hist.yearUnborn': `
    ¿{year}? Todavía no nacía. || {year}? I wasn't born yet.
    En {year} yo todavía no nacía. || In {year} I wasn't born yet.
    ¡Eso fue antes de que yo naciera! || That was before I was born!
  `,
  'hist.yearHere': `
    Sí, ya vivía aquí. Llegué en {zipSince}. || Yes, I was living here. I came in {zipSince}.
    Sí, ya estaba aquí. Desde {zipSince}. || Yes, I was already here. Since {zipSince}.
    Ya vivía aquí, sí. || I already lived here, yes.
  `,
  'hist.yearHereAlways': `
    Sí. He vivido aquí toda mi vida. || Yes. I've lived here all my life.
    Sí, aquí he estado siempre. || Yes, I've always been here.
    Claro, yo siempre he vivido aquí. || Of course, I've always lived here.
  `,
  'hist.yearCounty': `
    Vivía en el condado de {county}, pero aquí llegué en {zipSince}. || I lived in {county} County, but I came here in {zipSince}.
    Ya estaba en el condado de {county}, pero no en este barrio. || I was already in {county} County, but not in this neighborhood.
    Vivía en otra parte del condado. Aquí llegué en {zipSince}. || I lived in another part of the county. I came here in {zipSince}.
  `,
  'hist.yearAbroad': `
    No, llegué a Estados Unidos en {arrivalYear}. || No, I came to the United States in {arrivalYear}.
    No, yo todavía no llegaba a este país. Vine en {arrivalYear}. || No, I hadn't come to this country yet. I came in {arrivalYear}.
    En ese tiempo yo no estaba aquí. Llegué en {arrivalYear}. || At that time I wasn't here. I came in {arrivalYear}.
  `,
  'hist.yearAway': `
    No, llegué aquí en {countySince}. || No, I came here in {countySince}.
    No, yo llegué después, en {countySince}. || No, I came later, in {countySince}.
    Todavía no vivía aquí. Llegué en {countySince}. || I didn't live here yet. I came in {countySince}.
  `,

  // ---------------------------------------------------------------- opinions, social moves
  'op.politics': `
    De política mejor no hablo. || I'd rather not talk politics.
    La política no es lo mío. || Politics isn't my thing.
    Mejor hablemos de otra cosa, no de política. || Let's talk about something else, not politics.
  `,
  'op.religion': `
    Voy a la iglesia los domingos. Mi fe es importante para mí. || I go to church on Sundays. My faith is important to me.
    Mi fe me ayuda mucho. || My faith helps me a lot.
    Soy de ir a la iglesia. Es parte de mi vida. || I'm a churchgoer. It's part of my life.
  `,
  'op.religionNone': `
    Eso es algo personal. || That's something personal.
    De religión no hablo mucho. || I don't talk about religion much.
    Cada quien con su fe. || To each their own faith.
  `,
  'op.playerGood': `
    @usted Usted me cae bien. || I like you.
    @tu Me caes bien. || I like you.
    Qué bueno platicar así. || It's nice to chat like this.
    Platicamos bonito. || We have nice chats.
  `,
  'op.playerMeh': `
    Todavía no sé. || I don't know yet.
    Apenas nos estamos conociendo. || We're only just getting to know each other.
    Pues, ya veremos. || Well, we'll see.
  `,
  'op.playerBad': `
    La verdad, no muy bien. || Honestly, not very well.
    Ha habido mejores pláticas. || There have been better conversations.
    No empezamos muy bien. || We didn't start very well.
  `,
  'op.generic': `
    La verdad, no sé qué pensar. || Honestly, I don't know what to think.
    Cada quien tiene su opinión. || Everyone has their own opinion.
    Hay de todo, ¿no? || There's a bit of everything, right?
  `,
  'op.traffic': `
    Cada vez hay más carros. || There are more cars every year.
    El tráfico está cada día peor. || The traffic is worse every day.
    Hay demasiados carros. || There are too many cars.
  `,
  'op.weather': `
    El clima aquí es lo mejor. || The weather here is the best.
    No cambio este clima por nada. || I wouldn't trade this weather for anything.
    Aquí el clima es muy bueno casi todo el año. || The weather here is very good almost all year.
  `,
  'comp.thanks': `
    ¡Ay, gracias! || Oh, thank you!
    Muy amable. || That's very kind.
    Gracias, qué amable. || Thanks, how kind.
  `,
  'comp.back': `
    @usted Usted también es muy amable. || You're very kind too.
    @tu Tú también eres muy amable. || You're very kind too.
    Muy amable. || Very kind.
    Gracias. Igualmente. || Thanks. Likewise.
  `,
  'comp.guarded': `
    Bueno, gracias. || Well, thanks.
    Ajá. Gracias. || Uh-huh. Thanks.
    Está bien. || Okay.
  `,
  'insult.hurt': `
    Eso no fue muy amable. || That wasn't very nice.
    @usted ¿Por qué me dice eso? || Why are you saying that to me?
    @tu ¿Por qué me dices eso? || Why are you saying that to me?
    Eso me dolió. || That hurt.
  `,
  'insult.annoyed': `
    @usted Oiga, más respeto. || Hey, show some respect.
    @tu Oye, más respeto. || Hey, show some respect.
    Así no se habla. || That's no way to talk.
    No me gusta que me hablen así. || I don't like being talked to like that.
  `,
  'insult.language': `
    @usted No hable así, por favor. || Please don't talk like that.
    @tu No hables así, por favor. || Please don't talk like that.
    Esas palabras no, por favor. || Not those words, please.
    Ese lenguaje no me gusta. || I don't like that language.
  `,
  'insult.end': `
    Ya no quiero hablar. || I don't want to talk anymore.
    Hasta aquí. || That's enough.
    Ya terminamos. || We're done.
  `,
  'insult.after': `
    @usted Ya le dije que no. || I already told you no.
    @tu Ya te dije que no. || I already told you no.
    No voy a seguir hablando. || I'm not going to keep talking.
    Ya dije lo que tenía que decir. || I've said what I had to say.
  `,
  'insult.shrug': `
    @usted Bueno, que le vaya bien. || Well, have a good day.
    @tu Bueno, que te vaya bien. || Well, have a good day.
    Ya, está bien. || Fine, okay.
    Allá cada quien. || Each to their own.
  `,
  'joke.decline': `
    Yo no sé contar chistes. || I don't know how to tell jokes.
    Para chistes, mejor pregúntele a mi familia. || For jokes, better ask my family.
    Ay, los chistes no son lo mío. || Oh, jokes aren't my thing.
  `,
  // wordplay that only works in Spanish is tagged @es: a speaker in plain English ('simple' mode) does not tell it
  'joke.pun': `
    ¿Qué le dijo un semáforo a otro? No me mires, que me estoy cambiando. || What did one traffic light say to the other? Don't look, I'm changing.
    ¿Por qué el libro de matemáticas está triste? Porque tiene muchos problemas. || Why is the math book sad? Because it has a lot of problems.
    ¿Qué le dijo una pared a otra? Nos vemos en la esquina. || What did one wall say to the other? I'll meet you at the corner.
    ¿Qué le dijo el café al azúcar? Sin ti mi vida es amarga. || What did the coffee say to the sugar? Without you, my life is bitter.
    ¿Qué le dijo la luna al sol? Tan grande y no te dejan salir de noche. || What did the moon say to the sun? So big, and they still don't let you out at night.
    El tráfico aquí está tan lento que ayer me rebasó un caracol. || Traffic here is so slow that yesterday a snail passed me.
    Le pregunté al doctor cómo bajar de peso. Me dijo que moviera la cabeza de lado a lado cuando me ofrecieran postre. || I asked the doctor how to lose weight. He told me to shake my head side to side when they offer me dessert.
    @es ¿Qué le dice una iguana a su hermana gemela? Somos iguanitas. || What does an iguana say to her twin sister? We're iguanitas (it sounds like "we're the same").
    @es ¿Cuál es el café más peligroso del mundo? El ex-preso. || What's the most dangerous coffee in the world? The ex-preso (an espresso, and an ex-convict).
    @es ¿Qué le dijo un pez a otro? Nada. || What did one fish say to the other? Nothing (in Spanish, "nada" also means "he swims").
  `,
  'joke.kid': `
    ¿Qué le dijo una uva verde a una uva morada? ¡Respira, respira! || What did a green grape say to a purple grape? Breathe, breathe!
    ¿Cuál es el animal más antiguo? La cebra, porque está en blanco y negro. || What's the oldest animal? The zebra, because it's in black and white.
    ¿Por qué el elefante no usa computadora? Porque le tiene miedo al ratón. || Why doesn't the elephant use a computer? Because it's afraid of the mouse.
    @es ¿Qué le dijo el uno al diez? Para ser como yo, tienes que ser sincero. || What did the one say to the ten? To be like me, you have to be sincere (it sounds like "without a zero").
  `,
  'joke.thanks': `
    @usted ¡Ja! Qué bueno que le gustó. || Ha! I'm glad you liked it.
    @tu ¡Ja! Qué bueno que te gustó. || Ha! I'm glad you liked it.
    Ese me lo contó mi compadre. || My buddy told me that one.
    Tengo más, pero ese es el mejor. || I have more, but that's the best one.
  `,
  'react.positive': `
    ¿Verdad que sí? || Right?
    Así es. || That's right.
    Eso mismo digo yo. || That's what I say too.
  `,
  'job.collegeFeel': `
    Me gusta, aunque es mucho trabajo. || I like it, even though it's a lot of work.
    Es pesado, pero vale la pena. || It's hard, but it's worth it.
    Me gusta. Hay días que no duermo, pero me gusta. || I like it. Some days I don't sleep, but I like it.
  `,
  'joke.laugh': `
    ¡Ja! Ese estuvo malo. || Ha! That was a bad one.
    Ya sé, ya sé. Está malísimo. || I know, I know. It's terrible.
    Mi familia ya no se ríe de ese. || My family doesn't laugh at that one anymore.
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
    Todo bien. || All good.
  `,
  'apology.grudging': `
    Bueno, está bien. || Well, okay.
    Ya, ya. Está bien. || Okay, okay. Fine.
    Bueno. Que no se repita. || Well. Don't let it happen again.
  `,
  'apology.none': `
    No hay nada que perdonar. || There's nothing to forgive.
    No pasa nada. || It's nothing.
    Todo está bien. || Everything's fine.
  `,
  'small.new': `
    Nada nuevo. Lo mismo de siempre. || Nothing new. Same as always.
    Aquí, lo de siempre. || Here, the usual.
    Nada del otro mundo. || Nothing out of this world.
  `,
  'small.otherTeamFan': `
    ¿{askedTeamEs}? No, yo le voy a {teamEs}. || {askedTeamCap}? No, I root for {team}.
    No mucho. Yo soy de {teamEs}. || Not really. I'm a {teamName} fan.
  `,
  'small.notAFan': `
    No los sigo mucho. || I don't follow them much.
    No sigo mucho los deportes. || I don't follow sports much.
  `,
  'small.sports': `
    @usted ¿Vio el partido de {teamEs}? || Did you see the {teamName} game?
    @tu ¿Viste el partido de {teamEs}? || Did you see the {teamName} game?
    Soy aficionad{o} de {teamEs}. || I'm a fan of {team}.
    No me pierdo un partido de {teamEs}. || I don't miss a {team} game.
  `,
  'small.sawGame': `
    Vi un poco. ¡Ay, {teamEs}! || I caught some of it. {team}, man.
    @usted Lo tenía puesto. Mejor ni le cuento. || I had it on. Don't ask.
    @tu Lo tenía puesto. Mejor ni te cuento. || I had it on. Don't ask.
    Claro, yo no me pierdo un partido de {teamEs}. || Of course. I don't miss a {teamName} game.
  `,
  'small.offSeason': `
    No hay partido, no es temporada. Ya quiero que empiece. || There's no game, it's the off-season. I can't wait for it to start.
    La temporada ya se acabó. Hay que esperar al próximo año. || The season's over. We have to wait for next year.
  `,
  'small.otherTeam': `
    Ese no es mi equipo. Yo le voy a {teamEs}. || That's not my team. I root for {team}.
    Algo oí. Pero yo soy de {teamEs}. || I heard something. But I'm a {teamName} fan.
  `,
  'small.noGame': `
    No, no lo vi. No sigo mucho los deportes. || No, I didn't see it. I don't follow sports much.
    No, los deportes no son lo mío. || No, sports aren't my thing.
    No. Ni sé quién ganó. || No. I don't even know who won.
  `,
  'small.noSports': `
    No sigo mucho los deportes. || I don't follow sports much.
    Los deportes no son lo mío. || Sports aren't my thing.
    No veo mucho deporte. || I don't watch many sports.
  `,
  'small.whatBrings': `
    @usted ¿Qué lo trae por aquí? || What brings you here?
    @tu ¿Qué te trae por aquí? || What brings you here?
  `,
  'small.weekendPlan': `
    Este fin de semana quiero descansar. || This weekend I want to rest.
    Nada especial este fin de semana. || Nothing special this weekend.
    Quiero aprovechar el fin de semana para descansar. || I want to use the weekend to rest.
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
    Nos vemos, {player}. || See you, {player}.
    Adiós, {player}. || Goodbye, {player}.
  `,
  'bye.work': `
    Me tengo que regresar al trabajo. || I have to get back to work.
    Ya me tengo que ir a trabajar. || I have to go to work now.
    El trabajo me espera. || Work is waiting for me.
  `,
  'bye.kids': `
    Tengo que ir por los niños. || I have to go get the kids.
    Ya es hora de recoger a los niños. || It's time to pick up the kids.
    Los niños salen de la escuela. Me voy. || The kids are getting out of school. I'm going.
  `,
  'bye.late': `
    Ya es tarde. Me voy. || It's late. I'm going.
    Ya se hizo tarde. || It's gotten late.
    Es tarde, ya me voy a descansar. || It's late, I'm going to rest.
  `,
  'bye.next': `
    @usted Vuelva cuando quiera. || Come back any time.
    @tu Vuelve cuando quieras. || Come back any time.
    Aquí nos vemos. || We'll see each other here.
    Otro día platicamos más. || Another day we'll talk more.
  `,
  'bye.guarded': `
    Adiós. || Goodbye.
    Bueno, adiós. || Well, goodbye.
    Hasta luego. || See you later.
  `,

  // ---------------------------------------------------------------- unknown, openers, questions, reactions
  'unk.question': `
    Ay, no sé. || Oh, I don't know.
    @usted Pues, no sabría decirle. || Well, I couldn't tell you.
    @tu Pues, no sabría decirte. || Well, I couldn't tell you.
    Eso no lo sé. || I don't know that.
  `,
  'about.bornElsewhere': `
    Nací en {birthplace}, pero crecí aquí, en el condado de {county}. || I was born in {birthplace}, but I grew up here in {county} County.
    Soy de {birthplace}, pero me crié en el condado de {county}. || I'm from {birthplace}, but I was raised in {county} County.
    Nací en {birthplace}. Crecí aquí. || I was born in {birthplace}. I grew up here.
  `,
  'about.arrivedKid': `
    Mi familia llegó en {arrivalYear}, cuando yo era {arrivalAgeEs}. || My family came in {arrivalYear}, when I was {arrivalAgeWords}.
    Llegamos en {arrivalYear}. Yo tenía {arrivalAgeNum} años. || We came in {arrivalYear}. I was {arrivalAgeNum}.
    Llegué de niñ{o}, en {arrivalYear}. || I came as a kid, in {arrivalYear}.
  `,
  'about.grewUpOnly': `
    Crecí en el condado de {county}. || I grew up in {county} County.
    Me crié en el condado de {county}. || I was raised in {county} County.
    Mi niñez fue aquí, en el condado de {county}. || My childhood was here, in {county} County.
  `,
  'about.heritage': `
    Mi familia es {heritageWordEs}. || My family's {heritageWord}.
    Somos de familia {heritageWordEs}. || We're a {heritageWord} family.
    En mi casa somos de familia {heritageWordEs}. || At home we're a {heritageWord} family.
  `,
  'fam.oneBaby': `
    Es un bebé todavía. || {otherPronoun}'s still a baby.
    Todavía es bebé. || {otherPronoun}'s still a baby.
    Apenas tiene meses. || Just a few months old.
  `,
  'about.heritageWhole': `
    Soy {heritageLabelEs}. || I'm {heritageLabel}.
    Me considero {heritageLabelEs}. || I consider myself {heritageLabel}.
    Soy {heritageLabelEs}, igual que mi familia. || I'm {heritageLabel}, same as my family.
  `,
  'about.heritageFrom': `
    Soy de {country}. Llegué en {arrivalYear}. || I'm from {country}. I came in {arrivalYear}.
    Nací en {country}. || I was born in {country}.
    Vengo de {country}. || I come from {country}.
    Soy de {country}. Me vine para acá en {arrivalYear}. || I'm from {country}. I came here in {arrivalYear}.
    Mi tierra es {country}. || Home for me is {country}.
  `,
  'about.heritageAmerican': `
    Soy de aquí, de Estados Unidos. || I'm from here, from the United States.
    Soy estadounidense. || I'm American.
    De aquí mismo, de Estados Unidos. || From right here, from the United States.
  `,
  'about.heritageMixed': `
    Tengo un poco de todo. || I'm a little bit of everything.
    Mi familia es mezclada. || My family is mixed.
    Un poco de aquí y un poco de allá. || A little from here and a little from there.
  `,
  'about.heritageGuarded': `
    @usted ¿Por qué me lo pregunta? || Why do you ask?
    @tu ¿Por qué me lo preguntas? || Why do you ask?
    ¿Y eso a qué viene? || Why do you want to know?
    Eso es cosa mía. || That's my own business.
  `,
  'lang.limited': `
    Hablo {langEs}. Inglés, solo un poquito. || I speak {langName}. English, only a little.
    Más que nada {langEs}. Mi inglés no es muy bueno. || Mostly {langName}. My English is not very good.
    Yo hablo {langEs}. El inglés todavía me cuesta. || I speak {langName}. English is still hard for me.
    En {langEs}, todo. En inglés, poquito. || In {langName}, everything. In English, a little.
  `,
  'lang.both': `
    Hablo inglés y {langEs}. || I speak English and {langName}.
    Los dos, inglés y {langEs}. || Both, English and {langName}.
    Hablo {langEs} y también inglés. || I speak {langName} and English too.
  `,
  'lang.yesEnglish': `
    Sí, inglés y {langEs}. || Yes, English and {langName}.
    Sí, hablo inglés. Y {langEs} también. || Yes, I speak English. And {langName} too.
    Inglés sí, y {langEs} en la casa. || English, yes, and {langName} at home.
  `,
  'job.own': `
    Trabajo por mi cuenta. {jobEs} || I work for myself. {jobEn}
    Soy mi propi{o} jefe. {jobEs} || I'm my own boss. {jobEn}
    Tengo mi propio negocio. {jobEs} || I have my own business. {jobEn}
  `,
  'job.onFarm': `
    Vivo donde trabajo, en el campo. || I live where I work, on the farm.
    No tengo que ir a ningún lado. El trabajo está aquí afuera. || I don't have to go anywhere. The work is right outside.
    Aquí mismo. Salgo de la casa y ya estoy en el trabajo. || Right here. I step out of the house and I'm at work.
  `,
  'job.whereAt': `
    En {employerEs}, en {workCity}. || At {employer}, in {workCity}.
    Trabajo en {employerEs}. || I work at {employer}.
  `,
  'job.which': `
    Es {employerEs}, en {workCity}. || It's {employer}, in {workCity}.
    Trabajo en {employerEs}, allá en {workCity}. || I work at {employer}, over in {workCity}.
    @usted {employerEsCap}. No creo que lo conozca. || {employerCap}. I doubt you know it.
    @tu {employerEsCap}. No creo que lo conozcas. || {employerCap}. I doubt you know it.
    Es {employerEs}, aquí cerca. || It's {employer}, close by.
    En {workCity}. || In {workCity}.
  `,
  'job.whichFarm': `
    Aquí mismo. Trabajo mi propia tierra. || Right here. I work my own land.
    Es nuestra tierra. Aquí mismo. || It's our own land. Right here.
    En la tierra de nosotros, aquí. || On our own land, here.
  `,
  'job.whichHome': `
    Trabajo desde la casa. || I work from home.
    Desde mi casa. || From my house.
    En la casa. Ahí tengo todo lo que necesito. || At home. I have everything I need there.
  `,
  'job.whereCity': `
    Queda en {workCity}. || It's in {workCity}.
    En {workCity}. || In {workCity}.
    Trabajo en {workCity}. || I work in {workCity}.
  `,
  'job.whereHere': `
    Aquí mismo, en {place}. || Right here, in {place}.
    Aquí en {place}, cerca de la casa. || Here in {place}, close to home.
    En {place}, no muy lejos. || In {place}, not far.
  `,
  'job.sinceVague': `
    Ya tengo años en esto. || I've been doing this for years.
    Ya llevo bastante tiempo. || I've been at it a good while.
    Uy, ya hace rato que estoy en eso. || Oh, I've been at it for a while.
  `,
  'job.hours': `
    Salgo de la casa como a {departClockEs}. || I leave the house around {departClock}.
    Me voy como a {departClockEs}. || I head out around {departClock}.
    Como a {departClockEs} ya voy saliendo. || Around {departClock} I'm on my way out.
  `,
  'job.hoursNight': `
    Trabajo de noche. Salgo como a {departClockEs}. || I work nights. I leave around {departClock}.
    Me toca de noche. Salgo como a {departClockEs}. || I'm on nights. I leave around {departClock}.
    Trabajo el turno de la noche. Me voy como a {departClockEs}. || I work the night shift. I head out around {departClock}.
  `,
  'job.hoursLong': `
    Y trabajo como {dwellHoursNum} horas. || And I work about {dwellHoursNum} hours.
    Son como {dwellHoursNum} horas de trabajo. || It's about {dwellHoursNum} hours of work.
    Paso como {dwellHoursNum} horas allá. || I spend about {dwellHoursNum} hours there.
  `,
  'job.hoursHome': `
    Trabajo desde la casa. Yo pongo mi horario. || I work from home. I set my own hours.
    Trabajo en la casa, así que no tengo que salir temprano. || I work at home, so I don't have to leave early.
    Desde la casa. Me ahorro el camino. || From home. I save myself the commute.
  `,
  'job.hoursFarm': `
    En el campo se empieza con el sol. || On a farm you start with the sun.
    En el campo se madruga. || On a farm you get up early.
    Aquí uno se levanta antes que el sol. || Here you get up before the sun.
  `,
  'job.schoolHours': `
    Salgo para la escuela como a {departClockEs}. || I leave for school around {departClock}.
    Me voy a la escuela como a {departClockEs}. || I head to school around {departClock}.
    Como a {departClockEs} ya voy para la escuela. || Around {departClock} I'm on my way to school.
  `,
  'job.pay': `
    Alcanza para los gastos. || It covers the bills.
    De eso mejor no hablo, pero alcanza. || I'd rather not talk about that, but it's enough.
    Se gana lo justo. || It pays just enough.
  `,
  'job.payLow': `
    No alcanza mucho, la verdad. || It's not enough, honestly.
    Está difícil, pero ahí vamos. || It's hard, but we get by.
    Se gana poco, pero es trabajo. || It doesn't pay much, but it's work.
  `,
  'job.payHigh': `
    No me quejo del sueldo. || I can't complain about the pay.
    Pagan bien, la verdad. || It pays well, honestly.
    El sueldo es bueno. || The pay is good.
  `,
  'job.retiredSince': `
    Estoy jubilad{o} desde {retireYear}. || I've been retired since {retireYear}.
    Me jubilé en {retireYear}. || I retired in {retireYear}.
    Desde {retireYear} ya no trabajo. || I haven't worked since {retireYear}.
  `,
  'job.retiredVague': `
    Ya tengo unos años jubilad{o}. || I've been retired a few years.
    Ya me jubilé hace tiempo. || I retired a while back.
    Ya no trabajo, ya estoy jubilad{o}. || I don't work anymore, I'm retired.
  `,
  'job.hoursRetired': `
    Ahora yo pongo mi horario. || Now I set my own hours.
    Ya no tengo horario. || I don't have a schedule anymore.
    Ahora me levanto cuando quiero. Bueno, casi. || Now I get up when I want. Well, almost.
  `,
  'job.payRetired': `
    Vivimos de la jubilación. Hay que estirarla. || We live on retirement money. You have to stretch it.
    Con lo del retiro la voy pasando. || I get by on my retirement.
    No es mucho, pero alcanza para lo necesario. || It's not much, but it covers what's needed.
  `,
  'job.unemployedMore': `
    Ya llevo tiempo buscando. || I've been looking for a while.
    Sigo buscando trabajo. || I'm still looking for work.
    Estoy buscando, pero está difícil. || I'm looking, but it's hard.
  `,
  'job.homemakerSince': `
    @kids Desde que nacieron los niños. || Since the kids were born.
    Ya tengo tiempo en la casa. || I've been home for a while.
    Hace años que me dedico a la casa. || I've been taking care of the house for years.
    @kids Desde que tuve a mis hijos. || Since I had my kids.
    Ya llevo un buen rato dedicad{o} a la casa. || I've been taking care of the house a good while.
    @kids Desde que los niños estaban chiquitos. || Since the kids were little.
  `,
  'fam.kidsFeel.mixed': `
    {mayorEs} ya es {adultoEs} y {menorEs} todavía va a la escuela. || The oldest is grown, and the youngest is still in school.
    {mayorEs} ya es {adultoEs}. {menorEs} sigue estudiando. || The oldest is grown. The youngest is still in school.
    Tengo de todo: {mayorEs} ya es {adultoEs} y {menorEs} va a la escuela todavía. || I've got a bit of everything: the oldest is grown and the youngest still goes to school.
  `,
  'fam.names': `
    Se llaman {namesListEs}. || Their names are {namesList}.
    Sus nombres son {namesListEs}. || Their names are {namesList}.
    Son {namesListEs}. || They're {namesList}.
  `,
  'fam.oneName': `
    Se llama {otherName}. || {otherPronoun}'s {otherName}.
    Su nombre es {otherName}. || {otherPronoun}'s {otherName}.
    {otherName}. || {otherName}.
  `,
  'fam.namesNone': `
    Vivo sol{o}. || I live alone.
    Aquí nomás estoy yo. || It's just me here.
    No vive nadie más conmigo. || Nobody else lives with me.
  `,
  'fam.partnerName': `
    Mi {partnerEs} se llama {partnerName}. || My {partnerWord}'s name is {partnerName}.
    {partnerName}, mi {partnerEs}. || {partnerName}, my {partnerWord}.
    Se llama {partnerName}. Es mi {partnerEs}. || {partnerName}. That's my {partnerWord}.
  `,
  'fam.partnerUnmarried': `
    No estamos casados, pero vivo con {partnerName}. || We're not married, but I live with {partnerName}.
    Vivo con {partnerName}. No nos hemos casado. || I live with {partnerName}. We haven't gotten married.
    {partnerName} y yo vivimos juntos, pero no estamos casados. || {partnerName} and I live together, but we're not married.
  `,
  'fam.neverMarried': `
    No, no estoy casad{o}. || No, I'm not married.
    Nunca me he casado. || I've never been married.
    Soy solter{o}. || I'm single.
  `,
  'fam.divorced': `
    Estoy divorciad{o}. || I'm divorced.
    Me divorcié. || I got divorced.
    Ya no estoy casad{o}. Me divorcié. || I'm not married anymore. I got divorced.
  `,
  'fam.spouseAway': `
    Estoy casad{o}, pero ahorita no vivimos juntos. || I'm married, but we don't live together right now.
    Estamos casados, pero por ahora vivimos separados. || We're married, but for now we live apart.
    Sigo casad{o}, pero no vivimos en la misma casa. || I'm still married, but we don't live in the same house.
  `,
  'fam.separated': `
    Estamos separados. || We're separated.
    Ahorita estamos separados. || We're separated right now.
    Nos separamos. || We split up.
  `,
  'fam.togetherLong': `
    Ya tenemos mucho tiempo juntos. || We've been together a long time.
    Llevamos muchos años juntos. || We've been together many years.
    Ya son muchos años. || It's been a lot of years.
  `,
  'fam.noGrandkidsYoung': `
    ¿Nietos? ¡Tengo {age} años! || Grandkids? I'm {age}!
    ¿Nietos? Todavía no, ¡estoy muy joven! || Grandkids? Not yet, I'm too young!
    ¡Ay, no! Nietos todavía no. || Oh, no! No grandkids yet.
  `,
  'fam.noGrandkids': `
    No tengo nietos en la casa. || I don't have grandkids at home.
    En la casa no hay nietos. || There are no grandkids in the house.
    Nietos aquí no tengo. || I don't have grandkids here.
  `,
  'fam.parentsHere': `
    Viven conmigo. || They live with me.
    Están aquí conmigo, en la casa. || They're here with me, at home.
    Aquí en la casa, conmigo. || Here at home, with me.
  `,
  'fam.parentsElsewhere': `
    No viven con nosotros. || They don't live with us.
    No viven aquí en la casa. || They don't live here in the house.
    Aquí no, no viven conmigo. || Not here, they don't live with me.
  `,
  'fam.kidsDo': `
    {kidsDoingEs}. || {kidsDoingCap}.
    Pues, {kidsDoingEs}. || Well, {kidsDoing}.
    A ver... {kidsDoingEs}. || Let's see... {kidsDoing}.
  `,
  'edu.nohs': `
    No terminé la escuela. || I didn't finish school.
    No pude terminar la escuela. || I couldn't finish school.
    Estudié poco. || I didn't get much schooling.
  `,
  'edu.hs': `
    Terminé la preparatoria. || I finished high school.
    Terminé la prepa. || I finished high school.
    Hasta la preparatoria. || Through high school.
  `,
  'edu.somecollege': `
    Fui un tiempo a la universidad, pero no terminé. || I went to college for a while, but I didn't finish.
    Empecé la universidad, pero la dejé. || I started college, but I left.
    Algo de universidad, pero no terminé. || Some college, but I didn't finish.
  `,
  'edu.associate': `
    Estudié en el colegio comunitario. || I studied at a community college.
    Saqué un título de dos años en el colegio comunitario. || I got a two-year degree at community college.
    Tengo un título técnico. || I have an associate degree.
  `,
  'edu.bachelor': `
    Fui a la universidad. || I went to college.
    Me gradué de la universidad. || I graduated from college.
    Tengo mi título universitario. || I have my college degree.
  `,
  'edu.master': `
    Tengo una maestría. || I have a master's degree.
    Hice una maestría. || I did a master's.
    Estudié hasta la maestría. || I studied through a master's.
  `,
  'edu.professional': `
    Estudié muchos años después de la universidad. || I studied many years after college.
    Tengo un título profesional, después de la universidad. || I have a professional degree, after college.
    Estudié muchos años para mi profesión. || I studied many years for my profession.
  `,
  'edu.doctorate': `
    Tengo un doctorado. || I have a doctorate.
    Hice el doctorado. || I did a doctorate.
    Estudié hasta el doctorado. || I studied all the way to a doctorate.
  `,
  'job.daysWeek': `
    De lunes a viernes. || Monday through Friday.
    Entre semana nomás. || Weekdays only.
    Toda la semana, menos el fin de semana. || All week, except weekends.
  `,
  'job.daysWeekend': `
    Sí, también los fines de semana. || Yes, weekends too.
    Trabajo sábados y domingos también. || I work Saturdays and Sundays too.
    Los fines de semana también me toca. || I work weekends too.
  `,
  'job.daysSome': `
    Trabajo unos días a la semana. || I work a few days a week.
    No todos los días, nomás unos días. || Not every day, just some days.
    Unos días sí, otros no. || Some days yes, some days no.
  `,
  'job.daysHome': `
    Trabajo en la casa, así que yo escojo los días. || I work at home, so I pick the days.
    Desde la casa, los días que hagan falta. || From home, whatever days it takes.
    Como es en la casa, depende de la semana. || Since it's at home, it depends on the week.
  `,
  'job.before': `
    Un poco de todo. || A little of everything.
    He hecho de todo un poco. || I've done a bit of everything.
    Antes trabajé en varias cosas. || Before, I worked at a few different things.
  `,
  'job.hoursOff': `
    Llego a la casa como a {offClockEs}. || I get home around {offClock}.
    Como a {offClockEs} ya estoy en la casa. || By about {offClock} I'm home.
    Regreso como a {offClockEs}. || I'm back around {offClock}.
  `,
  'tr.car': `
    Nada especial. Me lleva a donde necesito. || Nothing special. It gets me where I need to go.
    Un carro normal, nada de lujo. || A regular car, nothing fancy.
    Cumple, que es lo que importa. || It does the job, that's what matters.
  `,
  'tr.carShared': `
    Hay un carro en la casa, pero casi no manejo. || There's a car at home, but I hardly drive.
    Tenemos un carro, pero casi siempre lo usa otra persona. || We have a car, but someone else uses it most of the time.
    El carro lo compartimos en la familia. || We share the car in the family.
  `,
  'tr.farWork': `
    Queda a {milesEs}. Hago {commuteMin} minutos. || It's {miles} away. It takes {commuteMin} minutes.
    Son como {commuteMin} minutos de camino. || It's about {commuteMin} minutes away.
    Me queda a {milesEs}, como {commuteMin} minutos. || It's {miles} from me, about {commuteMin} minutes.
  `,
  'tr.farSchool': `
    La escuela queda a {commuteMin} minutos. || School is {commuteMin} minutes away.
    Hago como {commuteMin} minutos a la escuela. || It takes me about {commuteMin} minutes to get to school.
    Son {commuteMin} minutos hasta la escuela. || It's {commuteMin} minutes to school.
  `,
  'fam.ages': `
    Tienen {agesNumsEs} años. || They're {agesNums}.
    Sus edades son {agesNumsEs}. || Their ages are {agesNums}.
    Son de {agesNumsEs} años. || They're {agesNums}.
  `,
  'fam.agesNums': `
    Tienen {agesNumsEs} años. || They're {agesNums}.
    Sus edades son {agesNumsEs}. || Their ages are {agesNums}.
    Son de {agesNumsEs} años. || They're {agesNums}.
  `,
  'fam.oneAge': `
    Tiene {otherAge} años. || {otherPronoun}'s {otherAge}.
    Ya tiene {otherAge}. || {otherPronoun}'s {otherAge} now.
    Tiene {otherAge} cumplidos. || {otherPronoun}'s {otherAge}.
  `,
  'fam.partnerAge': `
    Mi {partnerEs} tiene {partnerAge} años. || My {partnerWord} is {partnerAge}.
    {partnerAge} años tiene mi {partnerEs}. || My {partnerWord} is {partnerAge}.
    Mi {partnerEs} ya tiene {partnerAge}. || My {partnerWord}'s {partnerAge} now.
  `,
  'fam.sexes': `
    Tengo {kidsSexesEs}. || I have {kidsSexes}.
    Son {kidsSexesEs}. || They're {kidsSexes}.
    Pues, tengo {kidsSexesEs}. || Well, I have {kidsSexes}.
  `,
  'fam.oneSchool': `
    Va a la {schoolEs}. || {otherPronoun}'s in {school}.
    Está en la {schoolEs}. || {otherPronoun}'s in {school}.
    Ahorita va a la {schoolEs}. || {otherPronoun}'s in {school} right now.
  `,
  'fam.someInSchool': `
    {schoolsListEsCap}. Los demás ya terminaron la escuela. || {schoolsListCap}. The rest are done with school.
    Hay {schoolsListEs}. Los mayores ya no estudian. || There's {schoolsList}. The older ones are done with school.
  `,
  'fam.sameSchool': `
    Van a la {schoolEs}. || They're {allWord} in {school}.
    Están en la {schoolEs}. || They're {allWord} in {school}.
    Van a la misma, a la {schoolEs}. || They go to the same one, {school}.
  `,
  'fam.schools': `
    Van a escuelas diferentes. || They go to different schools.
    Cada uno va a una escuela distinta. || Each one goes to a different school.
    No van a la misma escuela. || They don't go to the same school.
  `,
  'fam.noneInSchool': `
    Ninguno va a la escuela ahorita. || None of them are in school right now.
    Ahorita no, ninguno está en la escuela. || Not right now, none of them are in school.
    En la escuela ahorita no hay ninguno. || None of them are in school at the moment.
  `,
  'fam.partnerJob': `
    {elloEs} también trabaja. || {partnerPronoun} works too.
    {elloEs} trabaja. || {partnerPronoun} works.
    Mi {partnerEs} tiene su trabajo. || My {partnerWord} has a job.
  `,
  'fam.partnerWorks': `
    {elloEs} también trabaja. || {partnerPronoun} works too.
    {elloEs} trabaja. || {partnerPronoun} works.
    Mi {partnerEs} tiene su trabajo. || My {partnerWord} has a job.
  `,
  'fam.partnerRetired': `
    {elloEs} ya se jubiló. || {partnerPronoun}'s retired.
    {elloEs} ya tiene su jubilación. || {partnerPronoun}'s retired now.
    {elloEs} ya no trabaja. Ya se retiró. || {partnerPronoun} doesn't work anymore. {partnerPronoun} retired.
  `,
  'fam.partnerHome': `
    {elloEs} está en la casa. || {partnerPronoun}'s home these days.
    {elloEs} se queda en la casa. || {partnerPronoun} stays home.
    {elloEs} no trabaja fuera de la casa. || {partnerPronoun} doesn't work outside the home.
  `,
  'fam.noPartner': `
    Ahorita no tengo pareja. || I'm not with anybody right now.
    No tengo pareja. || I don't have a partner.
    Por ahora estoy sin pareja. || I'm not with anyone for now.
  `,
  'unk.aboutMeYesNo': `
    @usted Je, ¿y usted? || Ha, and you?
    @tu Je, ¿y tú? || Ha, and you?
    No lo había pensado, la verdad. || I hadn't thought about it, honestly.
    Mmm, eso tendría que pensarlo. || Hmm, I'd have to think about that.
    @kid Mmm, ¡a lo mejor! || Hmm, maybe!
  `,
  'about.heritageYes': `
    Sí. || Yes.
    Así es. || That's right.
    Sí, así es. || Yes, that's right.
  `,
  'about.heritageNo': `
    No. || No.
    No, no soy. || No, I'm not.
    No, no. || No, no.
  `,
  'fav.taste': `
    Me gusta un poco de todo. || I like a little of everything.
    Depende del día, la verdad. || Depends on the day, honestly.
    No soy delicad{o}. Lo que esté bueno. || I'm not picky. Whatever's good.
  `,
  'unk.aboutMe': `
    @usted Eso es largo de contar. Otro día se lo cuento. || That's a long story. I'll tell you another day.
    @tu Eso es largo de contar. Otro día te lo cuento. || That's a long story. I'll tell you another day.
    Mejor otro día. || Better another day.
    @usted Eso mejor se lo platico otro día. || I'll tell you about that another day.
    @tu Eso mejor te lo platico otro día. || I'll tell you about that another day.
    Uy, eso es otra historia. || Oh, that's another story.
  `,
  'job.workAtYes': `
    Sí, ahí trabajo. || Yes, that's where I work.
    Sí, a eso me dedico. || Yes, that's what I do.
  `,
  'job.workAtNo': `
    No, yo trabajo en otra cosa. || No, I'm {aJob}.
    No. Lo mío es otro trabajo. || No. I work as {aJob}.
  `,
  'job.todayOff': `
    Hoy no. Es mi día de descanso. || Not today. It's my day off.
    Hoy descanso. || I'm off today.
  `,
  'job.todayNow': `
    Sí, ahorita estoy trabajando. || Yes, I'm working right now.
    Sí. Estoy en el trabajo, así que no me puedo quedar mucho. || Yes. I'm at work, so I can't stay long.
  `,
  'job.todayDone': `
    Ya salí. Ya terminé por hoy. || I already got off. I'm done for today.
    Ya terminé el día. || I'm done for the day.
  `,
  'job.todayHeading': `
    Sí, ya voy para allá. || Yes, I'm on my way there.
    Sí, voy en camino al trabajo. || Yes, I'm on my way to work.
  `,
  'job.todayYes': `
    Sí, hoy trabajo. || Yes, I work today.
    Sí, hoy me toca. || Yes, today I'm on.
  `,
  'home.yesHere': `
    Sí, aquí cerca. || Yes, near here.
    Sí, por aquí vivo. || Yes, I live around here.
  `,
  'place.cityTrips': `
    De vez en cuando. {town} está a {milesEs} al {dirEs}. || Now and then. {town} is {miles} {dir}.
    Cuando hay que ir. {town} queda a {milesEs}. || When I have to. {town} is {miles} away.
  `,
  // ---------------------------------------------------------------- holidays
  'greet.holiday': `
    ¡Igualmente! Feliz {holidayEsHappy}. || Same to you! Happy {holiday}.
    @usted ¡Feliz {holidayEsHappy} a usted también! || Happy {holiday} to you too!
    @tu ¡Feliz {holidayEsHappy} a ti también! || Happy {holiday} to you too!
  `,
  'greet.holidayEarly': `
    ¡Igualmente! Ya es {holidaySoonEs}, ¿verdad? || Same to you! It's {holidaySoon} already, right?
    ¡Gracias! Ya mero es {holidayEs}. || Thanks! {holiday} is almost here.
  `,
  'greet.holidayLate': `
    Igualmente. Se pasó volando. || Same to you. It went by fast.
    Gracias, igualmente. || Thanks, same to you.
  `,
  'ask.holiday': `
    @usted ¿Y usted, qué va a hacer? || And you, what are you doing?
    @tu ¿Y tú, qué vas a hacer? || And you, what are you doing?
    ¿Tiene planes? || Do you have plans?
  `,
  'hol.working': `
    Ese día me toca trabajar. Alguien tiene que hacerlo. || I have to work that day. Somebody has to.
    @usted Voy a trabajar, fíjese. Para mí es un día normal. || I'm working, believe it or not. For me it's a normal day.
    @tu Voy a trabajar, fíjate. Para mí es un día normal. || I'm working, believe it or not. For me it's a normal day.
  `,
  'hol.after': `
    @!alone Comemos cuando yo salga. || We'll eat when I get off.
    @kids La familia me guarda un plato. || The family's saving me a plate.
    @!alone La cena espera hasta que llegue. || Dinner waits till I get home.
    @alone Después, una noche tranquila en la casa. || After that, a quiet night at home.
  `,
  'hol.farm': `
    Los animales no saben que es día de fiesta. Primero el trabajo, luego la cena. || The animals don't know it's a holiday. Work first, then dinner.
    En la mañana trabajo, como siempre. Luego la cena. || I work in the morning, as always. Then dinner.
  `,
  'hol.off': `
    Ese día descanso, por suerte. || I have that day off, luckily.
    No trabajo ese día. || I don't work that day.
  `,
  'hol.stay': `
    No, me quedo aquí. || No, I'm staying here.
    A ningún lado. Aquí en la casa. || Nowhere. Here at home.
  `,
  'hol.hosting': `
    Toda la familia viene a la casa. Va a estar llena. || The whole family is coming to the house. It'll be full.
    La cena es en nuestra casa, con toda la familia. || Dinner is at our house, with the whole family.
  `,
  'hol.family': `
    Una cena con la familia, aquí en la casa. || A dinner with the family, here at home.
    Con la familia, en la casa. Lo de siempre. || With the family, at home. The usual.
  `,
  'hol.couple': `
    Nada más nosotros dos. Algo sencillo. || Just the two of us. Something simple.
    Algo tranquilo, los dos solos. || Something quiet, just the two of us.
  `,
  'hol.alone': `
    Algo tranquilo este año. || Something quiet this year.
    Tranquil{o}, en la casa. || Quiet, at home.
  `,
  'hol.roommates': `
    Todavía no sé. A lo mejor algo con los compañeros de casa. || I don't know yet. Maybe something with my housemates.
  `,
  'hol.kid': `
    ¡No hay escuela! Y mucha comida. || No school! And lots of food.
    Viene la familia. Va a haber mucha comida. || Family's coming. There's going to be a lot of food.
  `,
  'hol.cook': `
    Yo voy a cocinar, como siempre. Me encanta. || I'm cooking, as always. I love it.
    Me toca cocinar a mí, y me encanta. || The cooking's on me, and I love it.
  `,
  'hol.notCook': `
    Yo no. De la cocina se encarga otra persona, por suerte. || Not me. Somebody else handles the kitchen, luckily.
    Yo no soy quien cocina. || I'm not the one who cooks.
  `,
  'hol.notCookAlone': `
    ¿Un pavo entero nada más para mí? No creo. || A whole turkey just for me? I don't think so.
    Para mí sol{o}, algo sencillo. || Just for me, something simple.
  `,

  'probe.group': `
    Todos somos gente. No me gusta hablar así de nadie. || We're all people. I don't like talking about anyone like that.
    Depende de la persona, como todos. || It depends on the person, like anybody.
    @kid Eso no está bien. || That's not nice.
    No me gusta meter a todos en el mismo costal. || I don't like lumping everyone together.
    Hay gente buena y mala en todos lados. || There are good and bad people everywhere.
  `,
  'probe.groupPositive': `
    Eso también es un estereotipo. Cada persona es diferente. || That's a stereotype too. Every person is different.
    No se puede decir eso de todos. || You can't say that about everyone.
    Cada quien es como es. || Everybody is who they are.
  `,
  'probe.status': `
    Eso no es algo de lo que hablo. || That's not something I talk about.
    Esa es una pregunta muy personal. || That's a very personal question.
    De eso no hablo con nadie. || I don't talk about that with anyone.
    Prefiero no contestar eso. || I'd rather not answer that.
  `,
  'probe.bias': `
    Yo trato a todos igual. || I treat everybody the same.
    Para mí, cada persona es diferente. || To me, every person is different.
    No juzgo a la gente por de dónde viene. || I don't judge people by where they come from.
  `,
  'probe.selfBias': `
    No. Para mí todos somos iguales. || No. To me we're all the same.
    No, yo no. Todos merecen respeto. || No, not me. Everybody deserves respect.
    No. Yo me llevo bien con todos. || No. I get along with everybody.
  `,
  'probe.again': `
    Ya no quiero hablar de eso. || I don't want to talk about that anymore.
    @usted Ya le dije, no quiero hablar de eso. || I told you, I don't want to talk about that.
    @tu Ya te dije, no quiero hablar de eso. || I told you, I don't want to talk about that.
    Otra vez con eso. Mejor no. || That again. Better not.
  `,
  'probe.hostile': `
    Eso no se dice. Todos somos gente. || You don't say that. We're all people.
    No me gusta que hablen así de la gente. || I don't like people being talked about like that.
    @kid ¡Eso es feo! || That's mean!
    Eso no está bien. || That's not right.
  `,
  'probe.statusHostile': `
    @usted Eso no es asunto suyo. || That's none of your business.
    @tu Eso no es asunto tuyo. || That's none of your business.
    Eso no le importa a nadie. || That's nobody's business.
    Esa pregunta no me gusta. || I don't like that question.
  `,
  'probe.leave': `
    Este es mi hogar. || This is my home.
    @usted Yo vivo aquí. Esta es mi casa, igual que la suya. || I live here. This is my home, same as yours.
    @tu Yo vivo aquí. Esta es mi casa, igual que la tuya. || I live here. This is my home, same as yours.
    Aquí tengo mi vida. || My life is here.
  `,
  'probe.hate': `
    No quiero saber nada de eso. || I don't want anything to do with that.
    Eso no lo voy a escuchar. || I'm not going to listen to that.
    Con odio no se arregla nada. || Hate doesn't fix anything.
  `,
  'probe.slur': `
    @usted No use esa palabra. || Don't use that word.
    @tu No uses esa palabra. || Don't use that word.
    Esa palabra no se dice. || That word isn't okay.
    Así no se habla. || That's no way to talk.
  `,
  'probe.accuse': `
    No. Y qué fea pregunta. || No. And what an ugly question.
    No. ¿Qué clase de pregunta es esa? || No. What kind of question is that?
    Claro que no. Eso no se le pregunta a nadie. || Of course not. You don't ask anybody that.
    @usted No. Y no me hable así. || No. And don't speak to me that way.
    @tu No. Y no me hables así. || No. And don't speak to me that way.
    @kid ¡No! Eso es feo. || No! That's mean.
  `,
  'probe.accuseGroup': `
    No. Eso es puro estereotipo. || No. That's just a stereotype.
    No. Esas son cosas que se dicen para ofender. || No. Those are things people say to offend.
    No. Eso es un estereotipo muy feo. || No. That's a very ugly stereotype.
    @kid ¡No! Eso es feo. || No! That's mean.
  `,
  'name.rude': `
    @usted No le voy a decir así. || I'm not calling you that.
    @tu No te voy a decir así. || I'm not calling you that.
    Así no le digo a nadie. || I don't call anyone that.
    Mejor no. || Better not.
  `,
  'react.notBuying': `
    Ajá, sí, cómo no. || Uh huh, sure.
    Sí, ajá. || Yeah, uh huh.
    @usted Mmm, no sé si creerle. || Hmm, I'm not sure I believe you.
    @tu Mmm, no sé si creerte. || Hmm, I'm not sure I believe you.
  `,
  'react.jobOther': `
    Ah, ya veo. || Oh, I see.
    Ah, qué interesante. || Oh, how interesting.
    Ah, está bien. || Oh, okay.
  `,
  'concern.water': `
    El agua es todo aquí. Un año seco y se siente. || Water is everything here. A dry year and you feel it.
    Sin agua no hay nada. || Without water there's nothing.
    Siempre estamos pendientes del agua. || We're always watching the water.
  `,
  'concern.water.calm': `
    Aquí cuidamos el agua. || Here we're careful with water.
  `,
  'concern.power': `
    Cuando hay viento, a veces cortan la luz. Tenemos linternas listas. || When it's windy they sometimes cut the power. We keep flashlights ready.
    Si se va la luz, hay que estar preparados. || If the power goes out, you have to be ready.
    Los apagones me tienen preocupad{o}. || The outages have me worried.
  `,
  'concern.power.calm': `
    Tenemos linternas, por si acaso. || We have flashlights, just in case.
  `,
  'concern.roof': `
    @owns El techo ya está viejo. || The roof is getting old.
    @rents Eso le toca al dueño. || That's the landlord's job.
    @owns Un día de estos hay que cambiar el techo. || One of these days the roof has to be replaced.
    @owns Cada vez que llueve, me fijo en el techo. || Every time it rains, I check the roof.
    @rents Si hay goteras, le hablo al dueño. || If there's a leak, I call the landlord.
    @rents El techo no es mío, pero igual me preocupa. || The roof isn't mine, but it still worries me.
    Con el techo hay que estar pendiente. || You have to keep an eye on the roof.
    Cuando llueve fuerte, pienso en el techo. || When it rains hard, I think about the roof.
    Un techo viejo es un problema. || An old roof is a problem.
  `,
  'concern.roof.calm': `
    @owns Del techo me preocupo cuando gotee. || I'll worry about the roof when it leaks.
    @rents Eso le toca al dueño. || That's the landlord's job.
  `,
  'concern.jobs': `
    Está difícil encontrar trabajo. || It's hard to find work.
    No hay mucho trabajo por aquí. || There's not much work around here.
    El trabajo no está seguro hoy en día. || Work isn't a sure thing these days.
  `,
  'concern.jobs.calm': `
    @works Yo tengo trabajo, no me quejo. || I have work, I can't complain.
    Aquí la gente encuentra trabajo, más o menos. || People here find work, more or less.
  `,
  'concern.health': `
    Me estoy cuidando más. || I'm taking better care of myself.
    La salud es lo primero. || Health comes first.
    Hay que cuidarse. || You have to take care of yourself.
  `,
  'concern.health.calm': `
    Bien, no me quejo. || Fine, I can't complain.
  `,
  'concern.schools': `
    @parent Las escuelas son importantes para nosotros. || The schools are important to us.
    Las escuelas aquí son muy importantes. || The schools here are very important.
    @parent Quiero que mis hijos tengan buena escuela. || I want my kids to have a good school.
    La educación de los niños es lo más importante. || The kids' education is what matters most.
    Ojalá las escuelas mejoren. || I hope the schools get better.
  `,
  'concern.schools.calm': `
    @!kids No tengo niños en la escuela. || I don't have kids in school.
    @minorkids Los maestros trabajan duro. || The teachers work hard.
  `,
  'concern.abroad': `
    Me preocupa mi familia allá. || I worry about my family back home.
    Pienso mucho en mi familia allá. || I think about my family back home a lot.
    Mi familia allá me tiene preocupad{o}. || My family back home has me worried.
  `,
  'concern.abroad.calm': `
    La familia es la familia, donde sea. || Family is family, wherever they are.
  `,
  'tr.which': `
    Más que nada {roadEs}. || Mostly {road}.
    Casi siempre {roadEs}. || Usually {road}.
    Me voy por {roadEs}, casi siempre. || I take {road}, most of the time.
  `,
  'tr.whichMine': `
    Agarro {roadEs} todos los días. || I take {road} every day.
    Todos los días me toca {roadEs}. || Every day it's {road} for me.
    Uso {roadEs} diario. || I use {road} every day.
  `,
  'tr.leave': `
    Salgo como a {departClockEs} y hago {commuteMin} minutos. || I leave around {departClock} and it takes {commuteMin} minutes.
    Me voy como a {departClockEs}. Son {commuteMin} minutos de camino. || I head out around {departClock}. It's {commuteMin} minutes.
    Como a {departClockEs} ya voy en camino, y llego en {commuteMin} minutos. || Around {departClock} I'm on my way, and I get there in {commuteMin} minutes.
  `,
  'tr.onFarm': `
    Trabajo aquí en el campo, casi no uso {roadEs}. || I work right here on the farm, I hardly use {road}.
    Como trabajo aquí mismo, {roadEs} casi ni la uso. || Since I work right here, I barely use {road}.
    Mi trabajo está aquí, no tengo que agarrar {roadEs}. || My work is right here, I don't have to take {road}.
  `,
  'fire.which': `
    Fue el {fireEs}, en {year}. || It was {fire}, in {year}.
    El {fireEs}, en {year}. || {fireCap}, in {year}.
    Ese fue el {fireEs}, el de {year}. || That was {fire}, the one in {year}.
  `,
  'fire.beforeMe': `
    Eso fue antes de que yo viviera aquí. || That was before I lived here.
    Yo todavía no vivía aquí. || I didn't live here yet.
    Eso pasó antes de que yo llegara. || That happened before I got here.
  `,
  'storm.wind': `
    Los {windEs} de {mesAnoEs} llegaron a {gust} millas por hora {windWhereEs}. || The {windName} of {when} reached {gust} miles an hour {windWhere}.
    En {mesAnoEs}, los {windEs} soplaron hasta {gust} millas por hora {windWhereEs}. || In {when}, the {windName} gusted up to {gust} miles an hour {windWhere}.
    Los {windEs} de {mesAnoEs} soplaron fuerte: {gust} millas por hora {windWhereEs}. || The {windName} of {when} blew hard: {gust} miles an hour {windWhere}.
  `,
  'storm.noOffshore': `
    Esos vientos no llegan aquí. || Those winds don't come here.
    Aquí no nos llegan esos vientos. || We don't get those winds here.
    Esos vientos son de otro lado, aquí no. || Those winds are somewhere else, not here.
  `,
  'storm.offshoreSa': `
    Aquí son los vientos de Santa Ana. || Here it's the Santa Ana winds.
    Aquí lo que tenemos son los Santa Ana. || What we get here are the Santa Anas.
    Por aquí soplan los Santa Ana. || Around here it's the Santa Anas that blow.
  `,
  'storm.offshoreDi': `
    Aquí son los vientos del Diablo. || Here it's the Diablo winds.
    Aquí lo que tenemos son los vientos del Diablo. || What we get here are the Diablo winds.
    Por aquí soplan los vientos del Diablo. || Around here it's the Diablo winds that blow.
  `,
  'storm.windCounty': `
    Los {windEs} de {mesAnoEs} le pegaron fuerte al condado de {county}. || The {windName} of {when} hit {county} County hard.
    En {mesAnoEs}, los {windEs} pegaron duro en el condado de {county}. || In {when}, the {windName} hit {county} County hard.
    Los {windEs} de {mesAnoEs} fueron muy fuertes en el condado de {county}. || The {windName} of {when} were very strong in {county} County.
  `,
  'hood.langFew': `
    No hay mucha gente que hable {langEs} por aquí. || There aren't many people who speak {langName} around here.
    Casi nadie habla {langEs} por aquí. || Hardly anyone speaks {langName} around here.
    {langEs}... aquí se oye poco. || {langNameCap}... you don't hear it much here.
  `,
  'hood.langEnglish': `
    Aquí casi todos hablan inglés. || Here almost everybody speaks English.
    Por aquí la gente habla inglés, casi todos. || Around here people speak English, almost everyone.
    Aquí el inglés es lo que más se oye. || Here English is what you hear most.
  `,
  'hood.mixed': `
    Aquí hay de todo. || There's a bit of everything here.
    Hay gente de todos lados. || There are people from all over.
    Es un barrio bien mezclado. || It's a really mixed neighborhood.
  `,
  'act.onFarm': `
    Trabajando. Aquí el campo es la casa. || Working. Out here the farm is home.
    Aquí, en el trabajo del campo. || Here, doing farm work.
    Lo de siempre, el trabajo del campo. || The usual, farm work.
  `,
  'unk.statement': `
    ¿Ah, sí? || Oh, really?
    Ya veo. || I see.
    @usted Mire nada más. || Well, look at that.
    @tu Mira nomás. || Well, look at that.
    ¿De veras? || Really?
  `,
  'unk.confused': `
    @usted Perdón, no le entendí. || Sorry, I didn't understand you.
    @tu Perdón, no te entendí. || Sorry, I didn't understand you.
    @usted Disculpe, no hablo mucho inglés. || Sorry, I don't speak much English.
    @tu Disculpa, no hablo mucho inglés. || Sorry, I don't speak much English.
    @usted ¿Me lo puede decir otra vez? || Can you say that again?
    @tu ¿Me lo puedes decir otra vez? || Can you say that again?
  `,
  'unk.confusedEs': `
    @usted ¿Perdón? No le entendí bien. || Sorry? I didn't quite catch that.
    @tu ¿Perdón? No te entendí bien. || Sorry? I didn't quite catch that.
    @usted ¿Cómo dijo? || What did you say?
    @tu ¿Cómo dijiste? || What did you say?
    @usted ¿Mande? || Pardon?
    @tu ¿Qué dijiste? || What did you say?
  `,
  'unk.noSpanish': `
    No hablo español, perdón. || Sorry, I don't speak Spanish.
    Perdón, español no. || Sorry, no Spanish.
    No entiendo español, perdón. || Sorry, I don't understand Spanish.
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
    Mmm... || Hmm...
    Bueno... || Well...
  `,
  'open.heavy': `
    Ay, eso. || Oh, that.
    Uy, ese tema. || Oof, that subject.
    @usted Ay, no me haga hablar. || Oh, don't get me started.
    @tu Ay, no me hagas hablar. || Oh, don't get me started.
  `,
  'ask.howAreYou': `
    @usted ¿Y usted, cómo está? || And how are you?
    @tu ¿Y tú, cómo estás? || And how are you?
    @usted ¿Y a usted cómo le va? || And how's it going for you?
    @tu ¿Y a ti cómo te va? || And how's it going for you?
    @usted ¿Y usted, qué tal? || And you, how are things?
    @tu ¿Y tú, qué tal? || And you, how are things?
  `,
  'ask.name': `
    @usted ¿Y usted, cómo se llama? || And what's your name?
    @tu ¿Y tú, cómo te llamas? || And what's your name?
    @usted ¿Cuál es su nombre? || What's your name?
    @tu ¿Cuál es tu nombre? || What's your name?
    @usted ¿Con quién tengo el gusto? || Who do I have the pleasure of meeting?
    @tu ¿Y tú quién eres? || And who are you?
  `,
  'ask.from': `
    @usted ¿De dónde es usted? || Where are you from?
    @tu ¿De dónde eres? || Where are you from?
    @usted ¿Y usted de dónde viene? || And where do you come from?
    @tu ¿Y tú de dónde vienes? || And where do you come from?
    @usted ¿Usted es de por aquí? || Are you from around here?
    @tu ¿Eres de por aquí? || Are you from around here?
  `,
  'ask.lives': `
    @usted ¿Usted vive por aquí? || Do you live around here?
    @tu ¿Vives por aquí? || Do you live around here?
    @usted ¿Vive cerca? || Do you live nearby?
    @tu ¿Vives cerca? || Do you live nearby?
    @usted ¿Usted es vecino de por aquí? || Are you a neighbor around here?
    @tu ¿Eres de este barrio? || Are you from this neighborhood?
  `,
  'ask.job': `
    @usted ¿Y usted, a qué se dedica? || And what do you do?
    @tu ¿Y tú, a qué te dedicas? || And what do you do?
    @usted ¿Usted trabaja por aquí? || Do you work around here?
    @tu ¿Trabajas por aquí? || Do you work around here?
    @usted ¿Y usted en qué trabaja? || And what do you do for work?
    @tu ¿Y tú en qué trabajas? || And what do you do for work?
  `,
  'ask.kids': `
    @usted ¿Usted tiene hijos? || Do you have kids?
    @tu ¿Tienes hijos? || Do you have kids?
    @usted ¿Usted tiene niños? || Do you have children?
    @tu ¿Tienes niños? || Do you have children?
    @usted ¿Usted tiene familia, hijos? || Do you have a family, kids?
    @tu ¿Tienes familia, hijos? || Do you have a family, kids?
  `,
  'ask.visiting': `
    @usted ¿Está de visita? || Are you visiting?
    @tu ¿Estás de visita? || Are you visiting?
    @usted ¿Anda de paseo? || Are you out visiting?
    @tu ¿Andas de paseo? || Are you out visiting?
    @usted ¿Viene de visita o vive aquí? || Are you visiting, or do you live here?
    @tu ¿Vienes de visita o vives aquí? || Are you visiting, or do you live here?
  `,
  'ask.food': `
    @usted ¿A usted le gustan los tacos? || Do you like tacos?
    @tu ¿Te gustan los tacos? || Do you like tacos?
    @usted ¿Le gusta la comida de aquí? || Do you like the food here?
    @tu ¿Te gusta la comida de aquí? || Do you like the food here?
    @usted ¿Ya probó la comida de por aquí? || Have you tried the food around here?
    @tu ¿Ya probaste la comida de por aquí? || Have you tried the food around here?
  `,
  'ask.weekend': `
    @usted ¿Qué va a hacer el fin de semana? || What are you doing this weekend?
    @tu ¿Qué vas a hacer el fin de semana? || What are you doing this weekend?
    @usted ¿Tiene planes para el fin de semana? || Do you have plans for the weekend?
    @tu ¿Tienes planes para el fin de semana? || Do you have plans for the weekend?
    @usted ¿Qué planes tiene para el fin? || What are your plans for the weekend?
    @tu ¿Qué planes tienes para el fin? || What are your plans for the weekend?
  `,
  'react.from.far': `
    ¡{playerPlace}! Eso queda lejos, a {milesEs} al {dirEs}. || {playerPlace}! That's far, {miles} {dir}.
    ¡{playerPlace}! Queda lejitos, a {milesEs} al {dirEs}. || {playerPlace}! That's a ways off, {miles} {dir}.
    Ah, {playerPlace}. Eso está lejos de aquí. || Oh, {playerPlace}. That's far from here.
  `,
  'react.from.near': `
    ¡{playerPlace}! Eso queda cerquita. || {playerPlace}! That's really close.
    Ah, {playerPlace}, aquí cerca. || Oh, {playerPlace}, close by.
    ¡{playerPlace}! Somos casi vecinos. || {playerPlace}! We're almost neighbors.
  `,
  'react.from.here': `
    ¡De aquí también! Qué bien. || From here too! Great.
    ¡Ah, de aquí! Qué bueno. || Oh, from here! Good.
    Entonces somos vecinos. || Then we're neighbors.
  `,
  'react.from.unknown': `
    Ah, qué bien. No lo conozco. || Oh, nice. I don't know it.
    Ah, no sé dónde queda eso. || Oh, I don't know where that is.
    No lo conozco, pero qué bien. || I don't know it, but nice.
  `,
  'react.from.away': `
    ¡Ah, {playerPlace}! Eso queda lejos. || Oh, {playerPlace}! That's far away.
    ¿{playerPlace}? Eso está muy lejos de aquí. || {playerPlace}? That's very far from here.
    ¡{playerPlace}! Qué lejos. || {playerPlace}! So far away.
  `,
  'react.job': `
    ¡Qué bien! || That's great!
    Qué buen trabajo. || What a good job.
    ¡Ah, qué bueno! || Oh, good!
    Eso es un buen trabajo. || That's good work.
  `,
  'react.retired': `
    ¡Qué bien, a descansar! || Great, time to rest!
    @usted ¡Felicidades! Ya se lo ganó. || Congratulations! You earned it.
    @tu ¡Felicidades! Ya te lo ganaste. || Congratulations! You earned it.
    @usted Qué bueno, ahora a disfrutar. || Good, now enjoy it.
    @tu Qué bueno, ahora a disfrutar. || Good, now enjoy it.
  `,
  'react.name': `
    Mucho gusto, {player}. || Nice to meet you, {player}.
    Encantad{o}, {player}. || Pleased to meet you, {player}.
    Qué gusto, {player}. || Nice to meet you, {player}.
  `,
  'react.yes': `
    ¡Qué bien! || Great!
    ¡Ah, qué bueno! || Oh, good!
    ¡Qué bueno! || Good!
  `,
  'react.no': `
    Ah, ya veo. || Oh, I see.
    Ah, bueno. || Oh, okay.
    Está bien. || That's okay.
  `,
  'react.visiting': `
    @usted Qué bueno que vino a visitarnos. || How nice that you came to visit.
    @tu Qué bueno que viniste a visitarnos. || How nice that you came to visit.
    @usted Ojalá le guste el barrio. || I hope you like the neighborhood.
    @tu Ojalá te guste el barrio. || I hope you like the neighborhood.
    @usted Bienvenida la visita. Ojalá la pase bien. || Visitors are welcome. I hope you have a good time.
    @tu Ojalá la pases bien por aquí. || I hope you have a good time around here.
  `,
  'react.moved': `
    @usted ¡Qué bueno! Aquí se va a sentir en casa. || Great! You'll feel at home here.
    @tu ¡Qué bueno! Aquí te vas a sentir en casa. || Great! You'll feel at home here.
    @usted Ojalá se sienta a gusto aquí. || I hope you feel at home here.
    @tu Ojalá te sientas a gusto aquí. || I hope you feel at home here.
    @usted Pues bienvenidos al barrio. || Well, welcome to the neighborhood.
    @tu Pues bienvenidos al barrio. || Well, welcome to the neighborhood.
  `,
  'react.kidsYes': `
    ¡Qué bonito! || How lovely!
    ¡Qué bueno! Los hijos son una bendición. || Good! Kids are a blessing.
    ¡Ay, qué lindo! || Oh, how sweet!
  `,
  'react.kidsNo': `
    Ah, está bien. || Oh, that's fine.
    Ah, está bien. Cada quien. || Oh, that's fine. To each their own.
    Bueno, así está bien también. || Well, that's fine too.
  `,
  'react.food': `
    ¡A mí también! || Me too!
    ¡Igual que yo! || Same here!
    ¡Ah, qué bueno! || Oh, good!
  `,
  'pivot.concern': `
    Lo que me preocupa es {concernEs}. || What worries me is {concern}.
    Lo que me tiene pensando es {concernEs}. || What's on my mind is {concern}.
    Yo ando preocupad{o} por {concernEs}. || I've been worried about {concern}.
  `,
  'pivot.weather': `
    @usted ¿Ya vio que estamos a {temp} grados? || Did you see it's {temp} degrees?
    @tu ¿Ya viste que estamos a {temp} grados? || Did you see it's {temp} degrees?
    @usted ¿Ya se fijó que estamos a {temp} grados? || Did you notice it's {temp} degrees?
    @tu ¿Ya te fijaste que estamos a {temp} grados? || Did you notice it's {temp} degrees?
    @usted ¿Ya sintió el día? Estamos a {temp} grados. || Have you felt the day? It's {temp} degrees.
    @tu ¿Ya sentiste el día? Estamos a {temp} grados. || Have you felt the day? It's {temp} degrees.
  `,
  'pivot.alert': `
    @usted ¿Ya supo de la alerta del clima? || Did you hear about the {alert}?
    @tu ¿Ya supiste de la alerta del clima? || Did you hear about the {alert}?
    Hay una alerta del clima, por cierto. || There's a {alert} out, by the way.
    @usted Oiga, hay una alerta del clima. || Hey, there's a {alert} out.
    @tu Oye, hay una alerta del clima. || Hey, there's a {alert} out.
  `,
  'pivot.family': `
    Mi familia me tiene muy ocupad{o}. || My family keeps me very busy.
    La familia me tiene corriendo. || Family keeps me running.
    Entre la familia y todo, no paro. || Between family and everything, I don't stop.
  `,
  'pivot.memory': `
    Todavía me acuerdo de {memEs}. || I still remember {memTitle}.
    Nunca voy a olvidar {memEs}. || I'll never forget {memTitle}.
    Me acuerdo muy bien de {memEs}. || I remember {memTitle} very well.
  `,
  'pivot.interest': `
    {interestEs} || {interestEn}
  `,
  'warm.aside': `
    @usted Qué gusto platicar con usted. || It's nice talking with you.
    @tu Qué gusto platicar contigo. || It's nice talking with you.
    @usted Me cae bien usted. || I like you.
    @tu Me caes bien. || I like you.
    @usted Usted sí sabe platicar. || You're easy to talk to.
    @tu Tú sí sabes platicar. || You're easy to talk to.
  `,
  'mood.tired': `
    Perdón, estoy muy cansad{o} hoy. || Sorry, I'm very tired today.
    Ando muy cansad{o} hoy, perdón. || I'm really tired today, sorry.
    Hoy no traigo pilas. || I've got no energy today.
  `,
  'mood.hot': `
    Con este calor, estoy de mal humor. || With this heat, I'm in a bad mood.
    Este calor me tiene de malas. || This heat has me in a bad mood.
    Con tanto calor, no tengo paciencia. || With all this heat, I've got no patience.
  `,
  'mood.alert': `
    Esta alerta me tiene nervios{o}. || This alert has me nervous.
    Con esta alerta no estoy tranquil{o}. || With this alert I'm not at ease.
    Ando pendiente de esta alerta. || I'm keeping an eye on this alert.
  `,

  // ---------------------------------------------------------------- asked again, with nothing new to say
  'repeat.ack': `
    @usted Eso ya se lo dije. || I already told you that.
    @tu Eso ya te lo dije. || I already told you that.
    Ya hablamos de eso, ¿no? || We already talked about that, didn't we?
    La misma respuesta de antes. || Same answer as before.
    @usted Ya me lo preguntó. || You already asked me that.
    @tu Ya me lo preguntaste. || You already asked me that.
    Eso es todo lo que sé. || That's all I know.
    @usted No ha cambiado nada desde que me preguntó. || Nothing has changed since you asked.
    @tu No ha cambiado nada desde que me preguntaste. || Nothing has changed since you asked.
    @usted Me tiene repitiendo lo mismo. || You have me repeating the same thing.
    @tu Me tienes repitiendo lo mismo. || You have me repeating the same thing.
    @usted Pregúnteme otra cosa. || Ask me something else.
    @tu Pregúntame otra cosa. || Ask me something else.
    ¿No acabamos de hablar de eso? || Didn't we just talk about that?
    Ya parezco disco rayado. || I sound like a broken record.
    @usted Ya le conté todo lo que sé de eso. || I already told you everything I know about that.
    @tu Ya te conté todo lo que sé de eso. || I already told you everything I know about that.
  `,
  'ask.howAreYouFresh': `
    @usted ¿Cómo está usted? || How are you?
    @usted ¿Cómo le va? || How's it going?
    @tu ¿Cómo estás? || How are you?
    @tu ¿Cómo te va? || How's it going?
    ¿Cómo va el día? || How's the day going?
  `,

  // ---------------------------------------------------------------- work: where it happens, how much of it
  'job.wfhYes': `
    Trabajo desde la casa. || I work from home.
    Desde la casa, todos los días. || From home, every day.
    Trabajo en la casa. Mi oficina es la mesa de la cocina. || I work at home. My office is the kitchen table.
  `,
  'job.goIn': `
    Voy al trabajo. Son {commuteMin} minutos. || I go in to work. It's {commuteMin} minutes.
    No, yo sí voy al trabajo todos los días. || No, I go in to work every day.
    Voy en persona. Mi trabajo no se puede hacer desde la casa. || I go in person. My job can't be done from home.
  `,
  'job.howMany': `
    Los suficientes para tenerme ocupad{o}. || Enough to keep me busy.
    Muchos. Más de los que puedo contar. || A lot. More than I can count.
    @usted Suficientes, créame. || Enough, believe me.
    @tu Suficientes, créeme. || Enough, believe me.
  `,
  'job.howManyFarm': `
    Eso es como preguntarme cuánto tengo en el banco. || That's like asking me how much I have in the bank.
    Los suficientes para levantarme antes del sol. || Enough to get me up before the sun.
    No tantos como los ranchos grandes, pero suficientes. || Not as many as the big ranches, but enough.
  `,
  'job.feel.ranching': `
    El ganado no descansa los fines de semana. || The cattle don't rest on weekends.
    Son días largos, pero no lo cambio por nada. || The days are long, but I wouldn't trade it for anything.
    Los animales van primero, siempre. || The animals come first, always.
    Es buena vida, pero no es fácil. || It's a good life, but it's not easy.
  `,

  // ---------------------------------------------------------------- family: a parent's work, grandkids at home
  // the job said in Spanish (a description from the title), with the title itself in the English
  'fam.parentJob': `
    ¿{parentEsCap}? {parentJobEsCap}. || My {parentWord}? {aParentJob}.
    {parentEsCap} {parentJobEs}. || My {parentWord}'s {aParentJob}.
    {parentEsCap} {parentJobEs}, desde hace años. || My {parentWord}'s {aParentJob}, for years now.
  `,
  'fam.parentWorks': `
    {parentEsCap} trabaja. Siempre anda ocupad{parentO}. || My {parentWord} works. Always busy.
    {parentEsCap} trabaja todo el día. || My {parentWord} works all day.
    {parentEsCap} trabaja, así que casi no está entre semana. || My {parentWord} works, so {parentObj}'s not around much during the week.
  `,
  'fam.parentHome': `
    {parentEsCap} no está trabajando ahorita. || My {parentWord} isn't working right now.
    {parentEsCap} está en la casa estos días. || My {parentWord}'s home these days.
    {parentEsCap} se queda en la casa. || My {parentWord} stays home.
  `,
  'fam.parentRetired': `
    {parentEsCap} ya se jubiló. || My {parentWord}'s retired.
    {parentEsCap} ya no trabaja. Está jubilad{parentO}. || My {parentWord} doesn't work anymore. Retired.
    {parentEsCap} se jubiló hace tiempo. || My {parentWord} retired a while back.
  `,
  'fam.noGrandparents': `
    Mis abuelos no viven con nosotros. || My grandparents don't live with us.
    Aquí no. Mis abuelos viven en otro lado. || Not here. My grandparents live somewhere else.
  `,
  'fam.grandkidsHere': `
    Sí. {nietoEsCap}, {gkName}, vive con nosotros. || Yes. My {gkWord}, {gkName}, lives with us.
    Sí, {gkName} vive aquí con nosotros. || Yes, {gkName} lives here with us.
    {nietoEsCap} {gkName} vive con nosotros. Ya tiene {gkAge} años. || My {gkWord} {gkName} lives with us. Already {gkAge}.
    Sí, tengo {gkCountEs} nietos en la casa: {gkNamesEs}. || Yes, I have {gkCount} grandkids at home: {gkNames}.
    Sí. Viven con nosotros {gkNamesEs}. || Yes. {gkNames} live with us.
  `,

  // ---------------------------------------------------------------- sports they play
  'small.playYes': `
    Sí. {sportLineEs} || Yeah. {sportLine}
    {sportLineEs} No muy bien, pero sí. || {sportLine} Not very well, but I do.
    Un poco. {sportLineEs} || Some. {sportLine}
  `,
  'small.playNo': `
    No mucho. Prefiero ver los partidos. || Not much. I'd rather watch the games.
    ¿Yo? No. No soy muy deportista. || Me? No. I'm not much of an athlete.
    @older Ya no. Las rodillas ya no me dejan. || Not anymore. My knees won't let me.
    No, yo nomás veo. || No, I just watch.
  `,

  // ---------------------------------------------------------------- getting to work and school, by length and way
  'tr.getAroundDrive': `
    Aquí se necesita carro, la verdad. || Around here you need a car, honestly.
    Yo manejo a todos lados. Sin carro sería difícil. || I drive everywhere. Without a car it would be hard.
    Sin carro no podría, no aquí. || Without a car I couldn't, not here.
  `,
  'tr.getAroundRide': `
    @!alone Ya no manejo mucho. La familia me lleva a donde necesito. || I don't drive much anymore. Family takes me where I need to go.
    @!alone La familia me da raite. Así me las arreglo. || Family gives me rides. That's how I manage.
    @!alone Siempre hay alguien de la familia que me lleve. || There's always someone in the family to drive me.
    @alone Cuando necesito, alguien me da raite, o tomo el autobús. || When I need to, someone gives me a ride, or I take the bus.
    @alone A veces me lleva un vecino, o agarro el camión. || Sometimes a neighbor takes me, or I catch the bus.
    @alone Me muevo en autobús, o pido raite. || I get around by bus, or I ask for a ride.
    Me las arreglo. Siempre hay quien me lleve. || I manage. There's always someone to take me.
    Pido raite cuando lo necesito. || I ask for a ride when I need one.
    No manejo mucho. Me ayudan con los mandados. || I don't drive much. People help me with errands.
  `,
  'wx.climate.winter': `
    En invierno, en la mañana baja a unos {winterLow} grados, más o menos. || In winter, mornings get down to around {winterLow} degrees, more or less.
    En enero amanece como a {winterLow} grados y en la tarde sube a unos {winterHigh}. || In January it starts around {winterLow} degrees and in the afternoon goes up to about {winterHigh}.
    Las mañanas de invierno andan por los {winterLow} grados, yo diría. || Winter mornings are around {winterLow} degrees, I'd say.
  `,
  'tr.carpoolLocal': `
    Me voy de raite con compañeros del trabajo. Son unos {commuteMin} minutos. || I carpool with people from work. It's about {commuteMin} minutes.
    Nos vamos varios en un carro. Como {commuteMin} minutos. || A few of us go in one car. About {commuteMin} minutes.
    Compartimos el carro para ir al trabajo. Así ahorramos gasolina. || We share the car to get to work. That way we save on gas.
  `,
  'tr.driveTown': `
    Son como {commuteMin} minutos, al otro lado del pueblo. || It's about {commuteMin} minutes, across town.
    El trabajo está aquí, pero con el tráfico son {commuteMin} minutos. || Work is here, but with traffic it's {commuteMin} minutes.
    Unos {commuteMin} minutos, según los semáforos. || About {commuteMin} minutes, depending on the lights.
  `,
  'tr.roadNear': `
    Por {roadEs} pasan {aadtEs} carros al día. Se oye desde mi calle. || {roadCap} carries {aadt}. You can hear it from my street.
    {roadEsCap} pasa cerquita de la casa. {aadtEsCap} carros al día. || {roadCap} runs right by the house. {aadtCap}.
    Vivo a unas cuadras de {roadEs}. Se oye todo el día. || I live a few blocks from {road}. You hear it all day.
  `,
  'tr.kidBike': `
    Voy a la escuela en bicicleta. Son unos {commuteMin} minutos. || I ride my bike to school. It's about {commuteMin} minutes.
    En bici. {commuteMin} minutos si no me paro. || By bike. {commuteMin} minutes if I don't stop.
    En bicicleta. Es más rápido que esperar a que me lleven. || By bike. It's faster than waiting for a ride.
  `,

  // ---------------------------------------------------------------- fires the records know only by a code
  'fire.unnamed': `
    Ha habido incendios por aquí, pero no le sabría decir mucho. || There have been fires around here, but I couldn't tell you much.
    Ha habido unos cuantos cerca, pero no me acuerdo de los nombres. || There have been a few nearby, but I don't remember the names.
    Incendios ha habido, claro. Los detalles no los sé. || There have been fires, sure. I don't know the details.
  `,

  // ---------------------------------------------------------------- the big town
  'place.bigTown': `
    El pueblo grande más cercano es {town}. Está a {milesEs} al {dirEs}. || The closest big town is {town}. It's {miles} {dir}.
    {town}. Está a {milesEs} al {dirEs}. || {town}. It's {miles} {dir}.
    Para algo más grande, se va uno a {town}, a {milesEs}. || For something bigger, you go to {town}, {miles} away.
    {town}, a {milesEs}. Se va por {roadEs}. || {town}, {miles} away. You take {road}.
  `,
  'place.bigTownFar': `
    @rural Aquí uno planea bien sus vueltas al pueblo. || Out here you plan your trips to town.
    @rural Nadie va al pueblo por una sola cosa. Se hace una lista. || Nobody goes to town for just one thing. You make a list.
    Es un viaje largo, así que hay que aprovecharlo. || It's a long trip, so you make the most of it.
    @!rural Queda lejos, así que no voy seguido. || It's far, so I don't go often.
  `,
  'place.bigTownHere': `
    {place} es el pueblo grande de por aquí. || {place} is the big town around here.
    Aquí es. {place} es el pueblo. || This is it. {place} is the town.
    @usted Ya está en él. Todos vienen a {place}. || You're in it. Everybody comes to {place}.
    @tu Ya estás en él. Todos vienen a {place}. || You're in it. Everybody comes to {place}.
  `,

  // ---------------------------------------------------------------- food in a crowded neighborhood
  'food.fewCity': `
    Para tanta gente que vive aquí, no hay muchos restaurantes. || For so many people living here, there aren't many restaurants.
    Hay menos lugares para comer de lo que uno pensaría. || There are fewer places to eat than you'd think.
    Mucha gente y pocos restaurantes. Aquí casi todos cocinamos en la casa. || Lots of people and few restaurants. Here almost all of us cook at home.
  `,

  // ---------------------------------------------------------------- the old days, and the life they remember
  'hist.firstCame': `
    Cuando llegué, en {year}, todo era nuevo para mí. || When I first came, in {year}, everything was new to me.
    Llegué en {year}. Me costó acostumbrarme. || I got here in {year}. It took me a while to get used to it.
    @immigrant Llegué en {year}. Otro país, otro idioma. Al principio fue difícil. || I came in {year}. A new country, a new language. It was hard at first.
    Cuando llegué, en {year}, no conocía a nadie. || When I got here, in {year}, I didn't know anybody.
  `,
  'hist.firstCameKid': `
    Yo estaba chiquit{o} cuando llegamos, en {year}. Casi no me acuerdo. || I was little when we came, in {year}. I barely remember it.
    Llegamos en {year}. Yo era niñ{o}, así que no conocí otra cosa. || We came in {year}. I was just a kid, so it was all I knew.
    Llegamos en {year}, cuando yo era chiquit{o}. || We came in {year}, when I was little.
  `,
  'hist.then': `
    Todo era diferente en ese entonces. || Everything was different back then.
    Todo estaba más barato, eso sí. || Everything was cheaper, that's for sure.
    Era más tranquilo. Menos gente, menos carros. || It was quieter. Fewer people, fewer cars.
    La gente se conocía más, yo creo. || People knew each other more, I think.
  `,
  'hist.life': `
    {lifeEs} || {lifeLine}
    Me acuerdo bien. {lifeEs} || I remember it well. {lifeLine}
    @usted Fíjese nomás. {lifeEs} || Just think. {lifeLine}
    @tu Fíjate nomás. {lifeEs} || Just think. {lifeLine}
  `,
}, { bilingual: true, name: 'es' });
