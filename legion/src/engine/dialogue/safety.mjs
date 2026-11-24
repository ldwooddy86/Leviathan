// Legion · dialogue · safety: what no conversation plays along with.
//
// Some lines from a player are not part of the game, and the offline engine (the voice of every NPC without a Claude
// key) reads them before anything else (understand.mjs), so no topic planner ever answers one:
//
//   crisis  the player says they want to die or to hurt themselves, that someone is hurting them, or that they are
//           having an emergency. The NPC answers kindly and steps out of the scene with 988 (call or text) and 911;
//           the line carries a note from Legion with the same numbers. Nothing jokes, pivots or asks a question back.
//   sexual  a sexual line; an advance, a lure or a secret aimed at a minor; asking whether someone is home alone;
//           asking a minor where they live or for their number. An adult declines and disengages (a plain romantic
//           line gets a polite no); a minor refuses, gives nothing away about where they live or who is home, and
//           goes to find a parent; a toddler runs to one.
//   threat  a threat to kill or hurt, rape, burn a house, shoot up a school or bomb a place, hurt the NPC's family,
//           stalking ("I know where you live"), or a threat to call immigration on them. The NPC disengages firmly;
//           a threat of mass violence gets a word about calling 911.
//
// safetyOf() reads English and Spanish, on the line folded to plain lower-case letters. Readings that only matter for
// a child (a compliment on their looks, "come with me", "where do you live?") apply only when opts.age is under 18.

const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}+/gu, '').normalize('NFC')
  .replace(/[’‘`´]/g, "'").replace(/[¿¡]/g, ' ').replace(/\s+/g, ' ').trim();

// "I'll", "I'm going to", "I'm gonna", "I want to", "I could": a first person about to do something.
const I_WILL = "(?:i(?:'ll|ll| will| shall|'m going to|m going to| am going to|'m gonna|m gonna| am gonna| gonna| wanna| want to|'d like to| would like to| can|'m about to| am about to|'m coming to)|let me|imma|i'?ma)";
// Who a threat can be aimed at: the listener, their family, home or pets, or a crowd.
const AIMED = "(?:you|u|ya|y'?all|your (?:\\w+ )?(?:family|kids?|children|son|sons|daughters?|wife|husband|mom|mother|dad|father|parents|brothers?|sisters?|baby|babies|grandkids|grandchildren|dogs?|cats?|pets?|neighbors|friends|boss|coworkers|people)|everyone|everybody|all of you|them all|the (?:kids|children|students|teachers))";
const VIOLENT = '(?:kill|murder|hurt|stab|shoot|strangle|choke|slap|punch|kick|kidnap|abduct|attack|assault|torture|beat up|beat|cut|run over|slit|break)';
const PLACES = '(?:house|home|place|apartment|trailer|car|truck|store|shop|business|school|class|classroom|campus|church|mosque|synagogue|temple|gurdwara|mall|office|workplace|work|building|neighborhood|town|street|block|park|stadium|concert|parade|hospital|restaurant|bar|club|library|daycare)';

// ------------------------------------------------------------------ crisis (English)

const CRISIS_EN = [
  ['suicide', new RegExp([
    "\\b(?:kill|killing|end|ending|take|taking|off|offing) (?:my ?self|my own life|my life)\\b(?!\\s+(?:at|over|for|with|trying|working|to (?:get|finish|make|keep|pay))\\b)",
    '\\bsuicid(?:e|al)\\b(?!\\s+(?:bomb\\w*|vests?|squads?|doors?|attacks?|missions?|runs?|lanes?|drills?|rates?)\\b)',
    "\\bi (?:really |just |kind of |kinda |sometimes |honestly |still |do )?(?:want|wanna|wanted|plan|am planning|'m planning|m planning|am ready|'m ready|m ready|am trying|'m trying|m trying|tried|deserve) (?:to )?die\\b(?!\\s+(?:laughing|of (?:laughter|embarrassment|boredom)))",
    "\\b(?:don'?t|do not|dont|no longer|never) (?:want|wanna|wish) (?:to )?(?:live|be alive|exist|wake up)\\b(?!\\s+(?:in|here|there|near|by|with|around|close|far|next|on|at|somewhere|anywhere|like|without|so|that|through|under|paycheck|this way|that way|downtown|out|up)\\b)|\\bdon'?t want to be here any ?more\\b",
    "\\b(?:better off dead|better off without me|no reason to live|nothing (?:left )?to live for|end it all|ending it all|not worth living|want it (?:all )?to (?:end|be over)|wish i (?:was|were) dead|wish i (?:wasn'?t|weren'?t) alive|wish i (?:was|had) never (?:been )?born|can'?t go on (?:anymore|any more|like this)|thinking (?:about|of) (?:killing|ending|hurting) myself)\\b",
    "\\bi (?:overdosed|od'?d|took (?:too many|a bunch of|a lot of|all (?:my|the|of my)) (?:pills|meds|medication|sleeping pills))\\b",
  ].join('|'))],
  ['selfharm', new RegExp([
    '\\bself[- ]?harm\\w*\\b',
    "\\b(?:cutting|hurting|harming|burning|starving|punishing) (?:my ?self|myself)\\b(?!\\s+(?:some|a|off|short|slack|in|out|loose|free|on|at|playing|working|lifting|by accident|accidentally)\\b)",
    "\\b(?:want|wanna|going|gonna|keep|kept|started|been|urge|urges|need|thinking about|think about|feel like) (?:to )?(?:cut|hurt|harm|burn|starve)(?:ing)? (?:my ?self|myself)\\b(?!\\s+(?:some|a|off|short|slack)\\b)",
  ].join('|'))],
  ['abuse', new RegExp([
    "\\b(?:someone|somebody|he|she|they|my (?:dad|father|stepdad|step-dad|step dad|mom|mother|stepmom|step-mom|step mom|parents?|husband|wife|boyfriend|girlfriend|partner|ex|uncle|aunt|brother|sister|cousin|grandpa|grandfather|grandma|grandmother|teacher|coach|neighbor|roommate|babysitter|foster (?:dad|mom|parents?)))(?: at home)? (?:keeps |always |sometimes |still |has been |have been |is |are )?(?:hit|hits|hitting|beat|beats|beating|abuse|abuses|abused|abusing|hurt|hurts|hurting|choke|chokes|choking|kick|kicks|kicking|rape|rapes|raped|raping|molest\\w*|touch(?:es|ed|ing)?|threaten\\w*|burn|burns|starve|starves) me\\b(?!\\s+(?:at|in|to|up|off|out|back|by|on the shoulder)\\b)",
    "\\bi'?m (?:being|getting) (?:abused|hit|beaten|hurt|molested|raped|trafficked|threatened|stalked|beat up)\\b",
    "\\bi (?:was|got|have been|'ve been|ve been) (?:raped|molested|sexually assaulted|abused|trafficked)\\b",
    "\\b(?:i'?m|i am) (?:not safe|scared|afraid) (?:at home|to go home|of my (?:dad|father|stepdad|mom|mother|husband|wife|boyfriend|girlfriend|partner))\\b",
    '\\bdomestic (?:violence|abuse)\\b',
  ].join('|'))],
  ['emergency', new RegExp([
    "\\b(?:i'?m|i am|i think i'?m|i think i am|i might be|i may be) (?:having|having a|in) (?:a )?(?:heart attack|stroke|seizure|medical emergency|allergic reaction|asthma attack|anaphylactic)\\b",
    "^(?:help[,!.]* ?)?(?:i|me) (?:can'?t|cannot|cant) breathe(?:[,.!]* ?(?:help|please|call (?:911|an ambulance))\\b)?[,.!]*$|\\bhelp,? i (?:can'?t|cannot|cant) breathe[,.!]*$",
    "^(?:please |someone |somebody |help,? )*call (?:911|9-1-1|an ambulance)\\b|\\b(?:please|someone|somebody) call (?:911|9-1-1|an ambulance)\\b|\\bcall (?:911|9-1-1|an ambulance)[!.]*$|\\bi need (?:an ambulance|a paramedic)\\b",
    "\\bi'?(?:ve| have) been (?:shot|stabbed|poisoned)\\b|\\bi'?m (?:bleeding (?:a lot|badly|out)|choking|overdosing)\\b",
  ].join('|'))],
];

// ------------------------------------------------------------------ crisis (Spanish, folded)

const CRISIS_ES = [
  ['suicide', new RegExp([
    '\\b(?:me quiero morir|quiero morir(?:me)?|me voy a matar|voy a matarme|quiero matarme|me quiero matar|matarme|suicidarme|suicid(?:io|a|arme)|quitarme la vida|acabar con mi vida)\\b(?! de (?:risa|hambre|sueno|verguenza|calor|frio|ganas|aburrimiento))',
    '\\b(?:ya )?no quiero (?:vivir|seguir viviendo|estar viv[oa]|despertar)\\b(?! (?:aqui|aca|alla|ahi|en|con|cerca|lejos|asi|por|sin|junto|al lado))',
    '\\b(?:estaria|estarian|estaríamos) mejor muert[oa]s?\\b|\\bmejor (?:estar muert[oa]|me muero)\\b(?! de)|\\bno vale la pena vivir\\b|\\bsin mi estarian mejor\\b',
  ].join('|'))],
  ['selfharm', /\b(?:me estoy cortando|me corto (?:los brazos|las munecas|la piel)|(?:quiero|voy a|ganas de) (?:cortarme|lastimarme|hacerme dano)|me hago dano a (?:mi mism[oa]|proposito))\b/],
  ['abuse', new RegExp([
    '\\b(?:alguien|mi (?:papa|padre|padrastro|mama|madre|madrastra|esposo|esposa|marido|novio|novia|pareja|tio|tia|hermano|hermana|primo|prima|abuelo|abuela|maestro|maestra)) me (?:pega|golpea|maltrata|lastima|toca|viola|amenaza|esta pegando|esta golpeando|hace dano)\\b',
    '\\babusa(?:n|ron)? de mi\\b|\\bme (?:violaron|abusaron|estan pegando|estan golpeando|estan maltratando)\\b|\\bviolencia domestica\\b',
  ].join('|'))],
  ['emergency', /\b(?:(?:tengo|estoy teniendo|me esta dando|creo que (?:tengo|me esta dando)) un (?:infarto|derrame|ataque (?:al corazon|cardiaco|de asma))|no puedo respirar|llam(?:e|en|a) al 911|llam(?:e|en|a) a (?:una|la) ambulancia|necesito una ambulancia|me (?:dispararon|apunalaron)|me estoy desangrando)\b/],
];

// ------------------------------------------------------------------ sexual content, advances and lures (English)

// [sub, pattern, minorOnly]
const SEXUAL_EN = [
  ['explicit', new RegExp([
    "\\b(?:have|having|had|want|wanna|let'?s have|lets have|let'?s|lets|we should have|do you want|you want|down for|into) sex\\b|\\bsex with (?:me|you|u)\\b|\\bsexual (?:favors?|with (?:me|you))\\b",
    '\\bnudes?\\b|\\bnaked\\b(?! eye)|\\bnude (?:pics?|photos?|pictures?|selfies?|videos?)\\b',
    "\\b(?:take|takes|taking|took) (?:off|of) (?:your|ur|those|these|the) (?:clothes|shirt|pants|dress|top|bra|underwear|panties|skirt|jeans)\\b|\\btake (?:your|ur) (?:clothes|shirt|pants|top|bra|underwear|dress) off\\b|\\bundress\\w*\\b|\\bstrip (?:for me|naked|down)\\b",
    '\\b(?:touch|touching|grope|groping|lick|licking|feel up|fondle) (?:you|ya|u|me|your (?:body|chest|breasts?|boobs|butt|ass|legs?|thighs?|privates?|private parts|crotch|dick|penis|pussy|vagina)|my (?:body|dick|penis|cock|privates|private parts|crotch|chest|boobs|butt|ass|pussy|vagina))\\b(?! (?:base|up on|in on)\\b)',
    "\\bwhat (?:are|r) (?:you|u) wearing\\b|\\b(?:want|wanna|let'?s|lets|we should|down to) (?:to )?hook up\\b|\\bhook up (?:with me|tonight)\\b|\\b(?:want|wanna|let'?s|lets) (?:to )?make out\\b|\\bmake out with (?:me|you)\\b",
    "\\b(?:blow ?jobs?|hand ?jobs?|oral sex|horny|dick pics?|sexting|sext me|orgasm\\w*|masturbat\\w*|porn\\w*|sleep with (?:me|you)|in bed with (?:me|you)|go to bed with (?:me|you)|suck my|my (?:dick|cock|pussy)|your (?:dick|cock|pussy))\\b",
    "\\b(?:you'?re|you are|ur|u r|you look|lookin|looking) (?:so |really |very |super )?(?:sexy|fuckable|bangable)\\b|\\b(?:want|wanna|gonna|going) (?:to )?(?:fuck|screw|bang|smash|sleep with|have sex with) (?:you|u|ya|me)\\b",
  ].join('|')), false],
  // an advance on a child: their looks, a boyfriend, a kiss, a date
  ['romance', new RegExp([
    "\\b(?:you'?re|you are|ur|u r|you look|you'?re so|you'?re really) (?:so |really |very |super )?(?:sexy|gorgeous|attractive|beautiful|cute|pretty|handsome|adorable)\\b(?! (?:good|bad|smart|cool|funny|nice|tall|fast|sure|much|busy|young|old|well|quick|strong|brave|kind|lucky)\\b)",
    "\\b(?:do you have|have you got|you have|you got|got|any) (?:a )?(?:boyfriend|girlfriend|bf|gf|crush|lover)\\b|\\b(?:are you|you'?re) (?:single|available|seeing anyone|taken)\\b",
    '\\b(?:kiss|kissing) (?:me|you|ya|u)\\b|\\bgive (?:me|you) a kiss\\b|\\bi (?:love|like) you(?! (?:guys|too|all|as a friend|very much for|for))\\b',
  ].join('|')), true],
  // romance an adult can be asked too, and declines politely
  ['romance', new RegExp([
    '\\b(?:be|become) my (?:girlfriend|boyfriend|gf|bf|valentine|wife|husband|lover|date)\\b|\\b(?:go out with me|go on a date|on a date with me|date me|take you (?:out|on a date)|marry me)\\b',
    '\\b(?:kiss|kissing) (?:me|you|ya|u)\\b|\\bgive (?:me|you) a kiss\\b|\\bi love you(?! (?:guys|too|all|as a friend))\\b',
  ].join('|')), false],
  ['lure', new RegExp([
    '\\b(?:get|hop|jump|come|climb) (?:in|into|inside) (?:my|the|our) (?:car|van|truck|ride|vehicle|backseat|back seat|minivan)\\b',
    "\\b(?:meet|meet up|hang out|hangout|get together|come over|be alone|go somewhere|go some ?place|spend time)\\b[^.?!]{0,30}\\b(?:just (?:us|you and me|the two of us|me and you)|alone|by yourself|by ourselves|in private|without (?:your|ur) (?:parents|mom|dad|mother|father|family|friends))\\b",
    '\\b(?:come|go) (?:over )?(?:to|back to) my (?:house|place|apartment|room|car|van|truck|hotel)\\b|\\bsomewhere (?:private|alone)\\b',
  ].join('|')), false],
  ['lure', new RegExp([
    "\\bcome with me\\b|\\bfollow me\\b|\\b(?:want|need) a ride\\b|\\bi(?:'ll| will| can| could) (?:give you a ride|drive you|take you (?:home|somewhere|for a ride))\\b",
    "\\b(?:i have|i got|i'?ve got|got|want|wanna see|come see|see my|there'?s) (?:some |a |free |lots of )?(?:candy|candies|puppies|puppy|kittens?|toys?|treats|ice cream|video games|a surprise|presents|money)\\b[^.?!]{0,30}\\b(?:car|van|truck|house|place|come|with me|follow|see)\\b|\\b(?:car|van|truck|house)\\b[^.?!]{0,30}\\b(?:candy|puppies|puppy|kittens?|toys|treats|ice cream)\\b",
    "\\b(?:our|a|this) (?:little )?secret\\b|\\bkeep (?:it|this|that) (?:a )?secret\\b|\\bdon'?t tell (?:your|ur|anyone|anybody|nobody|mommy|daddy)\\b",
    '\\b(?:come|go) (?:over )?to (?:your|ur) (?:house|place|home|room)\\b|\\bcan i (?:come|go) (?:over|inside|in)\\b',
  ].join('|')), true],
  ['alone', new RegExp([
    "\\b(?:are|r) (?:you|u|ya) (?:home )?(?:all )?(?:alone|by yourself)\\b(?! (?:in (?:this|that|feeling|thinking|the world|the fight)|on (?:this|that))\\b)",
    '\\bhome alone\\b|\\balone at home\\b|\\bby yourself at home\\b',
  ].join('|')), false],
  ['alone', new RegExp([
    "\\b(?:is|are) (?:there )?(?:anyone|anybody|someone|somebody) (?:else )?(?:home|at home|with you|in the house)\\b|\\bwho(?:'?s| is) (?:home|at home|there|in the house) (?:with you|right now|now)\\b",
    "\\b(?:is|are) (?:your|ur) (?:parents|mom|dad|mother|father|folks|family|grandma|grandpa) (?:home|at home|there|around|away|out|gone|at work|asleep|sleeping)\\b",
    "\\bwhen (?:are|do|will|does|is) (?:your|ur) (?:parents|mom|dad|mother|father|folks|family) (?:get home|come home|coming home|come back|get back|leave|leaving|go out|go to work|work|get off|go to sleep)\\b",
    "\\b(?:when|while) (?:your|ur) (?:parents|mom|dad|mother|father|folks|family) (?:are|is|aren'?t|isn'?t|'re|'s) (?:gone|away|out|home|at work|not home|not there|asleep|sleeping)\\b",
  ].join('|')), true],
  // a stranger who asks where you live and says they will come over, or says they will come to your home at night:
  // every age declines (where you live, asked alone, is only a child's to refuse)
  ['visit', new RegExp([
    "\\b(?:what(?:'?s| is) (?:your|ur) (?:home |house |street )?address|where (?:exactly )?do (?:you|u) live|where(?:'?s| is) (?:your|ur) (?:house|home|apartment))\\b[^.?!]{0,30}[.?!]*\\s*[^.?!]{0,30}\\b(?:i(?:'ll| will|'m going to| am going to|'m gonna| gonna| wanna| want to)|let me|can i|could i|may i) (?:come|stop|swing|drop) (?:over|by|around)\\b(?! (?:there|that way|sometime|someday|one day|(?:to )?(?:the|that|this|your|ur) (?:town|city|area|neighborhood|state|county|valley|beach|coast|region)))",
    "\\bi(?:'ll| will|'m going to| am going to|'m gonna| gonna) (?:come|stop|swing|drop) (?:over|by|around) (?:to )?(?:your|ur) (?:house|home|apartment|room)\\b",
    "\\bi(?:'ll| will|'m going to| am going to|'m gonna| gonna) (?:come|stop|swing|drop) (?:over|by|around)(?: to (?:your|ur) place)? (?:tonight|late tonight|at night|after dark|when (?:you'?re|you are) (?:alone|asleep|by yourself)|when (?:no ?one|nobody)(?:'s| is) (?:home|around))\\b",
  ].join('|')), false],
  ['location', new RegExp([
    "\\bwhat(?:'?s| is) (?:your|ur) (?:home |house |street )?address\\b|\\bwhere (?:exactly )?do (?:you|u) live\\b|\\bwhere(?:'?s| is) (?:your|ur) (?:house|home|apartment|room)\\b|\\bwhat street\\b[^.?!]{0,20}\\blive\\b|\\bwhich (?:house|apartment|building|one) (?:is yours|do you live in|is your house)\\b",
    "\\bwhat(?:'?s| is) (?:your|ur) (?:phone |cell )?number\\b|\\b(?:can|could|may) i (?:have|get) (?:your|ur) (?:phone |cell )?number\\b|\\bgive me (?:your|ur) (?:phone |cell )?number\\b|\\b(?:your|ur) (?:snap|snapchat|insta|instagram|tiktok|discord|whatsapp|kik)\\b",
  ].join('|')), true],
];

// ------------------------------------------------------------------ sexual content, advances and lures (Spanish, folded)

const SEXUAL_ES = [
  ['explicit', /\b(?:tener|tengamos|hagamos|quieres tener|quiere tener|quieres hacer|vamos a tener|hacer el) (?:sexo|relaciones|el amor)\b|\bsexo conmigo\b|\bdesnud[oa]s?\b|\bencuerad[oa]s?\b|\bsin ropa\b|\bquita(?:te|se) (?:la ropa|la blusa|la camisa|los pantalones|el vestido)\b|\b(?:tocarte|te quiero tocar|dejame tocarte|tocame|le quiero tocar)\b|\bfotos? (?:desnud\w*|sin ropa|sexys?)\b|\b(?:que traes|que llevas) puesto\b/, false],
  ['romance', /\b(?:tienes|tiene) novi[oa]\b|\beres (?:muy |bien |tan )?(?:guap[oa]|bonit[oa]|lind[oa]|hermos[oa]|sexy|precios[oa]|chul[oa])\b|\b(?:dame|me das|te doy) un beso\b|\bbesarte\b|\bbesame\b|\bme gustas\b|\bte amo\b/, true],
  ['romance', /\b(?:quieres|quiere) (?:ser mi (?:novi[oa]|esposa|esposo)|salir conmigo)\b|\bcasate conmigo\b/, false],
  ['lure', /\b(?:subete|sube|metete|suba|subase) (?:a|en) mi (?:carro|coche|troca|camioneta|van|auto)\b|\b(?:vernos|juntarnos|salir|vamos) (?:a solas|sol[oa]s|tu y yo solos)\b|\b(?:ven|vente|venga|vamos) a mi casa\b/, false],
  ['lure', /\b(?:ven|vente|venga) conmigo\b|\b(?:tengo|traigo) (?:dulces|un perrito|perritos|un gatito|gatitos|juguetes|helado|regalos)\b|\bnuestro secreto\b|\bes un secreto\b|\bno le (?:digas|cuentes|diga|cuente) a (?:tu mama|tu papa|tus papas|tus padres|su mama|su papa|nadie)\b/, true],
  ['alone', /\b(?:estas|esta) sol[oa] en (?:la |tu |su )?casa\b|\bhay alguien (?:en (?:tu |su |la )?casa|contigo)\b/, false],
  ['alone', /\b(?:estas|esta) sol[oa]\b|\b(?:tus|sus) (?:papas|padres|papa|mama) (?:no )?(?:estan|esta) (?:en (?:la )?casa|ahi|aqui)\b|\bcuando (?:se van|salen|regresan|llegan) (?:tus|sus) (?:papas|padres)\b/, true],
  ['visit', /\b(?:cual es (?:tu|su) direccion|donde (?:vives|vive))\b[^.?!]{0,30}[.?!]*\s*[^.?!]{0,30}\b(?:voy a ir|voy a pasar|paso|pasare|ire|voy para alla|te visito|lo visito|la visito|te caigo|le caigo)\b|\b(?:voy a ir|voy a pasar|paso|pasare|ire|llego) (?:a|por) (?:tu|su) casa (?:esta noche|en la noche|al rato|cuando (?:estes|este) sol[oa])\b/, false],
  ['location', /\bcual es (?:tu|su) direccion\b|\bdonde (?:vives|vive)\b|\ben que calle (?:vives|vive)\b|\bcual es (?:tu|su) casa\b|\b(?:dame|pasame|cual es) (?:tu|su) (?:numero|telefono|celular|cel)\b/, true],
];

// ------------------------------------------------------------------ threats (English)

const THREAT_EN = [
  ['immigration', new RegExp([
    "\\b(?:call|calling|called|report|reporting|reported|turn|turning|rat) (?:ice|i\\.c\\.e\\.?|immigration|la migra|the migra|border patrol|the feds|homeland security|dhs)(?: on| about)? (?:you|your|ya|u|y'?all)\\b",
    '\\b(?:call|calling|report|reporting|turn|turning) (?:you|your (?:\\w+ )?(?:family|parents|mom|dad|husband|wife|kids|people)|ya|u)(?: in)? (?:to|into) (?:ice|immigration|la migra|border patrol|the feds|homeland security)\\b',
    "\\b(?:ice|immigration|la migra|border patrol)(?:'s| is| are|'re) (?:coming|going to come|gonna come) (?:for|after|to get) (?:you|your|ya)\\b",
    "\\b(?:get|have|getting|having) (?:you|ya|your (?:\\w+ )?(?:family|parents|mom|dad|husband|wife|kids|people)) deported\\b|\\b(?:you|your (?:\\w+ )?(?:family|parents|mom|dad|husband|wife|kids|people))(?:'re| are| will be|'ll be|'re going to be| are going to be|'re gonna get| are getting|'re getting| gonna get) deported\\b|\\bdeport (?:you|ya|your)\\b|\\bsend (?:you|ya|your (?:\\w+ )?(?:family|people)) back (?:to|where)\\b",
    `\\b${I_WILL} (?:\\w+ )?(?:call|report) (?:ice|immigration|la migra|border patrol)\\b`,
  ].join('|'))],
  ['mass', new RegExp([
    `\\bshoot up (?:the|a|your|this|my|our|that|ur) (?:\\w+ )?${PLACES}\\b`,
    `\\b(?:${I_WILL}|we(?:'re| are) (?:going to|gonna)|someone (?:should|is going to)) (?:\\w+ )?(?:shoot up|shoot everyone|shoot everybody|shoot people|bomb|blow up|firebomb|attack|shoot) (?:the|a|your|this|my|our|that|ur) (?:\\w+ )?${PLACES}\\b`,
    '\\b(?:bring|bringing|take|taking) (?:a |my )?(?:gun|guns|rifle|ar-?15|bomb|bombs|explosives) to (?:the |my |your |our |this )?(?:school|class|work|church|mosque|synagogue|temple|mall|office|game|concert|parade)\\b',
    `\\b${I_WILL} (?:\\w+ )?(?:shoot|kill|bomb) (?:everyone|everybody|people|them all|as many)\\b|\\b(?:plan|planning) (?:a|to do a) (?:school )?(?:shooting|bombing|massacre)\\b`,
  ].join('|'))],
  ['sexual', new RegExp(`\\b${I_WILL} (?:\\w+ )?(?:rape|molest|sexually assault|grope)\\b|\\b(?:rape|molest) (?:you|ya|u)\\b`)],
  ['arson', new RegExp([
    `\\b${I_WILL} (?:\\w+ )?(?:burn|torch|firebomb|set fire to|light) (?:down )?(?:your|this|that|the|ur) (?:\\w+ )?${PLACES}\\b`,
    `\\b${I_WILL} (?:\\w+ )?set (?:your|this|that|the|ur) (?:\\w+ )?${PLACES} on fire\\b`,
  ].join('|'))],
  ['violence', new RegExp([
    `\\b${I_WILL} (?:\\w+ )?${VIOLENT} ${AIMED}\\b(?!\\s+(?:at|in|on|to|a|an|some|off|out|down|loose|slack|short|first|back|over|for a|for the|for an)\\b)`,
    `\\b${I_WILL} (?:\\w+ )?(?:break your (?:neck|legs?|arms?|face|jaw|nose)|smash your (?:face|head)|slit your throat|end you|destroy you|hunt you down|come after you|come for you|make you pay|make you bleed|(?:kick|beat|whoop) your (?:ass|butt))\\b`,
    "\\b(?:i have|i got|i'?ve got) a (?:gun|knife|weapon)\\b[^.?!]{0,40}\\b(?:you|your|kill|shoot|stab|use it)\\b",
  ].join('|'))],
  ['stalk', new RegExp([
    "\\bi know where (?:you|u|your (?:\\w+ )?(?:family|kids|wife|husband|mom|dad)) (?:live|lives|work|works|sleep|sleeps|go to school|goes to school)\\b",
    "\\bwatch your back\\b|\\bsleep with one eye open\\b|\\byou'?re (?:so )?dead(?! (?:right|wrong|tired|serious|set|on|last|center|end|weight|heat|air))\\b|\\byou(?:'re| are) (?:a dead (?:man|woman)|going to die|gonna die)\\b|\\byou(?:'ll| will) (?:regret|pay for) (?:this|that|it)\\b",
    `\\b${I_WILL} (?:\\w+ )?(?:find|track down|hunt down|get) (?:you|ya|your (?:\\w+ )?(?:family|kids?|son|daughter|wife|husband|mom|dad))\\b(?!\\s+(?:a|an|some|something|one|two|the|more|another|later|tomorrow|there|food|coffee|lunch|dinner|water|anything|everything|info|information|directions)\\b)`,
    "\\bi'?m (?:coming|going to come|gonna come) (?:for|after) (?:you|your)\\b|\\bi(?:'ve| have) been (?:watching|following|stalking) you\\b|\\bi'?m (?:watching|following|stalking) you\\b",
  ].join('|'))],
];

// ------------------------------------------------------------------ threats (Spanish, folded)

const THREAT_ES = [
  ['immigration', /\b(?:voy a |vamos a |te voy a |le voy a |lo voy a |la voy a )?(?:llamar(?:te|le)?|hablar(?:le|te)?|reportar(?:te|lo|la|le)?|denunciar(?:te|lo|la)?|echar(?:te|le)?) (?:a |con )?(?:la migra|migracion|inmigracion|el ice|ice)\b|\b(?:te|lo|la|los|le|les) (?:van|voy|vamos) a (?:deportar|echar la migra)\b|\bla migra (?:viene|va a venir|te va a|lo va a|la va a)\b|\bte van a deportar\b/],
  ['mass', /\bvoy a (?:balacear|tirotear|disparar en|atacar|volar|poner una bomba en) (?:la|el|tu|su|esta|este) (?:escuela|iglesia|tienda|trabajo|oficina|parque|clase)\b/],
  ['sexual', /\b(?:te|la|lo) voy a violar\b|\bvoy a violar(?:te|la|lo)\b/],
  ['arson', /\bvoy a (?:quemar|prenderle fuego a|incendiar) (?:tu|su|la|el|este|esta) (?:casa|carro|coche|tienda|escuela|iglesia|barrio|lugar|negocio)\b|\b(?:te|le) voy a (?:prender fuego|quemar la casa)\b/],
  ['violence', /\b(?:te|lo|la|los|las) voy a (?:matar|pegar|golpear|madrear|partir la madre|balacear|disparar|apunalar|picar|secuestrar|romper la cara)\b|\bvoy a (?:matarte|matarlo|matarla|matarlos|pegarte|golpearte|balacearte|dispararte|apunalarte|secuestrarte)\b|\bte mato\b|\bte voy a dar en la madre\b/],
  ['stalk', /\bse donde (?:vive|vives|trabaja|trabajas)\b|\bcuidate la espalda\b|\bya (?:estas|esta) muert[oa]\b|\bte vas a arrepentir\b|\bme las vas a pagar\b/],
];

/**
 * Read a player's line for what no conversation plays along with: a crisis (wanting to die, self-harm, being hurt,
 * an emergency), a sexual line, an advance or a lure, or a threat, in English or Spanish. Null for an ordinary line.
 * Readings that only matter for a child (a compliment on their looks, "come with me", a secret, whether their
 * parents are home, where they live) apply only when opts.age is under 18; an unknown age is an adult's.
 * @param {string} text the player's line as typed
 * @param {{age?: number}} [opts]
 * @returns {{kind: 'crisis'|'sexual'|'threat', sub: string, es: boolean}|null}
 *   sub: crisis 'suicide' | 'selfharm' | 'abuse' | 'emergency'; sexual 'explicit' | 'romance' | 'lure' | 'alone' |
 *   'location' | 'visit' (where you live, and they will come over); threat 'immigration' | 'mass' | 'sexual' | 'arson' | 'violence' | 'stalk'. es: a Spanish reading matched.
 */
export function safetyOf(text, opts = {}) {
  const s = fold(text);
  if (!s || s.length < 3) return null;
  const minor = Number.isFinite(opts.age) && opts.age < 18;
  // a baby or a toddler is told it is cute and asked where it lives by every grown-up it meets, and answers neither:
  // for them a compliment or "where do you live" is not an alarm. Whether they are home alone, or when their parents
  // are gone, is asked of a small child for one reason only, so that reading stays on at every age.
  const small = Number.isFinite(opts.age) && opts.age < 5;
  const applies = (sub, minorOnly) => (!minorOnly || minor) && !(small && (sub === 'romance' || sub === 'location'));
  for (const [sub, re] of CRISIS_EN) if (re.test(s)) return { kind: 'crisis', sub, es: false };
  for (const [sub, re] of CRISIS_ES) if (re.test(s)) return { kind: 'crisis', sub, es: true };
  // a threat before an advance: "I'm going to rape you" is a threat, said to anyone
  for (const [sub, re] of THREAT_EN) if (re.test(s)) return { kind: 'threat', sub, es: false };
  for (const [sub, re] of THREAT_ES) if (re.test(s)) return { kind: 'threat', sub, es: true };
  for (const [sub, re, minorOnly] of SEXUAL_EN) if (applies(sub, minorOnly) && re.test(s)) return { kind: 'sexual', sub, es: false };
  for (const [sub, re, minorOnly] of SEXUAL_ES) if (applies(sub, minorOnly) && re.test(s)) return { kind: 'sexual', sub, es: true };
  return null;
}

/** The notes from Legion that go with a safety line (shown by the app as a note, not in the NPC's voice). */
export const SAFETY_NOTES = Object.freeze({
  crisis: "If you're thinking about suicide or hurting yourself, call or text 988 (the Suicide & Crisis Lifeline) any time, day or night; it answers in English and Spanish. If you or someone else is in danger right now, call 911. Legion's characters are made up and can't help in a crisis, but the people at 988 can.",
  crisisEs: 'Si está pensando en el suicidio o en hacerse daño, llame o mande un mensaje de texto al 988 a cualquier hora; atienden en español. Si usted u otra persona está en peligro ahora mismo, llame al 911.',
  abuse: "If you're in danger right now, call 911. If someone is hurting you, the National Domestic Violence Hotline is 1-800-799-7233 (or text START to 88788), and kids and teens can call Childhelp at 1-800-422-4453. You can also call or text 988 any time, day or night.",
  abuseEs: 'Si está en peligro ahora mismo, llame al 911. Si alguien le está haciendo daño, la Línea Nacional contra la Violencia Doméstica es el 1-800-799-7233, y atienden en español. También puede llamar o mandar un mensaje al 988 a cualquier hora.',
  emergency: 'If this is a medical emergency, call 911 now.',
  emergencyEs: 'Si es una emergencia médica, llame al 911 ahora mismo.',
  mass: "If anyone is in danger, call 911. If you're having thoughts of hurting someone, you can call or text 988 any time.",
  massEs: 'Si alguien está en peligro, llame al 911. Si tiene pensamientos de hacerle daño a alguien, puede llamar o mandar un mensaje al 988.',
});
