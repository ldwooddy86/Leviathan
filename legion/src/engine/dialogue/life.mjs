// Legion · dialogue · life: how a speaker talks about the parts of their life the persona lists.
//
// Interests (the persona's names: 'surfing', 'hiking up Mount Diablo', 'fishing at Shasta Lake', 'the Dodgers',
// 'Lunar New Year') become first-person sentences, a short noun for "this weekend I want to get some ___ in" and a
// "where you'll find me" phrase, in English and in Spanish. Worries become phrases ("the rent", "keeping the house
// insured"). Census occupation groups become a plain Spanish description of the work, because a job title from
// the catalog is English and a Spanish sentence should not carry one. And the small word maps: school levels,
// family words, Spanish directions, months and the sky.

import { MESES } from './core.mjs';

/**
 * Talk for one interest: {short, doing, en: [sentences], es: [[spanish, english]]}, or null for an empty name.
 * Unknown interests get a plain generic line, so a new persona interest never breaks a reply.
 * @param {string} name a persona interest
 * @returns {{short: string, doing: string, en: string[], es: Array<[string, string]>}|null}
 */
export function interestTalk(name, opts = {}) {
  // "hiking in the San Bruno Mountain" is said "hiking on San Bruno Mountain"
  const n = String(name || '').trim().replace(/\bhiking in the ((?:[A-Z][\w'.-]*\s)+Mountain)\b(?!s)/, 'hiking on $1');
  if (!n) return null;
  if (opts.tradition) {
    return {
      short: n, doing: `celebrating ${n}`, place: false, tradition: true,
      en: [`In my family we never miss ${n}.`, `${n[0].toUpperCase()}${n.slice(1)} is a big deal in my family.`],
      es: [['En mi familia guardamos nuestras tradiciones.', 'In my family we keep our traditions.']],
    };
  }
  for (const [re, f] of INTERESTS) {
    const m = re.exec(n);
    if (m) return Object.assign(f(m), { place: PLACE_INTERESTS.test(n) });
  }
  return {
    short: n, doing: `doing ${n}`.replace(/^doing (the |a )/, 'at $1'),
    en: [`I'm really into ${n}.`, `${n[0].toUpperCase()}${n.slice(1)}, mostly.`],
    es: [['Me gusta pasar mi tiempo libre en casa.', 'I like spending my free time at home.']], place: false,
  };
}

const I = (short, doing, en, es) => () => ({ short, doing, en, es });
// Interests that happen at a place someone could go (they can be recommended): see interestTalk().place.
const PLACE_INTERESTS = /^(surfing|the beach|sailing|skiing and snowboarding|snowshoeing|stargazing out in the desert|off-roading|the county fair|the farmers market|live music|museums|car shows|golf|wine tasting|swap meets|trying new restaurants|hunting|four-wheeling|walking|running|birdwatching|biking around town|concerts|tennis|ski trips up to .+|hiking .+|fishing at .+)$/;

const INTERESTS = [
  [/^surfing$/, I('surfing', 'out on a surfboard', ['I surf whenever the waves cooperate.', 'I try to surf a few mornings a week.', 'Surfing. The ocean is my therapy.'], [['Me gusta surfear.', 'I like to surf.']])],
  [/^the beach$/, I('beach time', 'at the beach', ["I'm at the beach every chance I get.", "Give me a beach day and I'm happy."], [['Me gusta ir a la playa.', 'I like going to the beach.']])],
  [/^sailing$/, I('sailing', 'out on the water', ['I go sailing when I can.', 'Sailing, when the wind is right.'], [['Me gusta salir a navegar.', 'I like to go sailing.']])],
  [/^skiing and snowboarding$/, I('skiing', 'up on the slopes', ["I ski all winter, whenever there's snow.", 'Skiing, as much as I can in the winter.'], [['En invierno me gusta esquiar.', 'In winter I like to ski.']])],
  [/^snowshoeing$/, I('snowshoeing', 'out on the snow', ["I snowshoe in the winter. It's quiet out there."], [['En invierno salgo a caminar en la nieve.', 'In winter I go walking in the snow.']])],
  [/^ski trips up to (.+)$/, m => ({ short: 'skiing', doing: `skiing up in ${m[1]}`, en: [`We try to get up to ${m[1]} to ski every winter.`, `Ski trips up to ${m[1]} when there's snow.`], es: [[`En invierno vamos a esquiar a ${m[1]}.`, `In winter we go skiing in ${m[1]}.`]] })],
  [/^hiking (up|near|in the|on) (.+)$/, m => ({ short: 'hiking', doing: `hiking ${m[1]} ${m[2]}`, en: [`I hike ${m[1]} ${m[2]} a lot.`, `I love hiking, especially ${m[1]} ${m[2]}.`], es: [['Me gusta salir de excursión.', 'I like to go hiking.']] })],
  [/^fishing at (.+)$/, m => ({ short: 'fishing', doing: `fishing at ${m[1]}`, en: [`I fish at ${m[1]} when I get the chance.`, `Fishing. ${m[1]} is my spot.`], es: [[`Me gusta ir a pescar a ${m[1]}.`, `I like to go fishing at ${m[1]}.`]] })],
  [/^stargazing out in the desert$/, I('stargazing', 'out in the desert looking at the stars', ['I like driving out to look at the stars. No city lights out there.'], [['Me gusta ver las estrellas en el desierto.', 'I like looking at the stars in the desert.']])],
  [/^off-roading$/, I('off-roading', 'out off-roading in the desert', ['I go off-roading in the desert on weekends.'], [['Los fines de semana salgo al desierto en el carro.', 'On weekends I drive out into the desert.']])],
  [/^the county fair$/, I('fair food', 'at the county fair', ['I never miss the county fair.', 'The county fair every year. The food alone is worth it.'], [['Nunca me pierdo la feria del condado.', 'I never miss the county fair.']])],
  [/^the harvest$/, I('harvest work', 'out in the fields', ['Harvest time is my favorite time of year, even with the hours.'], [['La cosecha es mi temporada favorita.', 'The harvest is my favorite season.']])],
  [/^4-H with the kids$/, I('4-H', 'at 4-H with the kids', ['The kids are in 4-H, so that keeps our weekends full.'], [['Los niños están en 4-H y eso nos tiene ocupados.', 'The kids are in 4-H and that keeps us busy.']])],
  [/^trying new restaurants$/, I('restaurant hunting', 'trying some new restaurant', ["I'm always trying new restaurants.", 'Trying new places to eat. There\'s always somewhere new.'], [['Me gusta probar restaurantes nuevos.', 'I like trying new restaurants.']])],
  [/^live music$/, I('live music', 'at a show', ['I go see live music whenever I can.', 'Live music. Small shows are the best.'], [['Me gusta ir a escuchar música en vivo.', 'I like going to hear live music.']])],
  [/^the farmers market$/, I('farmers market runs', 'at the farmers market', ["I'm at the farmers market every weekend."], [['Voy al mercado de los agricultores cada fin de semana.', 'I go to the farmers market every weekend.']])],
  [/^biking around town$/, I('biking', 'on my bike', ['I bike everywhere I can.', 'Biking around town. Faster than driving, half the time.'], [['Me gusta andar en bicicleta.', 'I like to ride my bike.']])],
  [/^museums$/, I('museum days', 'at a museum', ['I love a good museum.'], [['Me gustan los museos.', 'I like museums.']])],
  [/^backyard barbecues$/, I('barbecuing', 'at the grill in the backyard', ["Backyard barbecues. That's my idea of a good weekend."], [['Me gusta hacer carne asada en el patio.', 'I like grilling in the backyard.']])],
  [/^car shows$/, I('car shows', 'at a car show', ["I go to car shows when there's one around."], [['Me gustan las exhibiciones de carros.', 'I like car shows.']])],
  [/^hunting$/, I('hunting', 'out hunting', ['I hunt in the fall.'], [['En otoño salgo a cazar.', 'In the fall I go hunting.']])],
  [/^four-wheeling$/, I('four-wheeling', 'out four-wheeling', ['I go four-wheeling when I can.'], [['Me gusta salir al campo en el carro.', 'I like driving out into the country.']])],
  [/^golf$/, I('golf', 'on the golf course', ['I play golf when I can get a tee time.', 'Golf. I am not good, but I enjoy it.'], [['Me gusta jugar golf.', 'I like playing golf.']])],
  [/^wine tasting$/, I('wine tasting', 'at a winery', ['I like going wine tasting.'], [['Me gusta ir a probar vinos.', 'I like going wine tasting.']])],
  [/^travel$/, I('travel', 'somewhere new', ['I like to travel when I can swing it.', 'Travel, when I can. There is always another place on my list.'], [['Me gusta viajar.', 'I like to travel.']])],
  [/^tennis$/, I('tennis', 'on the tennis court', ['I play tennis a couple of times a week.'], [['Juego tenis.', 'I play tennis.']])],
  [/^swap meets$/, I('swap meet trips', 'at the swap meet', ['I love a good swap meet.'], [['Me encanta ir al swap meet.', 'I love going to the swap meet.']])],
  [/^thrift shopping$/, I('thrifting', 'at a thrift store', ['Thrift shopping is my thing.'], [['Me gusta buscar cosas en las tiendas de segunda.', 'I like looking for things at thrift stores.']])],
  [/^fixing up cars$/, I('car projects', 'under the hood of some old car', ["I'm always fixing up some old car."], [['Siempre estoy arreglando algún carro.', "I'm always fixing up some car."]])],
  [/^picture books$/, I('story time', 'with a picture book', ['I like books with pictures!'], [['¡Me gustan los cuentos!', 'I like storybooks!']])],
  [/^the playground$/, I('the playground', 'at the playground', ['I like the slide!', 'The playground is my favorite.'], [['¡Me gusta el resbaladero!', 'I like the slide!']])],
  [/^stuffed animals$/, I('stuffed animals', 'with my stuffed animals', ['I have a lot of stuffed animals.'], [['Tengo muchos peluches.', 'I have a lot of stuffed animals.']])],
  [/^cartoons$/, I('cartoons', 'watching cartoons', ['I like cartoons.', 'Cartoons are the best.'], [['Me gustan las caricaturas.', 'I like cartoons.']])],
  [/^drawing$/, I('drawing', 'drawing', ['I like drawing. I draw all the time.'], [['Me gusta dibujar.', 'I like to draw.']])],
  [/^soccer practice$/, I('soccer', 'at soccer practice', ['I play soccer. I have practice after school.'], [['Juego fútbol. Tengo práctica después de la escuela.', 'I play soccer. I have practice after school.']])],
  [/^Little League$/, I('baseball', 'at Little League', ['I play Little League.'], [['Juego béisbol en la liga infantil.', 'I play baseball in the kids league.']])],
  [/^video games$/, I('video games', 'playing video games', ['Video games, mostly.', 'I play a lot of video games.'], [['Me gustan los videojuegos.', 'I like video games.']])],
  [/^music$/, I('music', 'with my headphones on', ["Music. I'm always listening to something."], [['Me gusta la música.', 'I like music.']])],
  [/^basketball$/, I('basketball', 'on the basketball court', ['I play basketball whenever I can.'], [['Juego básquetbol.', 'I play basketball.']])],
  [/^skateboarding$/, I('skating', 'on my skateboard', ['I skate. Skateboard, I mean.'], [['Ando en patineta.', 'I ride a skateboard.']])],
  [/^anime$/, I('anime', 'watching anime', ['I watch a lot of anime.'], [['Veo mucho anime.', 'I watch a lot of anime.']])],
  [/^school sports$/, I('practice', 'at practice', ["I'm on a team at school."], [['Estoy en un equipo de la escuela.', "I'm on a team at school."]])],
  [/^the gym$/, I('gym time', 'at the gym', ["I'm at the gym most mornings."], [['Voy al gimnasio casi todas las mañanas.', 'I go to the gym most mornings.']])],
  [/^concerts$/, I('concerts', 'at a concert', ['I go to a lot of concerts.'], [['Voy a muchos conciertos.', 'I go to a lot of concerts.']])],
  [/^gaming$/, I('gaming', 'playing video games', ['I game a lot. Video games.'], [['Juego muchos videojuegos.', 'I play a lot of video games.']])],
  [/^podcasts$/, I('podcasts', 'with a podcast on', ['I listen to a lot of podcasts.'], [['Escucho muchos podcasts.', 'I listen to a lot of podcasts.']])],
  [/^home projects$/, I('house projects', 'in the middle of some project at the house', ["There's always a project going at the house."], [['Siempre estoy arreglando algo en la casa.', "I'm always fixing something at the house."]])],
  [/^cooking$/, I('cooking', 'in the kitchen', ["I like to cook. It's how I unwind.", 'Cooking. I make too much food every time.'], [['Me gusta cocinar.', 'I like to cook.']])],
  [/^walking$/, I('walking', 'out for a walk', ['I walk every day.', 'I take a long walk every morning.'], [['Salgo a caminar todos los días.', 'I go for a walk every day.']])],
  [/^crossword puzzles$/, I('crosswords', 'with the crossword', ['I do the crossword every morning.'], [['Hago crucigramas todas las mañanas.', 'I do crosswords every morning.']])],
  [/^birdwatching$/, I('birdwatching', 'watching the birds', ["I watch birds. You'd be surprised what comes through here."], [['Me gusta ver los pájaros.', 'I like watching birds.']])],
  [/^the grandkids$/, I('time with the grandkids', 'with the grandkids', ['My grandkids keep me busy, and I love it.'], [['Paso mucho tiempo con mis nietos.', 'I spend a lot of time with my grandkids.']])],
  [/^gardening$/, I('gardening', 'in the garden', ['I spend a lot of time in the garden.', 'Gardening. My tomatoes are my pride and joy.'], [['Me gusta trabajar en el jardín.', 'I like working in the garden.']])],
  [/^houseplants$/, I('plant care', 'watering my plants', ['My place is basically a jungle. Houseplants everywhere.'], [['Tengo muchas plantas en la casa.', 'I have a lot of plants at home.']])],
  [/^the kids' soccer games$/, I("the kids' soccer games", "at the kids' soccer games", ["I'm at the kids' soccer games every Saturday."], [['Los sábados voy a los partidos de fútbol de los niños.', "On Saturdays I go to the kids' soccer games."]])],
  [/^baby milestones$/, I('baby time', 'with the baby', ["We've got a baby at home, so that's everything right now."], [['Tenemos un bebé en la casa, así que eso es todo ahora.', "We have a baby at home, so that's everything right now."]])],
  [/^woodworking$/, I('woodworking', 'in the garage with my tools', ['I do some woodworking on the weekends.'], [['Me gusta trabajar la madera.', 'I like woodworking.']])],
  [/^working on cars$/, I('car work', 'under the hood of a car', ["I'm always working on cars."], [['Siempre estoy trabajando en carros.', "I'm always working on cars."]])],
  [/^tech gadgets$/, I('gadget shopping', 'reading about some new gadget', ['I like tech gadgets. Probably too much.'], [['Me gustan los aparatos electrónicos.', 'I like electronic gadgets.']])],
  [/^reading$/, I('reading', 'with a book', ['I read a lot.', "Reading. I've always got a book going."], [['Me gusta leer.', 'I like to read.']])],
  [/^photography$/, I('photography', 'out with my camera', ['I take a lot of pictures.'], [['Me gusta tomar fotos.', 'I like taking pictures.']])],
  [/^running$/, I('running', 'out running', ['I run most mornings.'], [['Salgo a correr en las mañanas.', 'I go running in the mornings.']])],
  [/^classic cars$/, I('classic cars', 'looking at classic cars', ['I love classic cars.'], [['Me encantan los carros clásicos.', 'I love classic cars.']])],
  [/^board games$/, I('board games', 'at a board game night', ['Board games with friends.'], [['Me gustan los juegos de mesa.', 'I like board games.']])],
  [/^hosting friends$/, I('hosting', 'with friends over at my place', ['I like having people over.'], [['Me gusta invitar a mis amigos a la casa.', 'I like having my friends over.']])],
  [/^(the old Oakland A's|the [A-Z0-9][A-Za-z0-9' ]+|LAFC|San Diego FC|San Diego State|[A-Z][a-z]+ State football|UCLA football|USC football|Stanford football|Cal football)$/, m => ({ short: `${m[1].replace(/^the (old Oakland )?/, '')} games`, doing: `watching ${m[1]}`, en: [`I never miss ${m[1]} if I can help it.`, `I follow ${m[1]}. Win or lose.`], es: [['Me gusta ver los partidos.', 'I like watching the games.']] })],
];

/** How people put each persona worry in a sentence (persona concern topics), English and Spanish. */
export const CONCERN_WORDS = Object.freeze({
  insurance: ['keeping the house insured', 'el seguro de la casa'], fire: ['the next wildfire', 'los incendios'], smoke: ['smoke season', 'el humo de los incendios'],
  heat: ['the summer heat', 'el calor'], storms: ['the winter storms', 'las tormentas'], flooding: ['flooding', 'las inundaciones'], wind: ['the wind', 'el viento'],
  'power shutoffs': ['the power shutoffs', 'los apagones'], snow: ['the snow', 'la nieve'], housing: ['what housing costs', 'lo cara que está la vivienda'],
  rent: ['the rent', 'la renta'], commute: ['my commute', 'el tráfico'], roof: ['the old roof', 'el techo de la casa'], earthquakes: ['the next big earthquake', 'los terremotos'],
  jobs: ['finding work', 'encontrar trabajo'], water: ['water for the farms', 'el agua para el campo'], health: ['staying healthy', 'la salud'],
  schools: ['the schools', 'las escuelas'], 'family abroad': ['my family back home', 'mi familia allá'],
});

// Common titles first ([pattern, Spanish for a man, Spanish for a woman, English]); the group map catches the rest.
const JOB_TITLES_ES = [
  [/tractor/, 'Manejo un tractor en el campo.', 'Manejo un tractor en el campo.', 'I drive a tractor on a farm.'],
  [/picker|harvester|field worker|farmworker|orchard|vineyard worker|grove|irrigation|ranch hand|nursery and greenhouse|cannabis|date palm/, 'Trabajo en el campo.', 'Trabajo en el campo.', 'I work in the fields.'],
  [/dairy/, 'Trabajo en una lechería.', 'Trabajo en una lechería.', 'I work at a dairy.'],
  [/produce sorter|packing house|food processing|hand packager/, 'Trabajo en una empacadora.', 'Trabajo en una empacadora.', 'I work at a packing plant.'],
  [/winery/, 'Trabajo en una bodega de vino.', 'Trabajo en una bodega de vino.', 'I work at a winery.'],
  [/bakery|pastry|baker/, 'Trabajo en una panadería.', 'Trabajo en una panadería.', 'I work at a bakery.'],
  [/dishwasher/, 'Lavo platos en un restaurante.', 'Lavo platos en un restaurante.', 'I wash dishes at a restaurant.'],
  [/\bserver\b|waiter|waitress/, 'Soy mesero.', 'Soy mesera.', "I'm a server."],
  [/bartender/, 'Soy cantinero.', 'Soy cantinera.', "I'm a bartender."],
  [/barista/, 'Preparo café en una cafetería.', 'Preparo café en una cafetería.', 'I make coffee at a café.'],
  [/fast food/, 'Trabajo en un restaurante de comida rápida.', 'Trabajo en un restaurante de comida rápida.', 'I work at a fast food restaurant.'],
  [/restaurant host/, 'Recibo a los clientes en un restaurante.', 'Recibo a los clientes en un restaurante.', 'I greet customers at a restaurant.'],
  [/\bcook\b|chef/, 'Soy cocinero.', 'Soy cocinera.', "I'm a cook."],
  [/sewing|seamstress|tailor/, 'Soy costurero.', 'Soy costurera.', 'I sew clothes.'],
  [/meat cutter|butcher/, 'Soy carnicero.', 'Soy carnicera.', "I'm a meat cutter."],
  [/welder/, 'Soy soldador.', 'Soy soldadora.', "I'm a welder."],
  [/assembly/, 'Trabajo en una fábrica, en la línea.', 'Trabajo en una fábrica, en la línea.', 'I work on the line at a factory.'],
  [/pool service/, 'Limpio albercas.', 'Limpio albercas.', 'I clean pools.'],
  [/pest control/, 'Trabajo en control de plagas.', 'Trabajo en control de plagas.', 'I work in pest control.'],
  [/landscap|gardener|groundskeep|tree trimmer/, 'Trabajo en jardinería.', 'Trabajo en jardinería.', 'I work in landscaping.'],
  [/housekeep|maid|janitor|custodian|house cleaner|cleaner/, 'Hago limpieza.', 'Hago limpieza.', 'I do cleaning.'],
  [/drywall/, 'Instalo tablaroca.', 'Instalo tablaroca.', 'I hang drywall.'],
  [/roofer/, 'Trabajo en techos.', 'Trabajo en techos.', 'I work on roofs.'],
  [/concrete/, 'Trabajo con concreto.', 'Trabajo con concreto.', 'I work with concrete.'],
  [/heavy equipment/, 'Manejo maquinaria pesada.', 'Manejo maquinaria pesada.', 'I run heavy equipment.'],
  [/carpenter|cabinetmaker/, 'Soy carpintero.', 'Soy carpintera.', "I'm a carpenter."],
  [/painter/, 'Soy pintor.', 'Soy pintora.', "I'm a painter."],
  [/electrician/, 'Soy electricista.', 'Soy electricista.', "I'm an electrician."],
  [/plumber/, 'Soy plomero.', 'Soy plomera.', "I'm a plumber."],
  [/construction laborer|construction foreman/, 'Trabajo en la construcción.', 'Trabajo en la construcción.', 'I work in construction.'],
  [/auto body/, 'Trabajo en un taller de hojalatería.', 'Trabajo en un taller de hojalatería.', 'I work at an auto body shop.'],
  [/mechanic/, 'Soy mecánico.', 'Soy mecánica.', "I'm a mechanic."],
  [/caregiver|home health aide/, 'Cuido a personas mayores.', 'Cuido a personas mayores.', 'I take care of older people.'],
  [/nursing assistant/, 'Soy asistente de enfermería.', 'Soy asistente de enfermería.', "I'm a nursing assistant."],
  [/medical assistant/, 'Soy asistente médico.', 'Soy asistente médica.', "I'm a medical assistant."],
  [/\bnurse\b/, 'Soy enfermero.', 'Soy enfermera.', "I'm a nurse."],
  [/child ?care|nanny|daycare/, 'Cuido niños.', 'Cuido niños.', 'I take care of children.'],
  [/teaching assistant/, 'Ayudo en una escuela.', 'Ayudo en una escuela.', 'I help out at a school.'],
  [/teacher/, 'Soy maestro.', 'Soy maestra.', "I'm a teacher."],
  [/hair|barber|stylist|nail/, 'Trabajo en un salón de belleza.', 'Trabajo en un salón de belleza.', 'I work at a beauty salon.'],
  [/warehouse|forklift|freight/, 'Trabajo en una bodega.', 'Trabajo en una bodega.', 'I work in a warehouse.'],
  [/grocery stocker|stock clerk/, 'Acomodo mercancía en una tienda.', 'Acomodo mercancía en una tienda.', 'I stock shelves at a store.'],
  [/car wash/, 'Trabajo en un lavado de carros.', 'Trabajo en un lavado de carros.', 'I work at a car wash.'],
  [/refuse/, 'Recojo la basura.', 'Recojo la basura.', 'I collect the trash.'],
  [/longshore|container crane/, 'Trabajo en el puerto.', 'Trabajo en el puerto.', 'I work at the port.'],
  [/truck driver/, 'Manejo un tráiler.', 'Manejo un tráiler.', 'I drive a truck.'],
  [/delivery/, 'Hago entregas.', 'Hago entregas.', 'I make deliveries.'],
  [/bus driver/, 'Manejo un autobús.', 'Manejo un autobús.', 'I drive a bus.'],
  [/rideshare/, 'Manejo para una aplicación de viajes.', 'Manejo para una aplicación de viajes.', 'I drive for a ride app.'],
  [/driver/, 'Soy chofer.', 'Soy chofer.', "I'm a driver."],
  [/cashier/, 'Soy cajero.', 'Soy cajera.', "I'm a cashier."],
  [/retail sales/, 'Trabajo en una tienda.', 'Trabajo en una tienda.', 'I work at a store.'],
  [/street vendor/, 'Vendo en la calle.', 'Vendo en la calle.', 'I sell on the street.'],
  [/security guard/, 'Soy guardia de seguridad.', 'Soy guardia de seguridad.', "I'm a security guard."],
  [/customer service/, 'Trabajo en servicio al cliente.', 'Trabajo en servicio al cliente.', 'I work in customer service.'],
  [/small business owner/, 'Tengo mi propio negocio.', 'Tengo mi propio negocio.', 'I have my own business.'],
  [/^farmer$/, 'Soy agricultor.', 'Soy agricultora.', "I'm a farmer."],
];

/** A plain description of the work: [Spanish, English], by title for common jobs, else by Census occupation group. */
export function jobSpanish(group, title, sex) {
  const t = String(title || '').toLowerCase();
  for (const [re, m, f, en] of JOB_TITLES_ES) if (re.test(t)) return [sex === 'F' ? f : m, en];
  const G = {
    management: ['Soy gerente.', "I'm a manager."], business: ['Trabajo en una oficina.', 'I work in an office.'],
    computer: ['Trabajo con computadoras.', 'I work with computers.'], engineering: ['Trabajo en ingeniería.', 'I work in engineering.'],
    science: ['Trabajo en ciencias.', 'I work in science.'], social: ['Trabajo en servicios sociales.', 'I work in social services.'],
    legal: ['Trabajo en el área legal.', 'I work in the legal field.'], education: ['Trabajo en una escuela.', 'I work at a school.'],
    arts: ['Trabajo en artes y medios.', 'I work in arts and media.'], practitioner: ['Trabajo en el cuidado de la salud.', 'I work in health care.'],
    healthtech: ['Trabajo en el área de la salud.', 'I work in health care.'], healthsupport: ['Cuido a pacientes.', 'I take care of patients.'],
    firefighting: [sex === 'F' ? 'Soy bombera.' : 'Soy bombero.', "I'm a firefighter."], police: ['Trabajo en seguridad.', 'I work in security.'],
    food: ['Trabajo en servicio de comida.', 'I work in food service.'], cleaning: ['Hago limpieza.', 'I do cleaning.'],
    personalcare: ['Trabajo atendiendo a la gente.', 'I work taking care of people.'], sales: ['Trabajo en ventas.', 'I work in sales.'],
    office: ['Trabajo en una oficina.', 'I work in an office.'], farming: ['Trabajo en el campo.', 'I work in the fields.'],
    construction: ['Trabajo en la construcción.', 'I work in construction.'], repair: ['Hago reparaciones.', 'I do repairs.'],
    production: ['Trabajo en una fábrica.', 'I work in a factory.'], transport: ['Trabajo en transporte.', 'I work in transportation.'],
    moving: ['Trabajo en una bodega.', 'I work in a warehouse.'],
  };
  return G[group] || ['Tengo un buen trabajo.', 'I have a good job.'];
}

// Titles whose work the Census group misdescribes: a farmer counts as management, but the job is farming; cattle and
// a ranch are ranching (no harvest to follow).
const FEEL_BY_TITLE = [
  [/\b(rancher|ranch hand|cattle|cowboy|livestock|herd)\b/, 'ranching'],
  [/\b(farmer|grower|farm|orchard|vineyard|dairy)\b/, 'farming'],
];

/**
 * Which "job.feel" bank fits a job: by title (and the employer, which says a farmer's farm is a cattle ranch) first,
 * else by the Census occupation group.
 * @param {string|null} group a Census occupation group (persona routine.occKey)
 * @param {string|null} [title] the job title
 * @param {string|null} [employer] the employer ("their cattle ranch")
 * @returns {string} a template key, 'job.feel.<kind>'
 */
export function feelKey(group, title = null, employer = null) {
  const t = String(title || '').toLowerCase();
  const e = String(employer || '').toLowerCase();
  if (/\bfarmer\b|\bowner\b|\bmanager\b/.test(t) && /\b(cattle|ranch|livestock)\b/.test(e)) return 'job.feel.ranching';
  for (const [re, k] of FEEL_BY_TITLE) if (re.test(t)) return `job.feel.${k}`;
  const K = {
    farming: 'farming', construction: 'construction', practitioner: 'health', healthtech: 'health', healthsupport: 'health',
    education: 'education', food: 'food', office: 'office', business: 'office', computer: 'tech', engineering: 'tech',
    transport: 'transport', moving: 'transport', sales: 'sales', police: 'protect', firefighting: 'fire', cleaning: 'cleaning',
    personalcare: 'care', repair: 'repair', production: 'production', management: 'management', legal: 'legal', arts: 'arts',
    science: 'science', social: 'social',
  };
  return `job.feel.${K[group] || 'any'}`;
}

// A workplace as named in Spanish, from the catalog's English employer ("a regional hospital" → "un hospital
// regional"): [pattern, Spanish]. The first match wins, so the specific kinds come first.
const EMPLOYER_ES = [
  [/\bcounty hospital\b/, 'el hospital del condado'], [/\bchildren'?s hospital\b/, 'un hospital de niños'], [/\bregional hospital\b/, 'un hospital regional'],
  [/\bhospital\b/, 'un hospital'], [/\b(urgent care|clinic|health center|medical (office|group|center))\b/, 'una clínica'],
  [/\b(nursing home|assisted living|care home|senior (home|center|living)|skilled nursing)\b/, 'una casa de reposo'], [/\bdental\b/, 'un consultorio dental'],
  [/\b(community college)\b/, 'un colegio comunitario'], [/\b(university|college|campus)\b/, 'la universidad'], [/\b(school district|elementary|middle school|high school|school|preschool|daycare)\b/, 'una escuela'],
  [/\b(packing ?house|packing plant|cannery|processing plant)\b/, 'una empacadora'], [/\b(warehouse|distribution center|fulfillment center|logistics)\b/, 'una bodega'],
  [/\b(dairy)\b/, 'una lechería'], [/\b(winery|vineyard)\b/, 'un viñedo'], [/\b(grower|farm|ranch|orchard|field|nursery|greenhouse)\b/, 'un rancho'],
  [/\b(restaurant|diner|taqueria|caf[eé]|bakery|kitchen|food truck)\b/, 'un restaurante'], [/\b(grocery|supermarket|market)\b/, 'un supermercado'],
  [/\b(store|shop|mall|retailer|boutique)\b/, 'una tienda'], [/\b(factory|plant|manufactur\w*|assembly)\b/, 'una fábrica'],
  [/\b(construction|contractor|builder|roofing|plumbing|electric)\b/, 'una compañía de construcción'], [/\b(hotel|motel|resort|inn)\b/, 'un hotel'],
  [/\b(bank|credit union)\b/, 'un banco'], [/\b(airport)\b/, 'el aeropuerto'], [/\b(port|harbor|terminal)\b/, 'el puerto'], [/\b(casino)\b/, 'un casino'],
  [/\b(church|parish)\b/, 'una iglesia'], [/\b(city|county|state agency|government|post office)\b/, 'el gobierno'],
  [/\b(auto shop|body shop|garage|dealership)\b/, 'un taller'], [/\b(salon|barbershop|spa)\b/, 'un salón de belleza'],
  [/\b(office|firm|agency|company|startup|consultancy)\b/, 'una compañía'],
];

/**
 * A workplace in Spanish for a catalog employer ("a regional hospital" → "un hospital regional", "their own
 * orchard" → "mi propio rancho"), or null when the kind of place is not known.
 * @param {string|null} employer
 * @returns {string|null}
 */
export function employerEs(employer) {
  const e = String(employer || '').toLowerCase().trim();
  if (!e || /^a local employer$/.test(e)) return null;
  const own = /^their own\b/.test(e), family = /^their family'?s?\b/.test(e);
  for (const [re, es] of EMPLOYER_ES) {
    if (!re.test(e)) continue;
    const noun = es.replace(/^(un|una|el|la) /, '');
    if (own) return `mi propi${/^(una|la) /.test(es) ? 'a' : 'o'} ${noun}`;
    if (family) return `${/^(una|la) /.test(es) ? 'la' : 'el'} ${noun} de mi familia`;
    return es;
  }
  return null;
}

// Places Spanish names its own way. The rest of the record's birthplaces (Michoacán, El Salvador, Jalisco) are
// already Spanish names; a name with its own article keeps it only when it comes first ("la Ciudad de México").
const PLACE_ES = {
  'mexico city': 'la Ciudad de México', 'state of mexico': 'el Estado de México', mexico: 'México', 'guatemala city': 'la Ciudad de Guatemala',
  'panama city': 'la Ciudad de Panamá', panama: 'Panamá', peru: 'Perú', philippines: 'Filipinas', spain: 'España', brazil: 'Brasil',
  'dominican republic': 'la República Dominicana', 'united states': 'Estados Unidos', japan: 'Japón', 'south korea': 'Corea del Sur',
  korea: 'Corea', canada: 'Canadá', germany: 'Alemania', italy: 'Italia', france: 'Francia', england: 'Inglaterra',
  'united kingdom': 'el Reino Unido', ireland: 'Irlanda', portugal: 'Portugal', yucatan: 'Yucatán', 'nuevo leon': 'Nuevo León',
  queretaro: 'Querétaro', michoacan: 'Michoacán', 'san luis potosi': 'San Luis Potosí', cambodia: 'Camboya', thailand: 'Tailandia',
  lebanon: 'el Líbano', iran: 'Irán', armenia: 'Armenia', russia: 'Rusia', ukraine: 'Ucrania', poland: 'Polonia', egypt: 'Egipto',
  ethiopia: 'Etiopía', haiti: 'Haití', belize: 'Belice', 'new york': 'Nueva York', 'new mexico': 'Nuevo México',
};

/**
 * A place name as a Spanish speaker says it: "Mexico City" → "la Ciudad de México", "Toluca, State of Mexico" →
 * "Toluca, Estado de México", "the Philippines" → "Filipinas". Names Spanish shares ("Michoacán", "Fresno") come back
 * unchanged.
 * @param {string|null} name
 * @returns {string|null}
 */
export function placeEs(name) {
  if (name === null || name === undefined) return name;
  const parts = String(name).split(',').map(x => x.trim());
  return parts.map((p, i) => {
    const es = PLACE_ES[p.toLowerCase().replace(/^the /, '')];
    if (!es) return p;
    return i === 0 ? es : es.replace(/^(el|la) /, '');
  }).join(', ');
}

// Whole background labels in Spanish, by the speaker's sex: [man, woman].
const HERITAGE_WHOLE_ES = {
  'african american': ['afroamericano', 'afroamericana'], 'native american': ['indígena', 'indígena'], 'asian american': ['asiático-americano', 'asiático-americana'],
  'pacific islander': ['de las islas del Pacífico', 'de las islas del Pacífico'], 'native hawaiian': ['hawaiano', 'hawaiana'],
  'alaska native': ['nativo de Alaska', 'nativa de Alaska'], latino: ['latino', 'latina'], latina: ['latina', 'latina'], hispanic: ['hispano', 'hispana'],
};

/**
 * A background label as a Spanish speaker says it of themself ("Hispanic" → "hispana" for a woman), or the label
 * itself when Spanish has no settled word for it.
 * @param {string} label
 * @param {'M'|'F'} sex
 * @returns {string}
 */
export function heritageLabelEs(label, sex) {
  const hit = HERITAGE_WHOLE_ES[String(label || '').toLowerCase().trim()];
  return hit ? hit[sex === 'F' ? 1 : 0] : String(label || '');
}

/**
 * A trail's label in Spanish: "a trailhead in the Santa Monica Mountains" → "un sendero en las montañas de Santa
 * Monica", "the trail up Mount Diablo" → "el sendero que sube a Mount Diablo".
 * @param {string|null} label
 * @returns {string|null}
 */
export function trailEs(label) {
  if (typeof label !== 'string' || !label) return null;
  const range = n => {
    let m;
    if ((m = /^(.+) Mountains$/.exec(n))) return `las montañas de ${m[1]}`;
    if ((m = /^(.+) Mountain$/.exec(n))) return `el monte ${m[1]}`;
    if ((m = /^(.+) Hills$/.exec(n))) return `las lomas de ${m[1]}`;
    if ((m = /^(.+) (Range|Sierra)$/.exec(n))) return `la sierra de ${m[1]}`;
    return n;
  };
  let m;
  if ((m = /^a trailhead (?:in the|on) (.+)$/.exec(label))) return `un sendero en ${range(m[1])}`;
  if ((m = /^the trail up (.+)$/.exec(label))) return `el sendero que sube a ${m[1]}`;
  if ((m = /^the trail near (.+)$/.exec(label))) return `el sendero cerca de ${m[1]}`;
  return label.replace(/^the /i, '');
}

/** "the fifties" → "los años cincuenta": a decade as decadeWords says it, in Spanish. */
export function decadeEs(decade) {
  const words = { 'the teens': 'los años diez', 'the twenties': 'los años veinte', 'the thirties': 'los años treinta', 'the forties': 'los años cuarenta', 'the fifties': 'los años cincuenta',
    'the sixties': 'los años sesenta', 'the seventies': 'los años setenta', 'the eighties': 'los años ochenta', 'the nineties': 'los años noventa' };
  const d = String(decade || '');
  if (words[d]) return words[d];
  const m = /^the (\d{4})s$/.exec(d);
  return m ? `los ${m[1]}` : null;
}

/** School level words: [English, Spanish]. *//** School level words: [English, Spanish]. */
export const SCHOOL_WORDS = Object.freeze({
  preschool: ['preschool', 'kínder'], elementary: ['elementary school', 'primaria'], middle: ['middle school', 'secundaria'],
  high: ['high school', 'preparatoria'], college: ['college', 'universidad'], grad: ['grad school', 'posgrado'],
});

/** Compass words in Spanish. */
export const DIR_ES = Object.freeze({ north: 'norte', northeast: 'noreste', east: 'este', southeast: 'sureste', south: 'sur', southwest: 'suroeste', west: 'oeste', northwest: 'noroeste' });

/** Home-language names in Spanish (Census language groups). */
export const LANG_ES = Object.freeze({ Spanish: 'español', Chinese: 'chino', Vietnamese: 'vietnamita', Tagalog: 'tagalo', Korean: 'coreano', Arabic: 'árabe', French: 'francés', German: 'alemán' });

/** "casi todos mis vecinos hablan": a share with its verb, in Spanish. */
export function shareVerbEs(share) {
  if (share >= 0.85) return 'casi todos mis vecinos hablan';
  if (share >= 0.6) return 'la mayoría de mis vecinos habla';
  if (share >= 0.42) return 'como la mitad de mis vecinos habla';
  if (share >= 0.29) return 'como la tercera parte de mis vecinos habla';
  if (share >= 0.21) return 'uno de cada cuatro vecinos habla';
  if (share >= 0.15) return 'uno de cada seis vecinos habla';
  return 'uno de cada diez vecinos habla';
}

/** The sky in Spanish, after "Estamos a 66 grados y ___" (a clause) and as an adjective for the forecast. */
export function cieloEs(short) {
  const l = String(short || '').toLowerCase();
  if (/thunder/.test(l)) return ['hay tormenta', 'con tormentas'];
  if (/snow|flurr/.test(l)) return /chance/.test(l) ? ['puede que nieve', 'con probabilidad de nieve'] : ['está nevando', 'con nieve'];
  if (/rain|shower|drizzle/.test(l)) return /chance|likely/.test(l) ? ['puede que llueva', 'con probabilidad de lluvia'] : ['está lloviendo', 'lluvioso'];
  if (/fog/.test(l)) return ['hay neblina', 'con neblina'];
  if (/smoke|haze/.test(l)) return ['hay humo', 'con humo'];
  if (/wind|breez|blust/.test(l)) return ['hace viento', 'con viento'];
  if (/mostly sunny|mostly clear/.test(l)) return ['casi no hay nubes', 'mayormente soleado'];
  if (/partly sunny/.test(l)) return ['hay sol y nubes', 'parcialmente soleado'];
  if (/partly/.test(l)) return ['está medio nublado', 'parcialmente nublado'];
  if (/cloudy|overcast/.test(l)) return ['está nublado', 'nublado'];
  if (/sunny/.test(l)) return ['hace sol', 'soleado'];
  if (/clear/.test(l)) return ['está despejado', 'despejado'];
  return ['el clima está normal', 'normal'];
}

/** "mañana", "esta noche", "el martes": a forecast period's English "when" in Spanish. */
export function cuandoEs(when) {
  const w = String(when || '').toLowerCase();
  if (w === 'tonight') return 'esta noche';
  if (w === 'later today') return 'más tarde';
  if (w === 'tomorrow') return 'mañana';
  if (w === 'tomorrow night') return 'mañana en la noche';
  const days = { sunday: 'domingo', monday: 'lunes', tuesday: 'martes', wednesday: 'miércoles', thursday: 'jueves', friday: 'viernes', saturday: 'sábado' };
  const m = /^(\w+)( night)?$/.exec(w);
  if (m && days[m[1]]) return `el ${days[m[1]]}${m[2] ? ' en la noche' : ''}`;
  if (/thanksgiving/.test(w)) return 'el Día de Acción de Gracias';
  if (/christmas/.test(w)) return 'en Navidad';
  return 'pronto';
}

/** Spanish month name. */
export const mesEs = m => (m >= 1 && m <= 12 ? MESES[m - 1] : null);

/** "unas 15 millas" for the English miles phrase. */
export function millasEs(milesPhrase) {
  const s = String(milesPhrase || '');
  if (s === 'a few blocks') return 'unas cuadras';
  if (s === 'less than a mile') return 'menos de una milla';
  if (s === 'about a mile') return 'una milla, más o menos';
  const m = /about (\d+) miles/.exec(s);
  return m ? `unas ${m[1]} millas` : null;
}

/** An approximate count in Spanish ("casi 290,000", "más de 1,200", "unos 90,000"). */
export function approxEs(approxPhrase) {
  const s = String(approxPhrase || '');
  return s.replace(/^almost /, 'casi ').replace(/^more than /, 'más de ').replace(/^about /, 'unos ');
}
