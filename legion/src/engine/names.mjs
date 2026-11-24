// Legion · names: given names and surnames for every Californian, by heritage, sex, birth cohort and
// generation in the US.
//
// Every name is a synthetic combination drawn from common-name pools; no record of a real person is used,
// surnames that point to a single famous family are left out of the pools, and full names that would point
// to a famous person are refused when the surname is known (isReservedName). Pools are ranked by popularity
// and drawn on a Zipf-like curve (or explicit weights where frequencies are well known, e.g. Nguyen), so
// common names are common and rare names are rare. Nothing here reads the clock or Math.random: every draw
// comes from the Rng passed in, so the same NPC always gets the same name.
//
// How a given name is chosen (givenName):
//   * the birth cohort picks the era list (e1 born before 1960, e2 1960-1979, e3 1980-1999, e4 2000 and
//     later), blended softly across era boundaries and with the neighbouring eras at a lower weight;
//   * the generation in the US picks the tradition: immigrants (generation 1) carry names from the origin
//     country in the romanization usual in California; their US-born children (generation 2) mostly carry
//     names popular in California for their cohort and sometimes heritage names as US-born families use
//     them; the third generation mostly the general California pool of their cohort;
//   * mixed traditions (Chinese pinyin / Cantonese / Taiwanese romanizations, Indian regions) follow the
//     household surname when it is passed in, so a Wong is named in Cantonese and a Reddy in Telugu style.
//
// Contract API (docs/CONTRACTS.md §5), unchanged from the provisional stub:
//   NAME_HERITAGES                                   every heritage key
//   surname(rng, heritage[, {sex, generation}])      a family name; with sex, adapted to the person
//                                                    (Sikh Singh / Kaur, Slavic and Greek feminine forms)
//   givenName(rng, {heritage, sex, birthYear, generation, nativity[, surname]})
//   nickname(rng, given, {heritage, age[, sex, surname]})   a diminutive or adopted name, or null
// Extras: nameFor (first, middle, last, full, display, nick in one call), middleName, adaptSurname, eraOf,
// ERAS, givenPool, surnamePool, nicknameCandidates, isReservedName, normName, and the raw data GIVEN,
// SURNAMES, NAMING (heritage configuration), NICKNAMES, EXCLUDED_SURNAMES and RESERVED_NAMES.
// Callers that know a person's surname (the household's) should pass it as opts.surname to givenName and
// nickname: Chinese and Indian given names then follow the surname's romanization or region, and full
// names that would point to a famous person are redrawn.
//
// Pool format: a comma-separated string ranked from most to least common. "Name:12.5" gives an explicit
// relative weight; names after an explicit weight continue the Zipf curve from it. Spelling follows what
// Californians of that heritage commonly write: accents kept where families keep them (José, María),
// dropped where US records and everyday use drop them (most surnames, US-born children's given names).

import { cumulative, drawCumulative } from './rng.mjs';

/** Given-name traditions: { M: [e1, e2, e3, e4], F: [...], base?: {M, F}, us?: {M: [...], F: [...]} }. */
const GIVEN = {};
/** Surname pools: a ranked string, or { mix: [[poolKey, weight], ...] }. */
const SURNAMES = {};

// ------------------------------------------------------------------ given names: the general California pool
// Names given across California's communities in each birth cohort (Social Security and California birth
// records by decade), the pool for the third generation and the main pool for the second.

GIVEN.general = {
  M: [
    'Robert,James,John,William,Richard,David,Charles,Thomas,Donald,Ronald,Michael,Gary,George,Joseph,Kenneth,Larry,Edward,Paul,Frank,Jerry,Dennis,Raymond,Daniel,Harold,Jack,Steven,Walter,Arthur,Gerald,Roger,Lawrence,Douglas,Dale,Bruce,Carl,Henry,Fred,Wayne,Norman,Ralph,Eugene,Howard,Philip,Leonard,Roy,Albert,Stanley,Glenn,Russell,Terry,Alan,Gordon,Marvin,Lloyd,Warren,Herbert,Melvin,Vernon,Clifford,Duane',
    'Michael,David,John,Robert,James,Richard,Mark,Steven,William,Daniel,Joseph,Thomas,Christopher,Brian,Kevin,Jeffrey,Scott,Anthony,Paul,Timothy,Eric,Kenneth,Gregory,Jason,Matthew,Charles,Ronald,Patrick,Gary,Stephen,Donald,Edward,Todd,Sean,Keith,Troy,Darren,Shawn,Craig,Brett,Jon,Chad,Derek,Bryan,Jeremy,Aaron,Andrew,Peter,Raymond,George,Frank,Douglas,Larry,Dennis,Randy,Russell,Rodney,Victor,Jesse,Joel,Phillip,Vincent,Marc',
    'Michael,Christopher,Daniel,David,Matthew,Joshua,Andrew,James,Ryan,Anthony,Kevin,Jonathan,Joseph,Robert,Brian,Nicholas,Justin,John,Eric,Jason,Steven,Brandon,Adam,Alexander,Jacob,Tyler,William,Kyle,Richard,Mark,Thomas,Aaron,Sean,Jeffrey,Timothy,Benjamin,Jesse,Patrick,Zachary,Nathan,Jordan,Samuel,Adrian,Travis,Dustin,Derek,Cody,Austin,Jeremy,Scott,Paul,Gabriel,Victor,Vincent,Christian,Erik,Alex,Jared,Marcus,Ian,Evan,Bryan,Kenneth,Edward,Charles',
    'Daniel,Jacob,Anthony,Matthew,Ethan,Noah,Alexander,Michael,Andrew,David,Joshua,Christopher,Jayden,Nathan,Benjamin,Liam,Sebastian,Isaac,Aiden,Ryan,Dylan,Joseph,Gabriel,Elijah,Lucas,Julian,Logan,Jonathan,Adrian,Samuel,Oliver,Mason,Aaron,Jackson,Evan,Isaiah,Leonardo,Christian,Henry,Kevin,Brandon,Caleb,Jason,Ezra,James,William,Wyatt,Owen,Jack,Hunter,Luke,Josiah,Asher,Mateo,Leo,Levi,Theodore,Elias,Jaxon,Carter,Grayson,Miles,Kai,Damian,Xavier,Max,Tyler,Justin,Nicholas,Zachary,Austin,Cameron,Eli,Landon,Lincoln,Roman,Axel',
  ],
  F: [
    'Mary,Patricia,Linda,Barbara,Susan,Carol,Nancy,Margaret,Sharon,Judith,Sandra,Betty,Dorothy,Donna,Karen,Shirley,Deborah,Joan,Janet,Kathleen,Helen,Carolyn,Diane,Virginia,Joyce,Ruth,Frances,Elizabeth,Marilyn,Beverly,Jean,Brenda,Gloria,Pamela,Cheryl,Janice,Martha,Ann,Jane,Catherine,Elaine,Alice,Louise,Evelyn,Rose,Phyllis,Peggy,Doris,Lois,Norma,Darlene,Connie,Diana,Joanne,Rita,Bonnie,Gail,Kathryn,Sylvia,Marjorie,Wanda',
    'Jennifer,Lisa,Michelle,Kimberly,Mary,Karen,Susan,Patricia,Elizabeth,Julie,Laura,Christine,Angela,Linda,Stephanie,Amy,Tracy,Melissa,Heather,Denise,Deborah,Cynthia,Kelly,Sandra,Nicole,Rebecca,Tina,Jessica,Lori,Shannon,Pamela,Dawn,Wendy,Tammy,Kathleen,Andrea,Christina,Monica,Rachel,Diana,Sharon,Robin,Renee,Erin,Dana,Holly,Stacy,Carrie,Kristen,Amanda,Sarah,Rhonda,Theresa,Catherine,Barbara,Gina,Jill,Jacqueline,Allison,Valerie,Leslie,Sheila,Brenda,Debra,Kristin,Anne',
    'Jessica,Jennifer,Ashley,Stephanie,Amanda,Sarah,Elizabeth,Melissa,Nicole,Michelle,Lauren,Samantha,Vanessa,Christina,Emily,Megan,Rachel,Kimberly,Brittany,Danielle,Amber,Andrea,Alexandra,Natalie,Jasmine,Monica,Victoria,Erica,Kelly,Rebecca,Laura,Heather,Crystal,Tiffany,Courtney,Katherine,Diana,Alyssa,Kristen,Chelsea,Erin,Kayla,Hannah,Taylor,Alexis,Jacqueline,Lindsey,Kathryn,Amy,Anna,Julia,Brianna,Veronica,Cynthia,Angela,Christine,Marissa,Allison,Sabrina,Mariah,Bianca,Kristina,Leslie,Desiree,Valerie',
    'Emily,Isabella,Sophia,Ashley,Emma,Mia,Olivia,Samantha,Natalie,Abigail,Madison,Elizabeth,Hailey,Alyssa,Chloe,Victoria,Ella,Evelyn,Camila,Avery,Charlotte,Amelia,Harper,Aria,Scarlett,Zoe,Sofia,Lily,Grace,Hannah,Kimberly,Leah,Valeria,Ava,Penelope,Nora,Luna,Stella,Layla,Audrey,Allison,Brianna,Jasmine,Andrea,Alexa,Katherine,Sarah,Jessica,Anna,Savannah,Riley,Addison,Aubrey,Madeline,Claire,Gianna,Kaylee,Arianna,Daniela,Melanie,Vanessa,Jocelyn,Stephanie,Kayla,Sienna,Maya,Naomi,Eleanor,Hazel,Violet,Elena,Ruby,Isla,Mila,Aurora,Ellie,Delilah,Nova',
  ],
};

// ------------------------------------------------------------------ given names: Hispanic traditions
// Mexico-born Californians keep the accents in their own given names (José, María, Jesús); their
// California-born children's names are written plain, as California birth records write them, and mix
// heritage names (Mateo, Valentina) with the cohort's general favorites (Jayden, Ashley).

GIVEN.mexican = {
  M: [
    'José,Juan,Jesús,Manuel,Francisco,Antonio,Pedro,Miguel,Rafael,Ramón,Luis,Javier,Salvador,Guadalupe,Alfredo,Roberto,Carlos,Jorge,Raúl,Armando,Ricardo,Ignacio,Enrique,Felipe,Alberto,Fernando,Arturo,Rubén,Ernesto,Mario,Sergio,Héctor,Andrés,Martín,Gilberto,Alejandro,Agustín,Rodolfo,Ramiro,Rogelio,Margarito,Refugio,Gabriel,Víctor,Joaquín,Ezequiel,Benjamín,Eduardo,Humberto,Tomás,Abel,Isidro,Esteban,Gregorio,Silvestre,Florentino,Anselmo',
    'José,Juan,Jesús,Francisco,Miguel,Luis,Antonio,Javier,Jorge,Manuel,Carlos,Alejandro,Martín,Ricardo,Pedro,Raúl,Roberto,Sergio,Fernando,Rafael,Arturo,Mario,Eduardo,Óscar,Víctor,Salvador,Ramón,Armando,Alfredo,Enrique,Héctor,Rubén,Gerardo,Jaime,Gustavo,Daniel,Alberto,Guillermo,Rogelio,Ignacio,Adrián,Gabriel,Efraín,Ernesto,Hugo,Leonel,Omar,Rodolfo,Felipe,Abel,Joel,Israel,Moisés,César,Teodoro,Rigoberto',
    'José,Juan,Luis,Jesús,Miguel,Carlos,Francisco,Jorge,Alejandro,Antonio,Daniel,Eduardo,Óscar,Ricardo,Fernando,Javier,Martín,Omar,Víctor,Mario,Raúl,Adrián,Sergio,Manuel,Rafael,Pedro,Erik,Iván,Edgar,Gerardo,Armando,Cristian,Alberto,Rubén,Roberto,Hugo,Julio,Arturo,Israel,Gabriel,Diego,Jonathan,Uriel,Ulises,Alan,Abraham,Enrique,Saúl,Héctor,Ángel,Marco,Rigoberto,Josué,Rodrigo',
    'José,Ángel,Luis,Juan,Diego,Miguel,Carlos,Jesús,Jorge,Alejandro,Daniel,Santiago,Leonardo,Emiliano,Mateo,Sebastián,Matías,Iker,Kevin,Brayan,Alexis,Christopher,Jonathan,Adrián,Emmanuel,Fernando,Eduardo,Francisco,Ricardo,Iván,Ian,Gael,Axel,Uriel,Erick,Óscar,Alan,Javier,Antonio,Rodrigo,Andrés,Isaac,Josué,Joel,David,Héctor,Aarón,Yahir,Dylan,Maximiliano',
  ],
  F: [
    'María,Guadalupe,Juana,Rosa,Josefina,Margarita,Carmen,Teresa,Elena,Martha,Ana,Francisca,Antonia,Socorro,Dolores,Esperanza,Gloria,Alicia,Irma,Isabel,Lucía,Graciela,Leticia,Raquel,Consuelo,Silvia,Estela,Angelina,Rafaela,Concepción,Rosario,Victoria,Elvira,Delia,Celia,Amparo,Ofelia,Natividad,Catalina,Esther,Petra,Herminia,Aurora,Eva,Beatriz,Hortensia,Imelda,Yolanda,Bertha,Lidia,Oralia,Ramona,Refugio,Trinidad',
    'María,Guadalupe,Rosa,Patricia,Leticia,Verónica,Martha,Silvia,Yolanda,Elizabeth,Gabriela,Laura,Adriana,Claudia,Alejandra,Ana,Teresa,Araceli,Margarita,Lourdes,Juana,Norma,Elena,Sandra,Irma,Carmen,Beatriz,Lorena,Alicia,Sonia,Maribel,Rocío,Graciela,Mónica,Gloria,Isabel,Angélica,Josefina,Esperanza,Blanca,Raquel,Cecilia,Susana,Liliana,Marisela,Olga,Reyna,Rosalba,Socorro,Eva,Bertha,Lucía,Hilda',
    'María,Guadalupe,Ana,Verónica,Adriana,Alejandra,Gabriela,Claudia,Elizabeth,Erika,Karina,Diana,Jessica,Mónica,Leticia,Laura,Rosa,Sandra,Brenda,Araceli,Yesenia,Yolanda,Patricia,Maribel,Liliana,Vanessa,Lorena,Marisol,Griselda,Rocío,Lizbeth,Nancy,Beatriz,Daniela,Paola,Fabiola,Karla,Cecilia,Angélica,Wendy,Elena,Silvia,Andrea,Martha,Esmeralda,Alma,Lucía,Itzel,Viridiana,Elvia,Janet,Maricela',
    'Sofía,Valentina,Camila,Ximena,Regina,Fernanda,Daniela,Valeria,Mariana,Guadalupe,Andrea,Natalia,Renata,Victoria,Isabella,Paola,Dulce,Jimena,Ana,Lucía,Melanie,Yaretzi,Abril,Alejandra,Itzel,Kimberly,Michelle,Leslie,Brenda,Karla,Diana,Montserrat,Alexa,Danna,Ashley,Arely,Gabriela,Joselyn,Nayeli,Citlali,Fátima,Estrella,Evelyn,Lizeth,Yamileth,María',
  ],
  us: {
    M: [
      'Jose,Robert,Frank,Manuel,Richard,Joe,Raymond,Ernest,Rudy,Arthur,Henry,Gilbert,Ruben,Johnny,Tony,Daniel,Albert,Alfred,Louis,Edward,Ralph,Jesse,Armando,Ramon,Pete,Gabriel,Alex,Rudolph,Lawrence,Carlos,Fernando,Juan',
      'Jose,David,Michael,Robert,Daniel,Richard,Juan,Frank,Steven,Anthony,Joe,Raymond,Ruben,Arthur,Carlos,Edward,Gilbert,Mario,Ricardo,Ernest,Gabriel,Albert,Fernando,Sergio,Victor,Jesse,Manuel,Rudy,Martin,Hector,Johnny,Eddie,Gerardo,Armando,Javier,Rene,Henry,Roberto,Rafael',
      'Daniel,Jose,Anthony,Christopher,David,Michael,Jonathan,Luis,Juan,Carlos,Adrian,Jesus,Andrew,Kevin,Eric,Joseph,Brian,Steven,Victor,Miguel,Richard,Alexander,Gabriel,Oscar,Edgar,Mario,Ricardo,Fernando,Sergio,Eduardo,Francisco,Javier,Ruben,Angel,Erik,Alex,Raul,Cesar,Manuel,Omar,Alejandro,Isaac,Marco,Ivan',
      'Mateo,Santiago,Sebastian,Daniel,Diego,Angel,Adrian,Julian,Jayden,Anthony,Leonardo,Gael,Emiliano,Gabriel,Isaac,Elijah,Ethan,Joshua,Christopher,Jesus,Jose,Luis,Ivan,Adriel,Aaron,Josiah,Liam,Noah,Alexander,Nathan,Jacob,Damian,Andres,Matias,Axel,Isaiah,Eduardo,Joel,Christian,Bryan',
    ],
    F: [
      'Maria,Mary,Rose,Dolores,Gloria,Josephine,Carmen,Yolanda,Esther,Irene,Teresa,Elena,Alice,Helen,Lucy,Virginia,Linda,Rosemary,Sylvia,Martha,Stella,Frances,Delia,Angie,Eva,Lydia,Ruth,Anita,Olivia,Victoria,Christine,Bertha,Ramona,Lupe',
      'Maria,Patricia,Yolanda,Elizabeth,Rosa,Martha,Linda,Veronica,Sandra,Laura,Lisa,Teresa,Diana,Gloria,Irma,Monica,Cynthia,Elena,Angela,Christina,Michelle,Lorraine,Sylvia,Norma,Leticia,Alicia,Margarita,Gabriela,Lucy,Anna,Carmen,Rachel,Marisa,Adriana,Rosemary,Barbara,Josephine,Celia,Debbie',
      'Jessica,Stephanie,Vanessa,Jennifer,Elizabeth,Maria,Michelle,Ashley,Jasmine,Daniela,Andrea,Monica,Veronica,Diana,Erika,Cynthia,Alejandra,Gabriela,Natalie,Leslie,Karina,Priscilla,Brenda,Yesenia,Melissa,Crystal,Amanda,Alyssa,Marisol,Christina,Bianca,Adriana,Claudia,Jacqueline,Angelica,Desiree,Samantha,Esmeralda,Lizette,Marlene,Yvette,Valerie,Evelyn',
      'Sofia,Valentina,Isabella,Camila,Mia,Emily,Ashley,Natalie,Victoria,Valeria,Daniela,Ximena,Genesis,Melanie,Leah,Jasmine,Kimberly,Alexa,Arianna,Abigail,Mariana,Andrea,Emma,Luna,Elena,Gianna,Aaliyah,Angelina,Isabel,Lucia,Esmeralda,Nayeli,Jocelyn,Giselle,Jazmin,Brianna,Adriana,Penelope,Scarlett,Aylin,Renata,Amaya,Itzel,Dulce',
    ],
  },
};

// Central America (El Salvador, Guatemala, Honduras, Nicaragua): Spanish names plus the English-sounding
// names popular there since the 1960s (William, Nelson, Edwin, Wilmer, Jefferson, Kimberly, Génesis).
GIVEN.centralam = {
  M: [
    'José,Juan,Carlos,Luis,Francisco,Manuel,Jorge,Mario,Pedro,Miguel,Rafael,Antonio,Ricardo,Julio,Roberto,Ramón,Raúl,Rigoberto,Salvador,Santos,Félix,Ernesto,Alfredo,Óscar,Rolando,Armando,Guillermo,René,Hugo,Arnoldo,Gilberto,Saúl,Tomás,Domingo,Marcos,Alberto,Héctor,Víctor,Enrique,Rodolfo,Leonel,Eusebio,Abelino',
    'José,Carlos,Juan,Luis,Mario,Jorge,Óscar,Miguel,William,Wilfredo,Nelson,Edwin,Mauricio,Francisco,Ricardo,Julio,René,Douglas,Rolando,Walter,Roberto,Manuel,Víctor,Danilo,Elmer,Hugo,Ernesto,Rafael,Milton,Fredy,Marvin,Wilber,Rigoberto,Herbert,Armando,Santos,Salvador,Alexander,Henry,Héctor,Gustavo,Alfredo,Erasmo',
    'José,Carlos,Juan,Luis,Kevin,Jonathan,Edwin,Christian,Erick,Josué,Bryan,Jorge,Óscar,Miguel,Wilmer,Elmer,Nelson,Marvin,Henry,Jefferson,Alexander,Wilson,Walter,Selvin,Byron,Mauricio,Francisco,Ronald,Brayan,Eduardo,Denis,Alex,Darwin,Ever,Wilber,Geovanny,Melvin,Danilo,Douglas,Kelvin,Anderson,Yovani',
    'José,Ángel,Kevin,Jonathan,Brayan,Christopher,Josué,Carlos,Luis,Jefferson,Anthony,Dylan,Joshua,Steven,Alexander,Justin,Erick,Jairo,Mateo,Santiago,Daniel,Jason,Bryan,Elmer,Wilmer,Cristian,Diego,Jordy,Ismael,Adonay,Gerson,Óscar,Juan,Miguel,Emanuel,Isaac,Fernando,Héctor,Eduardo,Samuel',
  ],
  F: [
    'María,Ana,Rosa,Carmen,Marta,Gloria,Blanca,Teresa,Juana,Concepción,Dolores,Mercedes,Amanda,Reina,Morena,Sonia,Elsa,Isabel,Margarita,Silvia,Alicia,Lucía,Julia,Victoria,Esperanza,Graciela,Elena,Paula,Olga,Antonia,Francisca,Dora,Haydée,Socorro,Adela,Celia,Hilda,Aminta,Zoila,Esther,Bertila',
    'María,Ana,Rosa,Sandra,Sonia,Blanca,Patricia,Claudia,Gladys,Morena,Reina,Delmy,Iris,Marlene,Roxana,Xiomara,Carmen,Silvia,Marta,Glenda,Evelyn,Ingrid,Lorena,Elizabeth,Verónica,Karla,Ruth,Marina,Lilian,Dinora,Norma,Telma,Yolanda,Wendy,Mirna,Brenda,Maritza,Zulma,Lidia,Elsa,Aracely,Vilma',
    'Ana,María,Karla,Jessica,Katherine,Wendy,Yesenia,Evelyn,Johana,Jennifer,Lesly,Glenda,Iris,Brenda,Kenia,Carolina,Diana,Ingrid,Mayra,Cindy,Paola,Stephanie,Gabriela,Yanira,Marleny,Heidy,Dayana,Ashley,Andrea,Fátima,Nancy,Daniela,Sandra,Lucía,Alejandra,Melissa,Elsy,Sindy,Yeimy,Marisol',
    'Ashley,Génesis,Dayana,Kimberly,Nicole,Michelle,Valeria,Sofía,Allison,Fernanda,Emily,Camila,Katherine,Daniela,Melany,Joselyn,Yaritza,Jennifer,Andrea,Lesly,Britany,Ángela,Valentina,María,Ana,Hellen,Dariana,Abigail,Naomi,Esther,Keyla,Yareli,Mía,Nathaly,Alison,Sarai,Jimena,Paola,Danna',
  ],
};

// Puerto Rico, Cuba and the Dominican Republic: shared Caribbean favorites and each island's own
// (Cuba's Y- names from the 1970s on, Dominican Altagracia and Yokasta, Puerto Rican Migdalia and Wilfredo).
GIVEN.caribhisp = {
  M: [
    'José,Luis,Juan,Carlos,Rafael,Manuel,Pedro,Jorge,Ramón,Ángel,Miguel,Antonio,Francisco,Raúl,Roberto,Héctor,Orlando,Armando,Alberto,Julio,Félix,Osvaldo,Rubén,Ernesto,Agustín,Gilberto,Pablo,Arturo,Efraín,Fernando,Mario,Eduardo,Andrés,Guillermo,Rolando,Wilfredo,Israel,Víctor,Domingo,Radamés',
    'José,Luis,Carlos,Juan,Jorge,Miguel,Ángel,Rafael,Héctor,Edwin,Wilfredo,Pedro,Ramón,Manuel,Francisco,Roberto,Orlando,Alexis,Raúl,Freddy,Alberto,Ricardo,Eduardo,Nelson,Wilson,Julio,Osvaldo,Reinaldo,Félix,Rubén,Fernando,Ernesto,Rolando,Alfredo,Víctor,Yoel,Lázaro,Wilfrido,Ariel,Gerardo,Danny',
    'José,Luis,Carlos,Juan,Jorge,Miguel,Ángel,Yunior,Alexis,Yoel,Yasmani,Yoandry,Reinier,Yordanis,Alexander,Jonathan,Christian,Edwin,Francisco,Rafael,Eddy,Henry,Wilson,Ramón,Héctor,Félix,Pedro,Javier,Ernesto,Jesús,Daniel,Yeison,Starlin,Junior,Osmany,Yuniel,Raúl,David,Manuel,Roberto',
    'José,Luis,Ángel,Carlos,Juan,Jorge,Adrián,Daniel,Diego,Alejandro,Sebastián,Gabriel,Jayden,Kevin,Christopher,Anthony,Justin,Jonathan,Javier,Yandel,Leonel,Erick,Fernando,Mateo,Santiago,Emmanuel,Yadiel,Joel,Samuel,Alexander,Dylan,Isaac,Bryan,Jeremy,Steven,Ian,Liam,Josué,Jesús,Héctor',
  ],
  F: [
    'María,Carmen,Ana,Rosa,Gloria,Mercedes,Altagracia,Teresa,Josefina,Ramona,Juana,Luz,Caridad,Margarita,Esperanza,Isabel,Milagros,Rosario,Dolores,Lourdes,Gladys,Nilda,Elba,Iris,Mirta,Marta,Zoraida,Hilda,Olga,Ada,Haydée,Lucía,Julia,Celia,Aida,Raquel,Amparo,Silvia,Mercedita,Yolanda',
    'María,Ana,Carmen,Rosa,Maritza,Migdalia,Marisol,Yolanda,Lourdes,Mayra,Iris,Gladys,Elizabeth,Sandra,Wanda,Ivelisse,Yamilé,Odalys,Mildred,Damaris,Daisy,Nancy,Yanet,Mirna,Mercedes,Teresa,Milagros,Zoraida,Evelyn,Lisette,Ileana,Belkis,Mariela,Arelis,Yudith,Margarita,Raquel,Norma,Gisela,Xiomara,Miriam',
    'María,Ana,Yanet,Yesenia,Jessica,Yaneisy,Mayelín,Yaimara,Yudelka,Yokasta,Yaniris,Massiel,Johanna,Elizabeth,Melissa,Jennifer,Stephanie,Vanessa,Paola,Karla,Carolina,Kimberly,Yarelis,Darlenys,Arianna,Leidy,Patricia,Claudia,Gabriela,Diana,Yanelis,Mariela,Odalis,Rosanna,Wendy,Liliana,Yaritza,Daisy,Glenda,Lisbeth',
    'Génesis,Camila,Valentina,Sofía,Isabella,Mía,Ashley,Emily,Victoria,Valeria,Brianna,Nicole,Alondra,Gabriela,Daniela,Arianna,Natalia,Amanda,Melany,Nathalie,Kiara,Yamilet,Adriana,Leah,Ariana,Angelina,Samantha,Kimberly,Laura,Andrea,Yaretzi,Lía,Zoe,Luna,Mariangel,Esther,Chloe,Lucía,Danna,Elena',
  ],
};

// South America (Colombia, Peru, Argentina, Venezuela, Ecuador, Chile, Brazil's Spanish-speaking neighbors).
GIVEN.southam = {
  M: [
    'José,Luis,Carlos,Juan,Jorge,Manuel,Héctor,Julio,Alberto,Hernán,Óscar,Mario,Ricardo,Fernando,Eduardo,Raúl,Rodolfo,Gustavo,Alfredo,Enrique,Rafael,Alfonso,Guillermo,Arturo,Hugo,Ernesto,Jaime,Germán,Gonzalo,Fabio,Rubén,Orlando,Rodrigo,Mariano,Nelson,Horacio,Darío,Edgar,Ramiro,Aníbal',
    'Carlos,Luis,Juan,José,Jorge,Fernando,Ricardo,Eduardo,Andrés,Javier,Alejandro,Diego,Gustavo,Pablo,Marcelo,Mauricio,Fabián,Gabriel,Óscar,Mario,Sergio,Raúl,Hernán,Martín,Rodrigo,Daniel,William,Wilson,Fredy,Edgar,Gonzalo,Patricio,Claudio,Walter,Jaime,César,Iván,Alberto,Hugo,Julián',
    'Juan,Carlos,Andrés,Luis,Diego,Jorge,Daniel,Sebastián,Alejandro,David,Felipe,Javier,Cristian,Jonathan,Santiago,Nicolás,Camilo,Mauricio,Julián,Gabriel,Fernando,Esteban,Ricardo,Óscar,Pablo,Rodrigo,Gonzalo,Martín,Iván,Miguel,Jhon,Edwin,Héctor,Kevin,Brayan,Wilmer,Leonardo,Facundo,Matías,Lucas',
    'Santiago,Sebastián,Samuel,Matías,Nicolás,Alejandro,Mateo,Emiliano,Tomás,Benjamín,Thiago,Martín,Lucas,Joaquín,Gabriel,Daniel,David,Juan,Diego,Felipe,Agustín,Maximiliano,Emmanuel,Jerónimo,Dylan,Isaac,Bautista,Ian,Ángel,Simón,Valentino,Francisco,Leonardo,Andrés,Luciano,Liam,Gael,Iker,Joshua,Adrián',
  ],
  F: [
    'María,Ana,Rosa,Carmen,Luz,Gloria,Martha,Blanca,Elena,Beatriz,Graciela,Teresa,Lucía,Cecilia,Mercedes,Alicia,Inés,Silvia,Leonor,Esther,Olga,Isabel,Amparo,Margarita,Dora,Elsa,Nelly,Raquel,Matilde,Aurora,Norma,Irma,Rosario,Celia,Lidia,Haydée,Victoria,Susana,Emilia,Marina',
    'María,Claudia,Patricia,Sandra,Martha,Gloria,Luz,Adriana,Ana,Carolina,Liliana,Mónica,Andrea,Sonia,Diana,Marcela,Viviana,Gabriela,Paola,Lorena,Natalia,Carmen,Silvia,Rocío,Beatriz,Alejandra,Verónica,Elizabeth,Fabiola,Yolanda,Mariela,Angélica,Nancy,Lucía,Ximena,Pilar,Rosa,Johana,Milena,Rosalba',
    'Daniela,Andrea,Paola,Natalia,Carolina,María,Ana,Laura,Valentina,Catalina,Juliana,Camila,Diana,Alejandra,Paula,Lina,Gabriela,Melissa,Jessica,Jennifer,Vanessa,Stephanie,Karen,Tatiana,Lorena,Johana,Viviana,Mariana,Fernanda,Florencia,Lucía,Sofía,Yesenia,Leidy,Kelly,Angie,Estefanía,Manuela,Ximena,Milagros',
    'Sofía,Valentina,Isabella,Mariana,Valeria,Luciana,Martina,Camila,Salomé,Sara,Emma,Antonella,Daniela,Gabriela,Victoria,Mía,Catalina,Abigail,Emilia,Juliana,Lucía,Renata,Allison,Zoe,Amanda,Florencia,Agustina,Paulina,Luna,Danna,Elena,Regina,Samantha,Ximena,Fernanda,Delfina,Josefina,Julieta,Alma,Violeta',
  ],
};

// Spain-born Californians.
GIVEN.spain = {
  M: [
    'José,Antonio,Manuel,Francisco,Juan,Jesús,Miguel,Pedro,Ángel,Rafael,Luis,Fernando,Joaquín,Ramón,Vicente,Enrique,Andrés,Julián,Agustín,Emilio,Tomás,Santiago,Ignacio,Felipe,Alfonso,Gregorio,Eduardo,Alberto,Salvador,Jaime,Pablo,Mariano,Lorenzo,Cristóbal,Domingo,Ricardo,Félix,Benito,Ernesto,Valentín',
    'José,David,Javier,Antonio,Francisco,Juan,Manuel,Carlos,Jorge,Alberto,Fernando,Luis,Miguel,Sergio,Ángel,Pedro,Jesús,Rafael,Pablo,Óscar,Ignacio,Raúl,Enrique,Vicente,Alfonso,Rubén,Eduardo,Andrés,Joaquín,Jordi,Íñigo,Xavier,Ramón,Gonzalo,Marcos,Emilio,Roberto,Tomás,Ricardo,Félix',
    'Alejandro,David,Daniel,Javier,Pablo,Sergio,Carlos,Adrián,Álvaro,Jorge,Rubén,Iván,Mario,Raúl,Diego,Alberto,Manuel,Víctor,Miguel,Antonio,Marcos,Óscar,Fernando,Jesús,Juan,Rafael,Ignacio,Guillermo,Jaime,Gonzalo,Borja,Íñigo,Aitor,Unai,Marc,Pau,Jordi,Hugo,Héctor,Samuel',
    'Hugo,Martín,Lucas,Mateo,Leo,Daniel,Alejandro,Pablo,Manuel,Álvaro,Adrián,David,Mario,Enzo,Diego,Marcos,Izan,Javier,Marco,Álex,Bruno,Oliver,Miguel,Thiago,Antonio,Marc,Carlos,Ángel,Juan,Gonzalo,Gael,Sergio,Nicolás,Dylan,Gabriel,Jorge,Iker,Aitor,Pau,Unai',
  ],
  F: [
    'María,Carmen,Josefa,Isabel,Dolores,Pilar,Teresa,Ana,Francisca,Antonia,Rosa,Mercedes,Concepción,Encarnación,Manuela,Juana,Ángeles,Rosario,Remedios,Amparo,Asunción,Consuelo,Montserrat,Margarita,Julia,Luisa,Esperanza,Soledad,Victoria,Inmaculada,Lucía,Elena,Josefina,Matilde,Paz,Purificación,Trinidad,Natividad,Emilia,Rafaela',
    'María,Cristina,Laura,Marta,Elena,Ana,Raquel,Silvia,Pilar,Montserrat,Begoña,Nuria,Susana,Mónica,Isabel,Carmen,Rosa,Beatriz,Patricia,Eva,Sonia,Teresa,Yolanda,Mercedes,Inmaculada,Rocío,Lourdes,Esther,Gloria,Concepción,Ángeles,Marina,Natalia,Victoria,Lucía,Margarita,Amparo,Sara,Belén,Rebeca',
    'Laura,Lucía,Paula,Andrea,Marta,Sara,Cristina,María,Irene,Alba,Elena,Noelia,Patricia,Raquel,Natalia,Claudia,Ana,Nerea,Carmen,Silvia,Beatriz,Sandra,Rocío,Lorena,Miriam,Alicia,Verónica,Julia,Ainhoa,Marina,Carla,Esther,Isabel,Tamara,Rebeca,Leire,Judith,Inés,Celia,Teresa',
    'Lucía,Sofía,Martina,María,Julia,Paula,Valeria,Emma,Daniela,Carla,Alba,Noa,Alma,Sara,Carmen,Vega,Lara,Mía,Valentina,Olivia,Claudia,Jimena,Lola,Chloe,Aitana,Abril,Ana,Laia,Triana,Elena,Candela,Alejandra,Vera,Manuela,Adriana,Irene,Marina,Ariadna,Nora,África',
  ],
};

// ------------------------------------------------------------------ given names: Asian traditions
// Chinese: mainland-born given names in pinyin (written as one word), Hong Kong and Guangdong-born names in
// Hong Kong Cantonese romanization, Taiwan-born names in Taiwan's Wade-Giles style (both hyphenated as their
// passports write them), plus the English names many Hong Kong and Taiwan-born people carry as their legal
// first names. The mix by cohort follows the waves: Cantonese-speaking before 1980, mainland after.
GIVEN['chinese-cmn'] = {
  M: [
    'Jianguo,Guoqiang,Jianhua,Zhiqiang,Guoliang,Jianjun,Yongqiang,Jianping,Guohua,Zhiming,Deming,Zhenhua,Weiguo,Jianzhong,Liming,Jianxin,Guoping,Guangming,Yonggang,Zhongming,Wenming,Baoguo,Jiahua,Jinsheng,Rongsheng,Fusheng,Changsheng,Zhaohui,Shengli,Xuezhong,Yongming,Zhenguo,Qingshan,Wenbin,Dezhong',
    'Wei,Jun,Jian,Yong,Tao,Bin,Gang,Hui,Ming,Qiang,Lei,Feng,Hai,Bo,Peng,Liang,Dong,Ping,Chao,Xin,Jie,Hongwei,Xiaodong,Jianming,Weidong,Xiaojun,Zhigang,Haitao,Jianbo,Xiaolong,Yonghong,Zhiwei,Xiaogang,Weimin,Hongbin,Zhihong,Liqiang,Wenjun,Xiaobing',
    'Hao,Lei,Peng,Tao,Jie,Yang,Chao,Xin,Bo,Long,Yu,Kai,Fan,Hang,Rui,Yi,Zhe,Jiawei,Tianyu,Haoyu,Yifan,Jiahao,Zhiyuan,Yuxiang,Junjie,Wenjie,Yiming,Zhenyu,Junhao,Jinlong,Shuai,Bowen,Yuhang,Xiang,Kun,Pengfei,Wenhao,Lin,Zhihao,Haiyang',
    'Haoran,Yuxuan,Zirui,Yichen,Haoyu,Zihao,Yuhang,Junhao,Muchen,Yize,Zimo,Haoxuan,Jiarui,Siyuan,Hongyu,Boyu,Yuze,Zeyu,Kaiwen,Jinhao,Ruixuan,Zixuan,Mingze,Yuchen,Tianrui,Bohan,Ziyang,Yuheng,Shengyang,Jingyu,Hanwen,Yunfei,Zhiyang,Chenxi,Tianyou,Yifeng,Ruize,Junyi',
  ],
  F: [
    'Shuzhen,Guiying,Yulan,Xiuying,Guilan,Yuying,Xiulan,Suzhen,Fengying,Shulan,Guizhen,Yuzhen,Lihua,Xiuzhen,Meiying,Shufen,Shuying,Guifang,Yuhua,Cuiying,Yufang,Xiuhua,Aihua,Yumei,Huizhen,Shuhua,Meilan,Xiuqin,Lanying,Baozhen,Jinhua,Yuxiu,Fenglan,Suhua,Peizhen',
    'Li,Yan,Hong,Ping,Hua,Ling,Jing,Hui,Mei,Xia,Juan,Yun,Fang,Min,Na,Qin,Lan,Hongmei,Xiaohong,Yanping,Lijuan,Xiaoyan,Haiyan,Chunmei,Lihong,Yanhong,Xiaoli,Liping,Weiwei,Yanli,Hongyan,Dongmei,Xiaomei,Ying,Rong,Yali,Xiaoping,Qiong,Lili',
    'Jing,Yan,Ting,Xue,Qian,Lu,Dan,Yue,Yang,Jia,Xin,Wen,Shan,Yu,Meng,Yuting,Jingjing,Tingting,Xiaoxue,Yingying,Shanshan,Yaqi,Mengyao,Jiayi,Qianqian,Wenjing,Xiaoyu,Shuang,Huan,Lingling,Mengmeng,Xinyu,Yiwen,Siyu,Yujie,Jie,Ning,Xiaoqian,Wenwen,Ruoyu',
    'Yutong,Zihan,Xinyi,Yixuan,Ruoxi,Shiyu,Yuxin,Keer,Yinuo,Xinyue,Siqi,Yuqi,Yiran,Mengqi,Jiaxin,Zhiruo,Ruotong,Yuhan,Chenxi,Yanxi,Anqi,Jingyi,Yunxi,Yaxuan,Xinran,Shuyi,Jiaqi,Muxi,Xiyue,Siyu,Yuyan,Ruoxuan,Zixin,Mengxuan,Jiayi,Qingyi,Yuning,Ziqi',
  ],
};

GIVEN['chinese-yue'] = {
  M: [
    'Kwok-wah,Chi-keung,Wai-man,Kam-wing,Kwok-keung,Yiu-wah,Siu-ming,Chi-ming,Kin-wah,Wing-hong,Kwok-leung,Wai-keung,Kam-chuen,Kwong-wah,Tak-wing,Chi-wai,Wing-cheung,Hon-ming,Yuk-lun,Shu-kei,Ping-kwan,Sai-cheong,Hing-wah,Chun-hung,Man-yiu,Kai-ming,Pak-lam,Yiu-kwong,Ting-fai,Sun-wah,Kin-man,Fook-wing,Kwan-yiu,Wai-chung',
    'Wai-ming,Chi-wing,Ka-wai,Man-kit,Chun-kit,Kin-fai,Wing-kin,Ka-ming,Siu-fung,Wai-kit,Kwok-hung,Chi-hang,Ho-yin,Man-hon,Tsz-wai,Chun-wai,Kam-fai,Wai-lun,Yat-ming,Chi-kin,Hon-wai,Kwan-ho,Wing-lok,Kin-ping,Chun-yip,Ka-lok,Ming-fai,Pui-kei,Hung-fai,Wai-hung,Kwok-ming,Siu-keung,Kar-wai',
    'Ka-ho,Chun-hei,Tsz-chun,Ka-lok,Ho-yin,Chun-yin,Wing-hei,Tsz-hin,Pak-hei,Ka-chun,Chi-hin,Cheuk-hin,Yat-hei,Tsz-kit,Ho-lam,Ka-fai,Man-chun,Chun-lok,Ka-yiu,Hiu-fung,Ho-ming,Tsz-ho,Kwan-lok,Wai-hin,Chi-lok',
    'Tsz-chun,Chun-hei,Ho-yin,Lok-hin,Pak-yin,Tsz-hin,Chi-lok,Yat-long,Ka-chun,Cheuk-lam,Tsz-long,Shing-hei,Ho-lam,Chun-ho,Hok-yin,Long-hin,Yu-hin,Pak-ho,Lok-yiu,Hin-yu',
  ],
  F: [
    'Mei-ling,Wai-ling,Yuk-lan,Siu-wan,Lai-ching,Yuk-ying,Wai-fong,Mei-lan,Kam-ying,Suk-fong,Yuk-mui,Lai-ha,Siu-ying,Wai-yee,Kit-ling,Yin-ping,Kwai-fong,Sau-ling,Shuk-yee,Lai-kuen,Wai-kuen,Siu-lan,Yuk-kam,Fung-ying,Sau-fong,Oi-lin,Bik-yuk,Choi-ha,Lin-fong,Wai-chun,So-ching',
    'Wai-yee,Mei-yee,Ka-yan,Lai-yee,Pui-ling,Wing-yan,Man-yee,Suk-yee,Ka-man,Sze-man,Wai-man,Hoi-yan,Pui-yee,Siu-man,Wai-han,Ching-yee,Mei-kuen,Shuk-fan,Man-wai,Ka-yee,Kit-yee,Wing-sze,Sau-man,Yee-man,Kwan-yee,Lai-fong,Fung-yee,Yuen-ling',
    'Hiu-yan,Tsz-yan,Hoi-ching,Sze-wing,Hiu-tung,Pui-shan,Ka-yi,Yan-ting,Tsz-ching,Man-ching,Ching-man,Wai-shan,Lok-yee,Yuen-ting,Hiu-ching,Tsz-ying,Ka-wing,Cheuk-yan,Sze-ki,Hoi-yan,Wing-yan,Ka-man',
    'Hiu-lam,Tsz-yu,Lok-yan,Wing-tung,Hoi-tung,Tsz-kiu,Hei-tung,Ching-yi,Sum-yu,Yan-yu,Hei-man,Ching-lam,Yuet-tung,Hiu-yu,Cheuk-yiu,Ka-hei,Yan-ching,Tsz-ching,Hoi-ching,Sze-wing',
  ],
};

GIVEN['chinese-tw'] = {
  M: [
    'Chih-ming,Wen-hsiung,Chun-hsiung,Kuo-hua,Yung-fu,Chien-kuo,Kuo-ching,Ming-te,Chin-lung,Tien-fu,Wen-pin,Cheng-hsiung,Kuo-liang,Ming-chang,Chung-hsin,Yao-tsung,Te-ming,Wen-chung,Hsien-chang,Jung-hua,Sheng-hsiung,Yung-ching,Chin-fa,Ching-hsiung,Shu-ming,Chia-hsiang,Tsung-hsien,Chao-ming',
    'Chih-wei,Chien-hung,Chun-hung,Chih-hung,Wen-chieh,Chia-hung,Chih-cheng,Wei-ming,Cheng-hsien,Yu-cheng,Chien-chih,Chih-hao,Wen-hsien,Ming-chieh,Chia-ming,Yung-chang,Chung-yi,Tsung-yu,Chih-yuan,Cheng-wei,Chun-chieh,Wen-hao,Ming-hung,Kuo-wei,Shih-hao,Chun-yi',
    'Chia-hao,Kuan-ting,Tsung-han,Yu-hsiang,Chun-hao,Po-yu,Chia-wei,Cheng-han,Kuan-yu,Chen-yu,Tzu-hao,Po-han,Hsiang-yu,Chun-yu,Yu-chieh,Kai-wen,Tsung-wei,Shao-wei,Wei-ting,Pin-yu,Chih-hao,Yu-cheng',
    'Po-yu,Yu-chen,Chen-yu,Pin-yu,Yu-hsiang,Cheng-en,Yu-en,Po-yen,Chen-hsi,Yi-chen,Chun-yu,Tzu-hsuan,Kuan-yu,Po-han,Ping-hsun,Yu-shen,Chia-hsun,Tzu-yang,En-hsi,Yu-ting',
  ],
  F: [
    'Mei-hua,Hsiu-ying,Shu-fen,Yu-lan,Su-chen,Li-hua,Hsiu-lan,Mei-yu,Shu-hui,Yueh-ying,Hsiu-chen,Chin-lien,Pao-chu,Shu-chen,Yu-chu,Mei-ling,Li-chu,Hui-ying,Chiu-hsiang,Hsueh-mei,Lan-ying,Yu-mei,Shu-ying,Chin-hua,Ah-lien,Su-mei',
    'Shu-fen,Mei-hui,Hui-ling,Mei-ling,Li-chun,Ya-ping,Shu-ling,Hsiu-chuan,Pei-ling,Hui-chen,Ya-hui,Shu-hui,Yu-ling,Li-hua,Su-ching,Ching-yi,Shu-chuan,Pei-chi,Li-ling,Wen-ling,Ya-ling,Hui-ju,Hsin-yi,Mei-fang,Chia-ling,Yi-ling',
    'Ya-ting,Yi-chen,Hsin-yi,Yu-ting,Chia-hui,Pei-yu,Yu-hsuan,Yi-ting,Chia-ying,Ting-yu,Pei-shan,Yi-hsuan,Chia-yi,Wan-ting,Hsiao-wen,Chia-yu,Yen-ting,Szu-yu,Pei-hsuan,Ching-wen,Tzu-ying,Ya-wen,Yi-ju,Yu-han',
    'Yu-tung,Pin-yu,Yu-chen,Tzu-han,Yi-hsuan,Pin-yi,Yun-chen,En-hsi,Yu-en,Chia-en,Hsin-yu,Yu-hsin,Ssu-han,Yu-shan,Wei-ning,Tzu-chi,Yi-an,Pei-en,Yu-tzu,Chen-hsi',
  ],
};

GIVEN['chinese-en'] = {
  M: [
    'Peter,Frank,Henry,George,Kenneth,Raymond,Patrick,Stanley,Albert,Wilson,Philip,Simon,Edmond,Alfred,Victor,Thomas,Francis,Benjamin,Edward,Ronald,Dennis,Alan,Anthony,Gary,Johnny,Michael,Paul,Jimmy,Andrew,William,Lawrence,Danny,Tony,Samuel,Leonard,Gordon',
    'Kenneth,Raymond,Patrick,Peter,Eric,Kevin,Vincent,Tony,Alan,Gary,Dennis,Danny,Johnny,Jimmy,Andy,Simon,Stanley,Wilson,Edmond,Philip,Derek,Ivan,Samuel,Michael,Thomas,Francis,Eddie,Alex,Benny,Calvin,Alvin,Kenny,Terry,Jacky,Felix,Nelson',
    'Kevin,Eric,Jason,Jack,Leo,Vincent,Kenny,Andy,Ivan,Calvin,Alvin,Brian,Terry,Jacky,Sunny,Ken,Tony,Hugo,Felix,Oscar,Justin,Alex,Daniel,Ryan,Max,Jerry,Allen,Steven,Edwin,Marco,Matthew,Harry,Louis,Nelson,Desmond,Gary',
    'Kevin,Jason,Leo,Ryan,Max,Lucas,Ethan,Jack,Eric,Oscar,Hugo,Felix,Justin,Ivan,Daniel,Matthew,Marcus,Aaron,Ian,Sean,Alex,Louis,Henry,Leon,Brian,Vincent,Andy,Jerry,Jayden,Kelvin,Chris,Victor,Owen,Harry,Edison,Tommy',
  ],
  F: [
    'Mary,Helen,Grace,Lily,Rose,Alice,Margaret,Nancy,Betty,Jenny,Linda,Susan,Amy,Annie,Joyce,Wendy,Irene,Rebecca,Winnie,Teresa,Josephine,Catherine,Agnes,Anita,Carmen,Doris,Esther,Fanny,Iris,Judy,Kitty,May,Monica,Peggy,Ruby,Sylvia,Vivian,Yvonne,Connie',
    'Wendy,Winnie,Irene,Joyce,Amy,Annie,Jenny,Linda,Susan,Grace,Helen,Iris,Vivian,Teresa,Monica,Carmen,Anita,Cindy,Tina,Kitty,Ada,Yvonne,Connie,Doris,Fanny,Agnes,Esther,Sylvia,Josephine,Rebecca,Christina,Elaine,Karen,Sharon,Shirley,Mandy',
    'Cindy,Tina,Vivian,Joyce,Iris,Winnie,Fiona,Cherry,Coco,Vicky,Crystal,Candy,Mandy,Ivy,Jessie,Kelly,Bonnie,Emily,Grace,Amy,Angela,Michelle,Jessica,Karen,Elaine,Phoebe,Venus,Gloria,Sharon,Natalie,Stella,Chloe,Carrie,Tiffany,Ruby,Zoe',
    'Chloe,Emily,Grace,Amy,Zoe,Stella,Fiona,Phoebe,Natalie,Sophia,Ivy,Ruby,Cherry,Jessie,Coco,Vivian,Iris,Angela,Hannah,Kelly,Tiffany,Crystal,Winnie,Hazel,Lily,Emma,Bella,Elsa,Cindy,Mia,Sharon,Bonnie,Elaine,Sabrina,Yvonne,Sylvia',
  ],
};

GIVEN.chinese = {
  // [tradition, weight by era e1..e4, keep-with]: the English-name share stays available to Hong Kong and
  // Taiwan-born people even when their surname's romanization narrows the mix.
  mix: [
    ['chinese-cmn', [0.10, 0.25, 0.65, 0.80]],
    ['chinese-yue', [0.55, 0.35, 0.10, 0.05]],
    ['chinese-tw', [0.25, 0.25, 0.12, 0.07]],
    ['chinese-en', [0.10, 0.15, 0.13, 0.08], ['chinese-yue', 'chinese-tw']],
  ],
  us: {
    M: [
      'George,Henry,Frank,Albert,Edward,Thomas,Robert,Richard,Raymond,Kenneth,Harry,Gordon,Herbert,Philip,Lawrence,Calvin,Stanley,Donald,Wilbur,Walter',
      'Kenneth,Raymond,Gary,Dennis,Gordon,Calvin,Alvin,Russell,Glenn,Curtis,Ronald,Stanley,Jeffrey,Steven,Michael,David,Richard,Philip,Wesley,Darryl',
      'Kevin,Eric,Brian,Andrew,Justin,Jason,Jonathan,Alan,Kenneth,Vincent,Derek,Calvin,Alvin,Edwin,Steven,Jeffrey,Raymond,Victor,Ryan,Daniel,Wesley,Timothy,Ming',
      'Ethan,Lucas,Ryan,Jayden,Andrew,Aiden,Ian,Kevin,Nathan,Justin,Brandon,Evan,Alexander,Max,Ivan,Isaac,Caleb,Jason,Owen,Dylan,Jonathan,Wei',
    ],
    F: [
      'Mary,Helen,Alice,Dorothy,Ruth,Grace,Florence,Rose,Margaret,Lillian,Frances,Esther,Edna,Mabel,Ida,Pearl,Jean,Ann,Lily,Betty',
      'Karen,Linda,Susan,Patricia,Janet,Wendy,Lisa,Carol,Cynthia,Diane,Pamela,Kathy,Laura,Shirley,Lily,Doris,Nancy,Cindy,Lorraine,Debbie',
      'Michelle,Jennifer,Christine,Tiffany,Vivian,Stephanie,Jessica,Amy,Grace,Joyce,Cindy,Annie,Angela,Karen,Wendy,Ivy,Irene,Cynthia,Jenny,Christina,Melissa,Kelly,Mei',
      'Chloe,Emily,Olivia,Sophia,Emma,Isabella,Claire,Grace,Hannah,Natalie,Ashley,Jessica,Michelle,Jasmine,Angela,Abigail,Audrey,Kaitlyn,Vivian,Lily,Ella,Evelyn,Mei,Lin',
    ],
  },
};

// Filipino: Spanish and English names in Philippine use (written without accents, as Filipinos write them),
// the -el / -lyn blends of the 1960s-90s, and today's Prince, Angel and Althea.
GIVEN.filipino = {
  M: [
    'Jose,Juan,Pedro,Antonio,Ricardo,Rodolfo,Romeo,Ernesto,Rolando,Eduardo,Roberto,Manuel,Francisco,Alfredo,Danilo,Reynaldo,Florencio,Rogelio,Leonardo,Benjamin,Arturo,Rodrigo,Mario,Domingo,Felipe,Vicente,Gregorio,Teodoro,Rufino,Marcelino,Ramon,Fernando,Virgilio,Emilio,Nestor,Lorenzo,Celestino,Alberto,Jesus,Wilfredo,Restituto,Crisanto',
    'Jose,Ronaldo,Romeo,Rolando,Reynaldo,Eduardo,Ricardo,Danilo,Edgardo,Rodel,Rommel,Arnel,Ariel,Ramon,Antonio,Roberto,Manuel,Alfredo,Joel,Noel,Allan,Dennis,Rey,Ferdinand,Jaime,Nestor,Elmer,Edwin,Ruel,Arnold,Randy,Jerome,Raymond,Michael,Mark,Marlon,Renato,Rodrigo,Bernard,Francis,Oscar',
    'Mark,John,Michael,Christian,Jerome,Joseph,Ryan,Kevin,Jayson,Marvin,Christopher,Paolo,Joshua,Angelo,Carlo,Daniel,Jonathan,Kenneth,Jeffrey,Ronald,Rodel,Raymond,Bryan,Mico,Patrick,Gerald,Jericho,Jhon,Neil,Aldrin,Jomar,Jasper,Rex,Kristoffer,Jan,Vincent,Jeric,Rommel,Arvin,Ralph',
    'John,Mark,Joshua,Christian,Angelo,Nathaniel,Gabriel,Ethan,Kyle,Ian,James,Justin,Carl,Prince,Jacob,Andrei,Sean,Kurt,Lance,Joaquin,Miguel,Rafael,Adrian,Daniel,Matthew,Liam,Elijah,Jared,Gian,Kian,Zion,Raphael,Jhon,Jericho,Ezekiel,Clarence,Vince,Lorenzo,Xian,Josiah',
  ],
  F: [
    'Maria,Teresita,Lourdes,Erlinda,Corazon,Rosario,Leticia,Remedios,Josefina,Carmelita,Evangeline,Natividad,Milagros,Felicidad,Concepcion,Rosalinda,Lolita,Gloria,Perla,Luzviminda,Purita,Estrella,Fe,Erlina,Norma,Elena,Victoria,Aurora,Cecilia,Flordeliza,Virginia,Adelaida,Nenita,Precy,Zenaida,Thelma,Rosita,Linda,Imelda,Editha,Charito,Lilia',
    'Maria,Marites,Maricel,Marilou,Rowena,Lorna,Jocelyn,Mylene,Rosemarie,Maribel,Emily,Elizabeth,Annabelle,Gemma,Cristina,Jennifer,Rachelle,Ruby,Grace,Leah,Analyn,Arlene,Evelyn,Ofelia,Marivic,Edna,Susan,Liza,Cynthia,Rosalie,Melinda,Gina,Vilma,Divina,Nora,Sheila,Rhodora,Daisy,Myrna,Josephine,Rebecca,Agnes',
    'Kristine,Jennifer,Angelica,Michelle,Jasmine,Joanna,Christine,Princess,Kimberly,Camille,Patricia,Katherine,Rose,Rachel,Jennylyn,Mae,Sheena,Jessa,Joy,Lovely,April,Diana,Shiela,Charmaine,Cherry,Jenny,Maricar,Abigail,Rhea,Shirley,Jamie,Clarissa,Stephanie,Mariel,Bea,Kathleen,Erika,Aileen,Lyka,Mary',
    'Angel,Princess,Althea,Andrea,Nicole,Samantha,Bea,Angela,Sofia,Ashley,Jasmine,Kyla,Mikaela,Janelle,Kristine,Bianca,Erica,Angeline,Gabrielle,Trisha,Hannah,Chloe,Isabella,Alexa,Kaye,Zia,Lara,Jillian,Danica,Sophia,Faith,Hazel,Jane,Rhian,Julia,Pia,Ysabel,Margarette,Shane,Aubrey',
  ],
  us: {
    M: [
      'Joseph,John,Robert,Richard,Edward,Ernest,Frank,Raymond,Alfred,Rudy,Benjamin,Vincent,Anthony,Rodney,Rogelio,Danilo',
      'Joseph,Michael,Ronald,Raymond,Rodney,Mark,Jerome,Dennis,Allan,Edwin,Ferdinand,Noel,Francis,Paul,Anthony,Romeo,Jaime,Rommel',
      'Paolo,Miguel,Angelo,Carlo,Rafael,Gabriel,Joaquin,Marco,Francis,Ryan,Kevin,Jerome,Christian,Mark,Joseph,Paul,John,Vincent,Jason,Darren,Brandon,Jared',
      'Gabriel,Joaquin,Miguel,Elijah,Ethan,Lucas,Nathaniel,Isaiah,Josiah,Rafael,Angelo,Matthew,Aiden,Jayden,Liam,Adrian,Caleb,Joshua,Christian,Lorenzo,Mateo,Kai',
    ],
    F: [
      'Mary,Rose,Josephine,Gloria,Carmen,Lillian,Juanita,Teresa,Linda,Lourdes,Rosemary,Virginia,Evelyn,Cecilia,Dolores,Corazon',
      'Maria,Elizabeth,Lisa,Jennifer,Michelle,Christine,Theresa,Maricel,Rowena,Gina,Liza,Rachelle,Cynthia,Annabelle,Melissa,Grace,Leah,Rebecca',
      'Kristine,Angelica,Jasmine,Camille,Nicole,Bianca,Patricia,Michelle,Christine,Joanna,Melissa,Gabrielle,Alyssa,Kristina,Stephanie,Jessica,Leah,Danielle,Jennifer,Kimberly,Erica,Monica',
      'Isabella,Sofia,Bea,Mikaela,Ysabel,Leah,Gabrielle,Chloe,Olivia,Sophia,Bianca,Jasmine,Angelina,Alyssa,Nicole,Kayla,Arianna,Mia,Ella,Hailey,Andrea,Julianna',
    ],
  },
};

// Vietnamese: given names as most Vietnamese Californians register them, without tone marks. Women's
// names are often recorded with the middle name Thi, men's with Van or a generation name (see middleName).
GIVEN.vietnamese = {
  M: [
    'Hung,Thanh,Minh,Son,Hai,Tam,Long,Quang,Duc,Binh,Phuoc,Loc,Tho,Hoa,Nghia,Khai,Chau,Dinh,Phuc,Vinh,Hoang,Tuan,Dung,Trung,Cuong,Thang,Hien,Lam,Ba,Tai,Sang,Hieu,Tri,Nam,Lanh,Thuan,Toan,Dat,Danh,Quy',
    'Tuan,Minh,Hung,Dung,Thanh,Hai,Nam,Long,Quang,Hieu,Phuc,Duc,Huy,Trung,Vinh,Son,Cuong,Thang,Hoang,Binh,Khanh,Phong,Tri,Tai,Loc,Toan,Dat,Tam,Hoa,Thinh,Vu,Tien,Nghia,Viet,Tung,Quoc,Kiet,Phat,Thai,Bao',
    'Minh,Tuan,Huy,Khoa,Bao,Duy,Hieu,Phong,Quan,Dat,Vinh,Long,Nam,Thinh,Tri,Khanh,Phuc,Kiet,Nhan,Thanh,Hoang,Trung,Phat,Tai,Hung,Quang,Viet,Hai,Cuong,Tien,Danh,Tan,An,Thien,Nghia,Loc,Toan,Luan,Son,Duc',
    'Minh,Khang,Bao,Huy,Phuc,Khoa,Nam,Gia,An,Khanh,Dang,Duy,Kiet,Thinh,Phat,Quan,Long,Hieu,Tri,Lam,Khoi,Tuan,Vinh,Nhat,Hoang,Thien,Danh,Quang,Phong,Hung,Tung,Dat,Son,Viet,Huu,Trung,Thanh,Tam,Loc,Hai',
  ],
  F: [
    'Lan,Hoa,Mai,Hong,Tuyet,Lien,Nga,Loan,Thu,Cuc,Tam,Huong,Hanh,Kim,Phuong,Yen,Dung,Hue,Thuy,Xuan,Anh,Bich,Diep,Hang,Hien,Ly,Muoi,Nhung,Oanh,Sau,Thao,Thanh,Thoa,Tuyen,Van,Le,Ngoc,Dao,Huyen,Sen,Chi,Quyen',
    'Lan,Linh,Huong,Mai,Hoa,Thu,Trang,Ngoc,Hanh,Thuy,Hong,Hang,Phuong,Nga,Hien,Tuyet,Loan,Dung,Kim,Yen,Anh,Thao,Nhung,Tam,Van,Lien,Diem,Oanh,Trinh,Uyen,Quynh,Thanh,Xuan,Huyen,My,Tuyen,Hue,Le,Hai,Kieu,Diep,Ly',
    'Linh,Trang,Thao,Vy,Nhi,Ngan,Uyen,Anh,Quynh,My,Tram,Khanh,Han,Ngoc,Tien,Thy,Giang,Huong,Mai,Phuong,Duyen,Hanh,Thu,Hang,Hien,Yen,Trinh,Nhung,Thuy,Van,Lan,Hoa,Diem,Kim,Huyen,Oanh,Tuyet,Loan,Xuan,Nga,Chau',
    'Vy,Nhi,Anh,Ngan,Linh,Han,Thy,My,Tram,Khanh,Tien,Uyen,Quynh,Thao,Trang,Ngoc,An,Chau,Giang,Mai,Yen,Hanh,Phuong,Huong,Trinh,Duyen,Thu,Huyen,Diep,Nghi,Kim,Tu,Hoa,Lan,Hien,Hang,Bao,Nhu,Xuan,Dan,Ha',
  ],
  us: {
    M: [
      'Peter,Paul,John,Joseph,Thomas,Michael,Steven,David,Daniel,Tony,Johnny,Jimmy,Henry,Minh,Danny,Kevin,Andrew,Francis,Vincent,Anthony,Richard,Robert',
      'Tony,Peter,Paul,John,Joseph,Thomas,Michael,Steven,David,Daniel,Kevin,Danny,Johnny,Jimmy,Henry,Minh,Vincent,Andrew',
      'Kevin,Tony,Peter,Andrew,Vincent,Jimmy,Johnny,Steven,Jonathan,Brian,Kenny,Michael,Joseph,Paul,John,Thomas,Danny,David,Daniel,Eric,Henry,Minh,Bao,Huy,Khoa,An',
      'Ethan,Ryan,Kevin,Andrew,Brandon,Aiden,Jayden,Nathan,Lucas,Justin,Vincent,Bryan,Daniel,Kenny,Tony,Bao,Minh,Khoi,Kai,Huy,Ivan,Joseph',
    ],
    F: [
      'Maria,Theresa,Anna,Linda,Lisa,Mary,Catherine,Kim,Mai,Lan,Christine,Tina,Elizabeth,Monica,Cecilia,Rose,Agnes,Helen',
      'Linda,Lisa,Tina,Kathy,Theresa,Maria,Cindy,Amy,Annie,Tracy,Jennifer,Christina,Mai,Lan,Kim,Julie',
      'Vivian,Tiffany,Jenny,Michelle,Christina,Tracy,Jennifer,Cindy,Amy,Tina,Linda,Lisa,Annie,Kathy,Theresa,Maria,Vy,Mai,Linh,Kim,Thao,Jessica',
      'Emily,Chloe,Sophia,Vivian,Tiffany,Jessica,Kayla,Ashley,Jasmine,Angela,Isabella,Natalie,Michelle,Hannah,Vy,Mai,Linh,Anh,Emma,Olivia,Kaitlyn,Angelina',
    ],
  },
};

// Korean: Korea-born given names hyphenated as Korean Americans write them (Young-ho, Ji-hoon, Min-jung);
// the US-born generation largely carries English and Biblical names from church (Daniel, Grace, Esther).
GIVEN.korean = {
  M: [
    'Young-ho,Sung-ho,Jong-soo,Young-soo,Kwang-ho,Jae-ho,Young-chul,Myung-soo,Sang-ho,Byung-ho,Yong-soo,Jung-ho,Seung-ho,Dong-soo,Chang-ho,Hyun-soo,Young-sik,Jong-ho,Sang-chul,Kwang-soo,Byung-chul,Jae-sung,Tae-ho,Ki-young,Yong-ho,Chul-soo,Jin-ho,Kyung-ho,Sung-soo,Chang-soo,Won-ho,Han-soo,Il-hwan,Moon-ho,Hak-soo,Duk-soo,Man-ho,Ki-ho,Soon-ho,Hee-soo',
    'Jung-hoon,Sung-min,Young-jin,Jae-hoon,Sang-woo,Jin-woo,Hyun-woo,Dong-hyun,Seung-hoon,Min-soo,Jun-ho,Sung-hoon,Jae-won,Joon-young,Sang-min,Hyun-jun,Ki-hyun,Dong-wook,Jae-hyun,Young-min,Sung-jin,Kyung-soo,Seung-woo,Chang-min,Tae-hoon,Jong-min,Hyung-jin,Joon-ho,Byung-hoon,Jin-soo,Kwang-min,Seok-jin,Yong-jun,Woo-jin,Sang-hyun,Jae-young,Dong-hoon,Min-ho,Sung-woo,Hyun-sik',
    'Ji-hoon,Hyun-woo,Min-jun,Sung-hyun,Dong-hyun,Jun-young,Seung-min,Min-ho,Jae-min,Ji-ho,Tae-hyun,Jin-young,Hyun-jun,Woo-jin,Sang-hoon,Joon-ho,Min-seok,Seung-hyun,Ji-sung,Jae-hyun,Sung-woo,Hyun-soo,Young-woo,Jong-hyun,Ji-won,Jun-hyuk,Dong-ha,Won-jun,Chan-woo,Ji-hwan,Hyun-seok,Min-woo,Jae-woo,Seung-jun,Sang-yoon,Kyu-ho,Yoon-ho,Seong-jin,Yong-ha,Jun-seok',
    'Min-jun,Seo-jun,Ha-jun,Do-yoon,Ye-jun,Si-woo,Ju-won,Ji-ho,Ji-hoon,Jun-seo,Gun-woo,Hyun-woo,Woo-jin,Seung-woo,Yu-jun,Jun-woo,Do-hyun,Ji-hwan,Min-jae,Eun-woo,Jin-woo,Dong-hyun,Tae-yang,Jae-won,Seong-min,Yoon-woo,Si-hoo,Ha-min,Jung-woo,Chan-young,Tae-min,Hyun-jun,Seung-hyun,Kang-min,Ye-seong,Ha-ram,Seo-jin,Ji-an,Min-hyuk,Si-won',
  ],
  F: [
    'Young-ja,Kyung-ja,Soon-ja,Jung-ja,Myung-ja,Sook-ja,Young-hee,Jung-hee,Myung-hee,Kyung-hee,Mi-ja,Ok-soon,Soon-ok,Young-sook,Jung-sook,Myung-sook,Kyung-sook,Hyun-sook,Young-ae,Sun-hee,Chun-ja,Hee-ja,Kum-ja,Soon-hee,Ok-ja,Bok-soon,Jung-soon,Yeon-hee,Kyung-ok,Hwa-ja,Young-soon,Sang-hee,Eun-ja,In-sook,Kyung-ae,Hye-ja,Mal-soon,Duk-ja,Kil-ja,Mi-sook',
    'Mi-kyung,Eun-jung,Ji-young,Hye-jin,Kyung-mi,Sun-young,Mi-young,Eun-hee,Young-mi,Jung-hwa,Hyun-joo,Min-jung,Soo-jin,Eun-young,Hye-young,Mi-sun,Jung-eun,Sun-mi,Yoon-hee,Hee-jung,Kyung-ah,Mi-ok,Sung-hee,Jin-hee,Eun-sook,Hyun-jung,Hye-kyung,Myung-sun,In-young,Soo-kyung,Young-joo,Jung-mi,Seon-hee,Hee-kyung,Eun-mi,Sook-hee,Ji-hyun,Yoon-jung,Mi-ra,Kyung-hwa',
    'Ji-eun,Min-ji,Su-jin,Hye-won,Ji-hye,Eun-ji,Seo-yeon,Yu-jin,Ji-won,Ji-yeon,Hyun-jung,Min-young,So-young,Ye-jin,Hye-jin,Da-eun,Yoon-ji,Na-young,Eun-bi,Su-yeon,Jung-min,Ha-na,Ji-min,Seung-hee,Bo-ram,Ye-won,Hyo-jin,So-yeon,Min-kyung,Ah-young,Ji-sun,Hae-won,Jae-eun,Sun-hwa,Ga-young,Mi-rae,Ye-eun,Min-seo,Joo-hee,Yeon-woo',
    'Seo-yeon,Seo-yun,Ji-woo,Seo-hyun,Min-seo,Ha-eun,Ha-yoon,Ji-yoo,Chae-won,Su-ah,Ji-a,Ye-eun,Ji-min,Su-bin,Ye-rin,Da-in,Ye-seo,Yu-na,Ha-rin,So-yul,Ji-an,Seo-ah,Si-eun,Chae-eun,Na-eun,Ye-ji,Ga-eun,Yoon-seo,Ah-rin,Eun-seo,Da-yeon,Ha-neul,Su-min,Yu-jin,Seo-jin,Min-ji,Ji-yun,Hye-rin,Ye-na,Ha-na',
  ],
  us: {
    M: [
      'David,Daniel,Paul,Peter,John,James,Samuel,Joseph,Thomas,Richard,Charles,Philip,Edward,Robert,Henry,Harry',
      'David,Daniel,Paul,Peter,John,James,Steven,Michael,Richard,Thomas,Andrew,Samuel,Joseph,Charles,Edward,Philip,Timothy,Eugene',
      'Daniel,David,John,Paul,Andrew,Joseph,Samuel,James,Peter,Michael,Brian,Justin,Eugene,Jason,Steven,Kevin,Jonathan,Timothy,Joshua,Edward,Sean,Christopher,Eric,Richard,Albert',
      'Daniel,Ethan,Andrew,Ryan,Joshua,Lucas,Jayden,Caleb,Isaac,Nathan,Aiden,Samuel,Joseph,Brandon,Justin,Jonathan,Aaron,Jacob,Elijah,Noah,Matthew,David,Joon',
    ],
    F: [
      'Grace,Esther,Mary,Helen,Ruth,Martha,Alice,Margaret,Jane,Anna,Dorothy,Rose,Lillian,Elizabeth,Florence,Sarah',
      'Grace,Esther,Susan,Julie,Christine,Helen,Jane,Mary,Ann,Sarah,Rebecca,Rachel,Elizabeth,Jennifer,Sharon,Michelle,Joanne,Eunice,Ruth,Hannah',
      'Grace,Esther,Christine,Jennifer,Sarah,Hannah,Rachel,Eunice,Julie,Michelle,Joanne,Christina,Stephanie,Jane,Susie,Angela,Jessica,Helen,Elizabeth,Rebecca,Sharon,Diane,Irene,Joyce',
      'Grace,Chloe,Hannah,Sophia,Emily,Claire,Olivia,Esther,Sarah,Rachel,Isabella,Abigail,Ellie,Emma,Ashley,Erin,Audrey,Joanne,Rebekah,Faith,Joy,Sophie,Yuna',
    ],
  },
};

// Japanese: Japan-born names by era (Showa -ko names, Heisei and Reiwa favorites); Japanese Californians
// are mostly third and fourth generation, whose families mixed American and Japanese names.
GIVEN.japanese = {
  M: [
    'Hiroshi,Takashi,Kazuo,Minoru,Shigeru,Isamu,Takeshi,Masao,Yoshio,Akira,Tadashi,Toshio,Kenji,Haruo,Mitsuo,Susumu,Noboru,Yutaka,Osamu,Satoshi,Hideo,Kiyoshi,Saburo,Ichiro,Jiro,Masaru,Makoto,Shoji,Teruo,Yoshiaki,Fumio,Katsumi,Tetsuo,Nobuo,Hajime,Tomio,Yasuo,Masami,Toru,Seiji',
    'Hiroshi,Takashi,Makoto,Kenji,Tetsuya,Kazuhiro,Hideki,Masahiro,Satoshi,Naoki,Akira,Yoshihiro,Toshiyuki,Kenichi,Koji,Shinji,Hiroyuki,Takeshi,Yuji,Tomohiro,Masato,Tsuyoshi,Atsushi,Kazuya,Nobuyuki,Junichi,Yasuhiro,Manabu,Shigeki,Ryoichi,Kiyoshi,Noriyuki,Hitoshi,Kazunori,Hiroki,Takuya,Shuji,Keiichi,Mitsuru,Osamu',
    'Daisuke,Takuya,Kenta,Shota,Yusuke,Kohei,Ryota,Tomoya,Kazuki,Yuki,Takumi,Naoki,Daiki,Yuta,Shun,Sho,Hiroki,Ryo,Kento,Yuya,Tatsuya,Keisuke,Ryosuke,Shohei,Kenji,Taiki,Yudai,Masaki,Shinya,Kosuke,Akihiro,Yohei,Tomohiro,Jun,Takahiro,Kei,Hayato,Yuichi,Kyohei,Shingo',
    'Haruto,Yuto,Sota,Yuki,Hayato,Haruki,Ren,Kaito,Riku,Sora,Yamato,Minato,Hinata,Daiki,Takumi,Kota,Sosuke,Yuma,Itsuki,Kento,Ryusei,Shota,Kosei,Asahi,Hiroto,Yusei,Taiga,Kanata,Ritsu,Takeru,Rui,Yuito,Tsubasa,Kazuki,Ryota,Shun,Kaisei,Haru,Ryo,Aoi',
  ],
  F: [
    'Yoshiko,Keiko,Kazuko,Michiko,Sachiko,Hiroko,Yoko,Setsuko,Fumiko,Kimiko,Masako,Toshiko,Emiko,Kiyoko,Mitsuko,Haruko,Chiyoko,Tomiko,Fusako,Hisako,Sumiko,Teruko,Yukiko,Akiko,Noriko,Shizuko,Ayako,Hideko,Nobuko,Etsuko,Miyoko,Reiko,Junko,Kyoko,Mieko,Takako,Mariko,Yasuko,Chieko,Tsuyako',
    'Yumiko,Naoko,Kumiko,Mayumi,Keiko,Tomoko,Junko,Kyoko,Akemi,Yuko,Hiromi,Megumi,Masami,Noriko,Yoko,Emiko,Mariko,Kaori,Miki,Rie,Atsuko,Sayuri,Chikako,Eriko,Reiko,Mika,Satomi,Kazumi,Yukari,Akiko,Michiyo,Midori,Naomi,Takako,Kayoko,Mieko,Shoko,Yoshimi,Hitomi,Masumi',
    'Yuka,Ayumi,Mai,Megumi,Ai,Yui,Saki,Mami,Yuki,Haruka,Asami,Kana,Erika,Natsuki,Misaki,Nanami,Aya,Rie,Sayaka,Mika,Eri,Yuko,Tomomi,Akane,Chihiro,Momoko,Shiori,Yumi,Miho,Kaori,Nozomi,Ayaka,Risa,Moe,Kanako,Nao,Aki,Mayu,Yuri,Arisa',
    'Yui,Hina,Sakura,Rin,Aoi,Mei,Yuna,Himari,Mio,Riko,Koharu,Hinata,Akari,Mitsuki,Saki,Miyu,Nanami,Hana,Kokona,Yuka,Ichika,Tsumugi,Ema,Sara,Mao,Rina,Kaede,Nao,Haruka,Momoka,Ayaka,Kanon,Misaki,Yuzuki,Honoka,Wakana,Miu,Natsumi,Ena,Hikari',
  ],
  us: {
    M: [
      'George,Frank,Henry,Harry,Tom,Roy,James,Ben,Sam,Joe,Fred,Jack,Paul,Robert,John,William,Richard,Kenneth,Hiroshi,Kiyoshi,Minoru,Tadashi,Masao,Shigeru,Toshio,Isamu',
      'Glenn,Gary,Dennis,Craig,Dean,Brian,Kevin,Steven,Alan,Wayne,Russell,Calvin,Darryl,Randall,Ronald,Curtis,Michael,David,Mark,Jeffrey,Dale,Kenji',
      'Kevin,Brian,Ryan,Kyle,Derek,Bryan,Scott,Jason,Justin,Jonathan,Kenji,Kenta,Hiro,Kai,Ken,Eric,Andrew,Michael,Daniel,Steven',
      'Kai,Kenji,Ryan,Kaito,Ethan,Noah,Lucas,Evan,Dylan,Kevin,Aiden,Ryo,Kenta,Hiro,Logan,Jacob,Owen,Haruki,Isaac,Riku',
    ],
    F: [
      'Mary,Grace,Alice,Helen,Ruth,Florence,Betty,Lily,Rose,Martha,Margaret,June,Amy,Jean,Yoshiko,Kazuko,Michiko,Fumiko,Kiyoko,Emiko,Sachiko,Masako',
      'Karen,Joyce,Janice,Susan,Lisa,Gail,Lynn,Wendy,Laurie,Carol,Kathy,Joanne,Diane,Naomi,Amy,Kim,Sharon,Tracy,Emi,Keiko',
      'Lauren,Kristen,Lindsay,Stephanie,Lisa,Michelle,Jennifer,Emi,Mika,Naomi,Erin,Kelly,Amy,Megan,Ashley,Kristin,Allison,Julie,Tiffany,Kimi',
      'Emi,Mika,Hana,Sakura,Yumi,Emma,Chloe,Sophia,Mia,Kaylee,Hannah,Ella,Naomi,Lily,Maya,Aiko,Grace,Mei,Leah,Kiyomi',
    ],
  },
};

// India: names differ by region far more than by anything else, so the pool is three regional traditions
// (north: Hindi belt, Punjabi Hindu, Bengali; west: Gujarati, Marathi; south: Telugu, Tamil, Kannada,
// Malayali) that follow the surname when it is known. Children born since 2000 share pan-Indian favorites.
const IN_E4_M = 'Aarav,Vivaan,Arjun,Reyansh,Ishaan,Aditya,Sai,Krishna,Aryan,Rohan,Vihaan,Ayaan,Atharv,Advik,Shaurya,Dhruv,Kabir,Ansh,Rudra,Arnav,Pranav,Aniruddh,Siddharth,Vedant,Ishan,Rishi,Yash,Dev,Om,Nikhil,Neil,Aarush,Viraj,Akshay,Tanish,Karthik,Laksh,Samarth,Vansh,Agastya,Aadi';
const IN_E4_F = 'Saanvi,Aadhya,Ananya,Diya,Pari,Anika,Myra,Sara,Kiara,Aaradhya,Navya,Ira,Ishita,Riya,Shreya,Prisha,Avni,Kavya,Tara,Anvi,Siya,Meera,Aditi,Isha,Naina,Aanya,Tanvi,Nitya,Advika,Mahi,Khushi,Pihu,Riddhi,Ahana,Janvi,Shanaya,Trisha,Vanya,Mira,Saisha,Amaira';

GIVEN['indian-north'] = {
  M: [
    'Ram,Shyam,Krishan,Omprakash,Ramesh,Suresh,Rajendra,Vijay,Ashok,Anil,Prakash,Satish,Subhash,Mahesh,Narendra,Surendra,Harish,Dinesh,Rakesh,Mohan,Gopal,Jagdish,Kishore,Pradeep,Prem,Ravi,Rajkumar,Arun,Vinod,Sushil,Kailash,Naresh,Devendra,Shiv,Hari,Inder,Kamal,Raj',
    'Rajesh,Sanjay,Sunil,Anil,Ajay,Manoj,Vinod,Ashok,Rakesh,Sanjeev,Rajeev,Deepak,Pankaj,Alok,Amit,Ashish,Atul,Vikas,Sandeep,Vivek,Nitin,Neeraj,Sachin,Arvind,Vijay,Sameer,Pradeep,Anurag,Mukesh,Rajiv,Sudhir,Sumit,Gaurav,Manish,Ravi,Naveen,Praveen,Puneet,Tarun',
    'Rahul,Amit,Rohit,Ankit,Abhishek,Gaurav,Vikas,Nikhil,Varun,Saurabh,Akshay,Ankur,Sumit,Kunal,Mohit,Vishal,Ashish,Pranav,Siddharth,Arjun,Karan,Aman,Vivek,Tarun,Anuj,Mayank,Sahil,Shubham,Rishabh,Harsh,Aditya,Prateek,Rajat,Sachin,Nitin,Puneet,Neeraj,Vaibhav,Akash,Deepak',
    IN_E4_M,
  ],
  F: [
    'Sita,Kamla,Shanti,Savitri,Sushila,Sarla,Usha,Asha,Pushpa,Kanta,Krishna,Saroj,Shakuntala,Nirmala,Santosh,Vimla,Urmila,Kusum,Shobha,Leela,Manju,Kiran,Pratibha,Sudha,Uma,Radha,Gita,Sarojini,Vidya,Lata,Meera,Kanchan,Suman,Indira,Prem,Raj',
    'Sunita,Anita,Rekha,Neelam,Seema,Poonam,Anju,Manju,Sangeeta,Kavita,Ritu,Meena,Neeta,Archana,Alka,Mamta,Shalini,Renu,Sarita,Nisha,Deepa,Rashmi,Vandana,Sonia,Monika,Madhu,Preeti,Shilpa,Suman,Asha,Usha,Kiran,Rajni,Ranjana,Babita,Jyoti,Sapna,Sudha',
    'Priya,Pooja,Neha,Shweta,Swati,Anjali,Nidhi,Divya,Ankita,Shruti,Megha,Sneha,Ritika,Richa,Shikha,Aarti,Nikita,Sonam,Payal,Pallavi,Garima,Komal,Ruchi,Tanvi,Isha,Simran,Ritu,Preeti,Nisha,Kirti,Deepika,Monika,Sakshi,Akanksha,Bhavna,Jyoti,Priyanka,Rashmi,Sonali',
    IN_E4_F,
  ],
};

GIVEN['indian-west'] = {
  M: [
    'Ramesh,Mahendra,Jayant,Dilip,Bharat,Kishor,Navin,Pravin,Hasmukh,Arvind,Dinesh,Kantilal,Chandrakant,Vasant,Suresh,Prakash,Anant,Shashikant,Vinayak,Madhukar,Jitendra,Pramod,Bhupendra,Natwar,Kanu,Ishwar,Rasik,Mukund,Narayan,Harshad',
    'Jignesh,Hitesh,Paresh,Nilesh,Mukesh,Jayesh,Kalpesh,Rakesh,Bhavesh,Ketan,Mehul,Nirav,Sanjay,Dharmesh,Tushar,Sameer,Amol,Sachin,Rajesh,Manish,Chirag,Nitin,Yogesh,Vipul,Hemant,Mitesh,Pankaj,Shailesh,Viral,Kaushik',
    'Nirav,Chirag,Parth,Harsh,Dhruv,Kunal,Ronak,Hardik,Jay,Pratik,Sagar,Rushabh,Keyur,Vishal,Ankit,Mihir,Rohan,Aniket,Tejas,Omkar,Siddhesh,Akshay,Prasad,Nikhil,Shreyas,Saurabh,Darshan,Amey,Yash,Neel',
    IN_E4_M,
  ],
  F: [
    'Jayshree,Hansa,Kokila,Manjula,Sarla,Pushpa,Bharti,Nirmala,Kusum,Vimla,Shobha,Kanchan,Sushila,Leela,Mangala,Sunanda,Vasanti,Sulochana,Kamal,Lata,Asha,Usha,Pramila,Saroj,Indu,Jyotsna,Madhuri,Vidya,Shalini,Hemlata',
    'Hetal,Falguni,Bhavna,Nisha,Rupal,Darshana,Jigna,Sejal,Komal,Varsha,Swati,Rupa,Meena,Sonal,Mamta,Shital,Kalpana,Hema,Ami,Trupti,Manisha,Deepali,Vaishali,Ashwini,Smita,Madhavi,Archana,Nilam,Rashmi,Prachi',
    'Krupa,Dhara,Khushbu,Riddhi,Siddhi,Pooja,Nidhi,Payal,Ami,Shreya,Kinjal,Hiral,Foram,Drashti,Prachi,Aditi,Sneha,Shruti,Ketaki,Mrunal,Rucha,Gauri,Sayali,Tanvi,Radhika,Sakshi,Kavya,Disha,Isha,Janvi',
    IN_E4_F,
  ],
};

GIVEN['indian-south'] = {
  M: [
    'Srinivasan,Krishnamurthy,Subramaniam,Narayanan,Ramaswamy,Venkataraman,Raghavan,Rangarajan,Sundaram,Balakrishnan,Ramachandran,Rajagopal,Seshadri,Govindarajan,Chandrasekhar,Satyanarayana,Venkateswarlu,Nageswara,Ramakrishna,Prabhakar,Gopalakrishnan,Muthu,Nagaraj,Ravindran,Thomas,Joseph,Mathew,Varghese,Kurian,Madhavan,Unnikrishnan,Raman,Gopal,Subba,Hanumantha',
    'Venkatesh,Srinivas,Ramesh,Suresh,Ganesh,Rajesh,Mahesh,Sridhar,Prakash,Murali,Ravi,Srikanth,Kumar,Sathish,Senthil,Prasad,Krishna,Shankar,Balaji,Anand,Raghu,Vijay,Sunil,Babu,Madhu,Raju,Mohan,Sudheer,Jayakumar,Gopi,Narayana,Siva,Kannan,Vinod,Jose,Biju,Shaji,Sajan,Rajan',
    'Karthik,Arun,Vignesh,Pradeep,Praveen,Naveen,Sandeep,Harish,Ashwin,Rajesh,Kiran,Sai,Vamsi,Chaitanya,Anil,Raviteja,Phani,Sriram,Balaji,Vivek,Deepak,Arjun,Aravind,Prashanth,Santhosh,Manoj,Dinesh,Gautham,Aditya,Varun,Abhinav,Rohit,Akhil,Nithin,Venkat,Mahesh,Sunil,Jithin,Anoop,Srikanth',
    IN_E4_M,
  ],
  F: [
    'Lakshmi,Saraswathi,Kamala,Meenakshi,Parvathi,Jayalakshmi,Vijayalakshmi,Padmavathi,Rukmini,Kalyani,Annapurna,Sita,Savithri,Janaki,Sarojini,Seetha,Vasantha,Sulochana,Pushpa,Leela,Rajeswari,Bhagyalakshmi,Susheela,Indira,Mary,Annamma,Mariamma,Thankamma,Saramma,Shantha,Visalakshi,Kanaka,Radha,Rama,Prema,Usha',
    'Lakshmi,Padma,Uma,Geetha,Latha,Sudha,Shanthi,Vasanthi,Revathi,Sujatha,Anuradha,Kavitha,Srividya,Sangeetha,Vidya,Rekha,Malathi,Jayanthi,Radhika,Hema,Chitra,Bhavani,Vani,Rani,Usha,Asha,Suma,Sunitha,Sheela,Bindu,Shobha,Jaya,Sumathi,Nalini,Shyamala,Ambika,Mini,Sindhu,Mercy,Elizabeth',
    'Divya,Priya,Swathi,Deepika,Sowmya,Keerthi,Ramya,Harini,Anusha,Bhavya,Sravani,Pavani,Lavanya,Shruthi,Nandini,Aishwarya,Sindhuja,Vaishnavi,Pooja,Meghana,Sneha,Mounika,Kavya,Gayathri,Sahithi,Haritha,Spandana,Archana,Madhuri,Neha,Anjali,Vidya,Revathi,Niveditha,Akhila,Asha,Reshma,Anitha,Sushma,Jyothi',
    IN_E4_F,
  ],
};

GIVEN.indian = {
  mix: [
    ['indian-north', [0.4, 0.38, 0.36, 0.34]],
    ['indian-west', [0.3, 0.27, 0.22, 0.2]],
    ['indian-south', [0.3, 0.35, 0.42, 0.46]],
  ],
  us: {
    M: [
      'Raj,Ravi,Anand,Vijay,Ajay,Sunil,Amar,Sanjay,Ashok,Arun,Kiran,Dev,Prem,Vikram,David,Thomas',
      'Raj,Ravi,Anand,Vijay,Ajay,Sunil,Amar,Sanjay,Vikram,Neil,Nikhil,Rahul,Sameer,Kiran,Dev,Arun,Ashwin,Jay',
      'Rohan,Arjun,Neil,Nikhil,Raj,Sanjay,Vikram,Ravi,Anand,Dev,Kiran,Ajay,Amar,Sameer,Rahul,Kabir,Aditya,Jay,Varun,Akash,Ashwin,Siddharth,Rishi,Arun,Sunil',
      'Arjun,Rohan,Ishaan,Aarav,Dev,Neil,Krish,Rishi,Kabir,Aditya,Veer,Nikhil,Ayaan,Vihaan,Ethan,Ryan,Aiden,Dhruv,Shiv,Jay,Kiran,Anay',
    ],
    F: [
      'Asha,Usha,Leela,Meera,Radha,Uma,Sita,Lata,Gita,Kamala,Mary,Indira',
      'Asha,Sonia,Nisha,Anjali,Priya,Rina,Meera,Neela,Sapna,Leela,Maya,Tara,Anita,Kiran,Uma,Sheila',
      'Priya,Anjali,Neha,Maya,Asha,Nisha,Sonia,Tara,Leela,Anika,Riya,Divya,Meera,Kavya,Isha,Shreya,Sana,Anya,Mira,Sapna,Rina,Simran,Pooja,Monica',
      'Anika,Diya,Maya,Riya,Isha,Tara,Kavya,Anya,Mira,Ananya,Saanvi,Sara,Kiara,Aria,Leela,Naina,Ira,Sophia,Avani,Asha,Nila,Zara',
    ],
  },
};

// Sikh Punjabi: largely unisex given names (-preet, -jit, -deep, -inder, -jot), with Singh for men and Kaur
// for women carried as part of the name (see givenName and middleName); the Central Valley and Bay Area
// families who came from the 1980s on, and their children born here.
GIVEN.sikh = {
  M: [
    'Gurbachan,Harbhajan,Mohinder,Surinder,Joginder,Kartar,Gurdev,Ajit,Amrik,Darshan,Gurcharan,Harnam,Jaswant,Karnail,Kashmir,Malkiat,Mehar,Piara,Pritam,Sohan,Baldev,Balwant,Gurmukh,Harbans,Jagir,Jarnail,Nachhatar,Niranjan,Santokh,Sarwan,Tarlochan,Ujagar,Bakhshish,Dalip,Dilbagh,Gurbax,Avtar,Major,Swaran,Inder',
    'Gurpreet,Harjinder,Sukhwinder,Kulwinder,Jaswinder,Paramjit,Rajinder,Balwinder,Harjit,Kuldeep,Sukhdev,Baljit,Daljit,Gurdeep,Jasbir,Ranjit,Sarbjit,Harpal,Jagjit,Satnam,Hardeep,Manjit,Lakhwinder,Gurjit,Hardev,Karamjit,Charanjit,Tarsem,Jaspal,Rupinder,Inderjit,Bhupinder,Iqbal,Harminder,Parminder,Mandeep,Jatinder,Kulbir,Ravinder,Pardeep',
    'Gurpreet,Harpreet,Amandeep,Manpreet,Jaspreet,Navdeep,Sandeep,Gurwinder,Jagdeep,Sukhjinder,Mandeep,Ramandeep,Lovepreet,Gagandeep,Arshdeep,Jasdeep,Jatinder,Gurjeet,Harjot,Simranjit,Prabhjot,Navjot,Jasvinder,Karanbir,Gurkirat,Taranjit,Manjinder,Kanwaljit,Rajvir,Inderpreet,Sukhpreet,Ravinder,Gurtej,Hardeep,Baljinder,Harvinder,Amritpal,Satinder,Parmvir,Jaskaran',
    'Arjun,Gurnoor,Ekam,Fateh,Sehaj,Jaskaran,Arshdeep,Prabhjot,Harnoor,Navjot,Gurkirat,Jasraj,Agamjot,Karanveer,Harman,Gurshan,Jasmeet,Taranveer,Sukhman,Gurveer,Ajeet,Rajveer,Inderveer,Akaal,Angad,Jujhar,Zorawar,Ranveer,Gurbaaz,Manvir,Harjas,Ekamjot,Tegbir,Abhijot,Arman,Nihal,Sartaj,Japji,Amarjot,Ishar',
  ],
  F: [
    'Gurdial,Harbans,Surjit,Pritam,Mohinder,Amarjit,Balbir,Gurmeet,Jasbir,Kuldip,Manjit,Paramjit,Rajinder,Satwant,Swaran,Tejinder,Gurbachan,Karamjit,Kulwant,Surinder,Darshan,Harjit,Inderjit,Jaswant,Kamaljit,Narinder,Parkash,Santosh,Sukhwant,Tarsem,Bhupinder,Charanjit,Davinder,Gian,Harjinder,Joginder,Mukhtiar,Nasib,Resham,Shinder',
    'Sukhwinder,Kulwinder,Jaswinder,Paramjit,Rajwinder,Baljinder,Harjinder,Kamaljit,Manjit,Amarjit,Gurmeet,Jasvir,Ranjit,Sarbjit,Rupinder,Navneet,Parminder,Charanjit,Satwinder,Baljit,Daljit,Kulwant,Gurinder,Harvinder,Kirpal,Jaspal,Inderjit,Bhupinder,Narinder,Tejinder,Rajinder,Sukhjit,Kuldeep,Davinder,Raminder,Gurdeep,Balwinder,Manjeet,Harpal,Surinder',
    'Harpreet,Manpreet,Gurpreet,Jaspreet,Amandeep,Navneet,Ramandeep,Simranjit,Kirandeep,Sukhpreet,Navjot,Gagandeep,Jasleen,Harleen,Simran,Kiranjit,Mandeep,Rupinder,Sandeep,Jasmeet,Manjot,Inderpreet,Harmeet,Gurleen,Prabhjot,Taranjit,Sukhdeep,Jasvir,Kamalpreet,Navpreet,Arshpreet,Harjot,Rajpreet,Gurjit,Ravneet,Sharanjit,Jasdeep,Amanpreet,Kulvir,Parveen',
    'Gurnoor,Jasleen,Harleen,Simran,Mehak,Navleen,Sehaj,Harnoor,Prabhleen,Jasnoor,Gurleen,Arshpreet,Jasmine,Amrit,Kirat,Manleen,Japneet,Avneet,Simrat,Jaspreet,Harsimran,Navjot,Gurkiran,Mannat,Noor,Anahat,Ishpreet,Sukhmani,Prabhnoor,Jannat,Asees,Rubani,Kiranjot,Sargun,Rasleen,Amarleen,Ekamjot,Seerat,Gurbani,Jasreet',
  ],
  us: {
    M: [
      'Harry,Bob,Jagjit,Sukhdev,Gurdev,Ajit,Darshan,Didar,Major,Bachan,Sohan,Ranjit,Joginder,Baldev,Iqbal,Kartar',
      'Gurpreet,Harjit,Ranjit,Sukhdev,Jasbir,Kuldeep,Daljit,Paramjit,Harpal,Rajinder,Sunny,Bobby,Harry,Ricky,Manjit,Satnam',
      'Gurpreet,Harpreet,Amandeep,Manpreet,Jaspreet,Navdeep,Sandeep,Jagdeep,Ramandeep,Arjun,Jasdeep,Simranjit,Sunny,Harry,Gurjeet,Karan,Raj,Jason,Kevin,Navjot',
      'Arjun,Jaskaran,Gurnoor,Sehaj,Fateh,Ekam,Harman,Arman,Rajveer,Karanveer,Jasraj,Angad,Ranveer,Gurveer,Nihal,Zorawar,Jayden,Ryan,Aiden,Sartaj',
    ],
    F: [
      'Surjit,Amarjit,Jasbir,Gurmeet,Manjit,Harbans,Kamaljit,Paramjit,Rajinder,Swaran,Inderjit,Pritam',
      'Sukhwinder,Kulwinder,Jaswinder,Paramjit,Rajwinder,Kamaljit,Manjit,Navneet,Rupinder,Ranjit,Pinky,Rani,Neena,Simi',
      'Harpreet,Manpreet,Gurpreet,Jaspreet,Amandeep,Navneet,Simran,Jasleen,Harleen,Kirandeep,Ramandeep,Navjot,Mandeep,Jasmine,Sonia,Kiran,Simi,Rupinder,Gurleen,Jasmeet',
      'Simran,Jasleen,Harleen,Gurnoor,Mehak,Jasmine,Navleen,Harnoor,Prabhleen,Amrit,Kirat,Mannat,Noor,Sehaj,Avneet,Simrat,Jannat,Seerat,Anahat,Asees,Sophia,Ava',
    ],
  },
};

// Pakistan.
GIVEN.pakistani = {
  M: [
    'Muhammad,Abdul,Ghulam,Mohammad,Ahmed,Ali,Aslam,Akram,Bashir,Rashid,Saleem,Naeem,Arshad,Shafiq,Mushtaq,Zafar,Anwar,Iqbal,Javed,Pervez,Tariq,Khalid,Mahmood,Nazir,Rafiq,Shaukat,Sultan,Yusuf,Riaz,Ijaz,Nasir,Habib,Latif,Hameed,Majeed,Amjad,Imtiaz,Liaqat,Sajjad,Zahid',
    'Muhammad,Imran,Asif,Tariq,Khalid,Faisal,Shahid,Naveed,Kamran,Adnan,Nadeem,Waqar,Rizwan,Javed,Sohail,Zubair,Farhan,Asad,Kashif,Amir,Yasir,Atif,Junaid,Fahad,Usman,Omer,Sajid,Babar,Ahmed,Ali,Hassan,Shoaib,Mansoor,Irfan,Salman,Naeem,Arif,Waseem,Zeeshan,Tahir',
    'Muhammad,Usman,Bilal,Hamza,Zain,Saad,Hassan,Ali,Ahmed,Umair,Talha,Hamid,Danish,Fahad,Junaid,Haris,Shahzaib,Omer,Faizan,Awais,Waleed,Zeeshan,Arslan,Ammar,Hasnain,Shoaib,Moiz,Asad,Kashif,Taimur,Rehan,Salman,Adeel,Sami,Haseeb,Farhan,Yasir,Owais,Uzair,Daniyal',
    'Muhammad,Ayaan,Rayyan,Abdullah,Ibrahim,Hamza,Zaid,Ali,Ahmed,Hassan,Hussain,Musa,Yusuf,Zain,Omar,Mustafa,Ayan,Arham,Rohaan,Haider,Zohaib,Saad,Zayan,Ahad,Sufyan,Usman,Taha,Shayan,Ismail,Adam,Haris,Dawood,Armaan,Fahad,Sameer,Zaviyar,Azaan,Ammar,Daniyal,Eesa',
  ],
  F: [
    'Fatima,Zainab,Khadija,Bushra,Nasreen,Rukhsana,Parveen,Shamim,Naheed,Yasmeen,Kausar,Razia,Shahida,Zubaida,Tahira,Akhtar,Begum,Shabana,Gulnaz,Kishwar,Nusrat,Sultana,Farhat,Rehana,Zahida,Saeeda,Naseem,Mumtaz,Rashida,Anwari,Hamida,Jamila,Safia,Sakina,Bilqees,Iffat,Musarrat,Tasneem,Zarina,Khalida',
    'Ayesha,Saima,Nadia,Shazia,Rubina,Farzana,Samina,Rabia,Uzma,Asma,Bushra,Sadia,Huma,Shaista,Sobia,Tahira,Kiran,Nazia,Naila,Fozia,Lubna,Sana,Amina,Hina,Mehwish,Sumaira,Aliya,Robina,Faiza,Saba,Fariha,Shagufta,Ghazala,Shabnam,Nighat,Salma,Sabeen,Erum,Madiha,Rizwana',
    'Sana,Hina,Ayesha,Amna,Sadia,Maryam,Mehwish,Iqra,Rabia,Saba,Javeria,Aiman,Kiran,Mahnoor,Zara,Anam,Hira,Arooj,Areeba,Faiza,Sidra,Sundas,Nimra,Maham,Aqsa,Zunaira,Momina,Laiba,Hafsa,Mariam,Fatima,Noor,Sabahat,Tooba,Bisma,Kinza,Rida,Alizeh,Sehrish,Urooj',
    'Fatima,Ayesha,Maryam,Zainab,Hania,Anaya,Inaya,Alishba,Eman,Hafsa,Khadija,Noor,Zara,Mahnoor,Hoorain,Aleena,Manahil,Abeeha,Dua,Aiza,Anabia,Haniya,Areeba,Zoya,Mishal,Rimsha,Sara,Amna,Aliza,Mehreen,Laiba,Minahil,Inaaya,Ruqayya,Sumaya,Hareem,Aimal,Zunaira,Hira,Yusra',
  ],
};

// Bangladesh (shares the common Muslim South Asian names, with Bengali ones of its own).
GIVEN.bangladeshi = {
  M: [
    'Mohammad,Abdul,Mohammed,Rafiq,Kamal,Jamal,Anis,Shafiqul,Aminul,Mizanur,Habibur,Mahbub,Rezaul,Abul,Nurul,Siddiqur,Mostafa,Golam,Azizul,Shahidul,Jahangir,Alamgir,Fazlul,Mujibur,Ziaur,Rashidul,Aftab,Delwar,Harun,Monir',
    'Mohammad,Saiful,Tanvir,Imtiaz,Shakil,Kamrul,Mahmud,Rezaul,Masud,Mizanur,Rafiqul,Aminul,Habib,Faruk,Anwar,Nazrul,Shahin,Mamun,Rubel,Sohel,Sumon,Babul,Liton,Shamim,Jahid,Rashed,Belal,Mostafizur,Shafiqul,Arif',
    'Mohammad,Rakib,Sabbir,Fahim,Tanvir,Shakil,Rasel,Sakib,Nayeem,Arif,Mehedi,Imran,Rifat,Shuvo,Tamim,Ashik,Rubel,Sohag,Mahfuz,Sajid,Shihab,Tarek,Nahid,Jubayer,Raihan,Mahin,Sifat,Tushar,Redwan,Ashraful',
    'Mohammad,Ayan,Rafsan,Nafis,Tahmid,Ayaan,Rayyan,Arham,Zayan,Arian,Yusuf,Ibrahim,Abdullah,Saad,Zarif,Tahsin,Fardin,Nahian,Samin,Sadman,Ahnaf,Fahad,Wasif,Mahir,Tanzim,Rizwan,Labib,Shadman,Raiyan,Musa',
  ],
  F: [
    'Rokeya,Shamima,Nasrin,Shirin,Fatema,Hasina,Khaleda,Rahima,Jahanara,Ayesha,Rasheda,Monowara,Anowara,Selina,Halima,Kulsum,Sufia,Amena,Rabeya,Mumtaz,Begum,Nurjahan,Hosneara,Firoza,Shahana,Nazma,Salma,Parveen,Rehana,Delwara',
    'Nasrin,Shirin,Shamima,Fahmida,Sultana,Nazma,Ruma,Salma,Farhana,Shahnaz,Rumana,Tahmina,Lucky,Nasima,Shilpi,Rupa,Mukta,Beauty,Rina,Shapla,Nazneen,Rozina,Kohinoor,Dilruba,Morium,Sharmin,Shahida,Parvin,Jesmin,Taslima',
    'Tasnim,Farhana,Sabrina,Nusrat,Tahmina,Sharmin,Jannatul,Sumaiya,Raisa,Tanjila,Mithila,Lamia,Sadia,Fariha,Anika,Nabila,Tania,Mim,Afroza,Ishrat,Shanta,Moushumi,Tamanna,Nadia,Sanjida,Rumana,Faria,Tanzila,Fatema,Sumi',
    'Ayesha,Fatima,Maryam,Zara,Anaya,Inaya,Sumaiya,Raisa,Nusaiba,Tasfia,Ariba,Samiha,Labiba,Nuha,Ruqaiya,Safa,Marwa,Aaliyah,Humaira,Zainab,Tahiya,Arisha,Mehjabin,Nafisa,Anisha,Tanha,Rifa,Afia,Lamisa,Sara',
  ],
};

// Afghanistan (Pashtun and Tajik families; Fremont and Hayward hold the largest community in the US).
GIVEN.afghan = {
  M: [
    'Mohammad,Abdul,Ahmad,Ghulam,Mahmood,Najib,Rahim,Wali,Habib,Aziz,Karim,Sayed,Nasir,Bashir,Latif,Rashid,Yousuf,Sharif,Shafiq,Hamid,Gul,Jan,Zalmai,Rahmatullah,Qadir,Hafiz,Noor,Amanullah,Safiullah,Akbar',
    'Mohammad,Ahmad,Abdul,Najib,Hamid,Wahid,Zalmai,Khalid,Farid,Habib,Jawad,Aziz,Qais,Shafiq,Wali,Nasir,Sayed,Omid,Mirwais,Ajmal,Bashir,Fawad,Haroon,Idris,Jamshid,Karim,Latif,Masood,Nawid,Sohrab',
    'Mohammad,Ahmad,Omid,Nawid,Fawad,Jawad,Hamid,Ajmal,Mirwais,Farhad,Wahid,Ehsan,Tamim,Yama,Zia,Obaid,Bilal,Haroon,Sohail,Shekib,Hamed,Mustafa,Qudrat,Rahmat,Sameer,Belal,Rameen,Masih,Javid,Elyas',
    'Mohammad,Ahmad,Mustafa,Yousuf,Ibrahim,Omar,Ali,Hamza,Rayan,Ayan,Zaid,Arman,Sami,Elias,Adam,Hasib,Haris,Yasin,Idris,Daniel,Arian,Bilal,Qais,Rahim,Ismail,Imran,Faisal,Murtaza,Sahil,Zakaria',
  ],
  F: [
    'Fatima,Maryam,Zahra,Bibi,Gul,Nazifa,Shakila,Zarghona,Mahbooba,Rahima,Sabira,Zohra,Homa,Parwin,Nooria,Aziza,Hamida,Nasima,Saliha,Malalai,Lailuma,Fahima,Soraya,Zainab,Hakima,Mastura,Gulalai,Bilqis,Amina,Sharifa',
    'Fatima,Maryam,Freshta,Mariam,Nargis,Parwana,Shabnam,Soraya,Laila,Mursal,Nazia,Roya,Sahar,Shakila,Shukria,Tamana,Wahida,Zarmina,Farzana,Homa,Khatera,Lima,Madina,Nadia,Nilofar,Palwasha,Rahima,Sitara,Yalda,Arezo',
    'Freshta,Mursal,Tamana,Mariam,Sahar,Yalda,Arezo,Mahnaz,Shabnam,Nilofar,Lima,Madina,Mina,Hasina,Zarmina,Mujgan,Sabrina,Roya,Wajiha,Sadaf,Nazanin,Marwa,Muska,Sana,Zuhal,Nazira,Shogofa,Tahmina,Fariba,Mahtab',
    'Maryam,Fatima,Sana,Zahra,Marwa,Muska,Yasmin,Aisha,Hadia,Zainab,Mahsa,Sahar,Arezo,Ayda,Elaha,Nazanin,Asal,Diana,Laila,Sabrina,Madina,Raihana,Mina,Parisa,Malika,Setara,Hanifa,Noor,Hawa,Rabia',
  ],
};

// Hmong (Fresno, Sacramento, Merced, Chico): short, often unisex names; women's names compounded with
// Mai, Pa, Ka and Gao, written joined as many Hmong Californians register them (Pahoua, Maikou, Kaying).
GIVEN.hmong = {
  M: [
    'Tou,Chue,Neng,Pao,Xai,Chong,Kou,Teng,Cher,Fue,Nhia,Seng,Va,Xeng,Yia,Chia,Lue,Shoua,Doua,Ger,Hue,Kao,Kong,Koua,Leng,Long,Meng,Nao,Nou,Pheng,Sai,Shong,Song,Tong,Toua,True,Wa,Xia,Yee,Yeng,Yer,Zong',
    'Tou,Kou,Pao,Neng,Chong,Fue,Teng,Xai,Chue,Nhia,Seng,Kao,Meng,Pheng,Xeng,Yeng,Lue,Long,Cher,Kong,Koua,Leng,Toua,Tong,Yia,Zong,Bee,Blong,Chao,Cheng,Chou,Dang,Fong,Ger,Hue,Sai,Song,True,Xia,Yee,Sue,Ying',
    'Kou,Tou,Pao,Neng,Chong,Fue,Kao,Meng,Pheng,Xeng,Teng,Yeng,Lue,Long,Jer,Ka,Leng,Nhia,Sai,Seng,Thai,Xai,Yia,Ying,Zong,Bee,Blong,Chao,Cheng,Chou,Dang,Fong,Kong,Tong,Toua,Doua,Ger,Lee,Chai',
    'Kou,Tou,Chue,Ge,Kong,Nhia,Fue,Tong,Xeng,Yeng,Kao,Neng,Chai,Lue,Dao,Pheng,Seng,Teng,Toua,Yia,Zong,Blong,Leng,Meng,Ying,Ka,Nou,Pao,Chong,Jer,Long,Sai,Xai,Doua,Cheng,Fong,Kia,Thai,Ger,Nao',
  ],
  F: [
    'Mai,Pa,Yer,Xee,Mee,Bee,Shoua,Chia,Ka,Sua,Youa,Nou,Kia,Pang,Ia,Blia,Choua,Der,Gao,Houa,Khou,Lee,May,Nhia,Sheng,Xia,Yia,Zoua,Ying,Lia,Dua,Hlee,Mao,Pai,Yee,Lou,Pla,Nao,Phoua,Bao',
    'Mai,Pa,Ka,Nou,Yer,Xia,Bao,Chia,Choua,Der,Gao,Houa,Kalia,Khou,Lee,May,Nhia,Pang,Sheng,Shoua,Xee,Youa,Zoua,Mee,Ia,Kia,Lia,Ying,Yia,Bee,Dua,Pahoua,Maiyer,Maikou,Panhia,Kaying,Mao,Hlee,Blia,Sua',
    'Mai,Pa,Kalia,Nalee,Malee,Kaying,Pahoua,Panhia,Pakou,Maikou,Maiyer,Maichao,Maineng,Maiyia,Maixee,Pachia,Kabao,Nou,Bao,Chia,Choua,Der,Gao,Houa,Ka,Kia,Lia,May,Nhia,Pang,Sheng,Shoua,Xia,Yer,Youa,Zoua,Mee,Gaonou,Maiyeng,Kazoua',
    'Kalia,Nalee,Malee,Kaying,Pakou,Maikou,Maiyia,Maichao,Kabao,Mai,Pa,Bao,Ka,Nou,Yer,Choua,Gaonou,Kazoua,Maiyeng,Pazong,Mainhia,Pahoua,Panhia,Maineng,Maiyer,Pachia,Kia,Lia,May,Shoua,Xia,Youa,Zoua,Gao,Houa,Sheng,Chia,Pang,Nhia,Der',
  ],
};

// Cambodia (Long Beach, Stockton): Khmer names as Cambodian Americans romanize them.
GIVEN.cambodian = {
  M: [
    'Sokha,Vannak,Sophal,Chantha,Dara,Visal,Rithy,Sovann,Phirun,Vuthy,Sambath,Sarath,Sokhom,Chhay,Kosal,Piseth,Vibol,Rathana,Sothea,Bunthan,Samnang,Sophat,Savuth,Sopheak,Chamroeun,Sarun,Saroeun,Thol,Yorn,Sophon,Chhorn,Heng,Soeun,Bunna,Narith,Vanna,Sambo,Kimsan,Pheap,Sinoeun',
    'Sokha,Dara,Vannak,Sophal,Visal,Rithy,Sovann,Piseth,Vibol,Rathana,Sothea,Samnang,Sopheak,Bunthoeun,Chanthy,Kosal,Sarath,Sokhom,Phalla,Narith,Vuthy,Kimheng,Seyha,Rotha,Sokhon,Chhay,Sambath,Ratanak,Sophoan,Vanthy',
    'Dara,Visal,Ratanak,Piseth,Vibol,Sokha,Kosal,Seyha,Rotha,Vannak,Bunthoeun,Sovannarith,Sokhon,Vicheka,Panha,Vireak,Rithy,Kimhong,Chantha,Samnang,Sophal,Theara,Monyrath,Sopheaktra,Veasna,Sakal,Pheakdey,Vathana,Sopheap,Chandara',
    'Panha,Vireak,Rithy,Visal,Dara,Pisith,Vicheka,Sokha,Ratanak,Seyha,Davith,Kimsour,Sovann,Bunrith,Rotha,Lyhour,Menghour,Sakal,Vathana,Kakada,Sereyvuth,Vanthorn,Sokunthy,Puthea,Raksa,Chanthou,Sopheaktra,Monyrath,Theara,Pheakdey',
  ],
  F: [
    'Sophea,Sreymom,Channary,Bopha,Thida,Malis,Sophy,Kunthea,Sokunthea,Chanthou,Srey,Sokha,Vanna,Sophal,Chantha,Phally,Sopheap,Kolab,Sarun,Neang,Ry,Thavy,Chenda,Somaly,Savy,Sitha,Navy,Pov,Sinat,Kim,Ratha,Davy,Rany,Leakhena,Mealea,Sophorn,Chanthy,Sokhalay,Yeng,Phan',
    'Sophea,Sreymom,Channary,Bopha,Thida,Malis,Sophy,Kunthea,Sokunthea,Sopheap,Chenda,Somaly,Savy,Leakhena,Mealea,Sophorn,Chanthy,Phalla,Sreyleak,Sreypov,Navy,Chantrea,Rachana,Socheata,Sreyneang,Dany,Sokhalay,Kanha,Sothy,Bophal',
    'Sreyneang,Sreyleak,Sreypov,Socheata,Sokunthea,Chantrea,Rachana,Leakhena,Sopheak,Bopha,Kanha,Pisey,Sreymao,Sokha,Malina,Sreynich,Chanlina,Sreyroth,Monika,Dalin,Lida,Sovanna,Rathana,Kalyan,Daravy,Sreyoun,Bunnary,Chandara,Sophany,Raksmey',
    'Sreynich,Sreyroth,Rachana,Chanlina,Pisey,Kanha,Sokunthea,Bopha,Malina,Dalin,Lida,Raksmey,Sovanna,Chanbormey,Monyneath,Sreypich,Sotheary,Nika,Molika,Sreylin,Chanmony,Kimleng,Ratana,Theary,Somaly,Lyna,Kanika,Sreymao,Daravy,Bunnary',
  ],
};

// Laos (Lao families in Sacramento, Stockton, Fresno, San Diego).
GIVEN.lao = {
  M: [
    'Somphone,Souksavanh,Khamphet,Bounmy,Phonsavanh,Vilay,Somsack,Khamla,Phouthone,Bounthavy,Sisouk,Thongsavanh,Khamphanh,Somboun,Bounchanh,Kongkeo,Phetsamone,Vongphet,Bounleuth,Khamsing,Somchith,Thongchanh,Soulivong,Chanthavong,Saysana,Phoxay,Keo,Somsanith,Bounkham,Khamsouk,Inthavong,Sengphet,Bouasone,Kham,Oudom,Vanhxay,Sounthone',
    'Somphone,Souksavanh,Phonsavanh,Vilay,Somsack,Bounmy,Khamphet,Sisouk,Saysana,Phoutthavong,Soulivong,Vongsavanh,Khampheng,Bounthanh,Somkhit,Thongphet,Sengsavanh,Anousone,Phetsamay,Viengsavanh,Khonesavanh,Sounthone,Vanhxay,Kongkeo,Chanthaphone,Bouasone,Somphet,Khamsay,Oudom,Phonepasith',
    'Anousone,Khonesavanh,Phonepasith,Somphone,Souksavanh,Vilay,Phonsavanh,Saysana,Khamphet,Sengsavanh,Viengxay,Thongsavanh,Anoulak,Phoutsady,Sitthideth,Bounthavy,Somsack,Vanhxay,Sounthone,Phetsamone,Sinxay,Phonexay,Bounkong,Souphanh,Somchay,Chanthaphone,Vongsavanh,Khamsay,Kittiphone,Daovong',
    'Anoulak,Sitthideth,Phoutsady,Khonesavanh,Phonepasith,Somphone,Souksavanh,Sengsavanh,Viengxay,Phonexay,Kittiphong,Vanhxay,Sinxay,Anousith,Somsack,Phetsamone,Vilaysack,Thongsavanh,Bounkong,Khamphet,Saysana,Phonsavanh,Vongsavanh,Chanthaphone,Sounthone,Souphanh,Bounthavy,Thanousone,Phetdavanh,Kittiphone,Phouvong,Thipphakone,Khamsavath,Vannasone,Alounsavath',
  ],
  F: [
    'Bounmy,Chanthala,Manivanh,Ketsana,Sengdao,Vongdeuane,Khamla,Bouavanh,Chansamone,Khamphouy,Phouangmala,Souvanny,Thongdy,Vanna,Viengkham,Bouachanh,Manichanh,Phayvanh,Somchanh,Kesone,Ounkham,Noy,Sengchanh,Viengsamay,Chanthavy,Douangchanh,Khamphone,Soudalay,Bouaphanh,Malaythong',
    'Chanthala,Manivanh,Ketsana,Sengdao,Vongdeuane,Bouavanh,Chansamone,Phouangmala,Souvanny,Viengkham,Manichanh,Phayvanh,Somchanh,Kesone,Chanthavy,Douangchanh,Viengsamay,Sengchanh,Khamphouy,Soukanya,Malayvanh,Latsamy,Daovy,Somsanouk,Sisomphone,Vilayvanh,Sonesavanh,Phoungeun,Kongkham,Soudalay',
    'Latsamy,Soukanya,Malayvanh,Daovy,Vilayvanh,Sonesavanh,Chanthala,Manivanh,Ketsana,Viengsamay,Phonevilay,Souksakhone,Alounny,Dalavanh,Phetmany,Sengaloun,Amphone,Khanthaly,Somsamay,Daoheuang,Vanida,Davone,Toukta,Manola,Saysamone,Thipphavanh,Bouakham,Nalinh,Sengmany,Chindavanh',
    'Alounny,Phonevilay,Souksakhone,Dalavanh,Phetmany,Sengaloun,Khanthaly,Vanida,Davone,Toukta,Manola,Thipphavanh,Malayvanh,Soukanya,Latsamy,Daovy,Vilayvanh,Sonesavanh,Noudeng,Phoudsavanh,Somsamay,Anousa,Chindavanh,Nalinh,Sengmany,Phonesouda,Kesone,Chanthaly,Bounlay,Amphone,Keomany,Sounantha,Viengkeo,Bouasavanh,Chansouda',
  ],
};

// Thailand (Thai Town in Hollywood, the Valley, Orange County).
GIVEN.thai = {
  M: [
    'Somchai,Somsak,Prasert,Wichai,Anan,Somporn,Surachai,Prayoon,Sombat,Boonmee,Chalerm,Sompong,Prasit,Kasem,Sakda,Sunthorn,Thawee,Chaiwat,Udom,Wirat,Banyat,Boonsong,Charoen,Manop,Narong,Prachuap,Samai,Somboon,Suchart,Thongchai,Vichit,Yuthana,Pichai,Sawat,Adul,Kamol,Pairoj,Prapan,Somkiat,Thanom',
    'Somchai,Somsak,Chaiyaporn,Surachai,Supachai,Pongsak,Sompong,Arthit,Apichat,Chatchai,Pichit,Wirat,Kittisak,Sakchai,Wanchai,Nopporn,Prasert,Piyawat,Sutep,Somkid,Chaiwat,Narongrit,Teerapong,Paisan,Weerawat,Sarawut,Yutthana,Thawatchai,Anuchit,Somkiat',
    'Nattapong,Thanawat,Kittisak,Thanakorn,Chaiyaporn,Apichat,Teerapat,Wuttichai,Sarawut,Nattawut,Pongsakorn,Jakkrit,Peerapong,Thitipong,Anuwat,Kritsada,Surasak,Wiwat,Ekkachai,Sittichai,Natthaphon,Panupong,Supakorn,Weerachai,Chatchawan,Sirichai,Tanapat,Rattapong,Sakda,Arthit',
    'Thanakrit,Thanapat,Nattawat,Pakorn,Kittipat,Chayanon,Teerapat,Phumipat,Kittiphong,Thanawin,Nattakit,Pakin,Sirawit,Tanakorn,Chanon,Napat,Phurin,Thitiwat,Wachirawit,Kanin,Siwakorn,Tawan,Jirayu,Peeranat,Krittin,Rachata,Thanapon,Sorawit,Akkarawat,Nattapong',
  ],
  F: [
    'Somsri,Malee,Siriporn,Nittaya,Wanida,Kanya,Pornthip,Ratana,Suda,Supaporn,Achara,Busaba,Duangjai,Jintana,Nongnuch,Orawan,Prapai,Rungnapa,Suwanna,Waraporn,Yupa,Pranee,Kulap,Sumalee,Somjai,Boonruen,Chanpen,Lamai,Mali,Nuanchan,Sunee,Thongbai,Wanna,Saowanee,Ubon,Prayong,Sompit,Chamnong,Bualai,Kesorn',
    'Siriporn,Supaporn,Kanokwan,Nittaya,Wanida,Pornthip,Ratana,Jintana,Rungnapa,Orawan,Waraporn,Duangjai,Achara,Busaba,Nongnuch,Sirinya,Suwanna,Kanya,Somsri,Malee,Pimpa,Jiraporn,Sasithorn,Patcharee,Wilaiwan,Kanchana,Saowalak,Benjawan,Nantana,Chutima',
    'Kanokwan,Pimchanok,Jiraporn,Sasithorn,Patcharee,Wilaiwan,Saowalak,Benjawan,Nantana,Chutima,Natthaya,Supattra,Pornpimol,Sirirat,Kornkanok,Thitima,Wannisa,Arisa,Chonticha,Pattaraporn,Nuttida,Ploypailin,Jutamas,Kamonchanok,Sunisa,Ratchanee,Duangporn,Siriluck,Apinya,Thanyarat',
    'Pimchanok,Natthaya,Chonticha,Pattaraporn,Nuttida,Ploypailin,Kamonchanok,Thanyarat,Phitchaya,Pimnipa,Napasorn,Kanyarat,Chanakan,Supitcha,Panida,Nichapat,Pornchanok,Sirada,Thitirat,Warisara,Jidapa,Kanyanat,Natcha,Sutasinee,Wipada,Peerada,Pichaya,Chalisa,Panisara,Lalita',
  ],
};

// Burma (Myanmar): Burmese names have no family name; the US record's first name is usually the first
// part of the personal name, the last name the final part (see SURNAMES.burmese).
GIVEN.burmese = {
  M: [
    'Aung,Kyaw,Tun,Than,Hla,Thein,Win,Myint,Soe,Maung,Ba,Sein,Khin,Mya,Ohn,San,Tin,Nyunt,Saw,Thaung,Chit,Htay,Kyi,Sann,Pe,Shwe,Zaw,Myo,Lwin',
    'Aung,Kyaw,Zaw,Min,Myo,Win,Tun,Thein,Soe,Naing,Hlaing,Than,Htun,Myint,Ko,Thet,Nyein,Lwin,Ye,Thura,Moe,Wai,Htay,Tint,Thant,Sithu,Kyi,Zin,Hein,Phyo',
    'Htet,Kaung,Min,Pyae,Khant,Hein,Zaw,Aung,Kyaw,Phyo,Thant,Sithu,Arkar,Zeyar,Thura,Paing,Nay,Yan,Linn,Thiha,Wai,Myat,Soe,Ye,Ko,Naing,Htoo,Thet,Wint,Zin',
    'Htet,Kaung,Pyae,Khant,Hein,Min,Thant,Arkar,Zeyar,Paing,Nay,Yan,Linn,Thiha,Myat,Sithu,Phone,Aung,Kyaw,Zaw,Thura,Ye,Wai,Htoo,Bhone,Thuta,Shin,Lin,Kyal,Zwe,Swan,Htin,Lynn,Naung,Yarzar',
  ],
  F: [
    'Khin,Aye,Mya,Than,Tin,Hla,San,Ohn,Nu,Nwe,Kyi,Thein,May,Mar,Sein,Yi,Cho,Mi,Win,Myint,Shwe,Hnin,Thida,Pyone,Htay,Sandar,Thet,Su',
    'Khin,Aye,Thida,May,Su,Hnin,Nwe,Mya,Ei,Phyu,Thandar,Sandar,Moe,Thiri,Wai,Nilar,Cho,Hla,Thuzar,Ohnmar,Khaing,San,Sanda,Yamin,Thinzar,Nandar,Ingyin,Hsu,Mon,Lay',
    'Thandar,Ei,Phyu,Myat,Su,Hnin,Yadanar,Zin,Thiri,Wai,Thinzar,Yamin,Nandar,Hsu,Wint,Phoo,Htet,Thet,Nyein,Chit,Eaindra,Pwint,Shwe,Moe,May,Aye,Sandar,Khin,Yu,Mon',
    'Yadanar,Thiri,Myat,Hsu,Wint,Phoo,Htet,Eaindra,Pwint,Shwe,Thet,Nyein,Chit,Zin,Ei,Phyu,Su,Hnin,Moe,May,Thinzar,Yamin,Nandar,Khin,Mon,Yoon,Sandi,Thazin,Myo,Lin,Wutyi,Nway,Khine,Hayman,Sabai',
  ],
};

// Indonesia (much of the California community is Chinese-Indonesian, with Christian and Indonesian names).
GIVEN.indonesian = {
  M: [
    'Budi,Agus,Bambang,Joko,Hadi,Sutrisno,Slamet,Sugeng,Teguh,Hartono,Gunawan,Darmawan,Supriyadi,Haryanto,Suparman,Wahyu,Herman,Hendra,Irwan,Yusuf,Ahmad,Rudy,Halim,Effendi,Santoso,Sutanto,Johan,Robert,Yohanes,Paulus',
    'Budi,Agus,Hendra,Andi,Dedi,Eko,Rudi,Joko,Wahyu,Hadi,Teguh,Irwan,Taufik,Arief,Yudi,Iwan,Hari,Benny,Johan,Hendrik,Robby,Ferry,Steven,Willy,Henry,Edwin,Gunawan,Sugianto,Kurniawan,Antonius',
    'Rizky,Fajar,Dimas,Bayu,Dwi,Andre,Kevin,Michael,Yohanes,Ricky,Reza,Adi,Aditya,Rio,Rendy,Fikri,Ilham,Arif,Yoga,Hendra,Indra,Wahyu,Eko,Agung,Rangga,Dodi,Ivan,Jonathan,Felix,Calvin',
    'Muhammad,Rafi,Raka,Bima,Arya,Daffa,Rizky,Farel,Kenzo,Nathan,Jason,Kevin,Christian,Matthew,Darren,Vincent,Bryan,Gilbert,Alvaro,Rafael,Aldo,Fauzan,Haikal,Reyhan,Dimas,Galih,Satria,Zidane,Kenneth,Jayden',
  ],
  F: [
    'Sri,Siti,Dewi,Nur,Sumiati,Suharti,Sulastri,Kartini,Endang,Sutinah,Lestari,Wati,Yanti,Ratna,Ningsih,Rahayu,Suryani,Hartati,Sumarni,Murni,Tuti,Lilis,Erna,Lina,Lanny,Lily,Maria,Yuliana,Theresia,Susana',
    'Dewi,Sri,Siti,Ratna,Indah,Wulan,Rina,Yanti,Lestari,Sari,Fitri,Kartika,Maya,Nina,Desi,Lina,Mega,Intan,Ayu,Diana,Yuli,Novi,Yenny,Lisa,Susanti,Yuliani,Sinta,Linda,Herlina,Elisabeth',
    'Putri,Ayu,Dewi,Indah,Fitri,Intan,Dian,Rani,Nadia,Anisa,Citra,Mega,Novita,Rizka,Sinta,Tiara,Vina,Yuni,Amelia,Angela,Cindy,Jessica,Stephanie,Vanessa,Felicia,Michelle,Natalia,Grace,Cynthia,Wulan',
    'Aisyah,Nabila,Salsabila,Zahra,Alya,Keisha,Naura,Azzahra,Khanza,Aurelia,Kayla,Nayla,Putri,Clarissa,Michelle,Jessica,Angelina,Felicia,Celine,Gabriella,Valerie,Vanessa,Cindy,Natasha,Sherly,Tasya,Bella,Shania,Cantika,Adinda',
  ],
};

// Other Asian origins (Nepal, Sri Lanka, Mongolia, Tibet, Malaysia, Bhutan ...): one era-neutral pool.
GIVEN['asian-other'] = {
  base: {
    M: 'Prakash,Bishnu,Hari,Krishna,Suman,Bikash,Sanjay,Dipak,Sunil,Binod,Sagar,Prabin,Sujan,Nabin,Bibek,Saroj,Nimal,Chaminda,Kasun,Ruwan,Nuwan,Saman,Lakshman,Chathura,Tharindu,Tenzin,Dorje,Pema,Karma,Sonam,Tashi,Dawa,Bat,Bold,Ganbaatar,Batbayar,Erdene,Ahmad,Hafiz,Azman,Faizal,Kumar,Rajan,Kelvin,Wei',
    F: 'Sita,Gita,Sunita,Laxmi,Sarita,Anita,Puja,Srijana,Sabina,Rina,Bimala,Shanti,Manju,Kabita,Asmita,Pratima,Rojina,Dilini,Nadeesha,Chamari,Sanduni,Nirosha,Ishara,Thilini,Kumari,Malini,Anoma,Tenzin,Pema,Dolma,Lhamo,Yangchen,Sonam,Tuya,Oyun,Saraa,Enkhjargal,Nurul,Siti,Aisyah,Farah,Mei,Priya,Shalini',
  },
};
GIVEN.asian = {
  mix: [
    ['asian-other', [0.3, 0.3, 0.32, 0.32]], ['chinese', [0.25, 0.25, 0.25, 0.25]], ['indian', [0.12, 0.14, 0.15, 0.15]],
    ['filipino', [0.13, 0.12, 0.1, 0.1]], ['vietnamese', [0.08, 0.08, 0.08, 0.08]], ['korean', [0.08, 0.08, 0.07, 0.07]], ['thai', [0.04, 0.03, 0.03, 0.03]],
  ],
};

// ------------------------------------------------------------------ given names: Black traditions
// African American naming by cohort (the Southern names of the Great Migration generation that came west in
// the 1940s; the 1970s-90s inventive names; today's Josiah and Nevaeh), drawn alongside the general pool.
GIVEN['african-american'] = {
  M: [
    'James,Willie,Robert,John,Charles,Johnny,Leroy,Earl,Clarence,Eddie,Henry,Joseph,William,Samuel,Roosevelt,Jesse,Otis,Curtis,Melvin,Herman,Lonnie,Raymond,Walter,Albert,Ernest,Arthur,Louis,Isaac,Nathaniel,Alvin,Harold,Calvin,Roy,Theodore,Cleveland,Booker,Moses,Wilbert,Freddie,Sylvester,Ollie,Floyd,Elijah,Edward,Tommie',
    'Michael,Anthony,Kevin,Darryl,Derrick,Andre,Reginald,Tyrone,Cedric,Marcus,Jerome,Keith,Lamont,Darnell,Terrence,Dwayne,Maurice,Rodney,Kenneth,Ronald,Gregory,Eric,Larry,Carl,Vincent,Bernard,Antoine,Byron,Clifton,Darren,Kelvin,Leon,Troy,Wendell,Alonzo,Darius,Jermaine,Corey,Stanley,Calvin,Lawrence,Gerald',
    'Brandon,Christopher,Jamal,DeShawn,Darius,Terrell,Marcus,Jalen,Andre,Malik,Antonio,Brian,Justin,Jordan,Isaiah,Cameron,Kevin,Devin,Tyler,Corey,Xavier,Jermaine,Demetrius,Darnell,Marquis,Rashad,Dominique,Anthony,Michael,Joshua,Jonathan,Aaron,Kenneth,Trevon,Tremaine,Dante,Lamar,Deandre,Javon,Quinton',
    'Jayden,Elijah,Josiah,Isaiah,Jeremiah,Kingston,Malachi,Amir,Zion,Kayden,Jaylen,Cameron,Christian,Micah,Darius,Jordan,Kai,Khalil,Major,Legend,King,Aiden,Carter,Ethan,Joshua,Caleb,Jaxon,Bryson,Devin,Chase,Kameron,Tristan,Marcus,Jalen,Noah,Jace,Ezekiel,Dominic,Messiah,Malik',
  ],
  F: [
    'Mary,Annie,Dorothy,Gloria,Shirley,Betty,Lillie,Ruby,Ernestine,Bernice,Helen,Willie,Barbara,Mattie,Louise,Juanita,Bessie,Hattie,Rosa,Lula,Geraldine,Doris,Evelyn,Martha,Margaret,Gladys,Essie,Jessie,Johnnie,Fannie,Ella,Mae,Alberta,Delores,Thelma,Loretta,Inez,Clara,Odessa,Viola,Minnie,Lois',
    'Tanya,Tonya,Kimberly,Angela,Sonya,Felicia,Yolanda,Keisha,Monique,Tamika,Lisa,Michelle,Sharon,Denise,Valerie,Robin,Stephanie,Gwendolyn,Latanya,Rhonda,Tracy,Wanda,Sheila,Vanessa,Cynthia,Patricia,Pamela,Andrea,Regina,Teresa,Karen,Carla,Lakisha,Tasha,Kendra,Rochelle,Deborah,Toni,Yvette,Darlene,Veronica,Natasha',
    'Ebony,Jasmine,Brittany,Tiara,Imani,Kiara,Destiny,Diamond,Ashley,Jessica,Raven,Chanel,Alexis,Briana,Jada,Kayla,Monique,Danielle,Tierra,Precious,Courtney,Crystal,Erica,Shanice,Aisha,Keisha,Brianna,Asia,Dominique,Taylor,Whitney,Kiana,Ciara,Bianca,Candace,Kierra,Tiffany,Amber,Aaliyah,Jazmine',
    'Aaliyah,Nevaeh,Zoe,Kennedy,Madison,Imani,Jada,Mya,Amara,Nia,Skylar,Ava,Taylor,Harmony,Destiny,Jasmine,Kamari,Laila,Londyn,Paris,Serenity,Trinity,Zariah,Ayanna,Amani,Brielle,Journee,Kaylee,Aubrey,Brooklyn,Morgan,Sanaa,Egypt,Heaven,Jayla,Makayla,Naomi,Faith,Ariana,Zuri,Amaya,Aniyah',
  ],
};

// Ethiopia and Eritrea (Amharic, Tigrinya and Oromo names; Oakland, San Jose and Los Angeles).
GIVEN.ethiopian = {
  M: [
    'Abebe,Tesfaye,Getachew,Tadesse,Girma,Alemayehu,Kebede,Mulugeta,Mekonnen,Haile,Bekele,Tekle,Berhane,Gebre,Yohannes,Solomon,Assefa,Alemu,Desta,Wondimu,Tilahun,Lemma,Negash,Shiferaw,Worku,Asfaw,Ayele,Demissie,Fikre,Gebremedhin,Habte,Kidane,Mengesha,Tsegaye,Woldemariam,Zewdu,Amare,Belay,Taye,Teshome',
    'Dawit,Yohannes,Solomon,Daniel,Samuel,Tewodros,Bereket,Mesfin,Yonas,Henok,Elias,Fikru,Habtamu,Mulugeta,Getachew,Tesfaye,Biniam,Tekle,Berhane,Tesfay,Goitom,Yemane,Haile,Mekonnen,Abraham,Ephrem,Wondwossen,Zelalem,Ermias,Girma,Kibrom,Mehari,Michael,Million,Nebiyu,Tadele,Teklu,Yared,Zerihun,Fitsum',
    'Dawit,Yonas,Henok,Biniam,Abel,Natnael,Robel,Amanuel,Kidus,Eyob,Nahom,Mikias,Fitsum,Ermias,Filmon,Samson,Haben,Bereket,Yared,Nebiyu,Elias,Daniel,Samuel,Michael,Yohannes,Solomon,Tewodros,Kaleb,Naod,Yafet,Abenezer,Dagim,Mussie,Semere,Yosef,Biruk,Leul,Tesfalem,Sirak,Tsegay',
    'Kidus,Nahom,Natnael,Abel,Eyob,Yafet,Naod,Abenezer,Dagim,Kaleb,Mikias,Amanuel,Robel,Biruk,Leul,Yosef,Elias,Henok,Yonas,Nathan,Barok,Ezana,Haben,Bemnet,Samuel,Daniel,Abraham,Isaiah,Kirubel,Mussie',
  ],
  F: [
    'Almaz,Tsehay,Genet,Abeba,Aster,Mulu,Yeshi,Zewditu,Belaynesh,Etenesh,Tiruwork,Askale,Tsige,Hirut,Konjit,Tigist,Werknesh,Alem,Azeb,Elsa,Saba,Senait,Mebrat,Lemlem,Tsega,Yeshimebet,Zenebech,Wubit,Bizunesh,Meseret,Shewaye,Tirunesh,Abebech,Asnakech,Birtukan,Emebet,Fantaye,Workinesh,Tsedale,Amsale',
    'Tigist,Hiwot,Meron,Selam,Hana,Bethlehem,Mahlet,Rahel,Saba,Senait,Martha,Tsion,Meseret,Kidist,Helen,Elsa,Hirut,Konjit,Genet,Azeb,Mekdes,Selamawit,Lidya,Ruth,Yordanos,Eden,Sara,Netsanet,Frehiwot,Mihret,Nardos,Tirsit,Winta,Feven,Luwam,Semhar,Ruta,Yodit,Wudase,Abrehet',
    'Bethlehem,Mahlet,Meron,Hiwot,Selam,Tsion,Liya,Ruth,Eden,Helen,Hana,Rahel,Saba,Feven,Winta,Selamawit,Lidya,Bilen,Eyerusalem,Mekdes,Nardos,Mihret,Kidist,Yordanos,Tizita,Semhar,Luwam,Ruta,Yodit,Senait,Bezawit,Hermela,Metasebia,Rediet,Samrawit,Sara,Ariam,Danait,Hanna,Betelhem',
    'Liya,Eden,Hermela,Bethel,Arsema,Abigiya,Ruhama,Yeabsira,Kalkidan,Mekdelawit,Hosana,Rediet,Bemnet,Fenet,Hana,Selam,Tsion,Nardos,Mahlet,Mihret,Feven,Winta,Ariam,Danait,Ruta,Saron,Elsabet,Lydia,Sofia,Meklit',
  ],
};

// Nigeria (Yoruba, Igbo and Hausa names alongside the English Christian names in wide use).
GIVEN.nigerian = {
  M: [
    'Olusegun,Adebayo,Babatunde,Oluwole,Adewale,Olufemi,Akinwale,Oladipo,Chukwuemeka,Nnamdi,Ikechukwu,Obinna,Emmanuel,Samuel,John,Joseph,Peter,Michael,Godwin,Sunday,Felix,Gabriel,Ibrahim,Musa,Abdullahi,Aliyu,Usman,Ifeanyi,Chinedu,Okechukwu,Adeyemi,Oluseyi,Kayode,Ayodele,Kehinde,Taiwo,Festus,Augustine,Cyril,Christopher',
    'Oluwaseun,Olumide,Adebayo,Babatunde,Oluwafemi,Tunde,Femi,Segun,Kunle,Emeka,Chukwuemeka,Chinedu,Obinna,Ikenna,Nnamdi,Uche,Chidi,Ifeanyi,Tochukwu,Kelechi,Ayodele,Ibrahim,Musa,Emmanuel,Samuel,Daniel,David,Joseph,Michael,John,Victor,Godwin,Gbenga,Rotimi,Yemi,Kayode,Dapo,Wale,Abiodun,Ikechukwu',
    'Oluwaseun,Oluwatobi,Damilola,Ebuka,Chibuzo,Chukwudi,Somto,Ifeanyi,Obinna,Kelechi,Tochukwu,Emeka,Nnamdi,Ikenna,Tobi,Seyi,Tolu,Femi,Kunle,Tayo,Dayo,Bayo,Abdul,Ahmed,Ibrahim,Emmanuel,David,Daniel,Samuel,Victor,Joshua,Michael,Stephen,Anthony,Kingsley,Collins,Chinonso,Chiedu,Ugochukwu,Opeyemi',
    'David,Daniel,Emmanuel,Joshua,Samuel,Divine,Toluwani,Ayomide,Oluwadamilare,Inioluwa,Feranmi,Chidubem,Chukwuebuka,Kamsiyochukwu,Somtochukwu,Munachi,Ifeoluwa,Mubarak,Ibrahim,Ahmed,Elijah,Isaac,Jeremiah,Joel,Nathan,Tobenna,Chimdi,Ebube,Tomiwa,Ayodeji,Kolade,Fikayomi',
  ],
  F: [
    'Folake,Funmilayo,Yetunde,Bukola,Ngozi,Nkechi,Chinwe,Ifeoma,Ijeoma,Uchenna,Titilayo,Abimbola,Omolara,Morenike,Aisha,Fatima,Hauwa,Zainab,Grace,Esther,Mercy,Comfort,Patience,Felicia,Victoria,Elizabeth,Mary,Juliana,Christiana,Bose,Iyabo,Kemi,Toyin,Bisi,Adunni,Modupe,Olufunke,Ebere,Nneka,Chioma',
    'Folake,Funmilayo,Funke,Yetunde,Bukola,Adaeze,Chioma,Ngozi,Nkechi,Amaka,Chinwe,Ifeoma,Ijeoma,Adaobi,Uchenna,Chiamaka,Oluwakemi,Kemi,Titilayo,Toyin,Bisi,Abimbola,Omolara,Temitope,Damilola,Oluwaseun,Morenike,Aisha,Fatima,Hauwa,Zainab,Blessing,Grace,Esther,Mercy,Joy,Patience,Comfort,Faith,Gift',
    'Chiamaka,Adaeze,Chioma,Ifeoma,Ngozi,Nneka,Amarachi,Chinonso,Chidinma,Ebere,Uju,Oluwatoyin,Temitope,Damilola,Oluwaseun,Tolulope,Opeyemi,Bolanle,Funmilola,Yewande,Adenike,Folasade,Ayomide,Blessing,Precious,Favour,Peace,Joy,Grace,Esther,Deborah,Ruth,Aisha,Zainab,Fatima,Halima,Khadijat,Bukola,Ifeoluwa,Oyinkansola',
    'Favour,Precious,Blessing,Esther,Deborah,Goodness,Miracle,Praise,Divine,Chimamanda,Zikora,Adaora,Chiamaka,Amara,Ifeoluwa,Oluwanifemi,Fikayomi,Tiwatope,Ayomide,Inioluwa,Morayo,Oyinkansola,Ireoluwa,Tamilore,Simisola,Anuoluwapo,Fatima,Aisha,Maryam,Zainab,Halima,Hadiza,Chisom,Kamsi,Nkem,Ebube,Munachi,Olivia',
  ],
};

// The Black Caribbean (Jamaica, Haiti, Trinidad and Tobago, Barbados, the Bahamas, Belize).
GIVEN.caribbean = {
  M: [
    'Winston,Desmond,Clive,Delroy,Leroy,Errol,Lloyd,Neville,Trevor,Everton,Garfield,Fitzroy,Courtney,Cecil,Rupert,Wilfred,Clement,Hubert,Aston,Lester,Linton,Vincent,Joseph,Pierre,Jean,Jacques,Claude,Marcel,Gérard,Fritz,Roland,Antoine,Raymond,Ernest,Lucien,Emmanuel,Michel,Frantz,Wilner,Rodney',
    'Andre,Trevor,Everton,Garfield,Fitzroy,Delroy,Courtney,Dwight,Dalton,Devon,Carlton,Clifton,Kirk,Conrad,Wayne,Mark,Paul,Anthony,Michael,Kevin,Patrick,Jean-Claude,Jean-Pierre,Jean-Marc,Wesner,Wilner,Fritz,Jacques,Ronald,Ricardo,Junior,Dexter,Glenroy,Lennox,Owen,Marlon,Sean,Kenrick,Sheldon,Ralph',
    'Andre,Kemar,Damian,Romario,Shane,Jermaine,Odane,Kevin,Christopher,Ricardo,Sheldon,Marlon,Dwayne,Kerron,Akeem,Shamar,Jean,Jonathan,Stanley,Peterson,Woodley,Ralph,Kenny,Wilson,Djimy,Mackenson,Jameson,Steeve,Ricky,Kendall,Rohan,Rushane,Tyrone,Dorian,Nicholas,Daniel,Joel,Fritzner,Junior,Oneil',
    'Jayden,Josiah,Elijah,Isaiah,Kemari,Jaheim,Malachi,Zion,Daniel,Christian,Joshua,Jordan,Nathan,Samuel,Gabriel,Kendrick,Kyrie,Kai,Liam,Noah,Ethan,Matthieu,Jeff,Dylan,Evens,Jeremy,Marc,Lucas,Shamar,Ajani,Amari,Tristan,Kingsley,Romeo,Aiden,Caleb,Micah,Jean-Luc,Shiloh,Akeem',
  ],
  F: [
    'Marcia,Paulette,Sonia,Beverley,Hyacinth,Claudette,Yvonne,Sharon,Gloria,Pearline,Daphne,Merle,Joyce,Gwendolyn,Icilda,Hortense,Myrtle,Enid,Iris,Lorna,Marie,Rose,Ginette,Yolande,Mireille,Gisèle,Lucienne,Jacqueline,Monique,Simone,Elaine,Carmen,Cynthia,Veronica,Pansy,Olive,Dorothy,Phyllis,Winifred,Marie-Thérèse',
    'Marcia,Paulette,Sonia,Donna,Simone,Nadine,Andrea,Sharon,Michelle,Karen,Charmaine,Natalie,Kerry-Ann,Tanya,Tamara,Sandra,Yvette,Marie,Nadège,Fabiola,Guerda,Mirlande,Marjorie,Rose-Marie,Carline,Darline,Stéphanie,Judith,Joan,Cheryl,Allison,Annette,Camille,Jacqueline,Claudine,Dahlia,Sophia,Hyacinth,Beverley,Lorraine',
    'Shanice,Tanisha,Kerry-Ann,Simone,Nadine,Stacy-Ann,Shauna,Kimberly,Tiffany,Crystal,Kadian,Shanelle,Shantel,Chantal,Natasha,Rochelle,Melissa,Samantha,Danielle,Fabienne,Nathalie,Roseline,Wideline,Islande,Mirlande,Bianca,Jessica,Kerline,Fedna,Ashley,Gabrielle,Kristen,Tamika,Amoy,Sasha,Jodian,Taneisha,Shellyann,Sherika,Tameka',
    'Aaliyah,Gabrielle,Kayla,Jada,Kimora,Amaya,Nia,Zoe,Imani,Kaitlyn,Ashanti,Shanice,Tianna,Jasmine,Naomi,Sarai,Daniella,Christina,Esther,Ruth,Nathalie,Sophia,Olivia,Mia,Ava,Brianna,Kiara,Taliyah,Jayla,Amara,Anaya,Makayla,Sanaa,Alexa,Isabelle,Laila,Zariah,Keira,Kamila,Mikayla',
  ],
};

// Other African origins (Ghana, Kenya, Somalia, Senegal and Mali, Cameroon, Uganda, Zimbabwe, South Africa).
GIVEN.african = {
  base: {
    M: 'Kwame,Kofi,Kwabena,Yaw,Kojo,Kwaku,Kwasi,Kwadwo,Nana,Kamau,Mwangi,Otieno,Odhiambo,Ochieng,Kariuki,Njoroge,Wafula,Mutua,Abdi,Ahmed,Hassan,Abdirahman,Abdullahi,Mohamed,Omar,Ali,Yusuf,Mamadou,Moussa,Ibrahima,Ousmane,Abdoulaye,Amadou,Cheikh,Modou,Lamine,Boubacar,Emmanuel,Samuel,Joseph,Daniel,Isaac,Patrick,Francis,Godfrey,Felix,Moses,Peter,Charles,Thabo,Sipho,Tendai,Tafadzwa,Jean-Pierre',
    F: 'Ama,Abena,Akosua,Adwoa,Efua,Afia,Yaa,Akua,Esi,Adjoa,Wanjiru,Njeri,Wambui,Wanjiku,Achieng,Akinyi,Atieno,Nyambura,Muthoni,Hodan,Fadumo,Halima,Asha,Hawa,Sahra,Ayan,Sagal,Ifrah,Maryan,Amina,Fatoumata,Aminata,Mariama,Aissatou,Kadiatou,Awa,Binta,Ndeye,Grace,Esther,Mercy,Joyce,Faith,Gladys,Florence,Agnes,Christine,Josephine,Rose,Nomsa,Thandiwe,Rudo,Chipo,Nyasha',
  },
  M: [
    '',
    '',
    'Emmanuel,Samuel,Daniel,David,Kelvin,Brian,Dennis,Collins,Felix,Eric,Kevin,Victor,Abdi,Mohamed,Ibrahim,Moussa,Kwame,Kofi,Yaw,Otieno',
    'Jayden,Ethan,Daniel,David,Samuel,Elijah,Joshua,Isaac,Nathan,Ryan,Ayaan,Yusuf,Mohamed,Abdirahman,Ibrahim,Kwame,Kofi,Nana,Jordan,Liam',
  ],
  F: [
    '',
    '',
    'Grace,Faith,Mercy,Joyce,Sharon,Diana,Brenda,Esther,Christine,Lilian,Hodan,Ifrah,Sagal,Ayan,Fatoumata,Aminata,Abena,Ama,Wanjiru,Achieng',
    'Ella,Zoe,Abigail,Hannah,Naomi,Grace,Faith,Precious,Amani,Imani,Nia,Zuri,Amina,Hafsa,Ayan,Sumaya,Ama,Abena,Akosua,Wanjiru',
  ],
};

// ------------------------------------------------------------------ given names: Armenian, Iranian, Arab, Assyrian
// Armenian Californians: Western Armenian forms from the Middle East diaspora (Hagop, Kevork, Garabed) and
// Eastern forms from Armenia and Iran (Hakob, Gevorg, Karapet), side by side, as in Glendale and Fresno.
GIVEN.armenian = {
  M: [
    'Hagop,Garabed,Krikor,Kevork,Sarkis,Hovhannes,Bedros,Haroutioun,Avedis,Vartan,Levon,Ara,Aram,Armen,Mihran,Nishan,Antranig,Zaven,Vahe,Hrant,Ohannes,Setrak,Toros,Yervant,Asadour,Dikran,Manoug,Misak,Nerses,Onnig,Shahe,Vazken,Yeghia,Zareh,Ashot,Grigor,Gevorg,Samvel,Vardan,Karapet,Suren,Hakob,Mkrtich,Khachatur',
    'Armen,Ara,Aram,Ashot,Artur,Arsen,Gevorg,Grigor,Hayk,Karen,Levon,Mher,Raffi,Sarkis,Sevak,Tigran,Vahe,Vahan,Vazgen,Hrant,Samvel,Suren,Gagik,Garnik,Artak,Davit,Edgar,Hakob,Harutyun,Hovhannes,Norayr,Robert,Ruben,Sargis,Varuzhan,Vardan,Shant,Sako,Vrej,Garo,Hagop,Kevork,Viken,Armenak',
    'Narek,Arman,Davit,Gor,Hayk,Tigran,Arsen,Erik,Edgar,Gevorg,Aram,Armen,Arthur,Hovhannes,Levon,Mher,Raffi,Sevak,Shant,Vahe,Vardan,Aren,Areg,Karen,Robert,Ruben,Samvel,Sargis,Vrezh,Hrach,Artyom,Garen,Ara,Alex,Arno,Vahagn,Gagik,Harut,Hakob,Hovsep',
    'Narek,Davit,Mark,Arman,Hayk,Tigran,Gor,Erik,Alex,Aren,Areg,Mher,Levon,Hovhannes,Gevorg,Samvel,Aram,Arsen,Daniel,Robert,Ruben,Vahe,Vahagn,Leo,Raffi,Arthur,Sevak,Armen,Albert,Edgar,Michael,Gabriel,Garen,Harut,Ashot,Hakob,Sarkis,Grigor',
  ],
  F: [
    'Arpi,Siranoush,Anahid,Zabel,Araksi,Nvard,Gohar,Hasmik,Haykanoush,Ani,Arshaluys,Sirarpi,Houri,Silva,Takouhi,Mariam,Lusine,Seta,Vartouhi,Azniv,Anoush,Knarik,Shoushan,Rose,Alice,Satenik,Varsenik,Zaruhi,Astghik,Margarit,Sona,Hripsime,Ovsanna,Armenouhi,Arousiag,Hermine,Lucine,Nazeli,Marie,Elmast',
    'Anahit,Ani,Anush,Armine,Arpi,Astghik,Gayane,Hasmik,Karine,Lilit,Lusine,Marine,Mariam,Narine,Nune,Ruzanna,Seda,Sona,Siranush,Tamar,Taguhi,Zara,Arevik,Hripsime,Knarik,Shushan,Satenik,Silva,Talin,Nairi,Maral,Lucine,Sossi,Houri,Rubina,Sirarpi,Ruzan,Gohar,Emma,Elen',
    'Ani,Lilit,Anna,Mariam,Tatevik,Nare,Arpine,Lusine,Armine,Anahit,Meri,Hasmik,Tamar,Talin,Nairi,Sevana,Arev,Gayane,Sona,Seda,Christine,Lena,Elen,Milena,Lianna,Narine,Kristine,Diana,Elena,Silva,Maral,Karina,Marine,Lucine,Ruzanna,Astghik,Anush,Gohar,Shushanik,Natalie',
    'Mariam,Ani,Nare,Lilit,Elen,Milena,Anna,Mane,Eva,Yeva,Arpi,Tatev,Sofia,Emma,Mila,Ariana,Lia,Nairi,Talin,Sevana,Arev,Areni,Anahit,Seda,Maria,Diana,Victoria,Alina,Arina,Eliza,Liana,Isabella,Arsine,Lucine,Natalie,Angela,Gayane,Lusine',
  ],
  us: {
    M: [
      'Ara,Aram,Armen,Haig,Hagop,Garo,Vahe,Levon,Raffi,George,Arthur,Harry,Edward,Charles,Richard,Kirk',
      'Ara,Aram,Armen,Raffi,Shant,Haig,Garo,Vahe,Levon,Arthur,Michael,David,Mark,Steven,Paul,Robert,Gregory,Hovsep',
      'Raffi,Aram,Armen,Shant,Ara,Levon,Narek,Areg,Hayk,Tigran,Davit,Alex,Erik,Mark,Andre,Christopher,Michael,Daniel,George,Gabriel,Adrian,Arin,Sevak,Vahe',
      'Narek,Aram,Raffi,Levon,Areg,Aren,Hayk,Tigran,Davit,Alex,Erik,Mark,Leo,Adrian,Gabriel,Daniel,Michael,Christopher,Arman,Sevan,Vahan,Ethan,Adam,Gor',
    ],
    F: [
      'Alice,Rose,Mary,Anna,Helen,Lucy,Grace,Margaret,Virginia,Arpi,Siran,Zabel,Seta,Silva,Ani,Nevart',
      'Talin,Lori,Christine,Nairi,Ani,Arpi,Lucine,Maral,Tamar,Seta,Silva,Karine,Nicole,Diana,Lisa,Michelle,Sossi,Houry',
      'Talin,Nairi,Ani,Sevana,Lucine,Maral,Tamar,Nareh,Sona,Lena,Natalie,Ariana,Mariam,Christine,Karine,Nicole,Diana,Seda,Arpi,Anahid,Lilit,Melanie,Tiffany,Arineh',
      'Ani,Nairi,Talin,Sevana,Ariana,Mariam,Ella,Lilit,Anahid,Sona,Lena,Natalie,Sofia,Isabella,Mila,Eva,Areni,Nareh,Arev,Lucine,Emma,Sophia,Liana,Victoria',
    ],
  },
};

// Iran (Persian Muslim, Jewish, Baha'i and Zoroastrian families of Los Angeles, Irvine and the Bay Area).
GIVEN.iranian = {
  M: [
    'Ali,Mohammad,Hossein,Hassan,Mahmoud,Reza,Ahmad,Abbas,Jafar,Mehdi,Parviz,Hooshang,Fereydoun,Manouchehr,Bahram,Jamshid,Iraj,Dariush,Nasser,Mansour,Morteza,Mostafa,Ebrahim,Esmaeil,Gholam,Hamid,Majid,Faramarz,Kamran,Cyrus,Bijan,Khosrow,Davoud,Yousef,Nader,Siavash,Shahram,Behrouz,Fariborz,Aziz,Yaghoub,Ezatollah',
    'Ali,Mohammad,Reza,Hamid,Majid,Saeed,Babak,Behrouz,Bijan,Cyrus,Dariush,Farhad,Kamran,Kourosh,Masoud,Mehran,Mohsen,Nader,Payam,Ramin,Shahram,Siavash,Kaveh,Arash,Amir,Afshin,Mehrdad,Mehdi,Behzad,Shahin,Peyman,Hooman,Farshid,Alireza,Hossein,Keyvan,Shervin,Kambiz,Pedram,Shahriar',
    'Arash,Amir,Arman,Navid,Omid,Pejman,Peyman,Nima,Pouya,Sina,Soheil,Shervin,Kian,Ramin,Babak,Kaveh,Behnam,Ehsan,Hamed,Mehdi,Mohammad,Ali,Reza,Hossein,Alireza,Saman,Farzad,Shayan,Mohsen,Milad,Mehran,Sam,Arya,Sasan,Vahid,Payam,Siamak,Bardia,Kamyar,Daniel',
    'Arya,Kian,Parsa,Ario,Darius,Daniel,Ryan,Sam,Liam,Adrian,Arman,Ali,Amir,Mohammad,Hossein,Mahdi,Amirali,Abolfazl,Taha,Yasin,Matin,Sepehr,Radin,Barbod,Artin,Aryan,Nikan,Rayan,Hirad,Iliya,Kasra,Sina,Bardia,Kourosh,Dariush,Navid,Benjamin,Cyrus,Kayvan,Shayan',
  ],
  F: [
    'Fatemeh,Zahra,Masoumeh,Maryam,Khadijeh,Robabeh,Sakineh,Fereshteh,Shahla,Parvin,Mahin,Ozra,Nosrat,Pari,Iran,Touran,Mahvash,Simin,Shirin,Homa,Mehri,Farideh,Azam,Ashraf,Parvaneh,Effat,Badri,Molouk,Mahnaz,Jaleh,Forough,Nahid,Shamsi,Goli,Monir,Esmat,Akram,Marzieh,Pouran,Tahereh',
    'Maryam,Fatemeh,Zahra,Shirin,Parisa,Nasrin,Mahnaz,Shahla,Mitra,Roya,Leila,Mina,Nazanin,Azadeh,Afsaneh,Farah,Fereshteh,Golnaz,Laleh,Mojgan,Nahid,Neda,Niloufar,Parvaneh,Shabnam,Simin,Soheila,Taraneh,Yasmin,Ziba,Bahar,Elham,Haleh,Homa,Jaleh,Katayoun,Mahtab,Minoo,Ladan,Shohreh',
    'Neda,Niloufar,Parisa,Sara,Maryam,Nazanin,Negar,Pegah,Sepideh,Setareh,Tannaz,Mahsa,Elham,Azadeh,Shiva,Yasaman,Bahar,Golnaz,Ladan,Leila,Mina,Mitra,Roxana,Samira,Shadi,Shirin,Shabnam,Tara,Yalda,Atoosa,Donya,Ghazal,Hoda,Kimia,Mahta,Nasim,Nooshin,Rana,Romina,Taraneh',
    'Kimia,Ava,Sara,Hasti,Nika,Diana,Yasmin,Ariana,Sophia,Mahsa,Ghazal,Helia,Melika,Mobina,Fatemeh,Zahra,Maryam,Zeinab,Nazanin,Parmis,Parnian,Roya,Tara,Yasaman,Setareh,Donya,Rosa,Nila,Ayda,Elena,Bahar,Dorsa,Darya,Mina,Shirin,Leila,Shiva,Elina,Rojan,Anahita',
  ],
};

// The Arab world (Lebanon, Syria, Palestine, Jordan, Iraq, Egypt, Yemen; Muslim and Christian families).
GIVEN.arab = {
  M: [
    'Mohammed,Ahmad,Ali,Mahmoud,Hassan,Hussein,Ibrahim,Mustafa,Khalil,Youssef,Abdullah,Salim,Saleh,Jamil,Fouad,Nabil,Sami,Adel,Khaled,Farouk,Walid,Nasser,Samir,Fawzi,Elias,Georges,Michel,Antoine,Joseph,Naim,Emile,Faris,Hanna,Issa,Suleiman,Aziz,Kamal,Majid,Rashid,Tawfiq',
    'Mohammed,Ahmad,Ali,Omar,Khaled,Mahmoud,Mustafa,Hassan,Hussein,Ibrahim,Youssef,Samir,Nabil,Walid,Karim,Tarek,Fadi,Rami,Bassam,Ziad,Imad,Hani,Jamal,Majed,Nasser,Sami,Adel,Amjad,Bilal,Elias,George,Fouad,Michel,Tony,Maher,Raed,Wael,Haitham,Marwan,Emad',
    'Mohammed,Ahmad,Omar,Ali,Khaled,Mahmoud,Mustafa,Hamza,Bilal,Yazan,Anas,Zaid,Ammar,Ibrahim,Youssef,Hassan,Hussein,Fadi,Rami,Tarek,Karim,Sami,Ziad,Majd,Mohannad,Laith,Mazen,Firas,Nader,Hadi,Ayman,Osama,Saif,Basel,Ihab,Elie,Georges,Charbel,Rabih,Fares',
    'Mohammed,Adam,Omar,Ali,Yousef,Ahmad,Hamza,Zaid,Yazan,Ibrahim,Abdullah,Karim,Hadi,Rayan,Elias,Malik,Sami,Amir,Hassan,Hussein,Mustafa,Khalid,Jad,Ryan,Taim,Tamer,Zain,Majd,Laith,Ismail,Bilal,Anas,Ammar,Charbel,Joseph,Daniel,Fares,Yahya,Eyad,Kenan',
  ],
  F: [
    'Fatima,Amina,Khadija,Zeinab,Aisha,Mariam,Samira,Nadia,Laila,Najwa,Souad,Wafa,Hanan,Huda,Amal,Salwa,Siham,Nawal,Fadia,Hayat,Jamila,Wadad,Afaf,Ibtisam,Hind,Raja,Inaam,Samia,Mona,Ghada,Nabila,Georgette,Marie,Therese,Hasna,Fairuz,Nuha,Najat,Sabah,Layla',
    'Fatima,Mariam,Rania,Rana,Hala,Huda,Lina,Dina,Mona,Reem,Samar,Suha,Ghada,Nisreen,Rasha,Wafa,Najwa,Randa,Hanan,Amal,Samira,Nadia,Iman,Hiba,Maha,Muna,Sawsan,Dalia,Manal,Abeer,Lama,Rula,Nada,Maysa,Layla,Aida,Nancy,Rita,Joumana,Carla',
    'Noor,Sara,Lina,Dana,Rana,Reem,Yasmin,Salma,Lara,Maya,Jana,Malak,Rawan,Leen,Tala,Sana,Hiba,Iman,Mariam,Aya,Asmaa,Shaima,Dalia,Nadine,Rasha,Ruba,Shatha,Haneen,Duaa,Lubna,Diana,Christine,Rita,Joelle,Rima,Zeina,Hala,Farah,Lama,Nour',
    'Layla,Mariam,Noor,Sara,Yasmin,Lina,Salma,Jana,Malak,Tala,Leen,Lara,Maya,Zainab,Fatima,Aisha,Hana,Joud,Lamar,Sidra,Dima,Rital,Talia,Celine,Yara,Amira,Nadine,Lana,Zeina,Ella,Mila,Aya,Sofia,Raghad,Retaj,Ghena,Mira,Judy,Tia,Elena',
  ],
};

// Assyrian and Chaldean families (Turlock, Modesto, San Jose, San Diego's El Cajon), from Iraq, Iran and Syria.
GIVEN.assyrian = {
  base: {
    M: 'Sargon,Ashur,Ninos,Nimrod,Yonan,Benyamin,Yousif,Odisho,Khoshaba,Shimon,Aprim,Youkhana,Gewargis,Hormiz,Ishaya,Isho,Khamis,Narsai,Ramsin,Toma,Wilson,Edison,Sami,Fadi,Raymond,Albert,Alfred,Ashour,Dinkha,Hanna,Lazar,Daniel,David,George,Emmanuel,Shmouel,Yacoub,Elias,Peter,Joseph,Atniel,Nineb',
    F: 'Shamiram,Ninva,Atour,Ninwe,Bella,Juliet,Lena,Maryam,Martha,Ramina,Shamiran,Sonia,Linda,Nahrain,Ninorta,Neshmaya,Esther,Rosa,Helen,Jandark,Klara,Layla,Nadia,Nancy,Natalie,Nisreen,Atra,Ashurina,Nineveh,Elishwa,Warda,Susan,Victoria,Diana,Christina,Janet,Nina,Samira,Mariam,Shlama',
  },
  M: [
    'Odisho,Khoshaba,Youkhana,Gewargis,Hormiz,Yacoub,Shimon,Aprim,Isho,Toma,Khamis,Yonan,Hanna,Dinkha,Benyamin,Lazar,Elias,Joseph,George,Albert',
    'Sargon,Ashur,Ninos,Wilson,Edison,Raymond,Alfred,Sami,Fadi,Ramsin,Nimrod,Yousif,Daniel,David,Emmanuel,Peter,Albert,Ashour,Narsai,Atniel',
    'Ninos,Sargon,Ashur,Ramsin,Nineb,Daniel,David,Andrew,Michael,Steven,Christopher,Johnny,Fadi,Sami,Ashour,Nimrod,Emmanuel,Wilson,Edison,Raymond',
    'Ninos,Sargon,Ashur,Ramsin,Nineb,Daniel,David,Adam,Andrew,Michael,Elijah,Gabriel,Adrian,Christian,Ethan,Lucas,Atour,Nathan,Noah,Ryan',
  ],
  F: [
    'Maryam,Martha,Esther,Shamiran,Warda,Elishwa,Helen,Rosa,Klara,Juliet,Victoria,Susan,Layla,Samira,Mariam,Nadia,Shlama,Linda,Sonia,Janet',
    'Shamiram,Ninva,Atour,Bella,Juliet,Lena,Ramina,Sonia,Linda,Nahrain,Jandark,Nancy,Nisreen,Diana,Christina,Janet,Nina,Samira,Nadia,Natalie',
    'Ninva,Atour,Shamiram,Ninorta,Nahrain,Neshmaya,Ramina,Natalie,Christina,Nancy,Jessica,Monica,Diana,Lena,Nina,Bella,Atra,Ashurina,Nineveh,Sonia',
    'Ninva,Atour,Shamiram,Ninorta,Nahrain,Neshmaya,Atra,Ashurina,Nineveh,Natalie,Sophia,Isabella,Mia,Ella,Emma,Lena,Bella,Nina,Mariam,Ava',
  ],
};

// ------------------------------------------------------------------ given names: Slavic and Greek
// Russian-speaking Californians (Soviet Jewish emigres of the 1970s-90s in West Hollywood and San Francisco's
// Richmond, the Slavic evangelical families of Sacramento), in the transliterations they use in the US.
GIVEN.russian = {
  M: [
    'Vladimir,Nikolai,Ivan,Alexander,Mikhail,Boris,Yuri,Viktor,Anatoly,Valentin,Gennady,Leonid,Pavel,Pyotr,Vasily,Grigory,Arkady,Lev,Semyon,Yakov,Isaak,Efim,Naum,Mark,Igor,Oleg,Vitaly,Konstantin,Fyodor,Georgy,Evgeny,Valery,Stanislav,Vyacheslav,Eduard,Aleksei,Sergei,Dmitri,Andrei,Abram',
    'Sergei,Alexander,Andrei,Dmitri,Alexei,Igor,Oleg,Vladimir,Yuri,Mikhail,Evgeny,Konstantin,Maxim,Roman,Denis,Vadim,Pavel,Ilya,Kirill,Artem,Vitaly,Viktor,Anton,Nikolai,Boris,Gennady,Valery,Vladislav,Stanislav,Ruslan,Ivan,Leonid,Grigory,Arkady,Yaroslav,Mark,Timur,Gleb,Fyodor,Eduard',
    'Alexander,Dmitri,Maxim,Sergei,Andrei,Alexei,Artem,Ilya,Kirill,Mikhail,Nikita,Ivan,Roman,Denis,Evgeny,Anton,Pavel,Vladislav,Egor,Daniil,Nikolai,Vladimir,Konstantin,Stanislav,Timur,Yaroslav,Gleb,Arseny,Matvei,Fyodor,Vadim,Oleg,Igor,Ruslan,Vitaly,Grigory,Mark,Lev,Semyon,Timofei',
    'Alexander,Maxim,Artem,Mikhail,Ivan,Daniil,Dmitri,Kirill,Matvei,Egor,Timofei,Mark,Lev,Nikita,Ilya,Andrei,Roman,Arseny,Fyodor,Vladimir,Sergei,Gleb,Yaroslav,Semyon,Platon,Stepan,Savva,Makar,Miron,Tikhon,Bogdan,Denis,Nikolai,Konstantin,Pavel,Anton,Vsevolod,Timur,Elisei,Danila',
  ],
  F: [
    'Galina,Lyudmila,Tamara,Valentina,Nina,Lidia,Raisa,Zoya,Antonina,Vera,Nadezhda,Lyubov,Maria,Anna,Tatiana,Larisa,Svetlana,Irina,Natalia,Olga,Elena,Rimma,Inna,Alla,Sofia,Bella,Faina,Ella,Klara,Rosa,Polina,Zinaida,Klavdia,Evgenia,Margarita,Emma,Ida,Ekaterina,Lilia,Frida',
    'Elena,Olga,Tatiana,Natalia,Irina,Svetlana,Marina,Yulia,Ekaterina,Anna,Larisa,Oksana,Galina,Lyudmila,Inna,Victoria,Alla,Zhanna,Nadezhda,Lyubov,Vera,Maria,Yana,Alyona,Ksenia,Diana,Valentina,Nina,Lilia,Polina,Alina,Veronika,Karina,Kristina,Evgenia,Margarita,Snezhana,Elvira,Regina,Tamara',
    'Anastasia,Ekaterina,Maria,Anna,Daria,Yulia,Olga,Elena,Natalia,Tatiana,Irina,Kristina,Alina,Victoria,Ksenia,Polina,Elizaveta,Valeria,Sofia,Alexandra,Yana,Veronika,Diana,Marina,Svetlana,Karina,Alyona,Evgenia,Margarita,Angelina,Arina,Ulyana,Vera,Nadezhda,Lyubov,Oksana,Milana,Vasilisa,Kira,Taisia',
    'Sofia,Anastasia,Maria,Anna,Victoria,Alisa,Polina,Elizaveta,Alexandra,Daria,Varvara,Ksenia,Arina,Veronika,Vasilisa,Milana,Ulyana,Valeria,Kira,Eva,Ekaterina,Taisia,Alina,Yana,Mira,Diana,Vera,Zlata,Margarita,Kristina,Marina,Evelina,Elena,Angelina,Amelia,Emilia,Stefania,Esenia,Lilia,Nadezhda',
  ],
};

// Ukraine (Ukrainian forms; the Slavic Christian refugees of the 1990s often register Russian forms and
// gave their California-born children Biblical names).
GIVEN.ukrainian = {
  M: [
    'Volodymyr,Mykola,Ivan,Vasyl,Petro,Mykhailo,Stepan,Hryhoriy,Fedir,Anatoliy,Yuriy,Viktor,Pavlo,Leonid,Borys,Oleksandr,Andriy,Taras,Bohdan,Yaroslav,Myroslav,Orest,Roman,Ostap,Dmytro,Semen,Yakiv,Kostiantyn,Danylo',
    'Oleksandr,Serhiy,Andriy,Volodymyr,Oleh,Ihor,Yuriy,Mykola,Viktor,Vitaliy,Ruslan,Vadym,Dmytro,Oleksiy,Roman,Vasyl,Petro,Ivan,Taras,Bohdan,Yaroslav,Valentyn,Yevhen,Maksym,Denys,Pavel,Sergey,Vasiliy,Nikolay,Anatoliy',
    'Oleksandr,Andriy,Dmytro,Serhiy,Maksym,Oleksiy,Artem,Vladyslav,Denys,Yevhen,Ivan,Mykola,Roman,Taras,Bohdan,Yaroslav,Volodymyr,Vitaliy,Ruslan,Vadym,Nazar,Kyrylo,Illia,Danylo,Pavlo,Yuriy,Igor,Pavel,Daniel,David',
    'Maksym,Artem,Oleksandr,Matviy,Danylo,Nazar,Bohdan,Tymofiy,Mark,Ivan,Dmytro,Kyrylo,Illia,Andriy,Roman,Yaroslav,Denys,Mykhailo,Daniel,David,Timothy,Samuel,Nathan,Benjamin,Eli,Joel,Ruslan,Taras,Ostap',
  ],
  F: [
    'Hanna,Mariya,Olha,Nadiya,Halyna,Kateryna,Valentyna,Liudmyla,Nina,Zoya,Raisa,Tamara,Vira,Lyubov,Oleksandra,Paraska,Yevdokiya,Motrya,Odarka,Hafiya,Teklia,Sofiya,Daria,Nataliya,Larysa,Iryna,Svitlana,Lidiya,Antonina,Uliana',
    'Olena,Nataliya,Tetiana,Iryna,Oksana,Svitlana,Mariya,Liudmyla,Nadiya,Larysa,Halyna,Valentyna,Olha,Yuliya,Kateryna,Anna,Vira,Lyubov,Hanna,Inna,Alla,Lesya,Natalya,Tatyana,Lyudmila,Galina,Svetlana,Oxana,Zhanna,Marta',
    'Yuliya,Kateryna,Anastasiya,Oksana,Olena,Iryna,Tetiana,Nataliya,Khrystyna,Viktoriya,Yana,Alina,Mariya,Anna,Daryna,Sofiya,Solomiya,Diana,Veronika,Inna,Marta,Olha,Svitlana,Halyna,Lesya,Ruth,Esther,Nadia,Lilia,Irina',
    'Sofiya,Anna,Solomiya,Zlata,Mariya,Anastasiya,Viktoriya,Veronika,Daryna,Uliana,Vasylyna,Myroslava,Bohdana,Yaroslava,Oleksandra,Diana,Kateryna,Polina,Eva,Milana,Ruth,Esther,Hannah,Sarah,Abigail,Leah,Naomi,Elizabeth,Emily,Nadia',
  ],
};

// Poland (written without diacritics, as Polish Californians usually write them).
GIVEN.polish = {
  M: [
    'Jan,Stanislaw,Jozef,Tadeusz,Jerzy,Zbigniew,Henryk,Kazimierz,Ryszard,Andrzej,Wladyslaw,Edward,Zdzislaw,Czeslaw,Marian,Mieczyslaw,Boleslaw,Bogdan,Janusz,Leszek,Wojciech,Franciszek,Antoni,Jacek,Roman,Waclaw,Witold,Eugeniusz,Lech,Romuald',
    'Andrzej,Krzysztof,Marek,Piotr,Tomasz,Pawel,Jacek,Grzegorz,Dariusz,Mariusz,Slawomir,Janusz,Robert,Jaroslaw,Zbigniew,Wojciech,Artur,Waldemar,Miroslaw,Leszek,Rafal,Adam,Marcin,Jerzy,Michal,Jan,Ryszard,Wieslaw,Cezary,Tadeusz',
    'Tomasz,Pawel,Michal,Marcin,Lukasz,Piotr,Krzysztof,Grzegorz,Jakub,Mateusz,Adam,Kamil,Dawid,Bartosz,Rafal,Maciej,Damian,Daniel,Sebastian,Przemyslaw,Wojciech,Szymon,Patryk,Karol,Mariusz,Robert,Marek,Arkadiusz,Konrad,Adrian',
    'Jakub,Kacper,Szymon,Filip,Jan,Antoni,Franciszek,Mikolaj,Aleksander,Wiktor,Igor,Oskar,Mateusz,Michal,Adam,Bartosz,Piotr,Dawid,Kamil,Maksymilian,Tymon,Stanislaw,Ignacy,Leon,Nikodem,Julian,Hubert,Wojciech,Krzysztof,Tomasz',
  ],
  F: [
    'Maria,Krystyna,Anna,Barbara,Teresa,Elzbieta,Janina,Zofia,Jadwiga,Danuta,Halina,Irena,Helena,Stanislawa,Wanda,Genowefa,Kazimiera,Bronislawa,Czeslawa,Leokadia,Henryka,Alicja,Marianna,Jozefa,Aniela,Wladyslawa,Regina,Lucyna,Bogumila,Feliksa',
    'Ewa,Malgorzata,Elzbieta,Grazyna,Bozena,Jolanta,Agnieszka,Katarzyna,Joanna,Beata,Dorota,Iwona,Renata,Anna,Barbara,Teresa,Danuta,Mariola,Wioletta,Aneta,Izabela,Marzena,Monika,Agata,Magdalena,Krystyna,Bogumila,Halina,Urszula,Hanna',
    'Katarzyna,Agnieszka,Anna,Magdalena,Joanna,Monika,Aleksandra,Justyna,Natalia,Karolina,Paulina,Marta,Ewelina,Agata,Dominika,Sylwia,Kamila,Patrycja,Malgorzata,Martyna,Weronika,Izabela,Emilia,Klaudia,Kinga,Beata,Dorota,Ewa,Alicja,Julia',
    'Zuzanna,Julia,Maja,Lena,Hanna,Zofia,Amelia,Alicja,Oliwia,Wiktoria,Natalia,Aleksandra,Laura,Pola,Nikola,Maria,Emilia,Antonina,Gabriela,Helena,Liliana,Martyna,Nadia,Kornelia,Weronika,Michalina,Jagoda,Iga,Anna,Lucja',
  ],
};

// Greece (Greek Orthodox families: names honor grandparents, so the old names stay common).
GIVEN.greek = {
  M: [
    'Georgios,Ioannis,Konstantinos,Dimitrios,Nikolaos,Panagiotis,Vasileios,Christos,Athanasios,Evangelos,Spyridon,Michail,Petros,Antonios,Stavros,Theodoros,Charalampos,Apostolos,Ilias,Emmanouil,Stylianos,Anastasios,Sotirios,Andreas,Pavlos,Kyriakos,Nektarios,Gerasimos,Stefanos,Efstathios,Fotios,Haralambos,Aristotelis,Leonidas,Periklis,Sarantis,Lampros,Zisis,Christoforos,Diamantis',
    'Georgios,Ioannis,Konstantinos,Dimitrios,Nikolaos,Panagiotis,Vasileios,Christos,Athanasios,Evangelos,Michail,Spyridon,Theodoros,Antonios,Stavros,Petros,Ilias,Charalampos,Apostolos,Emmanouil,Anastasios,Alexandros,Andreas,Stylianos,Kyriakos,Sotirios,Pavlos,Stefanos,Thomas,Grigorios',
    'Georgios,Dimitrios,Konstantinos,Ioannis,Nikolaos,Panagiotis,Christos,Vasileios,Athanasios,Alexandros,Michail,Evangelos,Spyridon,Theodoros,Antonios,Stavros,Emmanouil,Ilias,Charalampos,Apostolos,Stylianos,Andreas,Petros,Anastasios,Kyriakos,Pavlos,Stefanos,Marios,Angelos,Thomas,Aristeidis,Lefteris,Iason,Prodromos,Sarantis',
    'Georgios,Konstantinos,Dimitrios,Ioannis,Nikolaos,Alexandros,Panagiotis,Christos,Vasileios,Athanasios,Michail,Evangelos,Spyridon,Angelos,Stefanos,Theodoros,Emmanouil,Ilias,Marios,Petros,Antonios,Stavros,Andreas,Pavlos,Orestis,Aris,Lefteris,Rafail,Filippos,Odysseas,Iason,Aristeidis,Prodromos,Christoforos,Zisis,Viktor',
  ],
  F: [
    'Maria,Eleni,Aikaterini,Vasiliki,Georgia,Sofia,Anastasia,Dimitra,Ioanna,Konstantina,Panagiota,Paraskevi,Evangelia,Christina,Athanasia,Kyriaki,Theodora,Angeliki,Chrysoula,Eirini,Despoina,Stavroula,Fotini,Alexandra,Antonia,Kalliopi,Efthymia,Stamatia,Theodosia,Penelope,Argyro,Glykeria,Sevasti,Olympia,Eleftheria',
    'Maria,Eleni,Aikaterini,Vasiliki,Georgia,Sofia,Anastasia,Dimitra,Ioanna,Konstantina,Panagiota,Paraskevi,Evangelia,Christina,Athanasia,Kyriaki,Theodora,Angeliki,Eirini,Despoina,Stavroula,Fotini,Alexandra,Chrysoula,Stella,Anna,Nikoletta,Zoi,Olga,Argyro',
    'Maria,Eleni,Aikaterini,Georgia,Sofia,Vasiliki,Konstantina,Ioanna,Dimitra,Christina,Anastasia,Despoina,Evangelia,Panagiota,Paraskevi,Eirini,Angeliki,Theodora,Athina,Kyriaki,Alexandra,Stavroula,Chrysa,Anna,Nikoletta,Marina,Ioulia,Elisavet,Danai,Iliana',
    'Maria,Eleni,Georgia,Sofia,Konstantina,Ioanna,Aikaterini,Dimitra,Vasiliki,Anastasia,Christina,Despoina,Athina,Evangelia,Eirini,Zoi,Myrto,Danai,Iliana,Marina,Natalia,Panagiota,Theodora,Angeliki,Alexandra,Ariadni,Melina,Faidra,Elpida,Chara,Eleftheria,Olympia,Kalliopi,Artemis,Afroditi',
  ],
  us: {
    M: [
      'George,John,Nick,Peter,Gus,Chris,James,Steve,Tom,Michael,Paul,Andrew,Harry,Ted,William,Angelo,Demetrios,Constantine,Spiro,Louis',
      'George,John,Nick,Peter,Chris,James,Steve,Michael,Paul,Andrew,Alex,Dean,Gregory,Theodore,Anthony,Demetri,Costa,Angelo,Stephen,Mark',
      'Nicholas,George,John,Peter,Christopher,Alexander,Andrew,Michael,Dean,Gregory,Anthony,Theodore,Demetri,Costa,Stephen,Paul,Steven,Alex,Constantine,Elias',
      'Nicholas,Alexander,George,John,Constantine,Theodore,Peter,Christopher,Andrew,Leo,Dimitri,Elias,Michael,Gabriel,Lucas,Jason,Nico,Anthony,Stavros,Alexios',
    ],
    F: [
      'Mary,Helen,Katherine,Georgia,Sophia,Anna,Stella,Angela,Christine,Despina,Bessie,Pauline,Irene,Theodora,Evangeline,Penelope,Frances,Elaine,Toula,Vasiliki',
      'Maria,Helen,Katherine,Georgia,Christina,Anna,Stella,Angela,Irene,Elaine,Diane,Theresa,Joanna,Alexandra,Despina,Pauline,Sophia,Eleni,Dena,Kathy',
      'Christina,Alexandra,Katherine,Maria,Elena,Georgia,Sophia,Anastasia,Nicole,Stephanie,Angela,Theodora,Irene,Eleni,Despina,Athena,Diana,Joanna,Stella,Vanessa',
      'Sophia,Eleni,Alexandra,Anastasia,Georgia,Katerina,Christina,Maria,Athena,Theodora,Zoe,Elena,Stella,Olivia,Ariadne,Penelope,Isabella,Irene,Calliope,Nia',
    ],
  },
};

// ------------------------------------------------------------------ given names: Western Europe
// Most Californians of European ancestry are third generation or more and draw from the general pool; these
// are the names of those born in Europe, and the heritage names their American families kept.
GIVEN.irish = {
  M: [
    'John,Patrick,Michael,James,Thomas,Joseph,Sean,Martin,Brendan,Liam,Noel,Kevin,Gerard,Francis,Peter,Daniel,Denis,Kieran,Eamon,Declan,Brian,Hugh,Colm,Seamus,Padraig,Dermot,Donal,Cornelius,Timothy,Desmond,Fergus,Cathal',
    'John,Michael,Patrick,Paul,David,Sean,Brian,Declan,Kevin,Martin,Thomas,Gerard,Peter,Joseph,Anthony,Noel,Brendan,Ciaran,Fergal,Niall,Colm,Conor,Damien,Kieran,Alan,Mark,Barry,Dermot,Shane,Eamonn',
    'David,Michael,John,Mark,Stephen,Paul,Patrick,Sean,Daniel,Kevin,Thomas,Brian,Conor,Ciaran,Shane,Niall,Darren,Barry,Colm,Eoin,Ronan,Cian,Darragh,Gavin,Keith,Declan,Aidan,Rory,Dylan,Cillian',
    'Jack,Sean,Conor,James,Adam,Daniel,Cian,Darragh,Oisin,Fionn,Luke,Ryan,Dylan,Aaron,Eoin,Ronan,Rory,Cillian,Michael,Thomas,Callum,Evan,Liam,Oscar,Tadhg,Senan,Ruairi,Patrick,Finn,Charlie',
  ],
  F: [
    'Mary,Margaret,Bridget,Kathleen,Catherine,Anne,Patricia,Eileen,Teresa,Josephine,Maureen,Sheila,Noreen,Joan,Elizabeth,Rose,Nora,Ellen,Deirdre,Bernadette,Philomena,Agnes,Helen,Monica,Frances,Geraldine,Carmel,Nuala,Una,Brigid',
    'Mary,Catherine,Margaret,Anne,Siobhan,Deirdre,Bernadette,Patricia,Elizabeth,Geraldine,Fiona,Sinead,Niamh,Aine,Orla,Clare,Grainne,Yvonne,Sharon,Karen,Caroline,Jacqueline,Louise,Martina,Michelle,Susan,Paula,Breda,Eimear,Aisling',
    'Sarah,Aoife,Ciara,Niamh,Emma,Laura,Rachel,Sinead,Aisling,Claire,Lisa,Louise,Roisin,Orla,Gillian,Grainne,Eimear,Siobhan,Caoimhe,Clodagh,Fiona,Michelle,Nicola,Sharon,Deirdre,Katie,Amy,Lorna,Edel,Maeve',
    'Emma,Sophie,Grace,Ava,Aoife,Ella,Chloe,Ciara,Niamh,Sarah,Lucy,Caoimhe,Saoirse,Roisin,Orla,Ellie,Hannah,Katie,Amelia,Mia,Kate,Molly,Ruby,Freya,Clodagh,Fiadh,Aisling,Eabha,Ailbhe,Siofra',
  ],
  us: {
    M: [
      'Patrick,John,James,Michael,Thomas,Joseph,Francis,Edward,William,Daniel,Dennis,Timothy,Kevin,Brian,Eugene,Raymond',
      'Patrick,Sean,Kevin,Brian,Michael,Timothy,Dennis,Daniel,Thomas,Kieran,Brendan,Francis,Shawn,Terence,Kelly,Ryan',
      'Ryan,Sean,Patrick,Kevin,Brian,Brendan,Connor,Kyle,Shane,Kieran,Declan,Aidan,Liam,Michael,Timothy,Dennis,Casey,Riley',
      'Liam,Aidan,Connor,Declan,Finn,Rory,Owen,Patrick,Sean,Brendan,Ryan,Kieran,Riley,Quinn,Callum,Desmond,Ronan,Cormac',
    ],
    F: [
      'Mary,Margaret,Kathleen,Eileen,Maureen,Bridget,Catherine,Anne,Rose,Helen,Nora,Ellen,Agnes,Frances,Patricia,Joan',
      'Kathleen,Colleen,Maureen,Eileen,Patricia,Mary,Margaret,Bridget,Kelly,Shannon,Erin,Kerry,Tara,Moira,Deirdre,Sheila',
      'Erin,Shannon,Kelly,Colleen,Megan,Caitlin,Kathleen,Bridget,Molly,Tara,Kerry,Siobhan,Kiera,Fiona,Maureen,Meghan,Kaitlyn,Brenna',
      'Nora,Maeve,Fiona,Molly,Riley,Quinn,Caitlin,Erin,Bridget,Kiera,Aisling,Siobhan,Sloane,Delaney,Reagan,Teagan,Keira,Clare',
    ],
  },
};

GIVEN.italian = {
  M: [
    'Giuseppe,Giovanni,Antonio,Mario,Francesco,Luigi,Angelo,Vincenzo,Pietro,Salvatore,Carlo,Domenico,Bruno,Paolo,Franco,Sergio,Giorgio,Aldo,Gino,Enzo,Carmine,Raffaele,Alfredo,Renato,Michele,Rocco,Gaetano,Nicola,Umberto,Dante',
    'Giuseppe,Giovanni,Antonio,Marco,Paolo,Francesco,Roberto,Stefano,Massimo,Andrea,Luca,Alessandro,Claudio,Maurizio,Fabio,Mauro,Riccardo,Davide,Daniele,Luigi,Salvatore,Vincenzo,Sergio,Alberto,Gianluca,Fabrizio,Enrico,Domenico,Carlo,Massimiliano',
    'Andrea,Marco,Alessandro,Luca,Matteo,Francesco,Davide,Simone,Federico,Lorenzo,Stefano,Daniele,Giuseppe,Antonio,Roberto,Fabio,Giovanni,Riccardo,Michele,Nicola,Emanuele,Paolo,Alberto,Valerio,Gabriele,Mattia,Tommaso,Pietro,Filippo,Giacomo',
    'Leonardo,Francesco,Alessandro,Lorenzo,Mattia,Andrea,Gabriele,Riccardo,Tommaso,Edoardo,Matteo,Giuseppe,Antonio,Federico,Diego,Davide,Giovanni,Pietro,Filippo,Samuele,Christian,Luca,Marco,Simone,Nicolo,Alessio,Emanuele,Giacomo,Elia,Michele,Gioele,Manuel,Enea,Jacopo,Achille,Ettore',
  ],
  F: [
    'Maria,Anna,Giuseppina,Rosa,Angela,Giovanna,Teresa,Lucia,Carmela,Francesca,Antonietta,Concetta,Caterina,Rosaria,Elena,Franca,Bruna,Luisa,Adriana,Gabriella,Marisa,Graziella,Silvana,Lina,Carla,Rita,Vittoria,Assunta,Filomena,Annunziata',
    'Maria,Anna,Paola,Laura,Patrizia,Daniela,Cristina,Roberta,Giovanna,Francesca,Barbara,Monica,Alessandra,Elena,Simona,Antonella,Rosa,Silvia,Manuela,Raffaella,Stefania,Lucia,Sabrina,Tiziana,Federica,Elisabetta,Emanuela,Loredana,Carla,Claudia',
    'Francesca,Chiara,Sara,Valentina,Giulia,Federica,Silvia,Elisa,Martina,Alessandra,Laura,Elena,Roberta,Anna,Maria,Marta,Serena,Ilaria,Valeria,Michela,Paola,Erica,Veronica,Giorgia,Claudia,Simona,Eleonora,Alice,Arianna,Beatrice',
    'Sofia,Giulia,Aurora,Alice,Ginevra,Emma,Giorgia,Beatrice,Greta,Martina,Chiara,Anna,Sara,Matilde,Gaia,Vittoria,Noemi,Francesca,Ludovica,Arianna,Camilla,Elisa,Nicole,Rebecca,Bianca,Viola,Elena,Mia,Adele,Marta',
  ],
  us: {
    M: [
      'Joseph,Anthony,Frank,Louis,Salvatore,Dominic,Vincent,Angelo,John,Peter,Carmine,Michael,Sam,Ralph,Albert,Mario',
      'Anthony,Joseph,Vincent,Dominic,Michael,Frank,Nicholas,Paul,Louis,Mark,Thomas,Steven,Richard,John,Robert,Carl,Gino,Victor',
      'Anthony,Nicholas,Joseph,Vincent,Dominic,Michael,Matthew,Christopher,Marco,Frank,Paul,Daniel,Mark,Gino,Angelo,Luca,Mario,Steven',
      'Luca,Nicholas,Dominic,Anthony,Vincent,Leonardo,Marco,Gabriel,Matteo,Joseph,Lorenzo,Giovanni,Enzo,Gianni,Rocco,Michael,Mason,Santino',
    ],
    F: [
      'Mary,Rose,Josephine,Theresa,Angela,Anna,Lucy,Carmela,Antoinette,Frances,Margaret,Helen,Marie,Philomena,Jennie,Concetta',
      'Maria,Theresa,Angela,Rose,Lisa,Gina,Donna,Marie,Christina,Anna,Catherine,Diana,Joanne,Annette,Linda,Lucia,Paula,Rosemary',
      'Nicole,Christina,Gina,Maria,Angela,Lisa,Francesca,Jennifer,Theresa,Danielle,Michelle,Lauren,Gianna,Alexandra,Victoria,Andrea,Elena,Bianca',
      'Gianna,Isabella,Sophia,Francesca,Giuliana,Bella,Ava,Mia,Olivia,Lucia,Gabriella,Alessandra,Victoria,Arianna,Angelina,Elena,Valentina,Giada',
    ],
  },
};

GIVEN.german = {
  M: [
    'Hans,Karl,Heinz,Klaus,Peter,Wolfgang,Gerhard,Werner,Günter,Manfred,Dieter,Horst,Helmut,Jürgen,Walter,Kurt,Rolf,Bernd,Friedrich,Hermann,Otto,Ernst,Wilhelm,Rudolf,Erich,Siegfried,Reinhard,Herbert,Josef,Heinrich',
    'Thomas,Michael,Andreas,Stefan,Frank,Peter,Klaus,Jürgen,Uwe,Ralf,Jörg,Matthias,Martin,Thorsten,Markus,Holger,Christian,Bernd,Wolfgang,Dirk,Rainer,Carsten,Joachim,Olaf,Detlef,Sven,Oliver,Volker,Torsten,Harald',
    'Christian,Michael,Daniel,Tobias,Stefan,Sebastian,Alexander,Jan,Florian,Patrick,Dennis,Markus,Matthias,Philipp,Benjamin,Marcel,Kevin,Tim,Simon,Dominik,Felix,Thomas,Andreas,Martin,David,Lukas,Fabian,Julian,Moritz,Sven',
    'Lukas,Leon,Finn,Jonas,Paul,Ben,Luca,Felix,Noah,Elias,Maximilian,Luis,Tim,Julian,Niklas,Moritz,Jakob,Alexander,Philipp,David,Emil,Anton,Leo,Theo,Jan,Tom,Erik,Matteo,Oskar,Henry',
  ],
  F: [
    'Ursula,Helga,Gisela,Ingrid,Renate,Christa,Monika,Karin,Brigitte,Erika,Elisabeth,Margarete,Gertrud,Hildegard,Inge,Anneliese,Irmgard,Edith,Elfriede,Waltraud,Rosemarie,Marianne,Hannelore,Gudrun,Barbara,Gerda,Christel,Heidi,Lieselotte,Sigrid',
    'Sabine,Petra,Claudia,Andrea,Susanne,Birgit,Martina,Stefanie,Nicole,Anja,Kerstin,Katrin,Heike,Silke,Tanja,Sandra,Ute,Gabriele,Kirsten,Simone,Bettina,Christine,Manuela,Angelika,Cornelia,Iris,Daniela,Michaela,Dagmar,Karin',
    'Julia,Katharina,Sarah,Anna,Lisa,Laura,Christina,Jennifer,Sandra,Nadine,Stefanie,Melanie,Nicole,Jessica,Vanessa,Kathrin,Franziska,Johanna,Lena,Lea,Sophie,Theresa,Verena,Carina,Jana,Nina,Svenja,Janina,Miriam,Anja',
    'Mia,Emma,Hannah,Sofia,Lea,Lena,Emilia,Marie,Anna,Lina,Mila,Clara,Leonie,Johanna,Ella,Amelie,Charlotte,Luisa,Maja,Paula,Laura,Lara,Nele,Ida,Greta,Frieda,Mathilda,Lilly,Sophie,Lotta',
  ],
};

GIVEN.english = {
  M: [
    'John,David,Michael,Peter,Robert,Anthony,Brian,Alan,William,James,Richard,Kenneth,Roger,Keith,Colin,Christopher,Geoffrey,Graham,Derek,Malcolm,Barry,Terence,Trevor,Nigel,Stephen,Raymond,Dennis,Frederick,Leslie,Ronald',
    'David,Paul,Andrew,Mark,John,Michael,Stephen,Ian,Robert,Richard,Christopher,Peter,Simon,Gary,Neil,Martin,Kevin,Darren,Jonathan,Nicholas,Timothy,Philip,Lee,Anthony,Graham,Jason,Matthew,Nigel,Adrian,Russell',
    'Daniel,James,Thomas,Christopher,Matthew,David,Michael,Andrew,Adam,Luke,Benjamin,Jonathan,Oliver,Samuel,Ryan,Robert,Joshua,Alexander,Jack,Liam,Ashley,Jamie,Craig,Lewis,Sam,Tom,Joe,Callum,Nathan,Scott',
    'Oliver,Jack,Harry,George,Charlie,Thomas,James,William,Noah,Leo,Jacob,Oscar,Alfie,Freddie,Archie,Henry,Joshua,Max,Theo,Arthur,Ethan,Lucas,Isaac,Alexander,Samuel,Daniel,Joseph,Edward,Finley,Teddy',
  ],
  F: [
    'Margaret,Patricia,Susan,Christine,Elizabeth,Mary,Jean,Janet,Ann,Linda,Barbara,Pauline,Valerie,Sandra,Gillian,Carol,Sheila,Maureen,Brenda,Jennifer,Joan,Dorothy,Kathleen,Shirley,Irene,Joyce,Marion,Jacqueline,Sylvia,Doreen',
    'Susan,Julie,Karen,Sarah,Amanda,Deborah,Alison,Nicola,Helen,Joanne,Elizabeth,Claire,Tracey,Jacqueline,Lisa,Catherine,Jane,Michelle,Caroline,Angela,Wendy,Dawn,Sharon,Mandy,Kim,Joanna,Louise,Samantha,Rachel,Emma',
    'Sarah,Emma,Laura,Rebecca,Claire,Gemma,Charlotte,Hannah,Amy,Jessica,Lauren,Nicola,Kelly,Rachel,Victoria,Natalie,Katie,Sophie,Lucy,Stacey,Jennifer,Danielle,Hayley,Zoe,Kirsty,Joanne,Holly,Amanda,Emily,Stephanie',
    'Olivia,Amelia,Isla,Ava,Emily,Sophia,Grace,Mia,Poppy,Ella,Lily,Isabella,Evie,Charlotte,Jessica,Sophie,Freya,Daisy,Ruby,Florence,Alice,Phoebe,Matilda,Isabelle,Chloe,Millie,Rosie,Sienna,Holly,Harriet',
  ],
};

GIVEN['scottish-own'] = {
  base: {
    M: 'Angus,Alasdair,Hamish,Callum,Fraser,Ewan,Ross,Lachlan,Duncan,Fergus,Malcolm,Iain,Euan,Gordon,Craig,Alistair,Murray,Douglas,Stuart,Graeme,Kenneth,Kyle,Struan,Rory,Finlay,Andrew,Gregor,Archie,Ruaridh,Niall',
    F: 'Ailsa,Morag,Isla,Kirsty,Fiona,Eilidh,Catriona,Mhairi,Iona,Shona,Rhona,Elspeth,Heather,Moira,Isobel,Morven,Ishbel,Lorna,Skye,Freya,Rowan,Esme,Flora,Margaret,Jean,Agnes,Janet,Marion,Kirsteen,Euphemia',
  },
};
GIVEN.scottish = { mix: [['scottish-own', [0.45, 0.45, 0.45, 0.45]], ['english', [0.55, 0.55, 0.55, 0.55]]] };

GIVEN.french = {
  M: [
    'Jean,Pierre,Michel,André,Jacques,Bernard,Claude,Gérard,René,Robert,Daniel,Roger,Marcel,Henri,Louis,Paul,Guy,Alain,Georges,Maurice,Yves,Raymond,Christian,Jean-Pierre,Jean-Claude,Jean-Paul,Lucien,Gilbert,Serge,Marc',
    'Philippe,Christophe,Pascal,Patrick,Thierry,Laurent,Éric,Frédéric,Stéphane,Olivier,Didier,Bruno,Nicolas,Jean-Marc,Dominique,François,Sébastien,Vincent,Emmanuel,Fabrice,Franck,Hervé,Jérôme,Marc,Gilles,Denis,Alain,Pierre,Lionel,Thomas',
    'Nicolas,Julien,Sébastien,Thomas,Guillaume,Maxime,Alexandre,Romain,Mathieu,Antoine,Kevin,Jérémy,Anthony,Florian,Benjamin,Pierre,Adrien,Vincent,Clément,Jonathan,Damien,Cédric,Ludovic,Arnaud,Mickaël,Yann,Quentin,Hugo,Lucas,Louis',
    'Lucas,Hugo,Louis,Gabriel,Arthur,Jules,Nathan,Raphaël,Léo,Adam,Ethan,Tom,Paul,Théo,Mathis,Noah,Enzo,Maël,Liam,Sacha,Victor,Clément,Antoine,Baptiste,Maxime,Thomas,Axel,Timéo,Nolan,Martin',
  ],
  F: [
    'Marie,Jeanne,Monique,Françoise,Nicole,Jacqueline,Catherine,Christiane,Annie,Michèle,Danielle,Simone,Suzanne,Denise,Madeleine,Colette,Yvette,Odette,Germaine,Paulette,Hélène,Geneviève,Jeannine,Josette,Claudine,Brigitte,Marguerite,Anne-Marie,Huguette,Renée',
    'Isabelle,Sylvie,Nathalie,Catherine,Christine,Véronique,Valérie,Sandrine,Patricia,Martine,Brigitte,Corinne,Pascale,Florence,Laurence,Dominique,Anne,Sophie,Carole,Céline,Muriel,Karine,Stéphanie,Virginie,Hélène,Nadine,Agnès,Béatrice,Chantal,Claire',
    'Julie,Aurélie,Émilie,Céline,Stéphanie,Caroline,Marie,Laura,Élodie,Audrey,Sophie,Camille,Pauline,Mélanie,Sarah,Charlotte,Claire,Anaïs,Marion,Amandine,Virginie,Delphine,Laetitia,Jennifer,Manon,Lucie,Mathilde,Clémence,Justine,Chloé',
    'Emma,Jade,Louise,Alice,Chloé,Lina,Léa,Rose,Anna,Mila,Inès,Ambre,Julia,Mia,Léna,Manon,Juliette,Lou,Zoé,Camille,Agathe,Lola,Eva,Romane,Sarah,Charlotte,Margaux,Clara,Jeanne,Louna',
  ],
};

// Portugal, above all the Azores: the dairy and farming families of the Central Valley and the coast.
GIVEN.portuguese = {
  M: [
    'José,Manuel,António,João,Francisco,Joaquim,Fernando,Luís,Carlos,Jorge,Alfredo,Albano,Armando,Agostinho,Mário,Américo,Artur,Augusto,Domingos,Ernesto,Hélio,Henrique,Jaime,Júlio,Leonel,Mateus,Orlando,Raul,Serafim,Vitorino',
    'José,Manuel,António,João,Paulo,Carlos,Luís,Jorge,Fernando,Rui,Nuno,Pedro,Francisco,Mário,Sérgio,Ricardo,Joaquim,Vítor,Filipe,Miguel,Alberto,Eduardo,Hélder,Fausto,Duarte,Gilberto,Norberto,Marco,Fernão,Délio',
    'João,Pedro,Tiago,Nuno,Ricardo,Rui,Bruno,Hugo,Miguel,Paulo,André,Diogo,Luís,Marco,Daniel,Filipe,Sérgio,Carlos,Gonçalo,Vasco,Rafael,Fábio,Jorge,José,Duarte,Fernando,Hélio,Manuel,António,Francisco',
    'Francisco,Santiago,João,Rodrigo,Martim,Tomás,Afonso,Duarte,Lourenço,Gonçalo,Guilherme,Miguel,Gabriel,Salvador,Pedro,Tiago,Diogo,Rafael,Vicente,Simão,Lucas,Dinis,Henrique,Gustavo,Leonardo,Manuel,Bernardo,David,Mateus,Vasco',
  ],
  F: [
    'Maria,Ana,Conceição,Fátima,Rosa,Manuela,Lurdes,Glória,Teresa,Isabel,Fernanda,Natália,Filomena,Graça,Margarida,Alzira,Albertina,Aurora,Celeste,Deolinda,Emília,Ermelinda,Gracinda,Helena,Laura,Lucinda,Olívia,Rosalina,Zulmira,Hermínia',
    'Maria,Ana,Paula,Sandra,Sónia,Cristina,Susana,Isabel,Fátima,Teresa,Manuela,Fernanda,Helena,Lúcia,Carla,Elisabete,Graça,Rosa,Natália,Célia,Margarida,Anabela,Lurdes,Conceição,Alexandra,Cláudia,Rita,Patrícia,Luísa,Dulce',
    'Ana,Joana,Sara,Catarina,Inês,Marta,Rita,Patrícia,Andreia,Vanessa,Daniela,Diana,Filipa,Mariana,Sofia,Cláudia,Carla,Raquel,Liliana,Tânia,Sílvia,Sónia,Cátia,Susana,Mónica,Bruna,Ângela,Juliana,Bárbara,Beatriz',
    'Maria,Leonor,Matilde,Beatriz,Carolina,Mariana,Ana,Inês,Margarida,Sofia,Francisca,Benedita,Alice,Lara,Laura,Constança,Clara,Madalena,Luana,Joana,Rita,Diana,Camila,Íris,Eva,Mafalda,Vitória,Gabriela,Lia,Letícia',
  ],
  us: {
    M: [
      'Manuel,Joe,Tony,Frank,John,Joseph,Anthony,Louis,Antone,Manny,Jack,Alfred,Lawrence,Ernest,Arthur,Albert',
      'Tony,Joe,Frank,Manuel,John,Joseph,Anthony,Mike,Steve,David,Richard,Ronald,Gary,Dennis,Daniel,Robert,Paul,Mark',
      'Anthony,Joseph,Jason,Ryan,Matthew,David,Daniel,Michael,John,Steven,Justin,Eric,Jeremy,Joshua,Nicholas,Brian,Manuel,Frank',
      'Mateo,Lucas,Gabriel,Anthony,Joseph,Daniel,Nathan,Logan,Ethan,Ryan,Tyler,Andrew,Noah,Joao,Rafael,Tiago,Diego,Leo',
    ],
    F: [
      'Mary,Rose,Maria,Isabel,Alice,Evelyn,Dolores,Lucille,Virginia,Florence,Mabel,Olive,Laura,Helen,Bernice,Emily',
      'Mary,Linda,Diane,Maria,Lisa,Debra,Patricia,Susan,Karen,Cindy,Christina,Teresa,Sandra,Pamela,Donna,Annette,Paula,Rosemary',
      'Christina,Ana,Michelle,Nicole,Jessica,Natalie,Amanda,Melissa,Jennifer,Sarah,Stephanie,Vanessa,Alexandra,Andrea,Danielle,Monica,Kristina,Maria',
      'Sofia,Isabella,Gabriela,Mariana,Alexandra,Olivia,Ava,Emma,Victoria,Natalie,Leah,Chloe,Bianca,Ariana,Elena,Lara,Ines,Clara',
    ],
  },
};

// The Netherlands (the Dutch dairy families of Chino, Artesia and the Central Valley).
GIVEN.dutch = {
  M: [
    'Jan,Johannes,Cornelis,Hendrik,Willem,Gerrit,Pieter,Jacobus,Dirk,Klaas,Adrianus,Hendrikus,Theodorus,Gerardus,Wilhelmus,Petrus,Jacob,Hans,Henk,Kees,Wim,Gert,Arie,Bert,Ton,Frans,Joop,Piet,Teun,Sjoerd',
    'Peter,Jan,Hans,Johan,Marco,Erik,Paul,Rob,Frank,Martin,Mark,Ronald,Rene,Michel,Edwin,Richard,Patrick,Dennis,Jeroen,Arjan,Marcel,Gerard,Robert,Bas,Wouter,Maarten,Bart,Sander,Ruud,Remco',
    'Thomas,Tim,Mark,Kevin,Jeroen,Dennis,Michael,Stefan,Bas,Niels,Rick,Bart,Sander,Joost,Martijn,Ruben,Daan,Thijs,Wouter,Maarten,Jasper,Koen,Lars,Robin,Tom,Jesse,Sven,Bram,Stijn,Pieter',
    'Daan,Sem,Lucas,Levi,Finn,Milan,Luuk,Bram,Jesse,Thomas,Noah,Liam,Sam,Lars,Thijs,Ruben,Max,Stijn,Julian,Gijs,Teun,Jayden,Tim,Mees,Siem,Hugo,Jens,Floris,Sven,Jasper',
  ],
  F: [
    'Maria,Johanna,Cornelia,Anna,Elisabeth,Hendrika,Wilhelmina,Geertruida,Adriana,Catharina,Jacoba,Petronella,Aaltje,Grietje,Trijntje,Neeltje,Annie,Riet,Ria,Truus,Joke,Tineke,Gerda,Ineke,Corrie,Bep,Mien,Dineke,Willemijn,Marijke',
    'Monique,Petra,Marjolein,Ingrid,Anja,Sandra,Esther,Linda,Marieke,Mirjam,Annemieke,Wendy,Claudia,Saskia,Ellen,Karin,Patricia,Yvonne,Marja,Astrid,Jolanda,Anita,Brigitte,Hanneke,Ilse,Margriet,Nicole,Sylvia,Jacqueline,Marloes',
    'Anne,Lisa,Laura,Linda,Kim,Sanne,Esther,Marieke,Femke,Iris,Ilse,Eva,Lotte,Maaike,Anouk,Mirjam,Sarah,Charlotte,Nina,Fleur,Floor,Lieke,Roos,Inge,Manon,Joyce,Melissa,Kelly,Danielle,Bianca',
    'Emma,Julia,Tess,Sophie,Zoë,Mila,Sara,Anna,Eva,Noor,Evi,Lotte,Lisa,Fenna,Saar,Nora,Liv,Yara,Isa,Fleur,Femke,Roos,Lieke,Sanne,Lynn,Maud,Elin,Nina,Jasmijn,Lauren',
  ],
};

// Sweden, Norway and Denmark (written without the special letters, as US records usually write them).
GIVEN.scandinavian = {
  M: [
    'Lars,Anders,Nils,Per,Erik,Karl,Olof,Sven,Johan,Gunnar,Bengt,Goran,Leif,Kjell,Bjorn,Ole,Arne,Knut,Jens,Hans,Soren,Poul,Niels,Torben,Henrik,Rolf,Lennart,Ingvar,Stig,Einar',
    'Lars,Anders,Per,Erik,Mikael,Johan,Peter,Thomas,Jan,Henrik,Magnus,Mats,Stefan,Fredrik,Jens,Morten,Bjorn,Ole,Rune,Tor,Svein,Kim,Niels,Soren,Jesper,Torben,Martin,Tommy,Patrik,Ulf',
    'Erik,Johan,Andreas,Daniel,Fredrik,Marcus,Martin,Mattias,Jonas,Christian,Kristian,Thomas,Mikkel,Rasmus,Anders,Henrik,Magnus,Simon,Emil,Mads,Kasper,Jesper,Niklas,Oskar,Viktor,Sindre,Even,Eirik,Joakim,Petter',
    'William,Lucas,Oscar,Liam,Elias,Noah,Hugo,Oliver,Alexander,Emil,Theo,Filip,Isak,Jakob,Magnus,Mathias,Aksel,Henrik,Sander,Olav,Viktor,Leo,Felix,Malte,Carl,Alfred,Frederik,Anton,Ludvig,August',
  ],
  F: [
    'Kerstin,Birgitta,Ingrid,Karin,Margareta,Eva,Anna,Kristina,Elisabeth,Marianne,Inger,Gunilla,Ulla,Britt,Solveig,Astrid,Liv,Randi,Kari,Bente,Grete,Hanne,Kirsten,Lene,Inge,Mette,Birthe,Jytte,Gerd,Sigrid',
    'Anna,Maria,Annika,Helena,Susanne,Camilla,Malin,Sofia,Lena,Anette,Karin,Mette,Lene,Hanne,Pia,Tina,Charlotte,Trine,Heidi,Marit,Hege,Kristin,Siri,Ingrid,Ann,Helle,Linda,Eva,Jenny,Therese',
    'Emma,Sara,Hanna,Ida,Julia,Linnea,Elin,Johanna,Matilda,Amanda,Maja,Sofie,Camilla,Line,Maria,Kristine,Ingrid,Silje,Marte,Thea,Nora,Malin,Frida,Josefin,Louise,Mette,Cecilie,Karoline,Stine,Ane',
    'Alice,Maja,Elsa,Astrid,Wilma,Freja,Ella,Olivia,Ebba,Saga,Alma,Agnes,Nora,Emma,Sofia,Ingrid,Sofie,Ida,Clara,Frida,Selma,Ellen,Iben,Karla,Liva,Thea,Aurora,Linnea,Vera,Signe',
  ],
};

// Other European origins (Hungary, the Czech Republic, Romania, the former Yugoslavia, Bulgaria, the Baltics).
GIVEN['europe-other'] = {
  base: {
    M: 'Laszlo,Istvan,Zoltan,Tamas,Gabor,Attila,Janos,Ferenc,Pavel,Jiri,Tomas,Petr,Ion,Mihai,Florin,Andrei,Dragan,Milan,Goran,Zoran,Dejan,Marko,Luka,Stefan,Nikola,Dimitar,Georgi,Jonas,Mindaugas,Andris,Janis,Matej,Ales,Miroslav,Vladimir,Bogdan,Radu,Vasile,Ivan,Josip',
    F: 'Zsuzsanna,Katalin,Eva,Ildiko,Erzsebet,Agnes,Jana,Petra,Lucie,Tereza,Elena,Ioana,Mihaela,Andreea,Gabriela,Milica,Jelena,Ivana,Ana,Marija,Snezana,Dragana,Maja,Nina,Vesna,Rasa,Ieva,Inga,Liga,Kristina,Daniela,Simona,Monika,Lenka,Martina,Mirela,Adriana,Diana,Irina,Radka',
  },
};
GIVEN.european = {
  mix: [
    ['europe-other', [0.3, 0.3, 0.3, 0.3]], ['german', [0.14, 0.14, 0.14, 0.14]], ['italian', [0.1, 0.1, 0.1, 0.1]], ['english', [0.1, 0.1, 0.1, 0.1]],
    ['french', [0.08, 0.08, 0.08, 0.08]], ['polish', [0.08, 0.08, 0.08, 0.08]], ['dutch', [0.05, 0.05, 0.05, 0.05]], ['scandinavian', [0.05, 0.05, 0.05, 0.05]],
    ['greek', [0.05, 0.05, 0.05, 0.05]], ['portuguese', [0.05, 0.05, 0.05, 0.05]],
  ],
};

// ------------------------------------------------------------------ given names: Pacific Islanders
// Tongan and Samoan forms of Biblical and English names (Sione, Viliami, Iosefa, Mele, Salote), Hawaiian
// names, and Chamorro families' Spanish names.
GIVEN.pacific = {
  M: [
    'Sione,Tevita,Viliami,Siaosi,Semisi,Tomasi,Ioane,Iosefa,Pita,Lisiate,Mosese,Paulo,Falaniko,Malakai,Isileli,Keoni,Kawika,Kimo,Makana,Kalani,Joseph,John,Peter,Samuel,Henry,Vicente,Juan,Jose,Francisco,Ignacio,Jesus,Pedro',
    'Sione,Tevita,Viliami,Siaosi,Semisi,Iosefa,Ioane,Pita,Paulo,Mosese,Malakai,Isileli,Tomasi,Lisiate,Taniela,Keoni,Kawika,Kimo,Kalani,Kekoa,Makoa,Kainoa,Michael,David,Joseph,Daniel,John,Vincent,Jesse,Frank,Juan,Jesus',
    'Sione,Tevita,Viliami,Siaosi,Iosefa,Taniela,Malakai,Kekoa,Kainoa,Ikaika,Koa,Keanu,Kai,Makoa,Kalani,Nainoa,Kawika,Keoni,Michael,Joshua,Daniel,David,Isaiah,Jordan,Christopher,Anthony,Jacob,Joseph,Lopeti,Samuela',
    'Kai,Koa,Kekoa,Kainoa,Makoa,Ikaika,Nalu,Keanu,Kanoa,Isaia,Sione,Tevita,Viliami,Siaosi,Iosefa,Taniela,Malakai,Elijah,Isaiah,Josiah,Joshua,Noah,Jayden,Zion,Micah,Ezekiel,Elisha,Samuela,Lopeti,Kahiau',
  ],
  F: [
    'Mele,Salote,Losaline,Ana,Lose,Sela,Seini,Ofa,Malia,Lavinia,Fetu,Sina,Leilani,Noelani,Pualani,Iolana,Kanoe,Keala,Mary,Rosa,Maria,Josefina,Carmen,Dolores,Teresa,Lupe,Amelia,Ruta,Losana,Akanesi',
    'Mele,Salote,Losaline,Ana,Lose,Sela,Seini,Ofa,Malia,Lavinia,Sina,Leilani,Noelani,Kanoe,Keala,Pualani,Kehaulani,Lani,Moana,Teuila,Mary,Elizabeth,Christina,Michelle,Lisa,Angela,Tina,Linda,Losana,Vika',
    'Leilani,Kailani,Noelani,Kehaulani,Malia,Mele,Ana,Lose,Sela,Seini,Ofa,Lavinia,Salote,Losaline,Teuila,Moana,Alana,Keala,Kanoe,Makana,Kiana,Iolana,Kalena,Tiare,Sina,Vailea,Jessica,Ashley,Crystal,Brittany',
    'Leilani,Kailani,Moana,Kalea,Malia,Mele,Kiana,Alana,Keala,Nalani,Makana,Kehaulani,Iolana,Kaimana,Noelani,Tiare,Teuila,Sela,Salote,Lavinia,Ana,Lose,Seini,Ofa,Aaliyah,Isabella,Faith,Grace,Taliah,Aria,Mahina,Nohea,Kanani,Losana,Mana',
  ],
};

// ------------------------------------------------------------------ surnames: Hispanic
// Ranked by frequency in each origin; written as California records write them, without accents but with ñ.
SURNAMES.mexican = 'Hernandez:5.6,Garcia:5.2,Martinez:4.4,Lopez:4.1,Gonzalez:3.8,Rodriguez:3.4,Perez:2.7,Sanchez:2.6,Ramirez:2.5,Flores:1.9,Gomez:1.7,Torres:1.5,Diaz:1.3,Cruz:1.3,Reyes:1.25,Morales:1.2,Gutierrez:1.1,Vazquez:1.05,Jimenez:1,Ruiz:1,Mendoza:0.95,Aguilar:0.95,Ortiz:0.9,Castillo:0.85,Moreno:0.85,Romero:0.85,Alvarez:0.85,Chavez:0.85,Rivera:0.8,Juarez:0.8,Ramos,Dominguez,Herrera,Medina,Castro,Vargas,Guzman,Velazquez,Muñoz,Rojas,Contreras,Salazar,Luna,Ortega,Guerrero,Estrada,Bautista,Delgado,Soto,Cervantes,Rios,Valdez,Cortez,Sandoval,Pacheco,Avila,Ibarra,Zamora,Lara,Rangel,Espinoza,Carrillo,Ayala,Robles,Navarro,Acosta,Cardenas,Campos,Vega,Fuentes,Solis,Padilla,Maldonado,Cabrera,Villanueva,Trujillo,Barajas,Ochoa,Duran,Escobar,Ponce,Becerra,Zuniga,Esparza,Arellano,Villa,Montes,Miranda,Nuñez,Leon,Rosales,Valencia,Orozco,Magaña,Lozano,Saldaña,Hurtado,Galvan,Villegas,Huerta,Andrade,Arroyo,Cisneros';

SURNAMES.salvadoran = 'Hernandez:5,Martinez:3.8,Lopez:3.3,Garcia:3,Rodriguez:2.6,Flores:2.4,Ramirez:2.1,Rivera:2,Cruz:1.8,Reyes:1.6,Portillo:1.5,Romero:1.4,Alvarado:1.3,Ayala:1.2,Mejia:1.2,Argueta:1.1,Guevara:1.1,Orellana:1.05,Chavez:1,Escobar:1,Menjivar,Aguilar,Henriquez,Quintanilla,Amaya,Vasquez,Recinos,Bonilla,Granados,Fuentes,Serrano,Sorto,Ventura,Molina,Cortez,Melgar,Gomez,Perez,Gonzalez,Sanchez,Mendez,Castillo,Rosales,Lemus,Villalta,Aparicio,Cerna,Funes,Galdamez,Linares,Monterrosa,Palacios,Rauda,Saravia,Umaña,Velasquez,Zepeda,Campos,Mendoza,Rivas';

SURNAMES.guatemalan = 'Lopez:4.5,Garcia:3.6,Perez:3.4,Hernandez:2.8,Gonzalez:2.6,Rodriguez:2.2,Morales:2,Ramirez:1.7,Castillo:1.5,Mendez:1.4,Juarez:1.3,Gomez:1.3,Cruz:1.2,Vasquez:1.2,Ramos:1.1,Reyes:1.05,Ortiz:1,Chavez:1,Sanchez:1,Martinez:1,Barrios,Velasquez,Escobar,Orozco,Monroy,Cifuentes,Quiñonez,Tzul,Ixcoy,Choc,Coc,Xol,Caal,Tum,Ajanel,Batz,Tuy,Yax,Pop,Chun,Cux,Coj,Quej,Sic,Bol,Tecu,Pacheco,Ordoñez,Fuentes,Solis,Herrera,Marroquin,Alvarado,Estrada,Figueroa,Sandoval,Aguilar,Diaz,De Leon,Godinez,Bautista,Xicara';

SURNAMES.honduran = 'Hernandez:4.8,Lopez:3.6,Martinez:3.3,Rodriguez:3,Garcia:2.8,Flores:2.4,Reyes:2.1,Mejia:1.9,Castro:1.4,Zelaya:1.4,Cruz:1.3,Rivera:1.3,Rodas:1.1,Ramos:1.1,Aguilar:1.05,Pineda:1.05,Ordoñez:1,Banegas,Maradiaga,Paz,Velasquez,Matute,Bonilla,Sierra,Funez,Lagos,Euceda,Andino,Valladares,Turcios,Amador,Suazo,Zuniga,Calix,Discua,Mendoza,Sanchez,Gomez,Perez,Gonzalez,Ortiz,Murillo,Rosales,Padilla,Raudales,Midence,Fiallos,Moncada,Avila,Cerrato';

SURNAMES.nicaraguan = 'Lopez:4.2,Martinez:3.2,Gonzalez:3,Garcia:2.8,Hernandez:2.6,Rodriguez:2.4,Perez:2,Sanchez:1.8,Gutierrez:1.6,Rivera:1.4,Reyes:1.3,Mendoza:1.3,Espinoza:1.2,Castillo:1.2,Ruiz:1.1,Torres:1.05,Morales:1,Jarquin,Obando,Membreño,Arauz,Baltodano,Bermudez,Lacayo,Urbina,Zamora,Tellez,Mairena,Solorzano,Ubeda,Cuadra,Montiel,Marenco,Chavarria,Aguirre,Blandon,Cerda,Duarte,Gaitan,Guevara,Largaespada,Medrano,Moncada,Rocha,Vanegas,Zelaya,Silva,Alvarado,Mena,Picado';

SURNAMES.puertorican = 'Rivera:4.5,Rodriguez:3.6,Santiago:2.4,Colon:2.2,Torres:2.1,Ortiz:2,Ramos:1.8,Cruz:1.8,Diaz:1.6,Morales:1.6,Vazquez:1.5,Rosado:1.1,Pagan:1.1,Quiñones:1,Figueroa:1,Maldonado,Negron,Rosario,Ayala,Medina,Melendez,Burgos,Cintron,Soto,Acevedo,Feliciano,Irizarry,Baez,Nieves,Velazquez,Marrero,Santana,Lugo,Alicea,Padilla,Serrano,Vega,Matos,Concepcion,Roman,Perez,Gonzalez,Hernandez,Lopez,Martinez,Garcia,Sanchez,Reyes,Ruiz,Ocasio,Velez,Rios,Correa,Mercado';

SURNAMES.cuban = 'Rodriguez:4.2,Gonzalez:3.8,Hernandez:3.2,Perez:3,Garcia:3,Fernandez:2.2,Lopez:2.2,Diaz:2,Martinez:1.9,Sanchez:1.8,Alvarez:1.6,Suarez:1.3,Ruiz:1.2,Gomez:1.2,Castillo:1.1,Valdes:1.1,Cabrera:1,Morales,Rivero,Delgado,Herrera,Ramos,Acosta,Alonso,Iglesias,Betancourt,Castañeda,Fajardo,Llanes,Quintana,Pupo,Machado,Mesa,Padron,Fleitas,Rojas,Lorenzo,Sosa,Leyva,Peña,Hidalgo,Marrero,Varela,Ferrer,Guerra,Cardenas,Aguilera,Montero,Leon,Batista,Castro,Ortega,Figueredo,Arencibia';

SURNAMES.dominican = 'Rodriguez:3.8,Perez:3.2,Garcia:2.6,Martinez:2.4,Santana:2,Peña:1.8,Reyes:1.8,Jimenez:1.6,Cruz:1.6,Rosario:1.5,Ramirez:1.4,Polanco:1.2,Almonte:1.2,Tavarez:1.1,Batista:1.1,Feliz:1,De la Cruz:1,Espinal,Ventura,Mejia,Ureña,Paulino,Guzman,Nuñez,Vargas,Taveras,Abreu,Liriano,Baez,Encarnacion,Then,Rosa,Matos,Lantigua,De los Santos,Medina,Castillo,Familia,Mota,Brito,Gomez,Diaz,Hernandez,Sanchez,Gonzalez,Fernandez,Vasquez,Pichardo,Cabrera,Marte,Ozuna,Peralta';

SURNAMES.southamerican = 'Gonzalez:3.2,Rodriguez:3,Garcia:2.6,Lopez:2.4,Martinez:2.2,Perez:2,Gomez:1.9,Fernandez:1.8,Sanchez:1.7,Diaz:1.6,Torres:1.5,Ramirez:1.4,Flores:1.4,Rojas:1.3,Vargas:1.2,Castro:1.2,Mendoza:1.1,Gutierrez:1.1,Romero:1.05,Silva:1,Alvarez,Ruiz,Herrera,Medina,Moreno,Jimenez,Muñoz,Ortiz,Suarez,Quispe,Mamani,Chavez,Rivera,Salazar,Castillo,Cardenas,Ospina,Restrepo,Cardona,Giraldo,Arango,Valencia,Zapata,Osorio,Londoño,Benitez,Acosta,Sosa,Gimenez,Paredes,Espinoza,Villalobos,Aguirre,Delgado,Pacheco,Navarro,Vega,Cabrera,Cordova,Molina,Soto,Fuentes,Contreras,Araya,Morales,Rios,Correa,Sepulveda,Bustamante,Huaman,Condori,Tapia,Rossi,Bianchi';

SURNAMES.spanish = 'Garcia:3.2,Fernandez:2.6,Gonzalez:2.5,Rodriguez:2.4,Lopez:2.3,Martinez:2.2,Sanchez:2.1,Perez:2,Gomez:1.6,Martin:1.6,Jimenez:1.4,Ruiz:1.3,Hernandez:1.3,Diaz:1.2,Moreno:1.2,Muñoz:1.1,Alvarez:1.1,Romero:1,Alonso:1,Gutierrez,Navarro,Torres,Dominguez,Vazquez,Ramos,Gil,Ramirez,Serrano,Blanco,Molina,Morales,Suarez,Ortega,Delgado,Castro,Ortiz,Rubio,Marin,Sanz,Iglesias,Nuñez,Medina,Garrido,Cortes,Castillo,Santos,Lozano,Guerrero,Cano,Prieto,Mendez,Cruz,Calvo,Gallego,Vidal,Leon,Herrera,Marquez,Peña,Cabrera,Flores,Campos,Vega,Fuentes,Carrasco,Caballero,Nieto,Aguilar,Pascual,Herrero,Lorenzo,Montero,Hidalgo,Ibañez,Ferrer,Duran,Benitez,Mora,Arias,Carmona,Crespo,Pastor,Velasco,Soler,Parra,Bravo,Echeverria,Arteaga,Ugarte,Larrañaga,Lucero,Archuleta,Baca,Trujillo,Sandoval,Vigil,Gallegos,Montoya';

SURNAMES.latino = { mix: [['mexican', 0.6], ['salvadoran', 0.1], ['guatemalan', 0.08], ['southamerican', 0.1], ['puertorican', 0.05], ['spanish', 0.04], ['cuban', 0.03]] };

// ------------------------------------------------------------------ surnames: Asian
// Chinese surnames in the spelling each wave brought: Cantonese and Toishanese (Wong, Chan, Ng, Louie, Jue,
// Lum), mainland pinyin (Wang, Zhang, Liu, Chen) and Taiwan's (Chang, Hsu, Tsai, Hsieh, Kuo).
SURNAMES['chinese-yue'] = 'Wong:9,Chan:7,Lee:7,Lam:3.5,Ng:3.2,Leung:3,Cheung:2.8,Lau:2.6,Ho:2.5,Chow:2.2,Yee:2,Tam:2,Fong:1.8,Louie:1.5,Chin:1.5,Eng:1.4,Jung:1.2,Quan:1.2,Gee:1.1,Mah:1.1,Lum:1,Yuen,Tang,Kwan,Lo,Tsang,Kwok,Choi,Yip,Mak,Tse,Siu,Fung,Lai,Lui,Woo,Hui,Poon,Au,Szeto,Chiu,Chung,Low,Wan,Jue,Dong,Hom,Jew,Moy,Seid,Tom,Lowe,Kong,Toy,Wu,Ma';
SURNAMES['chinese-cmn'] = 'Wang:7,Li:7,Zhang:6.5,Liu:5.5,Chen:5.5,Yang:3.2,Huang:2.4,Zhao:2.3,Wu:2.1,Zhou:2,Xu:1.6,Sun:1.5,Ma:1.4,Zhu:1.3,Hu:1.3,Guo:1.2,He:1.2,Lin:1.2,Gao:1.1,Luo:1.1,Zheng:1,Liang,Xie,Song,Tang,Han,Feng,Deng,Cao,Peng,Zeng,Xiao,Tian,Dong,Pan,Yuan,Cai,Jiang,Yu,Du,Ye,Cheng,Wei,Su,Lu,Ding,Ren,Shen,Yao,Fan,Jin,Qian,Fu,Zou,Xiong,Bai';
SURNAMES['chinese-tw'] = 'Chen:8,Lin:6.5,Huang:4,Chang:3.8,Lee:3.6,Wang:2.9,Wu:2.8,Liu:2.5,Tsai:2.4,Yang:2.4,Hsu:2.1,Cheng:1.8,Hsieh:1.6,Kuo:1.5,Hung:1.5,Tseng:1.3,Chiu:1.3,Liao:1.2,Lai:1.2,Chou:1.2,Yeh:1,Su,Chuang,Lu,Chiang,Ho,Lo,Kao,Chien,Pan,Chu,Peng,Yu,Shih,Hu,Fang,Tu,Tsao,Wei,Hsiao,Teng,Fan,Shen,Sung,Yen,Tung,Weng,Chung,Kang,Hsueh,Tai,Fu,Kuan,Tsou,Chao,Lien';
SURNAMES.chinese = { mix: [['chinese-yue', 0.42], ['chinese-cmn', 0.38], ['chinese-tw', 0.2]] };

// The Philippines: the Spanish-era catalog (Santos, Reyes, Cruz, Bautista), Tagalog and other Philippine
// surnames (Manalo, Dimaculangan, Macaraeg, Panganiban) and Chinese-Filipino ones (Lim, Tan, Uy, Sy).
SURNAMES.filipino = 'Santos:3,Reyes:2.8,Cruz:2.6,Dela Cruz:2,Bautista:2.2,Garcia:2.2,Mendoza:2,Ramos:1.8,Torres:1.7,Flores:1.6,Villanueva:1.5,Gonzales:1.5,Castillo:1.4,De Guzman:1.4,Aquino:1.3,Castro:1.2,Rivera:1.2,Navarro:1.1,De Leon:1.1,Salazar:1,Mercado,Fernandez,Lopez,Hernandez,Perez,Rodriguez,Domingo,Pascual,Soriano,Valdez,Gutierrez,Javier,Del Rosario,Manalo,Dimaculangan,Macaraeg,Dimaano,Mangubat,Magbanua,Pangilinan,Panganiban,Manalastas,Dizon,Sison,Tolentino,Agustin,Aguilar,Alvarez,Bernardo,Cabrera,Cortez,Diaz,Enriquez,Estrada,Gomez,Ignacio,Lim,Tan,Uy,Sy,Ong,Mallari,Mamaril,Miranda,Morales,Natividad,Ocampo,Pineda,Quiambao,Quintos,Sarmiento,Serrano,Valencia,Velasco,Villareal,Yap,Zamora,Ferrer,Galang,Gatchalian,Ilagan,Lagman,Lacsamana,Malabanan,Bulatao,Cayabyab,Bacani,Buenaventura,Calma,Espiritu,Evangelista,Francisco,Guevarra,Lazaro,Legaspi,Manzano,Medina,Padilla,Rosales,Samson,Santiago,Tiongson,Umali,Yumul';

// Vietnam: Nguyen carries about 38 percent of Vietnamese people, then Tran, Le, Pham, Huynh (Hoang in the
// north), Phan, Vo (Vu in the north) ...; Californians are mostly from the south, where Huynh and Vo prevail.
SURNAMES.vietnamese = 'Nguyen:38,Tran:11,Le:9.5,Pham:7,Huynh:4.2,Phan:4.5,Vo:3.2,Hoang:1.5,Vu:1.6,Dang:2.1,Bui:2,Do:1.4,Ho:1.3,Ngo:1.3,Duong:1,Ly:0.8,Truong:0.8,Dinh:0.7,Lam:0.7,Mai:0.6,Doan:0.55,Luong:0.55,Trinh:0.5,Ha:0.5,Cao:0.45,Lu:0.4,Ta:0.4,Quach:0.4,Thai:0.4,Chau:0.4,Luu:0.35,La:0.35,Diep:0.3,Kieu:0.3,Tong:0.3,Vuong:0.3,Trieu:0.3,Lai:0.3,Thach:0.25,Banh:0.25,Giang:0.25,Tieu:0.2,Au:0.2,Nghiem:0.2,Phung:0.25,Khuu:0.2,Ninh:0.2,Tang:0.25,Nong:0.15,Bach:0.15';

// Korea: Kim, Lee, Park, Choi and Jung/Chung cover over half of all Koreans.
SURNAMES.korean = 'Kim:21.5,Lee:14,Park:8.4,Choi:4.7,Jung:3,Chung:1.6,Kang:2.3,Cho:2.1,Yoon:2.1,Jang:2,Lim:1.7,Han:1.5,Oh:1.5,Seo:1.4,Shin:1.4,Kwon:1.4,Hwang:1.4,Ahn:1.3,Song:1.3,Yoo:1.2,Hong:1.1,Jeon:1.1,Ko:0.9,Moon:0.9,Yang:0.9,Son:0.9,Bae:0.8,Baek:0.6,Heo:0.6,Nam:0.6,Shim:0.5,Rhee:0.5,Noh:0.4,Ha:0.4,Kwak:0.4,Sung:0.4,Cha:0.4,Joo:0.4,Woo:0.3,Koo:0.3,Min:0.3,Ryu:0.3,Na:0.3,Jin:0.3,Ji:0.3,Um:0.3,Chae:0.3,Byun:0.3,Paik:0.25,Won:0.25,Chun:0.25,Yim:0.2,Pyo:0.15,Do:0.15';

// Japan: the surnames of the immigrant prefectures (Hiroshima, Yamaguchi, Kumamoto, Fukuoka, Okinawa:
// Higa, Kaneshiro, Oshiro) in the older spellings families kept (Inouye, Uyeda).
SURNAMES.japanese = 'Nakamura:2,Tanaka:2,Yamamoto:1.9,Watanabe:1.6,Ito:1.5,Kobayashi:1.5,Sato:1.4,Suzuki:1.4,Takahashi:1.4,Yamaguchi:1.3,Kimura:1.2,Matsumoto:1.2,Inouye:1.1,Shimizu:1.1,Yamada:1.1,Sasaki:1,Hayashi:1,Kato:1,Yoshida:1,Yamashita,Nakano,Okamoto,Fujii,Ishii,Ogawa,Mori,Ikeda,Hashimoto,Murakami,Nishimura,Fujimoto,Okada,Nakagawa,Kondo,Maeda,Goto,Hirano,Ueda,Hamada,Kaneshiro,Higa,Shiroma,Miyashiro,Arakaki,Oshiro,Tamura,Yoshimura,Morimoto,Uyeda,Nishimoto,Kawamoto,Matsuda,Hara,Kubota,Endo,Fukuda,Miyamoto,Okubo,Sakamoto,Takeda,Tsuji,Uchida,Wada,Yokoyama,Abe,Aoki,Fujita,Iwamoto,Masuda,Nagata,Ota,Shimada,Tanimoto,Ishida,Honda,Matsui,Ono';

// India by region: the surname tells the region, and givenName follows it when the surname is passed in.
SURNAMES['indian-north'] = 'Sharma:3,Gupta:2.5,Kumar:2.5,Singh:2,Verma:1.4,Agarwal:1.3,Jain:1.3,Kapoor:1.1,Khanna:1,Malhotra:1,Arora:1,Bhatia,Sethi,Saxena,Srivastava,Mishra,Pandey,Tiwari,Shukla,Yadav,Chauhan,Goyal,Bansal,Mittal,Tripathi,Dubey,Chaturvedi,Sinha,Banerjee,Chatterjee,Mukherjee,Bose,Das,Dutta,Ghosh,Sen,Roy,Chakraborty,Bhattacharya,Sarkar,Saha,Mitra,Ganguly,Basu,Dey,Biswas,Chopra,Ahuja,Kohli,Mehra,Bhalla,Grover,Sood,Bajaj,Talwar,Anand,Dhawan,Tandon,Chadha,Rastogi,Garg';
SURNAMES['indian-west'] = 'Patel:9,Shah:4,Desai:2,Mehta:2,Joshi:1.5,Parikh:1.2,Trivedi:1,Pandya,Bhatt,Dave,Vyas,Amin,Panchal,Solanki,Thakkar,Dalal,Kothari,Mistry,Raval,Kulkarni,Deshpande,Patil,Jadhav,Deshmukh,Gokhale,Apte,Bhide,Kale,Chavan,Pawar,Shinde,Gaikwad,More,Sawant,Phadke,Karve,Paranjape,Naik,Parekh,Chokshi,Sheth,Vora,Majmudar,Bhakta,Jani,Rana,Bhagat,Gajjar';
SURNAMES['indian-south'] = 'Reddy:4,Rao:3.5,Nair:1.8,Iyer:1.5,Krishnan:1.5,Kumar:1.5,Subramanian:1.4,Naidu:1.2,Prasad:1.1,Chowdary:1.1,Raman:1,Murthy:1,Varma,Raju,Venkataraman,Ramachandran,Natarajan,Sundaram,Balasubramanian,Rajagopal,Srinivasan,Narayanan,Swaminathan,Ganesan,Mani,Pillai,Menon,Kurian,Thomas,Mathew,George,Varghese,Joseph,Abraham,Jacob,Cherian,Panicker,Hegde,Shetty,Gowda,Kamath,Bhat,Pai,Shenoy,Nayak,Acharya,Iyengar,Raghavan,Gopalan,Kannan,Chandran,Goud,Kolli,Gaddam,Kodali,Vemula,Katta,Alla,Mandava,Nallapati,Bommareddy,Yalamanchili,Chilukuri';
SURNAMES.indian = { mix: [['indian-north', 0.36], ['indian-west', 0.3], ['indian-south', 0.34]] };

// Punjabi Sikh family names (gotras). Singh and Kaur are not family names; they come with the person
// (givenName, middleName, or surname with {sex}).
SURNAMES.sikh = 'Sandhu:5,Gill:5,Dhillon:4,Sidhu:3.6,Grewal:2.8,Bains:2.2,Johal:1.8,Atwal:1.5,Mann:1.6,Brar:1.6,Cheema:1.5,Dhaliwal:1.5,Randhawa:1.4,Sangha:1.3,Virk:1.2,Sekhon:1.2,Hundal:1.1,Bal:1,Aulakh:1,Chahal:1,Toor,Kang,Bhullar,Purewal,Khaira,Sahota,Basra,Dhami,Kaler,Mangat,Uppal,Thind,Pannu,Badesha,Bhangu,Deol,Gosal,Heer,Jhutti,Khehra,Malhi,Nijjar,Rai,Samra,Takhar,Tiwana,Sran,Dhindsa,Chatha,Sohal';

// Pakistan.
SURNAMES.pakistani = 'Khan:8,Ahmed:5,Ali:4.5,Hussain:3.5,Malik:3,Chaudhry:2.4,Sheikh:2,Qureshi:1.8,Siddiqui:1.6,Akhtar:1.5,Iqbal:1.5,Raza:1.4,Shah:1.4,Mirza:1.3,Baig:1.2,Abbasi:1.2,Awan:1.1,Rana:1.1,Javed:1,Mahmood:1,Rehman,Aslam,Anwar,Haider,Rizvi,Naqvi,Zaidi,Jafri,Hashmi,Farooq,Rashid,Saleem,Bhatti,Cheema,Gondal,Janjua,Khokhar,Tarar,Warraich,Bajwa,Memon,Ansari,Usmani,Durrani,Khattak,Niazi,Kazmi,Bukhari,Gilani,Nawaz,Lodhi';

// Bangladesh.
SURNAMES.bangladeshi = 'Rahman:6,Hossain:5,Islam:4.5,Ahmed:4,Khan:3,Uddin:3,Chowdhury:2.5,Alam:2.2,Miah:1.8,Haque:1.5,Sarker:1.2,Karim:1.2,Talukder:1,Sheikh,Mollah,Bhuiyan,Siddique,Hasan,Kabir,Ali,Barua,Das,Roy,Saha,Paul,Biswas,Mondal,Majumder,Mahmud,Rashid,Hoque,Malik,Patwary,Shikder,Khondaker,Munshi,Babu,Matin,Zaman,Bari,Kazi,Sikder,Faruque,Pramanik,Ghosh,Dey';

// Afghanistan (tribal and place names became surnames only in the 20th century, many ending in -i or -zai).
SURNAMES.afghan = 'Ahmadi:3,Mohammadi:2.5,Rahimi:2,Hashimi:1.5,Karimi:1.5,Wardak:1.2,Noori:1.2,Amiri:1.1,Azizi:1.1,Popal:1,Stanekzai:1,Ahmadzai:1,Sultani:1,Haidari:1,Hakimi:1,Hussaini:1,Jalali,Kabuli,Kakar,Mohmand,Niazi,Nuristani,Omari,Popalzai,Qaderi,Rahmani,Rasuli,Safi,Saberi,Sadat,Samadi,Sharifi,Shinwari,Siddiqi,Wahidi,Zazai,Zaheer,Barakzai,Durrani,Hotak,Andar,Ludin,Mujaddidi,Faizi,Nazari,Habibi,Akbari,Azimi,Faqiri,Nawabi';

// Hmong surnames are the clan names (18 clans) with their common spellings; there are no others.
SURNAMES.hmong = 'Vang:15,Xiong:14,Yang:12,Lee:10,Lor:7,Thao:7,Moua:6,Her:5,Vue:4,Chang:3.5,Hang:2.5,Kue:2,Khang:2,Cha:1.6,Ly:1.5,Lo:1.4,Fang:1.2,Thor:1,Cheng:0.9,Pha:0.8,Kong:0.6,Chue:0.5,Chu:0.4';

// Cambodia.
SURNAMES.cambodian = 'Sok:4,Chea:3,Kim:2.5,Heng:2.5,Lim:2,Meas:1.8,Ly:1.8,Chan:1.5,Keo:1.5,Seng:1.4,Prak:1.3,Sam:1.3,Pich:1.2,Chhay:1,Ouk:1,Pen:1,Phan:1,Sin:1,Nhem:0.9,Long:0.8,Mao:0.8,Chhun:0.8,Hem:0.8,Kong:0.8,Leng:0.7,Mam:0.7,Nou:0.7,Sao:0.7,Thach:0.7,Touch:0.7,Yim:0.7,Choeun:0.6,Om:0.6,Phon:0.6,Ros:0.6,Sor:0.6,Tep:0.6,Un:0.6,Ung:0.6,You:0.6,Svay:0.6,Bun:0.6,Tan:0.6,Uy:0.5,Yin:0.5,Khem:0.5,Nhim:0.5,Pov:0.5,Muth:0.5,Chann:0.5,Hok:0.5,Lay:0.5,Moeun:0.5,Nget:0.5,Sim:0.5,Vong:0.5';

// Laos (family names, often long and particular to the family).
SURNAMES.lao = 'Phommachanh,Sengsavang,Keomany,Vongsavath,Phanthavong,Sisavath,Souvannavong,Chanthavong,Inthavong,Phengsavanh,Keophilavong,Souliyavong,Vongphachanh,Sayavong,Phimmasone,Sengchanh,Douangpanya,Thammavong,Khounborine,Sihavong,Luangrath,Manivong,Philavanh,Rattanavong,Sayasith,Sengdara,Sithideth,Soukhaseum,Sourinthone,Thongsavath,Vilaysane,Vongkhamsao,Xayavong,Chounlamany,Keovilay,Phomsavanh,Rasavong,Siharath,Southammavong,Phothisane,Somphanith,Vongxay,Saechao,Phanakhone,Bounkeua';

// Thailand (surnames are particular to families; these are among the more common, incl. Thai-Chinese Sae-).
SURNAMES.thai = 'Saetang,Saelim,Saelee,Saeheng,Saeyang,Srisuk,Wongsawat,Charoensuk,Sukjai,Thongdee,Jaidee,Boonmee,Srisawat,Rattanakul,Sriwong,Phongsri,Chantarasak,Suwannarat,Kaewmanee,Prasertsuk,Wongpanich,Jitpraphai,Somboon,Limsakul,Tangsiri,Kongkaew,Phromma,Panyawong,Siriwat,Chaiyasit,Thongsuk,Ruangrit,Kittikul,Inthasorn,Boonyarat,Pongpanich,Manee,Sanguansak,Promsiri,Wattanakul,Yodsuwan,Thanasak,Chokchai,Saechin';

// Burma: no family names; the last part of the personal name serves as the surname in US records.
SURNAMES.burmese = 'Aung:4,Win:3,Htun:2.5,Oo:2.5,Myint:2,Kyaw:2,Thein:1.8,Soe:1.8,Lwin:1.5,Naing:1.5,Zaw:1.5,Maung:1.4,Tun:1.4,Hlaing:1.3,Min:1.2,Htwe:1.1,Nyunt:1,Khaing:1,Hla:1,Shwe,Lin,Myo,Thu,Sein,Than,Mya,Htay,Nwe,Moe,Khin,Aye,Chit,Htoo,Paw,Hein,Phyo,Thet,Wai,Nyein,Zin,Tin,Ko,Ye,Thaung,Yee,Lay';

// Indonesia (many Indonesian Californians are Chinese-Indonesian, with Indonesian-form surnames).
SURNAMES.indonesian = 'Wijaya:3,Santoso:2.5,Halim:2,Gunawan:2,Tan:2,Lim:1.8,Setiawan:1.8,Kurniawan:1.6,Susanto:1.5,Hartono:1.4,Sutanto:1.3,Wibowo:1.2,Pratama:1.2,Saputra:1.2,Hidayat:1.2,Nugroho:1.1,Kusuma:1.1,Tanjaya:1,Salim:1,Liem:1,Lie:1,Sugiarto,Widjaja,Tjandra,Gozali,Hendrawan,Effendi,Purnomo,Siregar,Simanjuntak,Nasution,Hutapea,Sitompul,Lubis,Harahap,Pangaribuan,Manurung,Tambunan,Tanuwidjaja,Kartawijaya,Budiman,Sasmita,Suryadi,Rahardjo,Darmawan,Iskandar,Wirawan,Mulyadi,Hakim,Syahputra';

// Other Asian origins (Nepal, Sri Lanka, Mongolia, Tibet, Malaysia).
SURNAMES['asian-other'] = 'Shrestha,Gurung,Tamang,Thapa,Rai,Magar,Sherpa,Karki,Adhikari,Bhattarai,Poudel,Khadka,Basnet,Lama,Perera,Fernando,Silva,Jayasinghe,Wickramasinghe,Bandara,Dissanayake,Gunawardena,Ratnayake,Herath,Batbayar,Ganbold,Bold,Tsering,Dorje,Norbu,Abdullah,Ismail,Hamid,Rahman,Teoh,Khoo,Ooi,Goh,Tan,Lim,Ong,Chong,Yeoh,Mendis,Kumara';
SURNAMES.asian = { mix: [['asian-other', 0.32], ['chinese', 0.25], ['indian', 0.15], ['filipino', 0.1], ['vietnamese', 0.08], ['korean', 0.07], ['thai', 0.03]] };

// ------------------------------------------------------------------ surnames: Black heritages
SURNAMES['african-american'] = 'Williams:4.5,Johnson:4,Smith:3.5,Jones:3.2,Brown:3,Jackson:2.6,Davis:2.5,Thomas:2,Harris:1.9,Robinson:1.7,Taylor:1.6,Wilson:1.5,Moore:1.4,White:1.3,Washington:1.3,Thompson:1.2,Lewis:1.2,Green:1.1,Walker:1.1,Allen:1,Young,King,Wright,Scott,Hill,Clark,Mitchell,Carter,Turner,Coleman,Edwards,Henderson,Simmons,Freeman,Banks,Gaines,Hayes,Patterson,Bell,Bryant,Brooks,Sanders,Ford,Griffin,Butler,Graham,Perry,Reed,Howard,Daniels,Foster,Hall,Hunter,Wallace,Woods,Morris,Hamilton,Holmes,Jenkins,Gordon,Matthews,Spencer,Stewart,Watson,Bradley,Dixon,Gray,Lee,Cooper,Grant,Hawkins,Mason,Pierce,Rogers,Tucker,Wade,Owens,Payne,Joseph,James,Jefferson,Franklin,Booker,Mack';

// Ethiopia and Eritrea: the surname is the father's given name (and in the US often the grandfather's).
SURNAMES.ethiopian = 'Bekele,Tadesse,Haile,Gebremariam,Gebremedhin,Tesfaye,Alemu,Kebede,Wolde,Assefa,Abebe,Desta,Ayele,Getachew,Mekonnen,Woldemariam,Berhe,Tekle,Gebreyesus,Negash,Asfaw,Demissie,Hailu,Worku,Yohannes,Tsegaye,Fikre,Mulugeta,Belay,Amare,Ghebremichael,Tesfamariam,Ghebre,Kidane,Habte,Mehari,Tewolde,Zerihun,Lemma,Shiferaw,Mamo,Gebru,Tefera,Alemayehu,Wondimu,Teshome,Taye,Bogale,Kassa,Girma,Tilahun,Gebreegziabher,Hagos,Weldemichael,Abraha,Tsegay,Berhane,Kahsay';

// Nigeria (Igbo, Yoruba and Hausa-Fulani family names).
SURNAMES.nigerian = 'Okafor,Okonkwo,Nwosu,Eze,Okeke,Obi,Nwachukwu,Okoro,Chukwu,Ogunleye,Adeyemi,Adebayo,Ogunbiyi,Olawale,Oladipo,Afolabi,Adeleke,Balogun,Bello,Ibrahim,Abubakar,Mohammed,Usman,Okoye,Nnaji,Igwe,Ugwu,Akinola,Akinwale,Ojo,Adewale,Ogunyemi,Oyebanji,Babalola,Anyanwu,Ezeh,Ogbonna,Uzoma,Chukwuma,Nwankwo,Ibe,Agu,Ezenwa,Onuoha,Adeniyi,Ogundipe,Olaniyan,Oyewole,Odukoya,Ekwueme,Nwafor,Nwogu,Adesanya,Oyelaran';

// The Black Caribbean (Jamaican, Trinidadian and Barbadian surnames from British naming; Haitian French ones).
SURNAMES.caribbean = 'Campbell:2.5,Brown:2.4,Williams:2.2,Smith:2,Thompson:1.8,Johnson:1.6,Reid:1.4,Morgan:1.2,Clarke:1.2,Francis:1.1,Pierre:1.4,Jean:1.3,Joseph:1.3,Charles:1.2,Louis:1,Gordon,Grant,Henry,James,Lewis,McKenzie,Palmer,Robinson,Stewart,Walker,Wright,Spencer,Morrison,Bailey,Allen,Edwards,Graham,Ferguson,Bennett,Barnes,Baptiste,Jean-Baptiste,Desir,Etienne,Augustin,Celestin,Noel,Michel,Simon,Paul,Dorsainvil,Jean-Louis,Fils-Aime,Hylton,Samuels,Bryan,Wilson,Daley,Facey,Gayle,Lindo,McFarlane,Richards,Rowe,Sinclair,Tomlinson,Whyte,Chin,Mohammed';

// Other African origins.
SURNAMES.african = 'Mensah,Boateng,Owusu,Asante,Osei,Appiah,Agyeman,Ofori,Darko,Amoah,Kamau,Mwangi,Otieno,Odhiambo,Ochieng,Kariuki,Njoroge,Mutua,Kiprotich,Cheruiyot,Mohamed,Abdi,Hassan,Ali,Warsame,Farah,Ahmed,Omar,Yusuf,Hussein,Diallo,Traore,Konate,Ndiaye,Diop,Sow,Ba,Fofana,Camara,Keita,Toure,Coulibaly,Kone,Sylla,Nkosi,Dlamini,Ndlovu,Moyo,Banda,Phiri,Okello,Mugisha,Habimana,Tshabalala,Fotso,Mbah,Nyambura,Wekesa';

// ------------------------------------------------------------------ surnames: Armenian, Iranian, Arab, Assyrian
// Armenian: Eastern -yan forms (Armenia, and most recent arrivals) and Western -ian forms (the older
// diaspora from Lebanon, Syria, Turkey and Iran). Surnames tied to single famous families are left out.
SURNAMES.armenian = 'Petrosyan:2,Sargsyan:2,Harutyunyan:1.8,Hovhannisyan:1.6,Grigoryan:1.6,Hakobyan:1.5,Karapetyan:1.5,Vardanyan:1.3,Gevorgyan:1.3,Avetisyan:1.2,Mkrtchyan:1.2,Khachatryan:1.2,Sarkisian:1.2,Ghazaryan:1.1,Martirosyan:1.1,Margaryan:1,Stepanyan:1,Sahakyan:1,Davtyan:1,Manukyan,Simonyan,Arakelyan,Asatryan,Galstyan,Minasyan,Poghosyan,Babayan,Melkonian,Petrosian,Hagopian,Kazarian,Avakian,Boyajian,Gasparian,Keshishian,Ohanian,Papazian,Hovsepian,Manoukian,Bedrosian,Sahakian,Minassian,Tashjian,Garabedian,Kalajian,Kouyoumjian,Demirjian,Mardirossian,Tatevosian,Arzumanyan,Baghdasaryan,Movsisyan,Abrahamyan,Aghajanyan,Sarkissian,Kirakosyan,Torosyan,Zakaryan,Yeghiazaryan,Mikayelyan,Nazaryan';

// Iran (including the Persian Jewish families of Los Angeles: Hakimian, Kashanian, Ebrahimian).
SURNAMES.iranian = 'Mohammadi:2,Hosseini:2,Ahmadi:1.8,Rezaei:1.6,Moradi:1.5,Karimi:1.5,Rahimi:1.4,Jafari:1.4,Hashemi:1.3,Sadeghi:1.3,Mousavi:1.2,Tehrani:1.1,Shirazi:1.1,Esfahani:1,Tabrizi:1,Kermani,Rostami,Farahani,Ghorbani,Heidari,Kazemi,Amini,Rahmani,Nazari,Alavi,Ebrahimi,Akbari,Abbasi,Ansari,Bagheri,Daneshvar,Ghaffari,Javadi,Kashani,Khosravi,Mahdavi,Najafi,Rafiei,Salehi,Soltani,Yazdani,Zand,Saberi,Moghadam,Navabi,Nikpour,Shams,Golshani,Hakimi,Ebrahimian,Hakimian,Rahimian,Kashanian,Esfahanian,Behbahani,Azizi,Shahbazi,Taheri,Zamani,Asadi,Firouzi,Ghaemi,Jahanshahi,Mirzaei,Parsa,Sharifi,Shokri,Vahidi,Mehrabian,Farhadi';

// The Arab world (Lebanese and Syrian Christian names, Palestinian, Iraqi, Egyptian and Yemeni families).
SURNAMES.arab = 'Haddad:2,Khoury:2,Nassar:1.5,Saleh:1.5,Hamdan:1.4,Mansour:1.4,Khalil:1.4,Hassan:1.6,Ibrahim:1.5,Ali:1.5,Ahmad:1.4,Abdallah:1.3,Youssef:1.3,Saad:1.2,Aziz:1.1,Darwish:1.1,Habib:1,Issa:1,Jaber,Karam,Najjar,Rizk,Sabbagh,Suleiman,Tannous,Yassin,Zein,Awad,Barakat,Bitar,Daher,Farah,Ghanem,Hijazi,Kassab,Masri,Nasr,Odeh,Qasim,Rahal,Sayegh,Shaheen,Touma,Abboud,Hourani,Khalaf,Matar,Mikhail,Salameh,Hamad,Atallah,Khatib,Hussein,Mahmoud,Mustafa,Omar,Salem,Hamoud,Abdelrahman,Fakhoury,Hanna,Shammas,Antoun,Boutros,Gerges,Farag,Shenouda,Wahba';

// Assyrians and Chaldeans (the Chaldean Catholic families of El Cajon: Kassab, Yaldo, Jarbo, Kallabat).
SURNAMES.assyrian = 'Shamoun:2,Yonan:1.8,Odisho:1.6,Khoshaba:1.4,Youkhana:1.4,Benyamin:1.3,Sargis:1.2,Gewargis:1.2,Toma:1.2,Isho:1.1,Kassab:1.1,Yaldo:1,Jarbo:1,Baba,Shabbas,Warda,Elia,Kanna,Yousif,Hermiz,Badal,Davoodi,Jacob,Shlimon,Moshi,Oraha,Shimon,Tamraz,Younan,Zia,Lazar,Aziz,Khamis,Michael,Nissan,Poulus,Bahnam,Matti,Hanna,Petros,Daniel,Ishaya,Kallabat,Sesi,Najor,Arabo,Garmo,Karmo,Konja,Yono,Atisha,Sitto,Khananisho,Esho,Bet-Shmuel';

// ------------------------------------------------------------------ surnames: Europe and the US
SURNAMES.russian = 'Ivanov:2,Smirnov:1.8,Kuznetsov:1.6,Popov:1.5,Vasiliev:1.4,Petrov:1.4,Sokolov:1.3,Mikhailov:1.2,Novikov:1.2,Fedorov:1.1,Morozov:1.1,Volkov:1.1,Alekseev:1,Lebedev:1,Semenov:1,Egorov,Pavlov,Kozlov,Stepanov,Nikolaev,Orlov,Andreev,Makarov,Nikitin,Zakharov,Zaitsev,Soloviev,Borisov,Yakovlev,Grigoriev,Romanov,Vorobiev,Sergeev,Kuzmin,Frolov,Alexandrov,Dmitriev,Korolev,Gusev,Kiselev,Ilyin,Maksimov,Polyakov,Sorokin,Vinogradov,Kovalev,Belov,Antonov,Tarasov,Zhukov,Baranov,Filippov,Komarov,Davydov,Belyaev,Gerasimov,Bogdanov,Osipov,Sidorov,Matveev,Titov,Markov,Mironov,Krylov,Kulikov,Karpov,Vlasov,Melnikov,Rabinovich,Katz,Levin,Kaplan,Shapiro,Gurevich,Feldman,Friedman,Goldberg,Rosenberg,Shulman,Zilberman,Gelfand,Kogan,Lerner,Medvedev';
SURNAMES.ukrainian = 'Kovalenko:2,Bondarenko:1.8,Tkachenko:1.6,Shevchenko:1.6,Kravchenko:1.5,Kovalchuk:1.4,Boyko:1.4,Melnyk:1.4,Lysenko:1.2,Moroz:1.1,Petrenko:1.1,Savchenko:1.1,Rudenko:1,Marchenko:1,Pavlenko:1,Klymenko,Oliynyk,Koval,Polishchuk,Tkachuk,Kravchuk,Bondar,Shevchuk,Ponomarenko,Vasylenko,Levchenko,Hrytsenko,Romanenko,Karpenko,Yakovenko,Sydorenko,Ishchenko,Zinchenko,Kuzmenko,Mazur,Kozak,Hnatyuk,Fedoruk,Didenko,Kushnir,Kostenko,Pylypenko,Prykhodko,Holub,Lytvyn,Martynyuk,Kharchenko,Doroshenko,Vlasenko,Kucher,Tymchenko,Prokopenko,Demchenko,Fedorenko,Savchuk,Yurchenko,Kolesnyk,Melnik,Kovalev';
SURNAMES.polish = 'Nowak:2,Kowalski:1.6,Wisniewski:1.4,Wojcik:1.3,Kowalczyk:1.3,Kaminski:1.2,Lewandowski:1.2,Zielinski:1.1,Szymanski:1.1,Wozniak:1.1,Dabrowski:1,Kozlowski:1,Jankowski,Mazur,Wojciechowski,Kwiatkowski,Krawczyk,Kaczmarek,Piotrowski,Grabowski,Zajac,Pawlowski,Michalski,Krol,Wieczorek,Jablonski,Wrobel,Nowakowski,Majewski,Olszewski,Stepien,Malinowski,Jaworski,Adamczyk,Dudek,Nowicki,Pawlak,Gorski,Witkowski,Walczak,Sikora,Baran,Rutkowski,Michalak,Szewczyk,Ostrowski,Tomaszewski,Pietrzak,Zalewski,Wroblewski,Kowalewski,Sadowski,Kubiak,Duda,Kowalik,Sobczak';
SURNAMES.irish = 'Murphy:2.4,Kelly:2,O\'Sullivan:1.6,Walsh:1.6,Smith:1.4,O\'Brien:1.5,Byrne:1.4,Ryan:1.4,O\'Connor:1.3,O\'Neill:1.3,O\'Reilly:1.1,Doyle:1.1,McCarthy:1.1,Gallagher:1,Doherty:1,Kennedy:1,Lynch,Murray,Quinn,Moore,McLoughlin,Carroll,Connolly,Daly,O\'Connell,Dunne,Brennan,Burke,Collins,Clarke,Johnston,Hughes,Farrell,Fitzgerald,Martin,Maguire,Nolan,Flynn,O\'Callaghan,O\'Donnell,Duffy,O\'Mahony,Boyle,Healy,O\'Shea,Sweeney,Hayes,Kavanagh,Power,McGrath,Moran,Brady,Casey,Foley,Fitzpatrick,O\'Leary,McDonnell,McMahon,Donnelly,Regan,Donovan,Burns,Flanagan,Barry,Kane,Cunningham,Griffin,Kenny,Sheehan,Ward,Whelan,Lyons,Cullen,Keane,Maher,McKenna,Hogan,O\'Keeffe,Magee,McNamara,McDermott,Moloney,O\'Rourke,Buckley,O\'Dwyer';
SURNAMES.italian = 'Rossi:2,Russo:1.8,Esposito:1.5,Bianchi:1.4,Romano:1.4,Colombo:1.2,Ricci:1.2,Marino:1.2,Greco:1.1,Bruno:1.1,Conti:1,De Luca:1,Mancini,Costa,Giordano,Rizzo,Lombardi,Moretti,Barbieri,Fontana,Santoro,Mariani,Rinaldi,Caruso,Ferrara,Galli,Martini,Leone,Longo,Gentile,Martinelli,Vitale,Lombardo,Serra,De Santis,D\'Angelo,Marchetti,Parisi,Villa,Conte,Ferraro,Ferri,Fabbri,Bianco,Marini,Grasso,Valentini,Messina,Sala,De Angelis,Gatti,Pellegrini,Palumbo,Farina,Rizzi,Monti,Cattaneo,Morelli,Amato,Silvestri,Mazza,Testa,Grassi,Carbone,Benedetti,Barone,Rossetti,Caputo,Guerra,Palmieri,Bernardi,Martino,Fiore,De Rosa,Ferretti,Bellini,Basile,Donati,Vitali,Battaglia,Sartori,Neri,Pagano,Ruggiero,Sorrentino,D\'Amico,Orlando,Romeo,Lucchesi,Cuneo,Bertolini,Rossini';
SURNAMES.german = 'Mueller:1.6,Schmidt:1.6,Schneider:1.3,Fischer:1.3,Weber:1.2,Meyer:1.2,Wagner:1.1,Becker:1.1,Schulz:1,Hoffmann:1,Koch,Richter,Klein,Wolf,Schroeder,Neumann,Schwarz,Zimmermann,Braun,Krueger,Hartmann,Lange,Schmitt,Werner,Schmitz,Krause,Meier,Lehmann,Schmid,Schulze,Maier,Koehler,Herrmann,Koenig,Walter,Mayer,Huber,Kaiser,Fuchs,Peters,Lang,Scholz,Moeller,Weiss,Jung,Hahn,Schubert,Vogel,Friedrich,Keller,Guenther,Frank,Berger,Winkler,Roth,Beck,Lorenz,Baumann,Franke,Albrecht,Schuster,Simon,Ludwig,Boehm,Winter,Kraus,Schumacher,Kraemer,Vogt,Stein,Jaeger,Otto,Sommer,Gross,Seidel,Heinrich,Brandt,Haas,Schreiber,Graf,Schulte,Dietrich,Ziegler,Kuhn,Pohl,Engel,Horn,Busch,Bergmann,Voigt,Sauer,Arnold,Wolff,Pfeiffer,Hess,Gerber,Kessler';
SURNAMES.english = 'Smith:2.5,Jones:1.8,Williams:1.6,Taylor:1.6,Brown:1.6,Davies:1.2,Evans:1.2,Wilson:1.2,Thomas:1.1,Johnson:1.1,Roberts:1,Robinson:1,Thompson:1,Wright:1,Walker:1,White,Edwards,Hughes,Green,Hall,Lewis,Harris,Clarke,Jackson,Wood,Turner,Martin,Cooper,Hill,Ward,Morris,Moore,Clark,Lee,King,Baker,Harrison,Morgan,Allen,James,Scott,Phillips,Watson,Davis,Parker,Price,Bennett,Young,Griffiths,Mitchell,Kelly,Cook,Carter,Richardson,Bailey,Collins,Bell,Shaw,Murphy,Miller,Cox,Richards,Marshall,Anderson,Simpson,Ellis,Adams,Wilkinson,Foster,Chapman,Powell,Webb,Rogers,Gray,Mason,Hunt,Campbell,Matthews,Owen,Palmer,Holmes,Mills,Barnes,Knight,Lloyd,Butler,Russell,Barker,Fisher,Stevens,Jenkins,Murray,Dixon,Harvey';
SURNAMES.scottish = 'Smith:2,Brown:1.6,Wilson:1.5,Campbell:1.5,Stewart:1.4,Thomson:1.4,Robertson:1.3,Anderson:1.2,MacDonald:1.2,Scott:1.1,Reid:1.1,Murray:1.1,Taylor:1,Clark:1,Ross:1,Watson,Morrison,Paterson,Young,Mitchell,Walker,Fraser,Miller,McDonald,Gray,Henderson,Hamilton,Johnston,Duncan,Graham,Ferguson,Kerr,Davidson,Bell,Cameron,Kelly,Martin,Hunter,Allan,Mackenzie,Grant,Simpson,MacLeod,Black,Mackay,Wallace,McLean,Russell,Gibson,Ritchie,Sutherland,Munro,Kennedy,Sinclair,Gordon,Burns,Forbes,Douglas,Buchanan,Drummond,Lindsay,Crawford,Boyd,Macpherson,McGregor,Galbraith,Lamont,Baird,Rankin,Murdoch';
SURNAMES.french = 'Martin:2,Bernard:1.6,Dubois:1.5,Thomas:1.3,Robert:1.3,Richard:1.2,Petit:1.2,Durand:1.1,Leroy:1.1,Moreau:1.1,Simon:1,Laurent:1,Lefebvre:1,Michel,David,Bertrand,Roux,Vincent,Fournier,Morel,Girard,Andre,Lefevre,Mercier,Dupont,Lambert,Bonnet,Francois,Legrand,Garnier,Faure,Rousseau,Blanc,Guerin,Henry,Roussel,Nicolas,Perrin,Morin,Mathieu,Clement,Gauthier,Dumont,Fontaine,Chevalier,Robin,Masson,Gerard,Boyer,Denis,Lemaire,Duval,Joly,Roger,Roche,Roy,Noel,Lucas,Meunier,Marchand,Dufour,Blanchard,Barbier,Brun,Dumas,Brunet,Leroux,Colin,Renard,Arnaud,Rolland,Caron,Aubert,Giraud,Leclerc,Vidal,Bourgeois,Renaud,Lemoine,Picard,Gaillard,Lacroix,Fabre,Dupuis,Olivier,Hubert,Rey,Moulin,Fleury,Deschamps,Benoit,Boucher,Gagnon,Tremblay,Thibodeaux,Broussard,Landry,LeBlanc,Hebert,Guidry';
SURNAMES.portuguese = 'Silva:3,Santos:2,Ferreira:1.6,Pereira:1.6,Oliveira:1.4,Costa:1.4,Rodrigues:1.3,Martins:1.3,Sousa:1.3,Fernandes:1.2,Goncalves:1.1,Gomes:1.1,Medeiros:1.2,Avila:1.1,Furtado:1.1,Bettencourt:1,Machado:1,Mendes:1,Souza:1,Lopes,Marques,Alves,Almeida,Ribeiro,Pinto,Carvalho,Teixeira,Moreira,Correia,Nunes,Soares,Vieira,Monteiro,Cardoso,Rocha,Raposo,Neves,Coelho,Cunha,Pires,Reis,Simoes,Antunes,Matos,Fonseca,Araujo,Barbosa,Tavares,Lourenco,Figueiredo,Azevedo,Freitas,Borges,Brasil,Cabral,Dutra,Leal,Mello,Pacheco,Quadros,Rego,Rosa,Serpa,Toste,Amaral,Bento,Botelho,Faria,Fagundes,Silveira,Valadao,Mendonca,Sequeira,Garcia,Vargas';
SURNAMES.dutch = 'De Jong:2,Jansen:1.6,De Vries:1.6,Van den Berg:1.3,Van Dijk:1.3,Bakker:1.3,Janssen:1.2,Visser:1.2,Smit:1.1,Meijer:1.1,De Boer:1.1,Mulder:1,De Groot:1,Bos:1,Vos,Peters,Hendriks,Van Leeuwen,Dekker,Brouwer,De Wit,Dijkstra,Smits,De Graaf,Van der Meer,Van der Linden,Kok,Jacobs,De Haan,Vermeulen,Van den Heuvel,Van der Veen,Van den Broek,De Bruin,Van der Heijden,Schouten,Van Beek,Willems,Van Vliet,Hoekstra,Maas,Verhoeven,Koster,Van Dam,Van der Wal,Prins,Blom,Huisman,Kuiper,Veenstra,Kramer,Postma,Vink,De Ruiter,Groen,Gerritsen,Jonker,Van Loon,Molenaar,Verbeek,DeJong,DeGroot,VanderWal,Vander Poel,Te Velde,Bootsma,Hettinga,Van Ryn,Vanderham,Veldhuis';
SURNAMES.scandinavian = 'Anderson:2,Johnson:1.8,Peterson:1.6,Nelson:1.5,Olson:1.4,Larson:1.3,Hanson:1.2,Swanson:1.1,Carlson:1.1,Erickson:1.1,Jensen:1,Christensen:1,Johansson,Andersson,Karlsson,Nilsson,Eriksson,Larsson,Olsson,Persson,Svensson,Gustafsson,Pettersson,Jonsson,Hansson,Bengtsson,Lindberg,Lindstrom,Lindqvist,Lindgren,Berg,Bergstrom,Lundberg,Lundgren,Lund,Holm,Sandberg,Engstrom,Hedlund,Sjoberg,Wallin,Ekstrom,Forsberg,Dahl,Strand,Hansen,Johansen,Olsen,Larsen,Andersen,Pedersen,Nilsen,Kristiansen,Karlsen,Haugen,Halvorsen,Bakken,Solberg,Moen,Eide,Nygaard,Nielsen,Sorensen,Rasmussen,Jorgensen,Petersen,Madsen,Kristensen,Thomsen,Poulsen,Mortensen,Jacobson,Lindquist,Sorenson,Gustafson,Nyberg';
SURNAMES.greek = 'Papadopoulos:2,Pappas:1.8,Georgiou:1.4,Papadakis:1.2,Nikolaou:1.2,Dimitriou:1.1,Konstantinou:1.1,Ioannou:1.1,Vasileiou:1,Christodoulou:1,Alexiou,Antoniou,Papageorgiou,Karagiannis,Oikonomou,Makris,Papanikolaou,Angelopoulos,Athanasiou,Economou,Theodorou,Michailidis,Georgiadis,Vlachos,Katsaros,Kallas,Kanellos,Karras,Kokkinos,Mavros,Nikas,Panagiotopoulos,Pantazis,Petrakis,Sarris,Spanos,Stavrou,Triantafyllou,Tsakiris,Vasilakis,Zervas,Galanis,Andreou,Daskalakis,Demos,Kouris,Lekkas,Marinos,Pavlou,Raptis,Sotiropoulos,Stamatopoulos,Zografos,Chronis,Gianopoulos,Kalogeropoulos,Pappademos,Lambros';
SURNAMES['europe-other'] = 'Kovacs,Nagy,Toth,Szabo,Horvath,Varga,Kiss,Molnar,Novak,Svoboda,Dvorak,Novotny,Cerny,Prochazka,Popescu,Ionescu,Popa,Constantin,Dumitru,Stan,Stoica,Gheorghe,Petrovic,Jovanovic,Nikolic,Markovic,Djordjevic,Ilic,Horvat,Kovacevic,Babic,Maric,Georgiev,Dimitrov,Kazlauskas,Jankauskas,Petrauskas,Berzins,Kalnins,Ozols,Tamm,Saar,Gruber,Bauer,Huber,Krasniqi,Gashi,Shehu,Peeters,Janssens,Etxeberria,Lindner,Kowal,Bianco';
SURNAMES.european = { mix: [['europe-other', 0.3], ['german', 0.15], ['italian', 0.1], ['english', 0.1], ['french', 0.08], ['polish', 0.08], ['dutch', 0.05], ['scandinavian', 0.05], ['greek', 0.05], ['portuguese', 0.04]] };

// The general American pool (English, Scots-Irish, German and Scandinavian names as they settled in the US):
// the surnames of Californians whose families have been American for generations.
SURNAMES.general = 'Smith:3,Johnson:2.4,Williams:2.1,Brown:1.9,Jones:1.9,Miller:1.6,Davis:1.6,Wilson:1.2,Anderson:1.2,Taylor:1.1,Thomas:1.1,Moore:1,Martin:1,Jackson:1,Thompson:1,White:1,Harris:0.95,Clark:0.9,Lewis:0.9,Robinson:0.85,Walker:0.85,Young:0.8,Allen:0.8,King:0.8,Wright:0.8,Scott:0.75,Hill:0.75,Green:0.75,Adams:0.75,Baker:0.75,Nelson:0.7,Carter:0.7,Mitchell:0.7,Roberts:0.7,Turner:0.7,Phillips:0.65,Campbell:0.65,Parker:0.65,Evans:0.65,Edwards:0.6,Collins:0.6,Stewart:0.6,Morris:0.6,Rogers:0.55,Reed:0.55,Cook:0.55,Morgan:0.55,Bell:0.55,Murphy:0.55,Bailey:0.5,Cooper:0.5,Howard:0.5,Ward:0.5,Cox:0.5,Richardson:0.5,Watson,Brooks,Wood,Hughes,Price,Sanders,Myers,Long,Ross,Foster,Powell,Jenkins,Perry,Russell,Sullivan,Coleman,Butler,Henderson,Barnes,Fisher,Hayes,Graham,Wallace,Cole,West,Owens,Reynolds,Ellis,Harrison,Gibson,McDonald,Marshall,Murray,Freeman,Wells,Webb,Simpson,Stevens,Tucker,Porter,Hunter,Hicks,Crawford,Henry,Boyd,Mason,Kennedy,Warren,Dixon,Burns,Gordon,Shaw,Holmes,Rice,Robertson,Hunt,Black,Daniels,Palmer,Mills,Grant,Knight,Ferguson,Stone,Hawkins,Dunn,Perkins,Hudson,Spencer,Gardner,Stephens,Payne,Pierce,Berry,Matthews,Arnold,Wagner,Willis,Ray,Watkins,Olson,Carroll,Duncan,Snyder,Hart,Cunningham,Bradley,Lane,Andrews,Harper,Fox,Riley,Armstrong,Carpenter,Weaver,Greene,Lawrence,Elliott,Sims,Austin,Peters,Kelley,Franklin,Lawson,Fields,Ryan,Schmidt,Carr,Wheeler,Chapman,Oliver,Montgomery,Richards,Williamson,Johnston,Banks,Meyer,Bishop,McCoy,Howell,Morrison,Hansen,Harvey,Little,Burton,Stanley,George,Jacobs,Reid,Fuller,Lynch,Dean,Gilbert,Garrett,Welch,Larson,Frazier,Burke,Hanson,Day,Bowman,Fowler';
SURNAMES.american = 'general';

// Native Californians and Native Americans from elsewhere (Navajo, Cherokee, Lakota, Lumbee families in
// Los Angeles and the Bay Area) mostly carry Spanish or English surnames; a share carry family names
// particular to Native communities.
SURNAMES['native-own'] = 'Begay,Yazzie,Tsosie,Benally,Nez,Chee,Etsitty,Tso,Jim,Charley,Tom,Joe,Billy,Sam,Pete,Jack,Frank,Johnny,Hostler,Masten,Norton,Pratt,Risling,Whitehorse,Yellowhorse,Locklear,Oxendine,Youngblood,Silversmith,Harjo,Chavis,Swimmer,Lowry,Brewer,Hunt,Jacobs,Tsinajinnie,Bitsui,Lente,Cachora';
SURNAMES.native = { mix: [['general', 0.5], ['mexican', 0.25], ['native-own', 0.25]] };

// Pacific Islanders: Samoan and Tongan families (the largest groups in California), Native Hawaiian,
// Chamorro (Guam) and Fijian, including the Indo-Fijian families of Sacramento.
SURNAMES.pacific = 'Faleolo,Fuimaono,Leota,Mataafa,Tauiliili,Faamausili,Tuialii,Aumua,Fonoti,Seumalo,Taufa,Fifita,Vaipulu,Havili,Moala,Latu,Hufanga,Pulu,Mahe,Tonga,Fonua,Vake,Lolo,Afamasaga,Amituanai,Iosefa,Faleafa,Fanene,Lauina,Leiataua,Masoe,Paepae,Sefo,Soliai,Tagaloa,Toleafoa,Tuimavave,Kealoha,Akana,Kalani,Kamakana,Kahale,Kanahele,Kaleo,Keawe,Makua,Kamaka,Kahananui,Cruz,Santos,Camacho,Blas,Taitano,Quinata,Sablan,Aguon,San Nicolas,Mendiola,Guerrero,Borja,Toves,Unpingco,Salas,Babauta,Tenorio,Charfauros,Duenas,Pangelinan,Quitugua,Prasad,Chand,Lal,Naidu,Tuivaga,Naivalu,Tabua';

// California at large, for Californians of more than one heritage and of other or unstated origin.
SURNAMES.california = { mix: [['general', 0.46], ['mexican', 0.24], ['african-american', 0.06], ['chinese', 0.05], ['filipino', 0.05], ['vietnamese', 0.03], ['korean', 0.02], ['japanese', 0.02], ['indian', 0.03], ['armenian', 0.01], ['iranian', 0.01], ['german', 0.02]] };
SURNAMES.multiracial = { mix: [['general', 0.45], ['mexican', 0.2], ['african-american', 0.1], ['filipino', 0.06], ['japanese', 0.05], ['chinese', 0.05], ['korean', 0.03], ['pacific', 0.03], ['native-own', 0.03]] };
SURNAMES.other = 'california';

// ------------------------------------------------------------------ heritage configuration
// For each heritage key: the given-name tradition, the surname pool, `keep` = the chance that a person of
// generation 1 / 2 / 3+ carries a name from the heritage tradition rather than the general California pool
// of their cohort (immigrants nearly always; their US-born children often; grandchildren seldom, more so
// where heritage names stay strong in the US, e.g. Sikh, Arab, Armenian families), `us` = the tradition
// whose US-born lists the second and third generations draw heritage names from, and `nick` = the nickname
// customs that apply (see NICKNAMES).

const cfg = (given, sur, keep, nick, extra) => Object.freeze(Object.assign({ given, sur, keep: Object.freeze(keep), nick: Object.freeze(nick) }, extra || {}));
const ES = ['es', 'en'], EN = ['en'];

/** Naming configuration per heritage key: {given, sur, keep: [generation 1, 2, 3+], nick, us?, multi?, religiousName?}. */
const NAMING = Object.freeze({
  mexican: cfg('mexican', 'mexican', [0.97, 0.5, 0.18], ES),
  salvadoran: cfg('centralam', 'salvadoran', [0.97, 0.45, 0.15], ES, { us: 'mexican' }),
  guatemalan: cfg('centralam', 'guatemalan', [0.97, 0.45, 0.15], ES, { us: 'mexican' }),
  honduran: cfg('centralam', 'honduran', [0.97, 0.45, 0.15], ES, { us: 'mexican' }),
  nicaraguan: cfg('centralam', 'nicaraguan', [0.97, 0.45, 0.15], ES, { us: 'mexican' }),
  puertorican: cfg('caribhisp', 'puertorican', [0.95, 0.4, 0.15], ES, { us: 'mexican' }),
  cuban: cfg('caribhisp', 'cuban', [0.97, 0.4, 0.15], ES, { us: 'mexican' }),
  dominican: cfg('caribhisp', 'dominican', [0.97, 0.45, 0.15], ES, { us: 'mexican' }),
  southamerican: cfg('southam', 'southamerican', [0.96, 0.4, 0.12], ES, { us: 'mexican' }),
  spanish: cfg('spain', 'spanish', [0.95, 0.3, 0.1], ES, { us: 'mexican' }),
  latino: cfg('latino', 'latino', [0.96, 0.45, 0.15], ES, { us: 'mexican' }),

  chinese: cfg('chinese', 'chinese', [0.97, 0.22, 0.08], ['zh', 'en']),
  filipino: cfg('filipino', 'filipino', [0.98, 0.45, 0.2], ['fil', 'es', 'en', 'filpet']),
  vietnamese: cfg('vietnamese', 'vietnamese', [0.98, 0.35, 0.1], ['vi', 'en']),
  korean: cfg('korean', 'korean', [0.97, 0.5, 0.2], ['ko', 'en']),
  japanese: cfg('japanese', 'japanese', [0.97, 0.35, 0.18], ['ja', 'en']),
  indian: cfg('indian', 'indian', [0.98, 0.65, 0.35], ['in', 'en']),
  hmong: cfg('hmong', 'hmong', [0.98, 0.35, 0.12], EN),
  cambodian: cfg('cambodian', 'cambodian', [0.98, 0.3, 0.1], EN),
  lao: cfg('lao', 'lao', [0.98, 0.3, 0.1], ['lo', 'en']),
  thai: cfg('thai', 'thai', [0.98, 0.3, 0.1], ['th', 'en']),
  pakistani: cfg('pakistani', 'pakistani', [0.98, 0.75, 0.5], ['in', 'ar', 'en']),
  bangladeshi: cfg('bangladeshi', 'bangladeshi', [0.98, 0.75, 0.5], ['in', 'ar', 'en']),
  sikh: cfg('sikh', 'sikh', [0.99, 0.8, 0.55], ['pa', 'in', 'en', 'papet'], { religiousName: { M: 'Singh', F: 'Kaur' }, religiousKeep: [0.97, 0.9, 0.75] }),
  afghan: cfg('afghan', 'afghan', [0.98, 0.75, 0.5], ['ar', 'fa', 'en']),
  burmese: cfg('burmese', 'burmese', [0.98, 0.35, 0.1], EN),
  indonesian: cfg('indonesian', 'indonesian', [0.97, 0.3, 0.1], EN),
  asian: cfg('asian', 'asian', [0.95, 0.25, 0.08], ['zh', 'en']),

  'african-american': cfg('african-american', 'african-american', [0.7, 0.62, 0.6], EN),
  ethiopian: cfg('ethiopian', 'ethiopian', [0.98, 0.6, 0.3], ['et', 'en']),
  nigerian: cfg('nigerian', 'nigerian', [0.97, 0.55, 0.3], ['ng', 'en']),
  caribbean: cfg('caribbean', 'caribbean', [0.95, 0.4, 0.2], EN),
  african: cfg('african', 'african', [0.95, 0.5, 0.25], ['ar', 'en']),

  armenian: cfg('armenian', 'armenian', [0.98, 0.55, 0.3], ['hy', 'ru', 'en']),
  iranian: cfg('iranian', 'iranian', [0.98, 0.45, 0.2], ['fa', 'en']),
  arab: cfg('arab', 'arab', [0.98, 0.6, 0.3], ['ar', 'en']),
  assyrian: cfg('assyrian', 'assyrian', [0.98, 0.55, 0.3], ['ar', 'en']),
  russian: cfg('russian', 'russian', [0.97, 0.35, 0.1], ['ru', 'en']),
  ukrainian: cfg('ukrainian', 'ukrainian', [0.97, 0.4, 0.12], ['uk', 'ru', 'en']),
  polish: cfg('polish', 'polish', [0.97, 0.25, 0.05], ['pl', 'en']),
  irish: cfg('irish', 'irish', [0.97, 0.3, 0.15], EN),
  italian: cfg('italian', 'italian', [0.97, 0.35, 0.15], ['it', 'en']),
  german: cfg('german', 'german', [0.97, 0.2, 0.05], ['de', 'en']),
  english: cfg('english', 'english', [0.97, 0.15, 0.05], EN),
  scottish: cfg('scottish', 'scottish', [0.97, 0.15, 0.05], EN),
  french: cfg('french', 'french', [0.97, 0.2, 0.05], ['fr', 'en']),
  portuguese: cfg('portuguese', 'portuguese', [0.98, 0.35, 0.15], ['pt', 'en']),
  dutch: cfg('dutch', 'dutch', [0.97, 0.2, 0.05], EN),
  scandinavian: cfg('scandinavian', 'scandinavian', [0.97, 0.2, 0.05], EN),
  greek: cfg('greek', 'greek', [0.98, 0.45, 0.2], ['el', 'en']),
  european: cfg('european', 'european', [0.95, 0.15, 0.03], EN),
  american: cfg('general', 'general', [0, 0, 0], EN),

  native: cfg('general', 'native', [0, 0, 0], EN),
  pacific: cfg('pacific', 'pacific', [0.97, 0.45, 0.3], EN),
  multiracial: cfg('general', 'multiracial', [0, 0, 0], EN, { multi: true }),
  other: cfg('general', 'other', [0, 0, 0], EN),
});

/** Every heritage key of CONTRACTS §5, the vocabulary shared by names, lexicon, persona and dialogue. */
export const NAME_HERITAGES = Object.freeze(Object.keys(NAMING));

// Mixed traditions used by `latino` and by multiracial Californians (their families' tradition when the
// name is not from the general pool), weighted by how often each appears among them in California.
GIVEN.latino = {
  mix: [['mexican', [0.62, 0.62, 0.6, 0.6]], ['centralam', [0.16, 0.18, 0.2, 0.2]], ['southam', [0.12, 0.12, 0.12, 0.12]], ['caribhisp', [0.1, 0.08, 0.08, 0.08]]],
};
const MULTI_MIX = [['mexican', 0.34], ['african-american', 0.2], ['filipino', 0.1], ['japanese', 0.08], ['chinese', 0.06], ['korean', 0.05], ['pacific', 0.05], ['irish', 0.04], ['italian', 0.04], ['portuguese', 0.02], ['armenian', 0.02]];

// ------------------------------------------------------------------ nicknames
// Keys are given names folded to lowercase ASCII (normName). Values list nicknames, most usual first, with
// optional markers: '@M' or '@F' when the nickname suits one sex only (left out when the sex is unknown),
// then an age marker: '+' used for people 40 and over, '-' under 40, '~' children under 16, '^' adults.
// vi / ko are the English names many Vietnamese and Korean immigrants use day to day (by sex; Korean ones by
// the first syllable); zh draws from the English names Hong Kong, Taiwan and mainland immigrants adopt.
/** Nickname customs: {custom: {foldedGivenName: "Nick,Nick+,..."}}, with vi and ko split by sex. */
const NICKNAMES = {
  es: {
    jose: 'Pepe+,Joe,Chepe+,Pepito~', francisco: 'Pancho,Paco,Frank-,Kiko~', jesus: 'Chuy,Chucho', guadalupe: 'Lupe,Lupita@F~',
    roberto: 'Beto,Bob+', alberto: 'Beto', humberto: 'Beto', gilberto: 'Beto,Gil', ignacio: 'Nacho', enrique: 'Kike,Henry-',
    eduardo: 'Lalo,Eddie', gerardo: 'Lalo,Jerry', alfredo: 'Freddy,Fredo', guillermo: 'Memo,Willy', federico: 'Fede',
    rosario: 'Chayo', consuelo: 'Chelo', socorro: 'Coco', concepcion: 'Concha,Conchita', dolores: 'Lola,Lolita~',
    graciela: 'Chela', isabel: 'Chabela,Isa', mercedes: 'Meche', margarita: 'Mago,Maggie-', rafael: 'Rafa',
    antonio: 'Toño,Tony,Toñito~', manuel: 'Manny,Meme', salvador: 'Chava,Sal', santiago: 'Santi', sebastian: 'Sebas',
    alejandro: 'Alex,Jandro', alejandra: 'Ale,Alex', rodolfo: 'Rudy,Fito', adolfo: 'Fito', ramon: 'Moncho', joaquin: 'Quino,Joaco',
    luis: 'Wicho,Lucho', francisca: 'Paquita,Pancha', josefina: 'Chepina,Pina', alicia: 'Licha', leticia: 'Lety', patricia: 'Paty',
    veronica: 'Vero', gabriela: 'Gaby', beatriz: 'Bety', gregorio: 'Goyo', ernesto: 'Neto', andres: 'Andy', carlos: 'Charly,Carlitos~',
    juan: 'Johnny-,Juanito~', pedro: 'Pete,Pedrito~', miguel: 'Mike-,Miguelito~', maria: 'Mari', ana: 'Anita', rosa: 'Rosita',
    lourdes: 'Lulu', jorge: 'Coque,George-', javier: 'Javi', fernando: 'Nando,Fer', ricardo: 'Ricky,Richie', raul: 'Rulo',
    teresa: 'Tere', yolanda: 'Yoli', sofia: 'Sofi', valentina: 'Vale', camila: 'Cami', ximena: 'Xime', mariana: 'Mari',
    natalia: 'Naty', fatima: 'Faty', esperanza: 'Espe', trinidad: 'Trini', mateo: 'Teo', emiliano: 'Emi', maximiliano: 'Max,Maxi',
    leonardo: 'Leo', angel: 'Angelito~', daniel: 'Dani', fernanda: 'Fer,Fernandita~', regina: 'Gina', santos: 'Santi',
    wilfredo: 'Willy', william: 'Willy', mauricio: 'Mauro', reinaldo: 'Rey', rigoberto: 'Rigo', florentino: 'Tino', agustin: 'Agus',
    armando: 'Mando', osvaldo: 'Ozzie',
  },
  en: {
    william: 'Bill+,Will,Billy~,Willie+', robert: 'Bob+,Rob,Bobby,Robbie~', richard: 'Rick,Rich,Dick+,Richie~', james: 'Jim,Jimmy,Jamie-',
    john: 'Johnny,Jack+', michael: 'Mike,Mikey~,Mick+', thomas: 'Tom,Tommy', joseph: 'Joe,Joey', charles: 'Charlie,Chuck+', christopher: 'Chris',
    matthew: 'Matt', daniel: 'Dan,Danny', david: 'Dave', anthony: 'Tony,Ant-', edward: 'Ed,Eddie,Ted+', benjamin: 'Ben,Benny~',
    nicholas: 'Nick,Nicky~', alexander: 'Alex,Xander-', samuel: 'Sam,Sammy~', jonathan: 'Jon,Johnny', andrew: 'Andy,Drew-', steven: 'Steve',
    stephen: 'Steve', timothy: 'Tim,Timmy~', kenneth: 'Ken,Kenny', ronald: 'Ron,Ronnie', donald: 'Don,Donnie', gerald: 'Jerry',
    lawrence: 'Larry', raymond: 'Ray', gregory: 'Greg', jeffrey: 'Jeff', patrick: 'Pat,Paddy+', peter: 'Pete', zachary: 'Zach',
    joshua: 'Josh', jacob: 'Jake', nathan: 'Nate', nathaniel: 'Nate,Nat', frederick: 'Fred,Freddie', henry: 'Hank+,Harry',
    theodore: 'Theo,Ted+,Teddy~', elizabeth: 'Liz,Beth,Betty+,Lizzie~,Eliza-', katherine: 'Kate,Katie,Kathy+,Kat-', catherine: 'Cathy+,Cat-,Kate',
    kathryn: 'Kathy,Kate,Katie', margaret: 'Peggy+,Maggie,Meg,Margie+', jennifer: 'Jen,Jenny', jessica: 'Jess,Jessie', rebecca: 'Becky,Becca-',
    deborah: 'Debbie,Deb', susan: 'Sue,Susie', patricia: 'Pat+,Patty,Trish', barbara: 'Barb', victoria: 'Vicky,Tori-', samantha: 'Sam,Sammy',
    alexandra: 'Alex,Lexi-,Sasha', christina: 'Chris,Tina', christine: 'Chris,Chrissy', kimberly: 'Kim,Kimmy~', pamela: 'Pam', cynthia: 'Cindy',
    judith: 'Judy', dorothy: 'Dot+,Dottie+', abigail: 'Abby', madison: 'Maddie', isabella: 'Bella,Izzy', gabrielle: 'Gabby', olivia: 'Liv,Livvy~',
    natalie: 'Nat', theresa: 'Terri,Tess', josephine: 'Jo,Josie', melissa: 'Missy,Mel', stephanie: 'Steph', jacqueline: 'Jackie', valerie: 'Val',
    nicole: 'Nikki', amanda: 'Mandy', kathleen: 'Kathy,Kath', frances: 'Fran,Frannie', virginia: 'Ginny,Ginger+', francis: 'Frank,Fran',
    ashley: 'Ash', emily: 'Em,Emmy~', victor: 'Vic', vincent: 'Vince,Vinnie', walter: 'Walt', albert: 'Al,Bert', alfred: 'Al,Alfie',
    arthur: 'Art', harold: 'Hal+', leonard: 'Len,Lenny', louis: 'Lou', ernest: 'Ernie', eugene: 'Gene', douglas: 'Doug', terrence: 'Terry',
    reginald: 'Reggie', elijah: 'Eli', gabriel: 'Gabe', jeremiah: 'Jerry', isaiah: 'Ike+,Zay-', maximilian: 'Max', leonardo: 'Leo',
    sebastian: 'Seb,Bash-', cameron: 'Cam', jordan: 'Jordy~', mackenzie: 'Kenzie', alyssa: 'Aly', danielle: 'Dani', gabriela: 'Gabby',
    beverly: 'Bev', bernadette: 'Bernie', geraldine: 'Gerry', gwendolyn: 'Gwen',
  },
  fil: {
    rodolfo: 'Rudy,Dolfo', roberto: 'Bobby,Bert', antonio: 'Tony,Anton', jose: 'Pepe,Joey,Jojo', rolando: 'Lando,Roly', reynaldo: 'Rey,Naldo',
    danilo: 'Danny', eduardo: 'Eddie,Edong+', leonardo: 'Leo,Nardo', vicente: 'Enteng+,Vince', romeo: 'Romy,Meo', ricardo: 'Ricky,Carding+',
    ramon: 'Mon', fernando: 'Nando,Ferdie', gregorio: 'Greg,Gorio', ernesto: 'Erning+,Ernie', alfredo: 'Fred,Freddie', ronaldo: 'Ronnie,Ron',
    edgardo: 'Edgar,Ed', ferdinand: 'Ferdie,Andy', teresita: 'Tess,Tessie,Tita', erlinda: 'Linda,Erly', rosario: 'Charing+,Rose', lourdes: 'Lulu,Des',
    josefina: 'Pining+,Josie', remedios: 'Medy', leticia: 'Letty', carmelita: 'Mely,Lita', evangeline: 'Vangie', concepcion: 'Connie,Ching',
    natividad: 'Naty', milagros: 'Mila', felicidad: 'Fely', marites: 'Tess', maricel: 'Cel', marilou: 'Malou', rowena: 'Weng', jocelyn: 'Joy,Joyce',
    analyn: 'Ana', jennylyn: 'Jen', maribel: 'Belle', rosemarie: 'Rose', luzviminda: 'Luz,Minda', kristine: 'Tin,Tintin-', patricia: 'Pat,Pia',
    angelica: 'Gel', florencio: 'Flor', marcelino: 'Marcy,Celing+', virgilio: 'Virgie,Gilio+', rogelio: 'Roger,Ogie', restituto: 'Toto',
    crisanto: 'Santi', celestino: 'Tino', zenaida: 'Zeny', imelda: 'Mel,Imee', editha: 'Edith', charito: 'Cha', perla: 'Perl',
  },
  ja: {
    hiroshi: 'Hiro', takashi: 'Tak', kazuo: 'Kaz', masao: 'Mas', shigeru: 'Shig', toshio: 'Tosh', mitsuo: 'Mits', isamu: 'Sam', minoru: 'Min',
    tadashi: 'Tad', yoshio: 'Yosh', kiyoshi: 'Kiyo', takeshi: 'Tak,Take', kenji: 'Ken', kenichi: 'Ken', kazuhiro: 'Kaz', hiroyuki: 'Hiro',
    hiroki: 'Hiro', masahiro: 'Masa', tetsuya: 'Tets', yoshiaki: 'Yosh', haruo: 'Haru', saburo: 'Sab', noboru: 'Nobo', masaru: 'Mas',
    michiko: 'Michi', yoshiko: 'Yoshi', fumiko: 'Fumi', kiyoko: 'Kiyo', mariko: 'Mari', emiko: 'Emi', sachiko: 'Sachi', kazuko: 'Kazu',
    masako: 'Masa', tomoko: 'Tomo', hisako: 'Hisa', keiko: 'Kei', yukiko: 'Yuki', akiko: 'Aki', noriko: 'Nori', yumiko: 'Yumi', naoko: 'Nao',
    kumiko: 'Kumi', mayumi: 'Mayu', megumi: 'Meg', setsuko: 'Setsu', chiyoko: 'Chiyo', haruko: 'Haru', toshiko: 'Toshi',
  },
  in: {
    rajesh: 'Raj', rajendra: 'Raju', rajinder: 'Raj', venkatesh: 'Venky,Venkat', srinivas: 'Srini,Cheenu', srinivasan: 'Srini',
    subramaniam: 'Subbu,Mani', krishna: 'Kris,Kittu~', krishnamurthy: 'Krish', siddharth: 'Sid', abhishek: 'Abhi', aniruddh: 'Ani', aditya: 'Adi',
    nikhil: 'Nik', harish: 'Hari', lakshmi: 'Lucky', jayalakshmi: 'Jaya', vijayalakshmi: 'Viji', bhagyalakshmi: 'Bhagya', padmavathi: 'Padma',
    meenakshi: 'Meena', anuradha: 'Anu', radhika: 'Radha', anjali: 'Anju', kavitha: 'Kavi', srikanth: 'Sri', sriram: 'Sri', ramakrishna: 'Ramki',
    balakrishnan: 'Balu', gopalakrishnan: 'Gopi', chandrasekhar: 'Chandu', satyanarayana: 'Satya', venkateswarlu: 'Venky', vijay: 'VJ',
    sanjay: 'Sanju', deepak: 'Deep', muhammad: 'Mo', mohammad: 'Mo', mohammed: 'Mo', shakuntala: 'Shaku', rukmini: 'Rukku', sarojini: 'Saroj',
    raghavan: 'Raghu', ramachandran: 'Ram', narayanan: 'Narayan', jayakumar: 'Jay', sathish: 'Sat', ganesh: 'Ganu~', varun: 'Vaz-',
  },
  pa: {
    gurpreet: 'Gary@M,Preet,Guri', harpreet: 'Harry@M,Preet', manpreet: 'Manny@M,Preet', jaspreet: 'Jas,Jassi', sukhwinder: 'Sukhi', rajinder: 'Raj',
    harjit: 'Harry@M', harjinder: 'Harry@M', amandeep: 'Aman,Mandy@F', navdeep: 'Nav', sandeep: 'Sandy,Sunny@M', jaswinder: 'Jas', navjot: 'Nav',
    prabhjot: 'Prabh', simranjit: 'Simran,Simi', jaskaran: 'Jas,Karan', gurnoor: 'Noor', jasleen: 'Jas', ramandeep: 'Raman', mandeep: 'Mandy@F,Mani',
    kamaljit: 'Kam', lovepreet: 'Love', arshdeep: 'Arsh', gagandeep: 'Gagan', rupinder: 'Rupi', baljit: 'Bal', paramjit: 'Pammi@F', balwinder: 'Bally',
    sukhdev: 'Sukhi', kulwinder: 'Kulli', jasmeet: 'Jas', gurwinder: 'Guri', harmanpreet: 'Harman', parminder: 'Pammi@F', harvinder: 'Harry@M',
  },
  hy: {
    hovhannes: 'Hovo,John-', ohannes: 'Hovo', gevorg: 'Gevo,George', kevork: 'George', hakob: 'Jack', hagop: 'Jack', grigor: 'Greg',
    krikor: 'Greg', petros: 'Peter', bedros: 'Peter', sarkis: 'Sako', sargis: 'Sako', avedis: 'Avo', avetis: 'Avo', karapet: 'Gary,Karo',
    garabed: 'Gary,Garo', harutyun: 'Harut,Harry', haroutioun: 'Harout,Harry', khachatur: 'Khach', tigran: 'Tiko', vahagn: 'Vahe',
    anahit: 'Ani', anahid: 'Ani', ruzanna: 'Ruzan', margarit: 'Maggie', armenak: 'Armo', armen: 'Armo', ashot: 'Ash', hovsep: 'Joe,Hovo',
  },
  fa: {
    mohammad: 'Mamad,Mo', ebrahim: 'Ebi', kourosh: 'Cyrus', dariush: 'Darius', fariborz: 'Fred', fereydoun: 'Fred', mansour: 'Manny',
    babak: 'Bobby', fatemeh: 'Fati', maryam: 'Mary,Mimi', mahnaz: 'Mona', shahla: 'Sheila', parvaneh: 'Pari', zahra: 'Zari', masoumeh: 'Masi',
    esmaeil: 'Esi', alireza: 'Ali', mohammadreza: 'Reza', hooshang: 'Hoshi', khosrow: 'Khosi', faramarz: 'Fari', ashraf: 'Ashi',
  },
  ar: {
    mohammed: 'Moe,Hamoudi~', muhammad: 'Moe', mohamed: 'Moe', mohammad: 'Moe', mustafa: 'Mo', mostafa: 'Mo', mahmoud: 'Mo', youssef: 'Joe',
    yousef: 'Joe', yousif: 'Joe', yusuf: 'Joe', ibrahim: 'Abe', suleiman: 'Sully', elias: 'Eli', georges: 'George', michel: 'Mike',
    antoine: 'Tony', youkhana: 'John', gewargis: 'George', benyamin: 'Ben', shimon: 'Simon', toma: 'Tom', ashur: 'Ash', ashour: 'Ash',
    ninos: 'Nino', abdullah: 'Abdu', abdulrahman: 'Abdu', khalil: 'Kal', jamal: 'Jay',
  },
  ru: {
    alexander: 'Sasha,Shura+', aleksandr: 'Sasha', aleksei: 'Lyosha,Alyosha', alexei: 'Lyosha,Alyosha', andrei: 'Andryusha~', dmitri: 'Dima',
    mikhail: 'Misha', vladimir: 'Volodya,Vova', sergei: 'Seryozha', nikolai: 'Kolya', ivan: 'Vanya', pavel: 'Pasha', evgeny: 'Zhenya',
    konstantin: 'Kostya', anatoly: 'Tolya', viktor: 'Vitya', vyacheslav: 'Slava', yuri: 'Yura', boris: 'Borya', maxim: 'Max', grigory: 'Grisha',
    yakov: 'Yasha', pyotr: 'Petya', vasily: 'Vasya', leonid: 'Lyonya', stanislav: 'Stas', vladislav: 'Vlad', ilya: 'Ilyusha~', alexandra: 'Sasha',
    anastasia: 'Nastya', ekaterina: 'Katya', elena: 'Lena', natalia: 'Natasha', tatiana: 'Tanya', svetlana: 'Sveta', olga: 'Olya', irina: 'Ira',
    maria: 'Masha', yulia: 'Yulya', lyudmila: 'Lyuda,Mila', galina: 'Galya', nadezhda: 'Nadya', lyubov: 'Lyuba', ksenia: 'Ksyusha',
    evgenia: 'Zhenya', valentina: 'Valya', larisa: 'Lara', margarita: 'Rita', daria: 'Dasha', sofia: 'Sonya', polina: 'Polya', anna: 'Anya',
    victoria: 'Vika', elizaveta: 'Liza', veronika: 'Nika', artem: 'Tyoma', kirill: 'Kirya', timofei: 'Tima', semyon: 'Syoma', efim: 'Fima',
  },
  uk: {
    oleksandr: 'Sasha', mykola: 'Kolya', volodymyr: 'Volodya', vasyl: 'Vasya', mykhailo: 'Misha', serhiy: 'Seryozha', oleksiy: 'Lyosha',
    dmytro: 'Dima', yevhen: 'Zhenya', yuriy: 'Yura', bohdan: 'Bodya', petro: 'Petya', kateryna: 'Katya', olena: 'Lena', nataliya: 'Natasha',
    tetiana: 'Tanya', iryna: 'Ira', mariya: 'Masha', svitlana: 'Sveta', halyna: 'Halya', liudmyla: 'Lyuda', nadiya: 'Nadya', olha: 'Olya',
    yuliya: 'Yulya', anastasiya: 'Nastya', khrystyna: 'Khrystya', sofiya: 'Sonya', oleksandra: 'Sasha', taras: 'Tarasyk~', andriy: 'Andriyko~',
  },
  pl: {
    krzysztof: 'Krzys', malgorzata: 'Gosia', katarzyna: 'Kasia', agnieszka: 'Aga', aleksandra: 'Ola', wojciech: 'Wojtek', grzegorz: 'Grzesiek',
    tomasz: 'Tomek', jan: 'Janek', stanislaw: 'Stan,Stas', jozef: 'Jozek', elzbieta: 'Ela', joanna: 'Asia', barbara: 'Basia', zofia: 'Zosia',
    anna: 'Ania', maria: 'Marysia', jadwiga: 'Jadzia', tadeusz: 'Tadek', ryszard: 'Rysiek', magdalena: 'Madzia', piotr: 'Piotrek',
    jakub: 'Kuba', aleksander: 'Olek', zuzanna: 'Zuzia', wiktoria: 'Wika', kazimierz: 'Kazik', wladyslaw: 'Wladek', bronislawa: 'Bronia',
  },
  it: {
    giuseppe: 'Joe,Peppe,Pino', giovanni: 'Gianni,John', francesco: 'Franco,Frank', salvatore: 'Sal,Toto', antonio: 'Tony,Nino',
    vincenzo: 'Vince,Enzo', domenico: 'Dom,Mimmo', luigi: 'Gigi', alessandro: 'Sandro,Alex', giuseppina: 'Pina,Josie', francesca: 'Franca,Frankie',
    rosaria: 'Rosie', concetta: 'Connie,Tina', giovanna: 'Gianna,Jenny', caterina: 'Rina', antonietta: 'Etta,Toni', gaetano: 'Guy',
    raffaele: 'Lello', carmine: 'Carmie', maurizio: 'Mauri', massimiliano: 'Max', massimo: 'Max', federica: 'Fede', annunziata: 'Nancy',
  },
  pt: {
    jose: 'Zé,Joe', manuel: 'Manny,Mané', antonio: 'Tony,Tó', joao: 'Johnny', francisco: 'Chico,Frank', joaquim: 'Quim', fernando: 'Nando',
    conceicao: 'São', margarida: 'Guida', fernanda: 'Nanda', manuela: 'Nela', alfredo: 'Fred', albertina: 'Tina', ermelinda: 'Linda',
  },
  el: {
    konstantinos: 'Kostas,Gus,Dean', dimitrios: 'Jimmy,Jim,Dimitri', georgios: 'George', panagiotis: 'Pete,Takis', ioannis: 'John,Yiannis',
    nikolaos: 'Nick,Nikos', christos: 'Chris', athanasios: 'Tom,Thanasis', vasileios: 'Bill,Vasilis', spyridon: 'Spiro,Spyros',
    evangelos: 'Angelo,Vangelis', theodoros: 'Ted,Teddy', charalampos: 'Harry,Babis', stavros: 'Steve', apostolos: 'Paul,Tolis',
    michail: 'Mike,Michalis', emmanouil: 'Manolis', stylianos: 'Stelios', anastasios: 'Tasos', aikaterini: 'Katerina,Kathy', eleni: 'Helen',
    vasiliki: 'Vicky,Vasso', panagiota: 'Yiota,Peggy', konstantina: 'Dina', anastasia: 'Tasia', paraskevi: 'Voula,Vivi', theodora: 'Dora',
    ioanna: 'Joanna', kyriaki: 'Kiki', evangelia: 'Lia,Angie', athanasia: 'Soula', chrysoula: 'Chrysa', stavroula: 'Voula',
  },
  de: {
    wolfgang: 'Wolf', johannes: 'Hans', friedrich: 'Fritz', margarete: 'Grete', elisabeth: 'Lisa,Liesl', katharina: 'Kathi', heinrich: 'Heinz',
    joachim: 'Achim', matthias: 'Matze', christian: 'Chris', andreas: 'Andi', stefanie: 'Steffi', alexander: 'Alex', maximilian: 'Max',
  },
  fr: {
    'jean pierre': 'JP', 'jean claude': 'JC', philippe: 'Phil', frederic: 'Fred', christophe: 'Chris', dominique: 'Dom', nathalie: 'Nat',
    christine: 'Chris', isabelle: 'Isa', alexandre: 'Alex', guillaume: 'Will',
  },
  ng: {
    oluwaseun: 'Seun', oluwafemi: 'Femi', olufemi: 'Femi', babatunde: 'Tunde', olumide: 'Mide', adebayo: 'Bayo', oluwatobi: 'Tobi',
    chukwuemeka: 'Emeka', ifeanyi: 'Ify', oluwakemi: 'Kemi', funmilayo: 'Funmi', abimbola: 'Bimbo', temitope: 'Tope', damilola: 'Dami',
    adaeze: 'Ada', chiamaka: 'Amaka', chukwudi: 'Chudi', tochukwu: 'Tochi', obinna: 'Obi', ikechukwu: 'Ike', oluseyi: 'Seyi', olufunke: 'Funke',
    titilayo: 'Titi', omolara: 'Lara', oluwatoyin: 'Toyin', ayodele: 'Ayo', oladipo: 'Dipo', olusegun: 'Segun', oluwole: 'Wole', adewale: 'Wale',
    akinwale: 'Wale', kayode: 'Kay', chukwuebuka: 'Ebuka', kamsiyochukwu: 'Kamsi', somtochukwu: 'Somto', oluwanifemi: 'Nifemi', ifeoluwa: 'Ife',
    inioluwa: 'Ini', oluwadamilare: 'Dami', ayomide: 'Ayo', chinedu: 'Nedu', uchenna: 'Uche', nnamdi: 'Nam',
  },
  et: {
    tewodros: 'Teddy', bethlehem: 'Betty', selamawit: 'Selam', mekdelawit: 'Mekdi', eyerusalem: 'Eyeru', yohannes: 'John', abenezer: 'Abeni',
    natnael: 'Nati', amanuel: 'Amanu', habtamu: 'Habte', yordanos: 'Yordi', frehiwot: 'Frey',
  },
  // Adopted English names, by sex.
  vi: {
    M: {
      tuan: 'Tony', hung: 'Henry', dung: 'Danny,Dan', phuc: 'Peter,Phil', hai: 'Harry', huy: 'Henry,Huey', khoa: 'Kevin,Kyle', vinh: 'Vincent,Vinnie',
      binh: 'Ben,Benny', duc: 'David,Duke', duy: 'Danny', tam: 'Tom', long: 'Leo', minh: 'Mike,Mitch', nam: 'Nick', son: 'Sonny', kiet: 'Kenny',
      loc: 'Luke', thinh: 'Tim', tai: 'Ty', trung: 'Tony', hieu: 'Hugh,Hugo', quan: 'Quincy', phong: 'Paul', khang: 'Kenny', bao: 'Bobby',
      dat: 'David', tri: 'Trey', nhan: 'Nathan', phat: 'Pat', quoc: 'Kevin', viet: 'Victor', tien: 'Tim', thang: 'Tom', cuong: 'Kevin',
    },
    F: {
      lan: 'Lana,Lauren', linh: 'Linda,Lynn', huong: 'Helen', mai: 'May,Mimi', trang: 'Tracy', thuy: 'Tina,Tracy', hanh: 'Hannah', nga: 'Nina',
      hien: 'Helen', anh: 'Annie,Anna', vy: 'Vivian', uyen: 'Winnie', nhi: 'Nikki', ngan: 'Nancy', quynh: 'Quinn', diem: 'Diane', trinh: 'Trina',
      my: 'Mimi', tram: 'Tammy', han: 'Hannah', thu: 'Sue', yen: 'Yvonne', van: 'Vanessa', lien: 'Lily', xuan: 'Susan', thao: 'Theresa',
      hong: 'Rose', ngoc: 'Nancy', phuong: 'Fiona', oanh: 'Wendy', hang: 'Hannah', khanh: 'Kathy', huyen: 'Helen',
    },
  },
  ko: {
    M: {
      ji: 'Jay,John', jae: 'Jay,Jason', sung: 'Sam,Steve', seung: 'Sean,Sam', hyun: 'Henry,Hank+', min: 'Mike,Max', dong: 'Daniel,Don',
      jung: 'John,James', joon: 'John,June', jun: 'June,John', ki: 'Kevin', sang: 'Sam,Sean', tae: 'Tim,Tony', byung: 'Brian,Ben', jin: 'Jim',
      woo: 'Will', jong: 'John', ha: 'Harry', do: 'Don', young: 'Paul', kwang: 'Kenneth', chang: 'Charles', yong: 'Eugene',
      hyung: 'Hank', seo: 'Sean', si: 'Simon', chul: 'Charles', myung: 'Michael', kyung: 'Kevin', il: 'Eli',
    },
    F: {
      soo: 'Susie,Sue', eun: 'Eunice,Grace', hye: 'Helen,Grace', ji: 'Jenny,Jean,Jane', mi: 'Michelle,Mimi', kyung: 'Kay,Katherine', jung: 'Julie,June',
      min: 'Minnie,Michelle', sun: 'Sunny', yoon: 'Yvonne', ha: 'Hannah', so: 'Sophia,Sophie', seo: 'Sophia', da: 'Diana', na: 'Nancy', hee: 'Heidi',
      ah: 'Annie', chae: 'Chloe', su: 'Susan,Sue', young: 'Esther', myung: 'Mary', sook: 'Susan',
      hyun: 'Helen', in: 'Ina', ga: 'Gina', bo: 'Bonnie', jae: 'Jane', seon: 'Sunny', yeon: 'Yvonne', sang: 'Sandy',
    },
  },
};
// Pet names given regardless of the formal name.
const PET_NAMES = {
  filpet: { M: 'Jun,Boy,Bong,Jojo,Dodong,Toto', F: 'Baby,Girlie,Pinky,Inday,Neneng,Bing', minAge: 30, p: 0.12 },
  papet: { M: 'Sonu,Bittu,Goldy,Happy,Lucky,Bunty,Sunny,Rocky,Pinku,Bobby', F: 'Pinky,Dolly,Rimpy,Sweety,Neetu,Pammi,Rinku,Simmi,Babli,Rani', minAge: 0, p: 0.15 },
  th: { M: 'Lek,Noi,Ton,Boy,Big,Golf,Tum,Oat,Bank,Pond,Arm,Ice,Beer,New,Top,Toon,Jack,Nat', F: 'Noi,Nok,Lek,Nid,Joy,Ploy,Fon,Pim,Mint,Kwan,Aom,Ning,Nan,Pla,Ying,Bee,Gift,Fah', minAge: 0, p: 0.45 },
  lo: { M: 'Noy,Keo,Phet,Lek,Bee,Tou', F: 'Noy,Nok,Keo,Mone,Vanh,Nang', minAge: 0, p: 0.3 },
};
// Chance that a person whose name has a nickname in a custom goes by it.
const NICK_P = { es: 0.3, en: 0.25, fil: 0.35, ja: 0.35, in: 0.3, pa: 0.35, hy: 0.3, fa: 0.25, ar: 0.25, ru: 0.35, uk: 0.35, pl: 0.3, it: 0.3, pt: 0.3, el: 0.35, de: 0.25, fr: 0.2, ng: 0.4, et: 0.2, vi: 0.3, ko: 0.3, zh: 0.25 };

// ------------------------------------------------------------------ famous names
// Surnames that point to a single famous family are not in any pool (tests check this list), and full names
// that would point to a famous person are refused by givenName, nickname and nameFor when the surname is known.
/** Surnames kept out of every pool because they point to a single famous family. */
const EXCLUDED_SURNAMES = Object.freeze(('Kardashian,Kerkorian,Deukmejian,Tankian,Agassi,Kevorkian,Saroyan,Gagosian,Schwarzenegger,Zuckerberg,Bezos,Musk,' +
  'Spielberg,Disney,Getty,Hearst,Trump,Obama,Biden,Clinton,Nixon,Reagan,Pelosi,Newsom,Feinstein,Coppola,DiMaggio,Sinatra,Pacino,Scorsese,' +
  'Gotti,Capone,Ghirardelli,Mondavi,Gallo,Sebastiani,Giannini,Alioto,Ferrari,Lamborghini,Versace,Gucci,Armani,Prada,Fendi,Benetton,' +
  'Rockefeller,Vanderbilt,Carnegie,Huntington,Stanford,Crocker,Steinbeck,Einstein,Hanks,Clooney,Presley,Kennedy-Onassis,Marcos,Duterte,' +
  'Pacquiao,Macapagal,Magsaysay,Rizal,Mabini,Aguinaldo,Takei,Ohtani,Mineta,Korematsu,Pahlavi,Khomeini,Rouhani,Ahmadinejad,Mossadegh,' +
  'Omidyar,Aghdashloo,Amanpour,Arafat,Assad,Hariri,Mubarak,Nasrallah,Kasem,Shalhoub,Eshoo,Putin,Yeltsin,Gorbachev,Lenin,Stalin,' +
  'Tolstoy,Dostoevsky,Pushkin,Chekhov,Tchaikovsky,Nabokov,Kalashnikov,Kasparov,Navalny,Gagarin,Zelensky,Zelenskyy,Klitschko,Poroshenko,' +
  'Yanukovych,Yushchenko,Tymoshenko,Walesa,Chopin,Gandhi,Modi,Nehru,Tata,Ambani,Pichai,Nadella,Musharraf,Bhutto,Yousafzai,Karzai,Taraki,' +
  'Mengistu,Selassie,Obasanjo,Buhari,Achebe,Soyinka,Adichie,Olajuwon,Okonjo,Kipchoge,Mbeki,Mandela,Tutu,Hoxha,Onassis,Papandreou,' +
  'Mitsotakis,Tsipras,Dukakis,Stephanopoulos,Antetokounmpo,Tuiasosopo,Tuilagi,Sapolu,Polamalu,Seau,Mariota,Tagovailoa,Tupou,Mankiller,' +
  'Tallchief,Manuelito,Pol,Sandino,Somoza,Pastora,Chamorro,Ter-Petrosyan,Rajapaksa,Senanayake,Bandaranaike,Wangchuk,Nordstrom,Heinz,' +
  'Boeing,Kaling,Kurosawa,Bukele,Kahlo,Merkel').split(','));

/** Full names refused when the surname is known, because they would point to a famous person. */
const RESERVED_NAMES = ('Cesar Chavez|Dolores Huerta|Jennifer Lopez|George Lopez|Mario Lopez|Carlos Santana|Jerry Garcia|Andy Garcia|' +
  'Fernando Valenzuela|Vicente Fernandez|Alejandro Fernandez|Pedro Infante|Eva Longoria|Salma Hayek|Diego Luna|Ricky Martin|Celia Cruz|' +
  'Penelope Cruz|Ted Cruz|Gloria Estefan|Sammy Sosa|Pedro Martinez|David Ortiz|Alex Rodriguez|Sonia Sotomayor|Jose Canseco|Rita Moreno|' +
  'Jessica Alba|America Ferrera|Zoe Saldana|Cameron Diaz|Danny Trejo|Cheech Marin|Selena Gomez|Selena Quintanilla|Roberto Clemente|' +
  'Juan Soto|Fidel Castro|Raul Castro|Fulgencio Batista|Rafael Trujillo|Daniel Ortega|Oscar Romero|Diego Rivera|Francisco Villa|' +
  'Emiliano Zapata|Benito Juarez|Miguel Hidalgo|Alex Padilla|Xavier Becerra|Joan Baez|Vicente Fox|Jose Feliciano|Gloria Arroyo|Joseph Estrada|' +
  'Ruben Salazar|Anwar Sadat|Bruce Lee|Brandon Lee|Jackie Chan|Jacky Chan|Lucy Liu|Michelle Kwan|Kristi Yamaguchi|Michelle Yeoh|Sandra Oh|Margaret Cho|' +
  'John Cho|Jeremy Lin|Jack Ma|Lisa Su|Andrew Yang|Amy Tan|Maya Lin|Connie Chung|Jerry Yang|Eric Yuan|Ming Yao|Na Li|Andy Lau|' +
  'Jacky Cheung|Leslie Cheung|Tony Leung|Aaron Kwok|Kar-wai Wong|Michael Chang|Ali Wong|Xiaoping Deng|Yu-na Kim|Ji-sung Park|Randall Park|' +
  'Dat Nguyen|Ichiro Suzuki|Hideki Matsui|Doris Matsui|Robert Matsui|Yoko Ono|Haruki Murakami|Takashi Murakami|Ken Watanabe|Daniel Inouye|' +
  'Mike Honda|Judy Chu|Corazon Aquino|Cory Aquino|Sunisa Lee|Suni Lee|Kamala Harris|Nikki Haley|Dev Patel|Priyanka Chopra|Imran Khan|' +
  'Atif Aslam|Muhammad Ali|Arjun Kapoor|Anil Kapoor|Raj Kapoor|Rishi Kapoor|Aishwarya Rai|Ralph Nader|Saddam Hussein|Omar Sharif|' +
  'Mahmoud Darwish|Asghar Farhadi|Dmitri Medvedev|Dmitry Medvedev|Daniil Medvedev|Ivan Pavlov|Taras Shevchenko|Andriy Shevchenko|' +
  'Leonid Kravchuk|Robert Lewandowski|Andrzej Duda|Steve Wozniak|Steven Wozniak|Stephen Wozniak|John Kennedy|Robert Kennedy|' +
  'Edward Kennedy|Ted Kennedy|Joseph Kennedy|Conan O\'Brien|Sinead O\'Connor|Gene Kelly|Grace Kelly|Michael Collins|Bill Murray|' +
  'Eddie Murphy|Colin Farrell|Conor McGregor|Ewan McGregor|Tom Brady|Tony Bennett|Dean Martin|Rudy Giuliani|Rudolph Giuliani|' +
  'Enrico Caruso|Levi Strauss|Boris Becker|Michael Schumacher|Ralf Schumacher|Kurt Russell|Robert Mueller|Thomas Mueller|' +
  'George Washington|Thomas Jefferson|Andrew Jackson|James Dean|Bill Gates|William Gates|Steve Young|Steven Young|Jerry Rice|' +
  'George Bush|Jimmy Carter|Gerald Ford|Michael Jordan|Michael Jackson|Janet Jackson|Samuel Jackson|Jesse Jackson|Phil Jackson|' +
  'Serena Williams|Venus Williams|Will Smith|Adam Smith|Booker Washington|Morgan Freeman|Kevin Hart|Jackie Robinson|Jesse Owens|' +
  'Carl Lewis|Toni Morrison|Jim Morrison|Diana Ross|Ray Charles|James Brown|Bill Russell|Jerry Brown|Willie Brown|Tom Bradley|' +
  'Pete Wilson|John Muir|Kevin McCarthy|Charles Schulz|Pete Carroll|George Lucas|James Cameron|Julia Roberts|George Harrison|' +
  'Boris Johnson|Emma Watson|Hugh Grant|Patrick Stewart|Gerard Butler|Andy Murray|Robert Burns|William Wallace|Thierry Henry|' +
  'Tony Parker|Devin Nunes|David Valadao|Tony Coelho|Jim Costa|Anne Frank|Dwayne Johnson|Kim Jong-un|Jong-un Kim|Rupert Murdoch|' +
  'Abraham Lincoln|John Adams|Harrison Ford|Martin Luther|Bruce Willis|Brad Pitt|Tom Cruise|Mark Twain|John Wayne|Paul Walker|Ben Carson|' +
  'Colin Powell|Condoleezza Rice|Barry Bonds|Willie Mays|Kobe Bryant|Stephen Curry|Klay Thompson|Joe Montana|Magic Johnson|' +
  'Shaquille O\'Neal|Tiger Woods|LeBron James|Oprah Winfrey|Denzel Washington|Malcolm X|Rosa Parks|Ice Cube|Kendrick Lamar|' +
  'Tupac Shakur|Snoop Dogg|Prince Harry|Taylor Swift|Elvis Presley|Johnny Cash|Bob Dylan|Bob Marley|Paul McCartney|John Lennon|' +
  'Ringo Starr|Elton John|David Bowie|Freddie Mercury|Ed Sheeran|Harry Styles|Mark Zuckerberg|Larry Page|Sergey Brin|Steve Jobs|' +
  'Walt Disney|Jeff Bezos|Elon Musk|Warren Buffett|Mike Tyson|Floyd Mayweather|Lionel Messi|Cristiano Ronaldo|David Beckham').split('|');

// ------------------------------------------------------------------ pools and weighted draws

const Z_GIVEN = 0.6;      // Zipf exponent over a ranked given-name list: the top name holds about 8% of its pool
const Z_SURNAME = 0.75;   // surnames are more concentrated than given names
const ERA_START = [-Infinity, 1960, 1980, 2000];
const BLEND_YEARS = 4;    // within this many years of an era boundary the next era's fashions blend in
const REF_YEAR = 2026;    // the population's reference year (birthYear = 2026 - age)
const NEIGHBOR_ERA = 0.12, BASE_SHARE = 0.5;   // shares of the neighbouring eras and of era-neutral lists in a pool

/** The four birth cohorts the given-name pools are organized by (index 0..3, as eraOf returns). */
export const ERAS = Object.freeze(['born before 1960', 'born 1960-1979', 'born 1980-1999', 'born 2000 and later']);

const FOLD = { 'ł': 'l', 'Ł': 'L', 'ø': 'o', 'Ø': 'O', 'æ': 'ae', 'Æ': 'Ae', 'ß': 'ss', 'đ': 'd', 'Đ': 'D', 'ı': 'i' };

/**
 * Fold a name for lookups: accents dropped, lowercase ASCII, hyphens and other separators as single spaces
 * ("José" → "jose", "Ji-hoon" → "ji hoon", "O'Brien" → "o'brien").
 * @param {string} s
 * @returns {string}
 */
export function normName(s) {
  let t = String(s == null ? '' : s);
  // accents and special letters only cost a Unicode pass when there are any
  if (/[^\x00-\x7f]/.test(t)) t = t.replace(/[łŁøØæÆßđĐı]/g, c => FOLD[c]).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return t.toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim();
}

/**
 * The era index (0..3) of a birth year: 0 before 1960, 1 for 1960-1979, 2 for 1980-1999, 3 from 2000.
 * @param {number} birthYear
 * @returns {number}
 */
export function eraOf(birthYear) {
  const y = Number(birthYear);
  if (!Number.isFinite(y)) return 2;
  return y < 1960 ? 0 : y < 1980 ? 1 : y < 2000 ? 2 : 3;
}

// The era whose lists a person born in birthYear draws from: their own, or near a boundary sometimes the
// neighbouring one (fashions do not change on January 1st). One uniform draw either way.
function eraDraw(rng, birthYear) {
  const y = Number.isFinite(Number(birthYear)) && birthYear !== null ? Number(birthYear) : 1985;
  const e = eraOf(y), u = rng.float(), t = y + 0.5;
  if (e > 0) { const d = t - ERA_START[e]; if (d < BLEND_YEARS && u < 0.5 * (1 - d / BLEND_YEARS)) return e - 1; }
  if (e < 3) { const d = ERA_START[e + 1] - t; if (d < BLEND_YEARS && u < 0.5 * (1 - d / BLEND_YEARS)) return e + 1; }
  return e;
}

const eraIndex = x => { const n = Number(x); if (n >= 1800) return eraOf(n); return Math.max(0, Math.min(3, Number.isFinite(n) ? Math.floor(n) : 2)); };

// "A,B:3,C" → names with weights: explicit where given, otherwise the Zipf curve continued from the previous.
function parseRanked(str, s) {
  const names = [], w = [];
  if (!str) return { names, w };
  let last = 1, lastRank = 1;
  for (const raw of String(str).split(',')) {
    const item = raw.trim();
    if (!item) continue;
    const k = item.lastIndexOf(':');
    let name = item, wt = null;
    if (k > 0 && /^\d*\.?\d+$/.test(item.slice(k + 1))) { name = item.slice(0, k).trim(); wt = +item.slice(k + 1); }
    const rank = names.length + 1;
    if (wt === null) wt = names.length === 0 ? 1 : last * Math.pow(lastRank / rank, s);
    names.push(name); w.push(wt); last = wt; lastRank = rank;
  }
  return { names, w };
}

class Pool {
  constructor(map) { this.names = [...map.keys()]; this.cum = cumulative([...map.values()]); }
  draw(rng) { return this.names[drawCumulative(this.cum, rng.float())]; }
  entries() { const tot = this.cum[this.cum.length - 1]; let prev = 0; return this.names.map((name, i) => { const weight = (this.cum[i] - prev) / tot; prev = this.cum[i]; return { name, weight }; }); }
}

const poolCache = new Map();

// Merge ranked lists into one pool: each list's weights normalized to its share, a name keeping its best share.
function mergedPool(parts) {
  const m = new Map();
  for (const [str, share] of parts) {
    if (!str || !(share > 0)) continue;
    const { names, w } = parseRanked(str, Z_GIVEN);
    let tot = 0; for (const x of w) tot += x;
    names.forEach((n, i) => { const v = share * w[i] / tot; if (!(m.get(n) >= v)) m.set(n, v); });
  }
  return m.size ? new Pool(m) : null;
}

// The given-name pool of one leaf tradition, sex, era and kind ('origin' or 'us').
function leafPool(trad, sex, era, kind) {
  const key = `G|${trad}|${sex}|${era}|${kind}`;
  if (poolCache.has(key)) return poolCache.get(key);
  const T = GIVEN[trad] || {};
  const lists = (kind === 'us' ? (T.us && T.us[sex]) : T[sex]) || [];
  const own = lists[era];
  const base = kind === 'us' ? null : T.base && T.base[sex];
  const pool = mergedPool([[own, 1], [base, own ? BASE_SHARE : 1], [lists[era - 1], NEIGHBOR_ERA], [lists[era + 1], NEIGHBOR_ERA]]);
  poolCache.set(key, pool);
  return pool;
}

function listPool(key) {
  const k = 'S|' + key;
  if (poolCache.has(k)) return poolCache.get(k);
  const { names, w } = parseRanked(SURNAMES[key], Z_SURNAME);
  const m = new Map(); names.forEach((n, i) => m.set(n, (m.get(n) || 0) + w[i]));
  const pool = m.size ? new Pool(m) : null;
  poolCache.set(k, pool);
  return pool;
}

const isAlias = spec => typeof spec === 'string' && !spec.includes(',') && SURNAMES[spec] !== undefined;

function drawSurname(rng, key, depth = 0) {
  const spec = SURNAMES[key];
  if (spec === undefined || depth > 6) return listPool('general').draw(rng);
  if (isAlias(spec)) return drawSurname(rng, spec, depth + 1);
  if (spec.mix) { const i = rng.weighted(spec.mix.map(m => m[1])); return drawSurname(rng, spec.mix[Math.max(0, i)][0], depth + 1); }
  return listPool(key).draw(rng);
}

// normName(surname) → Set of surname-list keys holding it (for the romanization and region hints).
let surnameIndex = null;
function surnameKeysOf(name) {
  if (!surnameIndex) {
    surnameIndex = new Map();
    for (const [key, spec] of Object.entries(SURNAMES)) {
      if (typeof spec !== 'string' || isAlias(spec)) continue;
      for (const n of parseRanked(spec, 1).names) { const f = normName(n); if (!surnameIndex.has(f)) surnameIndex.set(f, new Set()); surnameIndex.get(f).add(key); }
    }
  }
  return surnameIndex.get(normName(name)) || null;
}

// Surname pools (list or mix) reachable from a surname key.
const reachCache = new Map();
function reach(key, depth = 0) {
  if (reachCache.has(key)) return reachCache.get(key);
  const spec = SURNAMES[key], out = new Set([key]);
  if (depth < 6 && spec !== undefined) {
    if (isAlias(spec)) for (const k of reach(spec, depth + 1)) out.add(k);
    else if (spec.mix) for (const [k] of spec.mix) for (const x of reach(k, depth + 1)) out.add(x);
  }
  reachCache.set(key, out);
  return out;
}

// Given-name traditions whose surnames live under other keys.
const TRADITION_SURNAMES = { centralam: ['salvadoran', 'guatemalan', 'honduran', 'nicaraguan'], southam: ['southamerican'], caribhisp: ['puertorican', 'cuban', 'dominican'], spain: ['spanish'] };

// Which traditions a surname points to (a Wong to Cantonese, a Reddy to the south of India): every surname
// key, list or mix, that holds it; null when the heritage's surnames are not a mix or the name is unknown.
function hintFor(cfg, last) {
  if (!last) return null;
  const spec = SURNAMES[cfg.sur];
  if (!spec || !spec.mix) return null;
  const keys = surnameKeysOf(last);
  if (!keys) return null;
  const hint = new Set();
  for (const k of reach(cfg.sur)) if ([...reach(k)].some(x => keys.has(x))) hint.add(k);
  return hint.size ? hint : null;
}

const hinted = (hint, k) => hint.has(k) || (TRADITION_SURNAMES[k] || []).some(x => hint.has(x));

function pickMix(rng, mix, era, hint) {
  const weightOf = ws => (Array.isArray(ws) ? ws[era] : ws);
  const w = mix.map(([k, ws, keepWith]) => (!hint || hinted(hint, k) || (keepWith && keepWith.some(x => hint.has(x))) ? weightOf(ws) : 0));
  let i = rng.weighted(w);
  if (i < 0) i = rng.weighted(mix.map(m => weightOf(m[1])));
  return mix[Math.max(0, i)][0];
}

function drawFromTradition(rng, trad, sex, era, kind, hint) {
  const T = GIVEN[trad];
  if (!T) return null;
  if (kind === 'us' && T.us) { const p = leafPool(trad, sex, era, 'us'); return p ? p.draw(rng) : null; }
  if (T.mix) return drawFromTradition(rng, pickMix(rng, T.mix, era, hint), sex, era, kind, hint);
  const p = leafPool(trad, sex, era, 'origin');
  return p ? p.draw(rng) : null;
}

const generalGiven = (rng, sex, era) => leafPool('general', sex, era, 'origin').draw(rng);
const usTradition = cfg => (GIVEN[cfg.given] && GIVEN[cfg.given].us ? cfg.given : (cfg.us || cfg.given));
const configOf = heritage => NAMING[heritage] || NAMING.other;
const heritageKey = heritage => (NAMING[heritage] ? heritage : 'other');

function sexKey(rng, sex) {
  const s = String(sex == null ? '' : sex).toLowerCase();
  if (s === 'm' || s === 'male' || s === 'man') return 'M';
  if (s === 'f' || s === 'female' || s === 'woman') return 'F';
  return rng.chance(0.5) ? 'F' : 'M';
}

function generationOf(generation, nativity) {
  const g = Math.floor(Number(generation));
  if (g >= 1) return Math.min(3, g);
  return nativity === 'foreign' ? 1 : 3;
}

// A given name before any religious name is added.
function coreGiven(rng, cfg, sex, era, gen, last, parents) {
  if (cfg.multi) return multiGiven(rng, sex, era, gen, parents);
  const keep = cfg.keep[gen - 1];
  if (keep > 0 && rng.chance(keep)) {
    const kind = gen === 1 ? 'origin' : 'us';
    const name = drawFromTradition(rng, kind === 'us' ? usTradition(cfg) : cfg.given, sex, era, kind, hintFor(cfg, last));
    if (name) return name;
  }
  return generalGiven(rng, sex, era);
}

// Multiracial Californians: mostly the general pool of their cohort, otherwise one parent's tradition
// (given in opts.parents, or drawn from the combinations most common in California).
function multiGiven(rng, sex, era, gen, parents) {
  const list = Array.isArray(parents) ? parents.filter(p => NAMING[p] && !NAMING[p].multi) : [];
  let pcfg = null;
  if (list.length) { if (rng.chance(gen === 1 ? 0.85 : 0.45)) pcfg = NAMING[list[rng.int(list.length)]]; }
  else if (!rng.chance(gen === 1 ? 0.4 : 0.7)) pcfg = NAMING[MULTI_MIX[Math.max(0, rng.weighted(MULTI_MIX.map(m => m[1])))][0]];
  if (pcfg && pcfg.keep.some(k => k > 0)) {
    const kind = gen === 1 ? 'origin' : 'us';
    const name = drawFromTradition(rng, kind === 'us' ? usTradition(pcfg) : pcfg.given, sex, era, kind, null);
    if (name) return name;
  }
  return generalGiven(rng, sex, era);
}

// A first name to redraw when the surname is known: a famous full name, or the surname itself (Mai Mai).
const clashes = (first, last) => isReservedName(first, last) || normName(first) === normName(last);

const isReligiousSurname = (cfg, last) => !!(cfg.religiousName && last && [cfg.religiousName.M, cfg.religiousName.F].some(r => normName(r) === normName(last)));

// ------------------------------------------------------------------ the contract API

/**
 * A family name for a household of this heritage, drawn by frequency. Without options it is the family
 * form shared by the household. With {sex, generation}, it is adapted to the person: Sikh men and women
 * sometimes carry Singh or Kaur as the surname; immigrant women of Russian, Ukrainian, Polish and Greek
 * families carry the feminine form (Ivanova, Kowalska, Papadopoulou); some Bangladeshi immigrant women
 * carry Akter, Begum, Khatun or Sultana. If a Sikh person's surname came out as Singh or Kaur, pass it to
 * givenName as opts.surname so the religious name is not repeated.
 * @param {import('./rng.mjs').Rng} rng
 * @param {string} heritage a key of NAME_HERITAGES (unknown keys fall back to the California mix)
 * @param {{sex?: 'F'|'M', generation?: number, nativity?: 'native'|'foreign'}} [opts]
 * @returns {string}
 */
export function surname(rng, heritage, opts) {
  const key = heritageKey(heritage), cfg = configOf(key);
  const family = drawSurname(rng, cfg.sur);
  if (!opts || (opts.sex !== 'M' && opts.sex !== 'F')) return family;
  return personalSurname(rng, family, key, opts.sex, generationOf(opts.generation, opts.nativity));
}

const BD_WOMEN = ['Akter', 'Begum', 'Khatun', 'Sultana'];

function personalSurname(rng, family, heritage, sex, gen) {
  const cfg = configOf(heritage);
  if (cfg.religiousName) return rng.chance(0.3) ? cfg.religiousName[sex] : family;
  if (heritage === 'bangladeshi' && sex === 'F' && gen === 1 && rng.chance(0.35)) return BD_WOMEN[rng.int(BD_WOMEN.length)];
  if (sex === 'F' && FEMININE[heritage]) {
    const p = gen === 1 ? 1 : gen === 2 ? 0.25 : 0;
    if (p > 0 && rng.chance(p)) return adaptSurname(family, { heritage, sex });
  }
  return family;
}

// Feminine surname forms, applied in order (first match wins).
const FEMININE = {
  russian: [[/(sk|tsk|ck)(?:y|iy|ii|i)$/, '$1aya'], [/oy$/, 'aya'], [/(ov|ev|in|yn)$/, '$1a']],
  ukrainian: [[/sk(?:yi|yy|iy|y)$/, 'ska'], [/(ov|ev|in)$/, '$1a']],
  polish: [[/dzki$/, 'dzka'], [/cki$/, 'cka'], [/ski$/, 'ska']],
  greek: [[/os$/, 'ou'], [/as$/, 'a'], [/is$/, 'i'], [/es$/, 'ou']],
};

/**
 * The form of a family name a woman carries where the language marks it (Russian Ivanov → Ivanova,
 * Ukrainian -skyi → -ska, Polish Kowalski → Kowalska, Greek Papadopoulos → Papadopoulou). Pure: no draw.
 * Unchanged for men, for other heritages and for names the rules do not touch (Kovalenko, Georgiou).
 * @param {string} name the family (masculine) form
 * @param {{heritage?: string, sex?: 'F'|'M'}} [opts]
 * @returns {string}
 */
export function adaptSurname(name, { heritage, sex } = {}) {
  if (!name || sex !== 'F') return name;
  const rules = FEMININE[heritage];
  if (!rules) return name;
  for (const [re, rep] of rules) if (re.test(name)) return name.replace(re, rep);
  return name;
}

/**
 * A given name for a person of this heritage, sex, birth cohort and generation in the US. Immigrants
 * (generation 1, or nativity 'foreign') carry names from the origin country in the romanization usual in
 * California; US-born children (generation 2) mostly carry names popular in California for their cohort and
 * sometimes heritage names; the third generation mostly the general pool. When opts.surname is given, mixed
 * traditions follow it (a Wong gets a Cantonese-style name, a Reddy a Telugu one) and names that would make
 * a famous person's full name are redrawn. For Sikh heritage the religious name is part of the returned
 * given name, as in "Harpreet Kaur" or "Gurpreet Singh" (opts.religiousName === false leaves it off).
 * @param {import('./rng.mjs').Rng} rng
 * @param {{heritage?: string, sex?: 'F'|'M', birthYear?: number, generation?: number, nativity?: 'native'|'foreign',
 *   surname?: string, last?: string, parents?: string[], religiousName?: boolean}} [opts]
 * @returns {string}
 */
export function givenName(rng, opts = {}) {
  const cfg = configOf(heritageKey(opts.heritage));
  const sex = sexKey(rng, opts.sex);
  const gen = generationOf(opts.generation, opts.nativity);
  const era = eraDraw(rng, opts.birthYear);
  const last = opts.surname || opts.last || null;
  let first = '';
  for (let k = 0; k < 8; k++) {
    first = coreGiven(rng, cfg, sex, era, gen, last, opts.parents);
    if (!last || !clashes(first, last)) break;
  }
  if (cfg.religiousName && opts.religiousName !== false && !isReligiousSurname(cfg, last) && rng.chance(cfg.religiousKeep[gen - 1])) {
    first = `${first} ${cfg.religiousName[sex]}`;
  }
  return first;
}

/**
 * The nickname a person goes by, or null (most people use their given name). Customs follow the heritage:
 * Spanish diminutives (Roberto → Beto, Guadalupe → Lupe, Francisco → Pancho or Paco, Jesús → Chuy,
 * José → Pepe), English ones by age (William → Bill for older men, Will for younger), Filipino, Japanese
 * American (Takashi → Tak), Russian, Greek, Punjabi and other customs, and the English names many
 * Vietnamese, Korean and Chinese immigrants use day to day (Tuan → Tony, Ji-hoon → Jay). Only the first
 * word of a multi-word given name is considered ("Harpreet Singh" → Harry).
 * @param {import('./rng.mjs').Rng} rng
 * @param {string} given
 * @param {{heritage?: string, age?: number, sex?: 'F'|'M', surname?: string}} [opts]
 * @returns {string|null}
 */
export function nickname(rng, given, opts = {}) {
  if (!given || typeof given !== 'string') return null;
  const cands = cachedCandidates(given, opts);
  const u = rng.float();
  if (!cands.length || u >= cands.p) return null;
  const pick = cands[Math.max(0, rng.weighted(cands.weights))].nick;
  if (opts.surname && isReservedName(pick, opts.surname)) return null;
  return pick;
}

// nickname() is called for every person materialized; candidates depend only on (heritage, name, sex, age).
const candidateCache = new Map();
function cachedCandidates(given, opts) {
  const age = Number.isFinite(Number(opts.age)) && opts.age !== null ? Math.floor(Number(opts.age)) : 35;
  const key = `${opts.heritage}|${given}|${opts.sex || ''}|${age}`;
  let c = candidateCache.get(key);
  if (!c) {
    c = nicknameCandidates(given, opts);
    c.weights = c.map(x => x.weight);
    if (candidateCache.size > 50000) candidateCache.clear();
    candidateCache.set(key, c);
  }
  return c;
}

/**
 * Every nickname the customs of this heritage allow for a given name at this age, with relative weights;
 * the array's `p` property is the chance that someone with this name goes by one of them.
 * @param {string} given
 * @param {{heritage?: string, age?: number, sex?: 'F'|'M'}} [opts]
 * @returns {Array<{nick: string, custom: string, weight: number}> & {p: number}}
 */
export function nicknameCandidates(given, opts = {}) {
  const out = []; out.p = 0;
  const head = String(given || '').trim().split(/\s+/)[0];
  if (!head) return out;
  const cfg = configOf(heritageKey(opts.heritage));
  const age = Number.isFinite(Number(opts.age)) && opts.age !== null ? Number(opts.age) : 35;
  const key = normName(head);
  const sex = opts.sex === 'M' || opts.sex === 'F' ? opts.sex : sexOfName(head);
  const seen = new Set([key]);
  const push = (nick, custom, weight, p) => {
    const f = normName(nick);
    if (!nick || seen.has(f)) return;
    seen.add(f); out.push({ nick, custom, weight }); out.p = Math.max(out.p, p);
  };
  cfg.nick.forEach((custom, order) => {
    const scale = 1 / (1 + 0.25 * order);
    if (PET_NAMES[custom]) {
      const pet = PET_NAMES[custom];
      if (sex && age >= pet.minAge) pet[sex].split(',').forEach(n => push(n, custom, 0.3 * scale, pet.p));
      return;
    }
    let raw = null;
    if (custom === 'vi') raw = sex && age >= 18 ? NICKNAMES.vi[sex][key] : null;
    else if (custom === 'ko') raw = sex && age >= 18 && head.includes('-') ? NICKNAMES.ko[sex][key.split(' ')[0]] : null;
    else if (custom === 'zh') raw = sex && age >= 18 ? chineseEnglishNames(head, sex, age) : null;
    else raw = NICKNAMES[custom] ? NICKNAMES[custom][key] : null;
    if (!raw) return;
    raw.split(',').map(s => s.trim()).filter(Boolean).forEach((item, i) => {
      const m = /^(.*?)(?:@([MF]))?([+\-~^])?$/.exec(item), nick = m[1], only = m[2], mark = m[3];
      if (only && only !== sex) return;
      if ((mark === '+' && age < 40) || (mark === '-' && age >= 40) || (mark === '~' && age >= 16) || (mark === '^' && age < 16)) return;
      push(nick, custom, (mark === '~' ? 2 : 1) * scale / (1 + i), NICK_P[custom] || 0.25);
    });
  });
  return out;
}

// The English names a Chinese immigrant with this romanized name would plausibly adopt: the cohort's
// favorites that share its first letter (Wei → William or Wilson, Mei-ling → May or Mandy).
function chineseEnglishNames(head, sex, age) {
  if (!isChineseRomanization(head)) return null;
  const pool = leafPool('chinese-en', sex, eraOf(REF_YEAR - age), 'origin');
  if (!pool) return null;
  const initial = normName(head)[0];
  const hits = pool.names.filter(n => normName(n)[0] === initial).slice(0, 4);
  return hits.length ? hits.join(',') : null;
}

let chineseRoman = null;
function isChineseRomanization(head) {
  if (!chineseRoman) {
    chineseRoman = new Set();
    for (const t of ['chinese-cmn', 'chinese-yue', 'chinese-tw']) for (const sx of ['M', 'F']) for (const s of GIVEN[t][sx]) for (const n of parseRanked(s, 1).names) chineseRoman.add(normName(n));
  }
  return chineseRoman.has(normName(head));
}

// Sex a name is given to across all pools: 'M', 'F', or null when it is given to both (or unknown).
let sexIndex = null;
function sexOfName(head) {
  if (!sexIndex) {
    sexIndex = new Map();
    const mark = (str, bit) => { for (const n of parseRanked(str, 1).names) { const f = normName(n); sexIndex.set(f, (sexIndex.get(f) || 0) | bit); } };
    for (const T of Object.values(GIVEN)) {
      for (const [sx, bit] of [['M', 1], ['F', 2]]) {
        (T[sx] || []).forEach(s => mark(s, bit));
        if (T.us && T.us[sx]) T.us[sx].forEach(s => mark(s, bit));
        if (T.base && T.base[sx]) mark(T.base[sx], bit);
      }
    }
  }
  const v = sexIndex.get(normName(head));
  return v === 1 ? 'M' : v === 2 ? 'F' : null;
}

// ------------------------------------------------------------------ whole names

const VN_MIDDLE = { M: 'Van:45,Duc:10,Minh:10,Quoc:8,Huu:8,Thanh:7,Cong:5,Dinh:4,Ngoc:3', F: 'Thi:80,Ngoc:6,Thu:4,Kim:4,Thanh:3,Bich:2,My:1' };
const CLASSIC_MIDDLE = {
  M: 'James,Michael,Lee,Allen,Wayne,Joseph,Thomas,Edward,Ray,Dean,Alexander,Robert,William,John,David,Paul,Scott,Anthony,Christopher,Matthew',
  F: 'Marie,Ann,Lynn,Elizabeth,Nicole,Michelle,Rose,Jean,Lee,Louise,Mae,Renee,Grace,Kay,Jane,Christine,Elaine,Diane,Catherine,Sue',
};
const HISPANIC_SECOND = {
  M: 'Luis,Antonio,Manuel,Carlos,Miguel,Alberto,Francisco,Javier,Alejandro,Ángel,Jesús,Guadalupe',
  F: 'Guadalupe,Isabel,Elena,Teresa,Luisa,Fernanda,Alejandra,Cristina,Inés,Carmen,Lourdes,Esther',
};
const HISPANIC = new Set(['mexican', 'salvadoran', 'guatemalan', 'honduran', 'nicaraguan', 'puertorican', 'cuban', 'dominican', 'southamerican', 'spanish', 'latino']);
const HERITAGE_MIDDLE = new Set(['chinese', 'korean', 'japanese', 'indian', 'hmong', 'cambodian', 'lao', 'thai', 'armenian', 'iranian', 'arab', 'assyrian', 'greek', 'ethiopian', 'nigerian', 'pakistani', 'bangladeshi', 'afghan', 'pacific']);

const rankedDraw = (rng, key, str) => {
  if (!poolCache.has(key)) { const { names, w } = parseRanked(str, Z_GIVEN); const m = new Map(); names.forEach((n, i) => m.set(n, w[i])); poolCache.set(key, new Pool(m)); }
  return poolCache.get(key).draw(rng);
};

/**
 * A middle name as Californians of this heritage carry one, or '' for none: Singh or Kaur for Sikhs; Thi,
 * Van or another Vietnamese middle name for Vietnamese immigrants; the mother's maiden surname for
 * Filipinos; a second given name for many Latin American immigrants (José Luis, María Guadalupe); a
 * heritage name for many US-born children of Asian, Middle Eastern and African families; otherwise a
 * common American middle name.
 * @param {import('./rng.mjs').Rng} rng
 * @param {{heritage?: string, sex?: 'F'|'M', birthYear?: number, generation?: number, nativity?: string, surname?: string, first?: string}} [opts]
 * @returns {string}
 */
export function middleName(rng, opts = {}) {
  const heritage = heritageKey(opts.heritage), cfg = configOf(heritage);
  const sex = sexKey(rng, opts.sex), gen = generationOf(opts.generation, opts.nativity);
  const era = eraDraw(rng, opts.birthYear), last = opts.surname || opts.last || '', first = normName(opts.first || '');
  const other = draw => { for (let k = 0; k < 6; k++) { const n = draw(); if (n && normName(n) !== first && normName(n) !== normName(last)) return n; } return ''; };
  if (cfg.religiousName) return isReligiousSurname(cfg, last) ? '' : cfg.religiousName[sex];
  if (heritage === 'vietnamese') {
    if (gen === 1) return rankedDraw(rng, 'VNM|' + sex, VN_MIDDLE[sex]);
    return rng.chance(0.5) ? other(() => drawFromTradition(rng, 'vietnamese', sex, era, 'origin', null)) : '';
  }
  if (heritage === 'filipino') return rng.chance(0.85) ? other(() => drawSurname(rng, 'filipino')) : '';
  if (HISPANIC.has(heritage)) {
    if (gen === 1) return rng.chance(0.45) ? other(() => rankedDraw(rng, 'HS|' + sex, HISPANIC_SECOND[sex])) : '';
    return rng.chance(0.5) ? other(() => drawFromTradition(rng, usTradition(cfg), sex, era, 'us', null)) : '';
  }
  if (HERITAGE_MIDDLE.has(heritage) && gen >= 2 && rng.chance(0.4)) return other(() => drawFromTradition(rng, cfg.given, sex, era, 'origin', hintFor(cfg, last)));
  if (gen === 1 && (HERITAGE_MIDDLE.has(heritage) || cfg.keep[0] > 0)) return '';
  if (!rng.chance(0.75)) return '';
  return other(() => (rng.chance(0.5) ? rankedDraw(rng, 'CM|' + sex, CLASSIC_MIDDLE[sex]) : generalGiven(rng, sex, era)));
}

/**
 * A whole name in one call: {first, middle, last, full, display, nick}. The surname is drawn for the person
 * (or taken from opts.surname, e.g. the household's), the given name follows it, famous full names are
 * avoided, and display is what people call them ("Beto Hernandez").
 * @param {import('./rng.mjs').Rng} rng
 * @param {{heritage?: string, sex?: 'F'|'M', birthYear?: number, age?: number, generation?: number,
 *   nativity?: 'native'|'foreign', surname?: string, parents?: string[]}} [opts]
 * @returns {{first: string, middle: string, last: string, full: string, display: string, nick: string|null}}
 */
export function nameFor(rng, opts = {}) {
  const heritage = heritageKey(opts.heritage), cfg = configOf(heritage);
  const sex = sexKey(rng, opts.sex), gen = generationOf(opts.generation, opts.nativity);
  const birthYear = Number.isFinite(Number(opts.birthYear)) && opts.birthYear !== null ? Number(opts.birthYear)
    : Number.isFinite(Number(opts.age)) && opts.age !== null ? REF_YEAR - Number(opts.age) : 1985;
  const age = Number.isFinite(Number(opts.age)) && opts.age !== null ? Number(opts.age) : REF_YEAR - birthYear;
  const last = opts.surname || opts.last || surname(rng, heritage, { sex, generation: gen });
  const era = eraDraw(rng, birthYear);
  let first = '';
  for (let k = 0; k < 8; k++) { first = coreGiven(rng, cfg, sex, era, gen, last, opts.parents); if (!clashes(first, last)) break; }
  const middle = middleName(rng, { heritage, sex, birthYear, generation: gen, surname: last, first });
  const nick = nickname(rng, first, { heritage, age, sex, surname: last });
  return { first, middle, last, full: [first, middle, last].filter(Boolean).join(' '), display: `${nick || first} ${last}`, nick };
}

// ------------------------------------------------------------------ inspection (tests, tools, the UI)

/**
 * The effective given-name pool a heritage draws from for one sex, era and generation, as shares that sum
 * to 1, most common first (mixed traditions merged by their weights for that era). Generation 1 is the
 * origin-country pool, 2 and 3 the heritage names US-born families use; heritages that use the general
 * pool (American, Native American, multiracial, other) return the general California pool.
 * @param {string} heritage
 * @param {'F'|'M'} sex
 * @param {number} era index 0..3, or a birth year
 * @param {number} [generation=1]
 * @returns {Array<{name: string, weight: number}>}
 */
export function givenPool(heritage, sex, era, generation = 1) {
  const cfg = configOf(heritageKey(heritage)), S = sex === 'M' ? 'M' : 'F', e = eraIndex(era), gen = generationOf(generation);
  const out = new Map();
  const add = (pool, scale) => { if (pool) for (const { name, weight } of pool.entries()) out.set(name, (out.get(name) || 0) + weight * scale); };
  const walk = (trad, kind, scale) => {
    const T = GIVEN[trad];
    if (!T) return;
    if (kind === 'us' && T.us) return add(leafPool(trad, S, e, 'us'), scale);
    if (T.mix) { const tot = T.mix.reduce((a, m) => a + m[1][e], 0); for (const m of T.mix) walk(m[0], kind, scale * m[1][e] / tot); return; }
    add(leafPool(trad, S, e, 'origin'), scale);
  };
  if (cfg.multi || !(cfg.keep[gen - 1] > 0)) walk('general', 'origin', 1);
  else walk(gen === 1 ? cfg.given : usTradition(cfg), gen === 1 ? 'origin' : 'us', 1);
  return [...out].map(([name, weight]) => ({ name, weight })).sort((a, b) => b.weight - a.weight);
}

/**
 * The surname distribution of a heritage as shares that sum to 1, most common first (mixed pools merged).
 * @param {string} heritage
 * @returns {Array<{name: string, weight: number}>}
 */
export function surnamePool(heritage) {
  const out = new Map();
  const walk = (key, scale, depth) => {
    const spec = SURNAMES[key];
    if (spec === undefined || depth > 6) return;
    if (isAlias(spec)) return walk(spec, scale, depth + 1);
    if (spec.mix) { const tot = spec.mix.reduce((a, m) => a + m[1], 0); for (const m of spec.mix) walk(m[0], scale * m[1] / tot, depth + 1); return; }
    for (const { name, weight } of listPool(key).entries()) out.set(name, (out.get(name) || 0) + weight * scale);
  };
  walk(configOf(heritageKey(heritage)).sur, 1, 0);
  return [...out].map(([name, weight]) => ({ name, weight })).sort((a, b) => b.weight - a.weight);
}

const RESERVED = new Set(RESERVED_NAMES.map(normName));

/**
 * True when first + last would name a famous person (e.g. "Michael Jordan", "Cesar Chavez"); accents,
 * case and hyphens do not matter, and only the first word of a multi-word given name counts as well.
 * @param {string} first
 * @param {string} last
 * @returns {boolean}
 */
export function isReservedName(first, last) {
  if (!first || !last) return false;
  const f = normName(first), l = normName(last);
  return RESERVED.has(`${f} ${l}`) || RESERVED.has(`${f.split(' ')[0]} ${l}`);
}

Object.freeze(GIVEN); Object.freeze(SURNAMES); Object.freeze(NICKNAMES);

export { GIVEN, SURNAMES, NAMING, NICKNAMES, EXCLUDED_SURNAMES, RESERVED_NAMES };
