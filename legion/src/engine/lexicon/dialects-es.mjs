// Legion · lexicon · Spanish (es) variants of the regional lines (decision 12, exp-66).
//
// In the places where most people speak Spanish at home (East LA, Santa Ana, the Inland Empire, the Coachella and
// Imperial valleys, Salinas, Fresno, Bakersfield, San Diego, the Mission and East Oakland), an NPC answering in
// Spanish should sound as much like their place as one answering in English: the food, the weather, the traffic,
// what they love and what they complain about. One line per row: "tags Spanish || English gloss". The Spanish is
// the everyday California Spanish of people from Mexico and Central America (el freeway, la troca, el fil, la
// pulga, el jale), correct in its own language; the gloss says the same thing in English, with the same {slots}.
//
// The rules of the English banks hold: tags say when and for whom a line is true (lexicon/tags.mjs); businesses are
// generic ("la troca de la esquina"), never brands; nothing claims a statistic, a named event or a date; no line
// speaks to the listener (no tú or usted forms, so it suits a stranger and a friend alike); no faith formulas. Slots
// are only names and numbers that read the same in Spanish ({neighborhood}, {city}, {county}, {temp}): a road's
// English name ("the 405") would not, so roads are named in the line itself, tagged to their counties.

import { esLines } from './text.mjs';

/** Spanish banks by dialect family (DIALECT_FAMILIES keys): {food, traffic, prideLines, complaintLines, weather}. */
export const ES_FAMILIES = {
  la: {
    food: esLines(`
      Los domingos, menudo con la familia. Eso no falla. || Sundays, menudo with the family. That never fails.
      Un elote con todo del elotero de la esquina, y ya estuvo. || A street corn with everything from the corner elote man, and that's that.
      Los tacos de la troquita de aquí a la vuelta son los mejores. || The tacos from the little truck around the corner are the best.
      Pupusas los sábados, con bastante curtido. || Pupusas on Saturdays, with plenty of curtido.
      @wx:heat Con este calor, un raspado de mango con chamoy. || In this heat, a mango shaved ice with chamoy.
      En la pulga de los domingos venden de todo, hasta tamales. || At the Sunday swap meet they sell everything, even tamales.
      @works Unos tacos de canasta en la mañana, antes del jale. || Some basket tacos in the morning, before work.
    `),
    traffic: esLines(`
      @drives Agarré el freeway temprano y aun así llegué tarde. || I got on the freeway early and I was still late.
      @drives Aquí las distancias se miden en minutos, no en millas. || Here distance is measured in minutes, not miles.
      Cae una gota de lluvia y el tráfico se pone imposible. || One drop of rain and traffic gets impossible.
      @drives El freeway a las cinco de la tarde es puro estacionamiento. || The freeway at five in the afternoon is nothing but a parking lot.
      Mejor me voy en el Metro y me ahorro el coraje. || I'd rather take the Metro and save myself the aggravation.
      @drives @county:Los_Angeles La 60 en la mañana, ni pensarlo. || The 60 in the morning, don't even think about it.
    `),
    prideLines: esLines(`
      Aquí en {neighborhood} todos nos conocemos. || Here in {neighborhood} we all know each other.
      Los Ángeles es duro, pero aquí está mi gente. || LA is hard, but my people are here.
      @rooted Llevo toda la vida en este barrio y de aquí no me muevo. || I've lived in this neighborhood my whole life and I'm not going anywhere.
      En esta ciudad se come lo mejor de todos lados. || In this city you eat the best food from everywhere.
    `),
    complaintLines: esLines(`
      @rents La renta sube cada año y el sueldo no. || The rent goes up every year and the pay doesn't.
      @adult Todo está carísimo: la gasolina, la renta, la comida. || Everything is so expensive: gas, rent, food.
      @m6-9 En el verano el aire se pone bien sucio con tanto esmog. || In summer the air gets really dirty with so much smog.
    `),
    weather: {
      fog: esLines(`
        @m5-7 Otra vez nublado en la mañana. Así es por estas fechas. || Overcast in the morning again. That's how it is this time of year.
        @coast @h5-11 Está bien nublado aquí cerca del mar; ya se despejará en la tarde. || It's really overcast here by the ocean; it'll clear up in the afternoon.
      `),
      heat: esLines(`
        Qué calorón. Ni con el aire acondicionado se aguanta. || What a scorcher. Even with the AC you can't stand it.
        Con este calor no dan ganas ni de salir. || In this heat you don't even feel like going out.
      `),
      rain: esLines(`
        Cae una gotita y todo el mundo maneja como si nunca hubiera visto la lluvia. || One little drop and everyone drives like they've never seen rain.
        Con tanta lluvia, ojalá no se deslaven los cerros donde se quemó. || With so much rain, I hope the hills where it burned don't slide.
      `),
      wind: esLines(`
        @offshore Ya empezaron los vientos de Santa Ana. Todo el mundo anda nervioso por los incendios. || The Santa Ana winds have started. Everyone's nervous about fires.
        Hay hojas de palma por toda la calle con este viento. || There are palm fronds all over the street with this wind.
      `),
      cold: esLines(`
        Hace {temp} grados y yo con chamarra y bufanda. || It's {temp} degrees and I'm in a jacket and a scarf.
        Para Los Ángeles, esto ya es frío. || For LA, this counts as cold.
      `),
      smoke: esLines(`
        El cielo está anaranjado por el humo de algún incendio. || The sky is orange from the smoke of some fire.
        @drives Amaneció el carro lleno de ceniza. || The car was covered in ash this morning.
      `),
      snow: esLines(`
        Desde el freeway se ve la nieve en las montañas. || From the freeway you can see the snow on the mountains.
      `),
      clear: esLines(`
        Qué bonito día. Hasta se ven las montañas clarito. || What a beautiful day. You can even see the mountains clearly.
      `),
    },
  },
  oc: {
    food: esLines(`
      Los domingos, tacos al pastor con la familia. || Sundays, al pastor tacos with the family.
      Una torta ahogada de la troca del parque, y ya estuvo. || A drowned torta from the truck by the park, and that's that.
      En la panadería de la esquina el pan dulce sale calientito en la mañana. || At the corner bakery the pan dulce comes out warm in the morning.
    `),
    traffic: esLines(`
      @drives La 5 a cualquier hora está llena. || The 5 is packed at any hour.
      @drives La 91 de regreso a la casa es un castigo. || The 91 on the way home is a punishment.
    `),
    prideLines: esLines(`
      Aquí en {neighborhood} hay comunidad: la gente se ayuda. || Here in {neighborhood} there's community: people help each other.
      @coast El mar está tan cerca que en la tarde se siente la brisa. || The ocean is so close that in the afternoon you feel the breeze.
    `),
    complaintLines: esLines(`
      @rents Aquí la renta se come medio sueldo. || Here the rent eats half your paycheck.
      @adult Las casas están carísimas; ya nadie puede comprar. || Houses are so expensive; nobody can buy anymore.
    `),
    weather: {
      fog: esLines(`
        @m5-7 Nublado toda la mañana, como siempre por estas fechas. || Overcast all morning, like always this time of year.
      `),
      heat: esLines(`
        @inland Qué calor. Aquí tierra adentro no llega la brisa. || So hot. Out here inland the breeze doesn't reach.
      `),
      wind: esLines(`
        @offshore Con los Santa Ana todo está seco y da miedo un incendio. || With the Santa Anas everything's dry and a fire is scary.
      `),
      rain: esLines(`
        Llueve tantito y el freeway se vuelve un desastre. || It rains a little and the freeway turns into a disaster.
      `),
      cold: esLines(`
        Hace {temp} grados; para aquí eso es frío. || It's {temp} degrees; for here that's cold.
      `),
    },
  },
  ie: {
    food: esLines(`
      Las carnitas de los domingos, con tortillas recién hechas. || Sunday carnitas, with fresh-made tortillas.
      Aquí hay más taquerías que semáforos. || There are more taquerias here than traffic lights.
      Birria los fines de semana, con su consomé. || Birria on the weekends, with its broth.
      En la pulga de los domingos se consigue de todo. || At the Sunday swap meet you can find anything.
    `),
    traffic: esLines(`
      @drives @works Si el trabajo está en Los Ángeles, se va media vida en el freeway. || If the job's in LA, half your life goes to the freeway.
      @drives Puro tráiler en el freeway, con tantas bodegas. || Nothing but big rigs on the freeway, with all the warehouses.
      @drives @county:Riverside|San_Bernardino La 60 y la 91 a las seis de la tarde, ni pensarlo. || The 60 and the 91 at six in the evening, forget about it.
      @drives @county:Riverside|San_Bernardino La 15 en la mañana está imposible. || The 15 in the morning is impossible.
    `),
    prideLines: esLines(`
      @adult Aquí todavía se puede comprar una casita, no como en Los Ángeles. || Here you can still buy a little house, not like in LA.
      La gente de aquí es trabajadora y sencilla. || People here are hard-working and down to earth.
      Desde aquí se ven las montañas, y en invierno hasta con nieve. || From here you can see the mountains, and in winter even with snow.
    `),
    complaintLines: esLines(`
      @adult Ya hay bodegas por todos lados; antes eran puros ranchos. || There are warehouses everywhere now; it used to be all ranches.
      El esmog se queda atrapado aquí contra las montañas. || The smog gets trapped here against the mountains.
      @rents La renta ya está casi como en Los Ángeles. || The rent is almost like LA now.
    `),
    weather: {
      fog: esLines(`
        @h5-10 Neblina en la mañana, pero para el mediodía sale el sol. || Fog in the morning, but by noon the sun comes out.
      `),
      heat: esLines(`
        Otro calorón. Aquí el verano no perdona. || Another scorcher. Summer here is merciless.
        El aire acondicionado no descansa ni un día. || The AC doesn't get a single day off.
      `),
      rain: esLines(`
        Con tanta lluvia, ojalá no haya deslaves donde se quemó. || With so much rain, I hope there are no mudslides where it burned.
      `),
      wind: esLines(`
        @offshore Con los Santa Ana se vuelan los botes de basura por toda la calle. || With the Santa Anas the trash cans blow all over the street.
        @offshore Viento seco del desierto: tiempo de incendios. || Dry wind from the desert: fire weather.
      `),
      cold: esLines(`
        En la mañana hace un frío que cala los huesos. || In the morning there's a cold that goes right to the bone.
      `),
      smoke: esLines(`
        Se ve el humo del incendio detrás del cerro. || You can see the smoke from the fire behind the hill.
      `),
      snow: esLines(`
        Las montañas amanecieron con nieve. Qué bonito se ven. || The mountains woke up with snow. They look so pretty.
      `),
      clear: esLines(`
        Con el cielo así de limpio se ven las montañas clarito. || With the sky this clear you can see the mountains clearly.
      `),
    },
  },
  desert: {
    food: esLines(`
      @wx:heat Un raspado bien frío para aguantar el calor. || An ice-cold shaved ice to stand the heat.
      Carne asada los domingos, aunque haga un calor infernal. || Carne asada on Sundays, even when it's hellishly hot.
      @works Los tacos de la troca cerca del trabajo son lo mejor del día. || The tacos from the truck near work are the best part of the day.
      Unos mariscos bien fríos cuando aprieta el calor. || Some ice-cold seafood when the heat comes down hard.
    `),
    traffic: esLines(`
      @drives En el desierto todo queda lejos; se maneja mucho. || In the desert everything is far; you drive a lot.
      @drives @county:Riverside La 10 está llena de tráileres a todas horas. || The 10 is full of big rigs at all hours.
      @drives @county:Imperial La línea para cruzar a Mexicali estaba larguísima. || The line to cross into Mexicali was super long.
    `),
    prideLines: esLines(`
      Los inviernos aquí son los mejores del país. || The winters here are the best in the country.
      Al atardecer las montañas se ponen color de rosa. || At sunset the mountains turn pink.
      Aquí la gente es trabajadora; nadie le tiene miedo al calor. || People here are hard workers; nobody's afraid of the heat.
    `),
    complaintLines: esLines(`
      @adult El verano es brutal y el recibo de la luz es peor. || Summer is brutal and the electric bill is worse.
      @m6-9 En el verano no se puede ni salir de la casa. || In summer you can't even leave the house.
      Con el polvo del viento todo el mundo anda con alergias. || With the dust in the wind everyone has allergies.
    `),
    weather: {
      heat: esLines(`
        Hace un calor que derrite. Ni a la sombra se aguanta. || It's a melting heat. Not even the shade helps.
        Hasta el volante del carro quema con este sol. || Even the steering wheel burns in this sun.
      `),
      wind: esLines(`
        Se levantó una tormenta de arena; no se ve nada en la carretera. || A sandstorm kicked up; you can't see a thing on the road.
      `),
      rain: esLines(`
        Llovió en el desierto y huele a gobernadora. || It rained in the desert and it smells like creosote.
      `),
      cold: esLines(`
        En la noche refresca mucho; el desierto engaña. || At night it gets really cool; the desert fools you.
      `),
      clear: esLines(`
        Cielo limpio y un sol que quema. || A clear sky and a sun that burns.
      `),
      smoke: esLines(`
        El humo de los incendios llega hasta acá. || The smoke from the fires gets all the way out here.
      `),
    },
  },
  sd: {
    food: esLines(`
      Tacos de pescado cerca del mar, no hay nada mejor. || Fish tacos near the ocean, there's nothing better.
      Un burrito de carne asada con papas adentro, como se hace aquí. || A carne asada burrito with fries inside, the way they make it here.
      Los mariscos de aquí no le piden nada a los de Ensenada. || The seafood here is as good as Ensenada's.
      Los domingos, menudo o birria, según el antojo. || Sundays, menudo or birria, depending on the craving.
    `),
    traffic: esLines(`
      @adult La línea para cruzar a Tijuana estaba larguísima. || The line to cross into Tijuana was super long.
      @drives @coast La 5 a las cinco de la tarde, mejor ni salir. || The 5 at five in the afternoon, better not to even go out.
      Mejor el trolley que buscar estacionamiento en el centro. || Better the trolley than hunting for parking downtown.
      @drives @inland La 15 en la mañana es puro parar y arrancar. || The 15 in the morning is nothing but stop and go.
    `),
    prideLines: esLines(`
      El mejor clima del mundo, y lo digo en serio. || The best weather in the world, and I mean it.
      Aquí uno está a un paso del mar y a un paso de la frontera. || Here you're a step from the ocean and a step from the border.
      @coast En la tarde se siente la brisa del mar; ni falta hace el aire acondicionado. || In the afternoon you feel the ocean breeze; you don't even need the AC.
    `),
    complaintLines: esLines(`
      @rents La renta en San Diego ya no se paga con un solo sueldo. || Rent in San Diego can't be paid on one paycheck anymore.
      @adult Todo está carísimo, hasta el agua. || Everything is so expensive, even water.
      @drives Para estacionarse cerca de la playa hay que dar mil vueltas. || To park near the beach you have to circle a thousand times.
    `),
    weather: {
      fog: esLines(`
        @m5-7 @coast Mayo gris y junio nublado. Así es la costa. || Gray May and cloudy June. That's the coast.
      `),
      heat: esLines(`
        @inland Tierra adentro hace un calor que no se aguanta. || Inland it's unbearably hot.
      `),
      rain: esLines(`
        Llueve tan poco que cuando llueve nadie sabe manejar. || It rains so little that when it does nobody knows how to drive.
      `),
      wind: esLines(`
        @offshore Vientos de Santa Ana: calor seco y peligro de incendio. || Santa Ana winds: dry heat and fire danger.
      `),
      cold: esLines(`
        Hace {temp} grados y ya sacamos las cobijas. || It's {temp} degrees and we already got the blankets out.
      `),
      smoke: esLines(`
        Huele a humo; debe haber un incendio en el monte. || It smells like smoke; there must be a fire out in the backcountry.
      `),
      clear: esLines(`
        Cielo azul y el mar tranquilo. Por eso vivimos aquí. || Blue sky and a calm ocean. That's why we live here.
      `),
    },
  },
  sjv: {
    food: esLines(`
      @m6-9 En el verano, fruta del fil: duraznos, uvas, ciruelas. || In summer, fruit from the fields: peaches, grapes, plums.
      Las tortas de la troca del mercado son las mejores. || The tortas from the truck at the market are the best.
      Un elote asado en la feria, con limón y chile. || A roasted corn at the fair, with lime and chile.
      Los domingos, barbacoa con la familia. || Sundays, barbacoa with the family.
    `),
    traffic: esLines(`
      @drives La 99 está llena de tráileres todo el día. || The 99 is full of big rigs all day.
      @drives @m11-2 Con la neblina no se ve nada en la carretera; hay que ir despacito. || With the fog you can't see a thing on the road; you have to go real slow.
      @drives En la temporada de la pisca las carreteras se llenan de troquitas del fil. || In picking season the roads fill up with little trucks from the fields.
    `),
    prideLines: esLines(`
      Aquí se cosecha la comida que llega a todo el país. || The food that goes all over the country is harvested here.
      A dos horas de las montañas y a dos horas del mar. || Two hours from the mountains and two hours from the ocean.
      Aquí la gente se levanta temprano y trabaja duro. || People here get up early and work hard.
    `),
    complaintLines: esLines(`
      @m6-10 En el verano el aire se pone feo, con el polvo y el humo. || In summer the air gets bad, with the dust and the smoke.
      @adult El trabajo en el campo es pesado, y el calor lo hace peor. || Farm work is hard, and the heat makes it worse.
      @adult Siempre preocupa el agua: si llueve poco, hay menos trabajo. || Water is always a worry: if it doesn't rain much, there's less work.
    `),
    weather: {
      fog: esLines(`
        @m11-2 La neblina está tan espesa que no se ve ni la casa de enfrente. || The fog is so thick you can't even see the house across the street.
      `),
      heat: esLines(`
        Qué calorón; hasta el pavimento quema. || What a scorcher; even the pavement burns.
        @works Con este calor hay que empezar a trabajar antes de que salga el sol. || In this heat you have to start work before the sun comes up.
      `),
      rain: esLines(`
        Qué bueno que llovió; los campos lo necesitaban. || Good thing it rained; the fields needed it.
      `),
      smoke: esLines(`
        Con el humo de los incendios de la sierra, el cielo está todo gris. || With the smoke from the fires in the Sierra, the sky is all gray.
      `),
      cold: esLines(`
        En la mañana hace un frío que hiela; ojalá no caiga helada en los árboles. || The mornings are freezing cold; I hope there's no frost on the trees.
      `),
      wind: esLines(`
        Con este viento se levanta un polvaderón en los campos. || With this wind a big dust cloud rises off the fields.
      `),
      clear: esLines(`
        @m11-5 Con el cielo limpio se ve la sierra con nieve. || With the sky clear you can see the snow on the Sierra.
      `),
    },
  },
  cc: {
    food: esLines(`
      Fresas recién cortadas, directo del fil. || Freshly picked strawberries, straight from the field.
      Tri-tip en la parrilla los sábados, al estilo de aquí. || Tri-tip on the grill on Saturdays, the local way.
      @coast Mariscos frescos en el muelle. || Fresh seafood at the pier.
      @works Unos tacos de la troca después del trabajo. || Some tacos from the truck after work.
    `),
    traffic: esLines(`
      @drives La 101 se llena de camiones de lechuga en la temporada. || The 101 fills up with lettuce trucks in the season.
      En la mañana salen las troquitas al fil antes de que amanezca. || In the morning the little trucks head out to the fields before dawn.
      Aquí no hay tanto tráfico como en la ciudad, por suerte. || There isn't as much traffic here as in the city, luckily.
    `),
    prideLines: esLines(`
      Aquí se cultiva la lechuga y la fresa que se come todo el país. || The lettuce and strawberries the whole country eats are grown here.
      Entre el mar y los campos, no hay lugar más bonito. || Between the ocean and the fields, there's no prettier place.
      @coast Con la brisa del mar nunca hace demasiado calor. || With the ocean breeze it never gets too hot.
    `),
    complaintLines: esLines(`
      @rents La renta está carísima; hay familias que viven dos o tres en una casa. || Rent is so expensive; there are families living two or three to a house.
      @adult El trabajo en el campo depende del clima; si llueve mucho, no hay jale. || Field work depends on the weather; if it rains a lot, there's no work.
    `),
    weather: {
      fog: esLines(`
        Neblina en la mañana, viento en la tarde. Así es aquí. || Fog in the morning, wind in the afternoon. That's how it is here.
      `),
      wind: esLines(`
        En la tarde se levanta el viento del mar, todos los días. || In the afternoon the wind comes up off the ocean, every day.
      `),
      rain: esLines(`
        Con esta lluvia no se puede trabajar en el campo. || With this rain you can't work in the fields.
      `),
      heat: esLines(`
        Hoy sí hace calor, cosa rara por aquí. || It's actually hot today, which is rare around here.
      `),
      cold: esLines(`
        Hace {temp} grados y con la humedad se siente más frío. || It's {temp} degrees and with the damp it feels colder.
      `),
      clear: esLines(`
        Día despejado: desde los cerros se ve el mar. || A clear day: from the hills you can see the ocean.
      `),
      smoke: esLines(`
        Huele a humo; dicen que hay un incendio en los cerros. || It smells like smoke; they say there's a fire in the hills.
      `),
    },
  },
  bay: {
    food: esLines(`
      Pupusas con curtido los sábados, no fallan. || Pupusas with curtido on Saturdays, they never miss.
      Un burrito grandote, de esos que pesan como un ladrillo. || A huge burrito, the kind that weighs as much as a brick.
      @county:Alameda Los tacos de las troquitas de la International son los mejores. || The tacos from the trucks on International are the best.
      En el mercado de los domingos se consigue fruta barata. || At the Sunday market you can get cheap fruit.
    `),
    traffic: esLines(`
      @drives El puente en la mañana es puro tráfico. || The bridge in the morning is nothing but traffic.
      @county:San_Francisco|Alameda|Contra_Costa|San_Mateo El BART venía lleno y otra vez tarde. || BART was packed and late again.
      @drives Para estacionarse en la ciudad hay que dar veinte vueltas. || To park in the city you have to circle twenty times.
    `),
    prideLines: esLines(`
      Aquí en {neighborhood} hay gente de todo el mundo. || Here in {neighborhood} there are people from all over the world.
      La Bahía es bonita, aunque cueste tanto vivir aquí. || The Bay is beautiful, even if it costs so much to live here.
      Con neblina o sin ella, esta es mi ciudad. || Fog or no fog, this is my city.
    `),
    complaintLines: esLines(`
      @rents La renta en la Bahía está por las nubes. || Rent in the Bay is through the roof.
      @adult Muchos conocidos ya se fueron para el valle porque aquí no alcanza. || A lot of people I know already left for the valley because here the money doesn't stretch.
    `),
    weather: {
      fog: esLines(`
        @m6-9 Otra vez la neblina; en el verano casi ni se ve el sol. || The fog again; in summer you hardly see the sun.
      `),
      cold: esLines(`
        Hace {temp} grados y el viento se siente hasta los huesos. || It's {temp} degrees and the wind cuts right to the bone.
      `),
      rain: esLines(`
        Con esta lluvia todo el mundo llega tarde al trabajo. || With this rain everyone gets to work late.
      `),
      heat: esLines(`
        Hace calor, cosa rara aquí, y casi nadie tiene aire acondicionado. || It's hot, a rare thing here, and hardly anyone has AC.
      `),
      clear: esLines(`
        Día despejado: se ve toda la bahía. || A clear day: you can see the whole bay.
      `),
      smoke: esLines(`
        El humo de los incendios del norte se metió a la Bahía. || The smoke from the fires up north got into the Bay.
      `),
      wind: esLines(`
        @offshore Con este viento seco cortan la luz por miedo a los incendios. || With this dry wind they cut the power for fear of fires.
      `),
    },
  },
};

/** Spanish lines of single dialects (DIALECT_KEYS), on top of their family's. */
export const ES_KEYS = {
  'desert-cv': {
    food: esLines(`
      Dátiles del valle, recién cosechados. || Dates from the valley, freshly harvested.
      Un licuado de dátil bien frío, lo mejor para el calor. || An ice-cold date shake, the best thing for the heat.
    `),
    prideLines: esLines(`
      Aquí se trabaja duro, en el campo y en los hoteles. || People work hard here, in the fields and in the hotels.
    `),
  },
  imperial: {
    food: esLines(`
      Comida china al estilo de Mexicali, como en ningún lado. || Mexicali-style Chinese food, like nowhere else.
    `),
    prideLines: esLines(`
      Aquí uno tiene familia a los dos lados de la línea. || Here people have family on both sides of the line.
    `),
  },
  salinas: {
    prideLines: esLines(`
      Salinas le da de comer a medio mundo, con la lechuga del valle. || Salinas feeds half the world, with the valley's lettuce.
    `),
  },
  kern: {
    food: esLines(`
      Comida vasca los domingos, con todo y su sopa. || Basque food on Sundays, soup and all.
    `),
  },
  'la-eastside': {
    prideLines: esLines(`
      El Este de Los Ángeles tiene su propio orgullo, y se nota en cada esquina. || East LA has its own pride, and you can see it on every corner.
    `),
  },
};
