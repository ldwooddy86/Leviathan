// Legion · dialogue · spanish: what a player's line in Spanish says, as English the patterns already know.
//
// A player may speak Spanish to anyone. The line is read through an English paraphrase of its common phrases
// ("¿Cómo se llaman sus hijos?" → "what are your kids' names"), and introductions become English sentences for the
// mind's appraisal ("Me llamo Sam" → "my name is Sam"). The phrases are matched on the line folded to plain letters
// (accents and ¿¡ optional), most specific first, and each match uses up the words it read, so "¿Cuántos años tienen
// sus nietos?" is a question about the grandkids' ages and not also "how old are you". Usted and tú forms both count.

// Folded text ("días" → "dias", "¿Qué?" → " que?"): what the phrase table reads.
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC').replace(/[¿¡]/g, ' ');
// A phrase as a pattern whose edges are letter boundaries (the text is folded, so ASCII letters are enough).
const w = src => new RegExp(`(?<![a-z])(?:${src})(?![a-z])`);

const KIDS = 'hijos|hijas|ninos|ninas|chamacos|muchachos|chiquillos|hijitos';
const GRANDKIDS = 'nietos|nietas|nietecitos';
const SIBS = 'hermanos|hermanas';
const PARTNER = 'esposo|esposa|marido|mujer|pareja|senora|senor';
const PARENT = 'mama|mami|madre|papa|papi|padre|jefa|jefe';
const POSS = '(?:su|tu|sus|tus)';
// A partner word as the English the patterns know.
const partnerEn = m => (/esposa|mujer|senora/.test(m) ? 'wife' : /pareja/.test(m) ? 'partner' : 'husband');
const parentEn = m => (/mam|madre|jefa/.test(m) ? 'mom' : 'dad');

/**
 * [pattern, English]: the English is a string or a function of the match. Order matters: the specific readings
 * come before the general ones that would otherwise take their words.
 * @type {Array<[RegExp, string | ((m: RegExpExecArray) => string)]>}
 */
const SAYS = [
  // ---------------------------------------------------------------- accusations and status probes (probe.mjs reads the English)
  [w('(?:es|eres) (?:usted )?(?:un |una )?terroristas?'), 'are you a terrorist'],
  [w('(?:es|eres) (?:usted )?(?:un |una )?(?:criminal|delincuente|ladron|ladrona|ratero|ratera|narco|narcotraficante|traficante|pandillero|pandillera|marero|marera|cholo|chola)'), 'are you a criminal'],
  [w('(?:vende|vendes|vendia|vendias|trafica|traficas) (?:drogas?|cristal|coca|cocaina|heroina|fentanilo)'), 'do you sell drugs'],
  [w(`${POSS} (?:${PARTNER}|hijo|hija|hijos|familia) (?:esta|anda|estan|andan) (?:metid[oa]s? )?en (?:una |la )?(?:pandilla|ganga|clica|mara)`), m => `is your ${/hij/.test(m[0]) ? 'son' : /famil/.test(m[0]) ? 'family' : partnerEn(m[0])} in a gang`],
  [w('(?:esta|estas|anda|andas) (?:metid[oa] )?en (?:una |la )?(?:pandilla|ganga|clica|mara)'), 'are you in a gang'],
  [w('(?:cruzo|cruzaste|se brinco|te brincaste|se paso|te pasaste|brinco|brincaste) (?:la frontera|el cerco|la linea|el muro|el rio|el bordo)'), 'did you cross the border'],
  [w('(?:es|eres) (?:usted )?ilegal|(?:esta|estas) (?:aqui )?ilegal(?:mente)?'), 'are you illegal'],
  [w('(?:tiene|tienes) (?:sus |tus )?papeles'), 'do you have papers'],
  [w('(?:come|comen|comes|comian|comia) (?:carne de )?(?:perros?|gatos?)'), 'do you eat dogs'],

  // ---------------------------------------------------------------- holidays ("Acción de Gracias" is never a thank-you)
  [w('(?:feliz|felices) (?:dia de )?accion de gracias'), 'happy thanksgiving'],
  [w('feliz navidad|felices fiestas'), 'merry christmas'],
  [w('(?:feliz|prospero) ano nuevo'), 'happy new year'],
  [w('(?:va|vas|van) a trabajar (?:el )?(?:dia de )?(?:accion de gracias|thanksgiving)|(?:trabaja|trabajas) (?:el )?(?:dia de )?accion de gracias'), 'are you working on thanksgiving'],
  [w('(?:va|vas|van) a (?:hacer|cocinar|preparar|comer) (?:un |el )?pavo'), 'are you cooking a turkey for thanksgiving'],
  [w('(?:que|que cosa) (?:va|vas|van) a (?:hacer|cocinar|preparar)(?: de comer)? (?:para|en) (?:la )?navidad|(?:planes|que hace|que haces) (?:para|en) (?:la )?navidad'), 'what are you doing for christmas'],
  [w('(?:que|que cosa) (?:va|vas|van) a (?:hacer|cocinar|preparar)(?: de comer)? (?:para|en) (?:el )?(?:dia de )?accion de gracias|(?:planes|que hace|que haces) (?:para|en) (?:el )?(?:dia de )?accion de gracias|(?:va|vas|van) a (?:ir|salir) a (?:algun lado|alguna parte) (?:para|en) (?:el )?(?:dia de )?accion de gracias'), 'what are you doing for thanksgiving'],
  [w('(?:el )?(?:dia de )?accion de gracias'), 'thanksgiving'],

  // ---------------------------------------------------------------- family
  [w(`como se llaman? ${POSS} (?:${GRANDKIDS})`), "what are your grandkids' names"],
  [w(`como se llaman? ${POSS} (?:${KIDS})`), "what are your kids' names"],
  [w(`como se llaman? ${POSS} (?:${SIBS})`), "what are your siblings' names"],
  [w(`como se llama ${POSS} (?:${PARTNER})`), m => `what's your ${partnerEn(m[0])}'s name`],
  [w(`como se llama ${POSS} (?:hijo|hija)`), m => `what's your ${/hija/.test(m[0]) ? 'daughter' : 'son'}'s name`],
  [w(`como se llama ${POSS} (?:${PARENT})`), m => `what's your ${parentEn(m[0].split(' ').pop())}'s name`],
  [w(`(?:cuantos anos|que edad) (?:tienen|tiene) ${POSS} (?:${GRANDKIDS})`), 'how old are your grandkids'],
  [w(`(?:cuantos anos|que edad) (?:tienen|tiene) ${POSS} (?:${KIDS})`), 'how old are your kids'],
  [w(`(?:cuantos anos|que edad) (?:tienen|tiene) ${POSS} (?:${SIBS})`), 'how old are your siblings'],
  [w(`(?:cuantos anos|que edad) tiene ${POSS} (?:${PARTNER})`), m => `how old is your ${partnerEn(m[0])}`],
  [w(`(?:cuantos anos|que edad) tiene ${POSS} (?:${PARENT})`), m => `how old is your ${parentEn(m[0].split(' ').pop())}`],
  [w(`(?:cuantos anos|que edad) tiene ${POSS} (?:hijo|hija|nieto|nieta)`), m => `how old is your ${/nieta/.test(m[0]) ? 'granddaughter' : /nieto/.test(m[0]) ? 'grandson' : /hija/.test(m[0]) ? 'daughter' : 'son'}`],
  [w('cuantos anos tienen|que edad tienen'), 'how old are they'],
  [w(`(?:en que|donde) trabaja ${POSS} (?:${PARTNER})|a que se dedica ${POSS} (?:${PARTNER})|${POSS} (?:${PARTNER}) (?:trabaja|tiene trabajo)`), m => `what does your ${partnerEn(m[0])} do`],
  [w(`(?:en que|donde) trabaja ${POSS} (?:${PARENT})|a que se dedica ${POSS} (?:${PARENT})|${POSS} (?:${PARENT}) trabaja`), m => `what does your ${parentEn((/(?:mama|mami|madre|papa|papi|padre|jefa|jefe)/.exec(m[0]) || ['papa'])[0])} do`],
  [w(`(?:en que|donde) trabajan ${POSS} (?:papas|padres|jefes)|a que se dedican ${POSS} (?:papas|padres|jefes)`), 'what do your parents do'],
  [w(`(?:a que escuela|a donde) van ${POSS} (?:${KIDS}|${GRANDKIDS})|${POSS} (?:${KIDS}|${GRANDKIDS}) (?:van a la escuela|estudian)`), m => `where do your ${/niet/.test(m[0]) ? 'grandkids' : 'kids'} go to school`],
  [w(`que tal la escuela de ${POSS} (?:${KIDS}|${GRANDKIDS})|como (?:les va|van) ${POSS} (?:${KIDS}|${GRANDKIDS}) en la escuela`), 'where do your kids go to school'],
  [w(`(?:tiene|tienes) (?:${GRANDKIDS})|cuantos nietos`), 'do you have grandkids'],
  [w(`(?:tiene|tienes) (?:${KIDS})|cuantos hijos`), 'do you have kids'],
  [w(`(?:tiene|tienes) (?:${SIBS})|${POSS} (?:${SIBS})`), 'do you have brothers or sisters'],
  [w('(?:es|eres|esta|estas) casad[oa]|(?:es|eres) (?:solter[oa]|viud[oa]|divorciad[oa])'), 'are you married'],
  [w('con quien (?:vive|vives)|(?:vive|vives) con (?:su|tu) familia|(?:tiene|tienes) familia (?:aqui|aca|por aqui|en (?:la casa|california))|(?:vive|vives) (?:sol[oa]|con alguien)'), 'who do you live with'],
  [w(`${POSS} (?:${PARTNER})`), m => `tell me about your ${partnerEn(m[0])}`],
  [w('(?:su|tu) familia'), 'tell me about your family'],

  // ---------------------------------------------------------------- about them
  [w('cuantos anos (?:tiene|tienes)|que edad (?:tiene|tienes)'), 'how old are you'],
  [w('cuando (?:llego|llegaste|vino|viniste|se vino|te viniste) (?:a|para) (?:los )?(?:estados unidos|este pais|california|aca|aqui|el norte)|cuanto tiempo (?:tiene|tienes|lleva|llevas) en (?:los )?(?:estados unidos|este pais|california|el norte)'), 'when did you come to the us'],
  [w('por que (?:se vino|te viniste|vino|viniste|se mudo|te mudaste|se fue|te fuiste)(?: para aca| aqui| a este pais| a california| para aqui)?|que (?:lo|la|te) trajo (?:aqui|para aca|a california|a este pais)'), 'what brought you here'],
  [w('de donde (?:es|eres|son|viene|vienes)|donde (?:nacio|naciste)|(?:es usted|eres) de aqui|(?:es|eres) de (?:aqui|por aqui)'), 'where are you from'],
  [w('(?:crecio|creciste) (?:aqui|por aqui|aca)'), 'did you grow up here'],
  // the place they come from: missing it, going back to visit, going back for good
  [w('(?:extrana|extranas) (?:a |mucho |a veces )?(?:mexico|el salvador|guatemala|honduras|nicaragua|el pais|(?:su|tu) (?:tierra|pais|pueblo|rancho|rancho|gente|casa))'), 'do you miss home'],
  [w('(?:piensa|piensas|quiere|quieres|planea|planeas) (?:regresar|volver|irse|irte) (?:a vivir )?(?:a|para) (?:mexico|el salvador|guatemala|honduras|su pais|tu pais|su tierra|tu tierra|alla)|(?:piensa|piensas) regresar'), 'would you ever move back'],
  [w('(?:va|vas|regresa|regresas|visita|visitas) (?:seguido |mucho |de vez en cuando )?(?:a|para) (?:mexico|el salvador|guatemala|honduras|nicaragua|su pais|tu pais|su tierra|tu tierra|su pueblo|tu pueblo|alla)'), 'do you go back to visit'],
  [w('(?:habla|hablas) (?:usted )?ingles'), 'do you speak english'],
  [w('(?:habla|hablas) (?:usted )?espanol'), 'do you speak spanish'],
  [w('que (?:idiomas|lenguas) (?:habla|hablas)'), 'what languages do you speak'],
  [w('que (?:hace|haces) en (?:su|tu) tiempo libre|que (?:le|te) gusta hacer|(?:sus|tus) pasatiempos|que (?:hace|haces) para divertirte|que (?:hace|haces) para divertirse'), 'what do you do for fun'],
  [w('(?:le|te) gusta cocinar'), 'do you like to cook'],
  [w('(?:le|te) gusta (?:leer|la lectura)'), 'do you like to read'],
  [w('(?:le|te) gusta bailar'), 'do you like to dance'],
  [w('(?:le|te) gusta pescar'), 'do you like to fish'],
  [w('(?:le|te) gusta (?:el jardin|la jardineria|trabajar en el jardin)'), 'do you like to garden'],
  [w('(?:le|te) gusta (?:el )?(?:futbol|beisbol|basquetbol|basquet|basket|box|boxeo)'), 'do you like sports'],
  [w('(?:le|te) va (?:al|a los|a las|a) [a-z]+'), 'are you a soccer fan'],
  [w('cual es (?:su|tu) comida favorita|que (?:le|te) gusta comer'), "what's your favorite food"],
  [w('(?:va|vas|ira|iras) (?:mucho |seguido )?a (?:la )?(?:iglesia|misa)'), 'do you go to church'],
  [w('(?:esta|estas) (?:muy )?cansad[oa]'), 'are you tired'],
  [w('(?:esta|estas) (?:muy )?ocupad[oa]'), 'are you busy'],
  [w('(?:tiene|tienes) (?:carro|coche|troca|camioneta|auto)'), 'do you have a car'],

  // ---------------------------------------------------------------- work
  [w('a que hora (?:empieza|empiezas|entra|entras|comienza|comienzas)(?: a trabajar| al trabajo| a la chamba)?'), 'what time do you start work'],
  [w('a que hora (?:sale|sales|termina|terminas)(?: de trabajar| del trabajo| de la chamba)?'), 'what time do you get off work'],
  [w('(?:es|esta) (?:muy )?(?:pesado|duro|dificil|cansado|cansador) (?:el|su|tu) (?:trabajo|jale|chamba)|(?:el|su|tu) (?:trabajo|jale|chamba) (?:es|esta) (?:muy )?(?:pesado|duro|dificil|cansado)'), 'is your work hard'],
  [w('que tal (?:el|su|tu) (?:trabajo|jale|chamba)|como (?:le|te) va en (?:el|su|tu) trabajo'), 'how do you like your job'],
  [w('(?:le|te) gusta (?:su|tu) (?:trabajo|chamba|jale)'), 'do you like your job'],
  [w('(?:trabaja|trabajas) (?:hoy|ahorita|ahora)'), 'are you working today'],
  [w('(?:trabaja|trabajas) (?:los )?(?:fines de semana|sabados|domingos)'), 'do you work weekends'],
  [w('cuanto (?:gana|ganas|le pagan|te pagan)'), 'how much do you make'],
  [w('como (?:se va|te vas|llega|llegas|se viene|te vienes) (?:al|a su|a tu) (?:trabajo|jale|chamba)|como (?:se va|te vas) a trabajar'), 'how do you get to work'],
  [w('(?:a|en) que (?:se dedica|te dedicas|trabaja|trabajas)|donde (?:trabaja|trabajas)|cual es (?:su|tu) trabajo|de que (?:trabaja|trabajas)'), 'what do you do for work'],

  // ---------------------------------------------------------------- home and neighborhood
  [w('(?:vive|vives) (?:cerca|por aqui|aqui cerca|aqui|por aca|aca)'), 'do you live around here'],
  [w('donde (?:vive|vives)'), 'where do you live'],
  [w('cuanto tiempo (?:tiene|tienes|lleva|llevas) (?:viviendo )?(?:aqui|aca|en [a-z]+(?: [a-z]+)?)|desde cuando (?:vive|vives) (?:aqui|aca)|hace cuanto (?:vive|vives) (?:aqui|aca)'), 'how long have you lived here'],
  [w('(?:renta|rentas) o (?:es|eres) (?:duen[oa]|propietari[oa])|(?:renta|rentas) o (?:tiene|tienes) casa propia|(?:es|eres) duen[oa] de (?:la|su|tu) casa'), 'do you own or rent'],
  [w('(?:le|te) gusta (?:su|tu) casa'), 'do you like your house'],
  [w('(?:es|esta) (?:muy )?(?:seguro|segura|tranquilo|tranquila|peligroso|peligrosa) (?:el barrio|aqui|por aqui|la zona|el vecindario|la colonia)|(?:el barrio|la zona|el vecindario|la colonia) (?:es|esta) (?:muy )?(?:seguro|tranquilo|peligroso)'), 'is it safe around here'],
  [w('que (?:opina|opinas|piensa|piensas) (?:del|de este|de su|de tu) (?:barrio|vecindario|pueblo|ciudad|colonia)'), 'what do you think of the neighborhood'],
  [w('(?:es|esta) (?:muy )?(?:dificil|caro) vivir (?:aqui|aca|en [a-z]+)|vivir (?:aqui|aca) (?:es|esta) (?:muy )?(?:dificil|caro)'), 'is it expensive to live here'],
  [w('(?:le|te) gusta (?:vivir|estar) (?:aqui|aca|por aqui|en [a-z]+(?: [a-z]+){0,2})|(?:le|te) gusta (?:el|este|su|tu) (?:barrio|pueblo|vecindario|lugar)'), 'do you like living here'],
  [w('como es (?:vivir aqui|el barrio|la zona|la vida aqui)'), "what's it like living here"],

  // ---------------------------------------------------------------- weather, traffic, fire, storms, quakes
  [w('(?:hace|hara) (?:mucho |tanto )?calor (?:aqui |aca )?en (?:el )?verano|que tanto calor hace|(?:cuanto|que tan) calor hace'), 'how hot does it get in the summer'],
  [w('(?:hace|hara) (?:mucho |tanto )?frio (?:aqui |aca )?en (?:el )?invierno'), 'how cold does it get in winter'],
  [w('(?:hace|va a hacer|hara) (?:mucho )?(?:frio|calor|viento) (?:en la noche|esta noche|en la manana|manana)'), m => `is it going to be ${/frio/.test(m[0]) ? 'cold' : /calor/.test(m[0]) ? 'hot' : 'windy'} tonight`],
  [w('va a llover|lluvia|llueve|tormentas?'), 'is it going to rain'],
  [w('que tiempo|el tiempo|el clima|el pronostico|hace (?:calor|frio|viento)|que (?:calor|frio)'), "what's the weather like"],
  [w('trafico|la autopista|el freeway|la carretera'), "how's traffic"],
  [w('incendios?|fuegos?|el humo'), 'were there fires here'],
  [w('terremotos?|temblor|temblores'), 'do you get earthquakes'],
  [w('inundaciones|inundacion|se inunda|se inundo'), 'does it flood here'],

  // ---------------------------------------------------------------- money and housing
  [w('la renta|el alquiler|rentar|cuanto (?:paga|pagas) de renta'), 'how much is rent'],
  [w('cuanto (?:cuesta|cuestan) (?:una casa|las casas)|el precio de las casas|las casas'), 'how much are houses here'],
  [w('aseguranza|el seguro'), 'is insurance a problem'],

  // ---------------------------------------------------------------- food, places, directions, the past
  [w('donde (?:hay|venden|puedo comer|se pueden comer|consigo) (?:unos |unas |buenos |buenas )*(tamales|tacos|pupusas|birria|menudo|pozole|mariscos|tortas|pan dulce|carnitas|pho|pizza|hamburguesas|helado|cafe)'), m => `where can i get ${m[1] === 'hamburguesas' ? 'burgers' : m[1] === 'helado' ? 'ice cream' : m[1] === 'cafe' ? 'coffee' : m[1]}`],
  [w('que me recomienda comer|donde (?:puedo |se puede )?comer|(?:buena|la) comida|restaurantes?|un buen lugar para comer'), 'where should i eat'],
  [w('donde (?:esta|queda|hay) (?:la |el |una |un )?(?:tienda|mercado|super|supermercado|marqueta)(?: mas cercan[oa])?'), 'where is the grocery store'],
  [w('donde (?:esta|queda|hay) (?:la |el |una |un )?(?:farmacia|botica)(?: mas cercan[oa])?'), 'where is the pharmacy'],
  [w('donde (?:esta|queda|hay) (?:la |el |una |un )?(?:iglesia|parroquia)(?: mas cercan[oa])?'), 'where is the church'],
  [w('donde (?:esta|queda|hay) (?:la |el |una |un )?(?:parque)(?: mas cercano)?'), 'where is the park'],
  [w('(?:como llego|como se llega|donde (?:esta|queda)) al centro'), 'how do i get to downtown'],
  [w('donde (?:esta|queda) la playa|como llego a la playa'), 'how do i get to the beach'],
  [w('que (?:hay|se puede hacer|me recomienda) (?:que hacer |para hacer )?(?:por )?(?:aqui|aca)|que puedo (?:ver|hacer)'), 'what should i see around here'],
  [w('como (?:llego|puedo llegar|se llega)|donde (?:esta|queda)'), 'how do i get to'],
  [w('(?:se acuerda|te acuerdas) (?:de )?(?:como era|cuando)|como era (?:antes|aqui antes|el barrio antes)|en aquellos tiempos'), 'what was it like back then'],

  // ---------------------------------------------------------------- small talk, plans, jokes
  [w('que (?:va|vas) a hacer (?:este |el )?fin de semana|(?:tiene|tienes) planes (?:para )?(?:este |el )?fin de semana'), 'what are you doing this weekend'],
  [w('(?:cuente(?:me)?|cuentame|digame|dime|sabe|sabes) (?:un|algun) chiste'), 'tell me a joke'],
  [w('cuente(?:me)? mas|cuentame mas|digame mas|y que mas'), 'tell me more'],
  [w('que (?:esta|estas) haciendo|a donde (?:va|vas)|que (?:hace|haces) por aqui'), 'what are you up to'],
  [w('que (?:opina|opinas|piensa|piensas)|(?:le|te) gusta'), 'what do you think about'],

  // ---------------------------------------------------------------- greetings, thanks, goodbyes
  [w('(?:muy )?bien,? (?:gracias,? )?y (?:usted|tu)'), 'good, and you'],
  [w('y (?:usted|tu)'), 'and you'],
  [w('hola|buenas|buenas tardes|buenas noches|buenos dias|que onda|quiubo|que hubo|saludos'), 'hello'],
  [w('como (?:estas?|estan|le va|te va|les va|andas|anda|ha estado|has estado|amanecio|amaneciste|se siente|te sientes)|que tal|como va todo'), 'how are you'],
  [w('como (?:se|te) llamas?|cual es (?:su|tu) nombre|quien es usted|quien eres'), "what's your name"],
  [w('adios|hasta (?:luego|pronto|manana|la vista)|nos vemos|cuide(?:se)?|cuidate|que (?:le|te) vaya bien|me voy'), 'bye'],
  [w('perdon(?:e(?:me)?)?|disculpe(?:me)?|disculpame|lo siento'), 'sorry'],
  [w('(?:muy|que|es usted|eres) (?:amable|simpatic[oa]|buena onda)'), "you're very nice"],
  [w('(?:muchas |mil )?gracias'), 'thanks'],
];

// Introductions as the mind's appraisal reads them.
const INTRO = [
  [/(?<![a-záéíóúñü])(?:me llamo|mi nombre es)\s+/gi, 'my name is '],
  [/(?<![a-záéíóúñü])soy de\s+/gi, "I'm from "],
  [/(?<![a-záéíóúñü])vivo en\s+/gi, 'I live in '],
];
const YES = /^[¡¿\s]*(s[ií]|claro|por supuesto|as[ií] es|exacto|c[oó]mo no)(?![a-záéíóúñü])/i;
// Words that mark a line as Spanish (two of them, or Spanish punctuation). Not "la", "el", "son" or "hay": LA, El
// Cajon and a son are English too.
const WORDS = new RegExp(`(?<![a-záéíóúñü])(usted|ustedes|tiene|tienes|tengo|est[aá]|est[aá]s|estoy|qu[eé]|c[oó]mo|d[oó]nde|cu[aá]ndo|cu[aá]nto|cu[aá]ntos|qui[eé]n|aqu[ií]|tambi[eé]n|muy|pero|porque|bueno|buena|buenos|buenas|tardes|noches|d[ií]as|se[nñ]ora?|gracias|hola|mucho|gusto|eres|soy|vive|vives|vivo|llama|llamo|trabajo|trabaja|trabajas|familia|hijos|hijas|nietos|hermanos|esposo|esposa|tiempo|clima|lluvia|renta|casas|comer|comida|llego|queda|chiste|cu[eé]nteme|d[ií]game|dime|adi[oó]s|vemos|tal|onda|hace|puedo|lleva|llevas|vaya|casad[oa]|a[nñ]os|edad|iglesia|barrio|calor|fr[ií]o|escuela|nos|ella|ellos|habla|hablas|ingl[eé]s|espa[nñ]ol|feliz|navidad|acci[oó]n|cerca|carro|gusta)(?![a-záéíóúñü])`, 'g');

/**
 * How a Spanish line reads in English, for the patterns and the appraisal: {en, says} (en: the line with its
 * introductions in English; says: the English of each phrase read, most specific first), or null when the line is not
 * Spanish.
 * @param {string} raw
 * @returns {{en: string, says: string[]}|null}
 */
export function spanishReading(raw) {
  const lower = String(raw || '').toLowerCase();
  const words = new Set([...lower.matchAll(WORDS)].map(m => m[1].normalize('NFD').replace(/\p{M}/gu, '')));
  let en = String(raw);
  for (const [re, to] of INTRO) en = en.replace(re, to);
  const says = [];
  let rest = fold(lower);
  for (const [re, to] of SAYS) {
    const m = re.exec(rest);
    if (!m) continue;
    says.push(typeof to === 'function' ? to(m) : to);
    // the words read are used up: a later, more general phrase does not read them again
    rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length);
  }
  if (YES.test(lower)) says.unshift('yes');
  // Spanish punctuation, two Spanish words, or a phrase only Spanish has
  if (!/[¿¡]/.test(lower) && words.size < 2 && !says.length && en === String(raw)) return null;
  return { en, says };
}
