// Legion · lexicon · phrase banks II: Armenian, Farsi, Dari, Pashto, Arabic, Assyrian, Amharic.
// Same authoring format as languages-a.mjs. Right-to-left scripts are stored in logical order.

const EAST = ['east'];
const WEST = ['west'];

/** Phrase banks for Armenian, Farsi, Dari, Pashto, Arabic, Assyrian and Amharic (compact form). */
export const SOURCES_B = {
  armenian: {
    name: 'Armenian', native: 'հայերեն', script: 'Armn', romanization: 'common English transliteration', defaultVariety: 'east',
    varieties: { east: 'Eastern Armenian (Armenia, Iran)', west: 'Western Armenian (the Lebanese, Syrian and Turkish diaspora)' },
    notes: 'Glendale, Burbank and East Hollywood have the largest Armenian community outside Armenia. Eastern Armenian (from Armenia and Iran, written in reformed spelling) and Western Armenian (the older diaspora from Lebanon, Syria and Turkey, written in classical spelling and pronounced with b/p, d/t, g/k swapped: Eastern barev is Western parev) are both spoken. "Jan" after a name is warm and everywhere. Untagged entries are shared by both.',
    greetings: [
      ['Բարև', 'barev', 'Hi', { region: EAST }],
      ['Բարեւ', 'parev', 'Hi', { region: WEST }],
      ['Բարև ձեզ', 'barev dzez', 'Hello (polite)', { region: EAST, register: 'respect' }],
      ['Բարի լույս', 'bari luys', 'Good morning', { region: EAST, time: 'morning' }],
      ['Բարի լոյս', 'pari luys', 'Good morning', { region: WEST, time: 'morning' }],
      ['Բարի երեկո', 'bari yereko', 'Good evening', { region: EAST, time: 'evening' }],
      ['Բարի իրիկուն', 'pari irigun', 'Good evening', { region: WEST, time: 'evening' }],
      ['Ողջույն', 'voghjuyn', 'Greetings', { region: EAST }],
    ],
    howAreYou: [
      ['Ո՞նց ես', 'vonts es?', 'How are you? (casual)', { region: EAST, register: 'casual' }],
      ['Ինչպե՞ս ես', 'inchpes es?', 'How are you?', { region: EAST }],
      ['Ինչպե՞ս եք', 'inchpes ek?', 'How are you? (polite)', { region: EAST, register: 'respect' }],
      ['Ինչպէ՞ս ես', 'inchbes es?', 'How are you?', { region: WEST }],
      ['Ի՞նչ կա', 'inch ka?', "What's up?", { region: EAST, register: 'casual' }],
    ],
    thanks: [
      ['Շնորհակալություն', 'shnorhakalutyun', 'Thank you', { region: EAST }],
      ['Շնորհակալութիւն', 'shnorhagalutyun', 'Thank you', { region: WEST }],
      ['Շատ շնորհակալ եմ', 'shat shnorhakal em', 'Thank you very much', { region: EAST }],
      ['Մերսի', 'mersi', 'Thanks (casual, from French)'],
    ],
    farewells: [
      ['Ցտեսություն', 'tstesutyun', 'Goodbye', { region: EAST }],
      ['Ցտեսութիւն', 'tsdesutyun', 'Goodbye', { region: WEST }],
      ['Առայժմ', 'arayzhm', 'Bye for now', { region: EAST }],
      ['Բարի գիշեր', 'bari gisher', 'Good night', { region: EAST, time: 'night' }],
    ],
    yes: [
      ['Այո', 'ayo', 'Yes'],
      ['Հա', 'ha', 'Yeah', { register: 'casual' }],
    ],
    no: [
      ['Ոչ', 'voch', 'No'],
      ['Չէ', 'che', 'Nah', { register: 'casual' }],
    ],
    interjections: {
      surprise: [
        ['Վա՜յ', 'vay!', 'Oh! / Wow!'],
        ['Ի՞նչ ես ասում', 'inch es asum?', "What are you saying?! / You don't say!", { region: EAST }],
      ],
      frustration: [
        ['Ուֆ', 'uf', 'Ugh'],
        ['Ախ', 'akh', 'Ah, alas'],
      ],
      delight: [
        ['Ապրե՛ս', 'apres!', 'Well done! (literally, may you live)', { region: EAST }],
        ['Սիրուն է', 'sirun e', "It's lovely", { region: EAST }],
        ['Համով է', 'hamov e', "It's delicious", { region: EAST }],
      ],
    },
    family: {
      grandmother: [['տատիկ', 'tatik', 'grandma', { region: EAST }], ['մեծ մայրիկ', 'mets mayrig', 'grandma', { region: WEST }]],
      grandfather: [['պապիկ', 'papik', 'grandpa', { region: EAST }], ['մեծ հայրիկ', 'mets hayrig', 'grandpa', { region: WEST }]],
      mother: [['մայրիկ', 'mayrik', 'mom', { region: EAST }], ['մամա', 'mama', 'mom']],
      father: [['հայրիկ', 'hayrik', 'dad', { region: EAST }], ['պապա', 'papa', 'dad']],
      aunt: [['մորաքույր', 'morakuyr', "mother's sister", { region: EAST }], ['հորաքույր', 'horakuyr', "father's sister", { region: EAST }]],
      uncle: [['քեռի', 'keri', "mother's brother"], ['հորեղբայր', 'horeghbayr', "father's brother", { region: EAST }]],
      son: [['տղա', 'tgha', 'son, boy', { region: EAST }], ['որդի', 'vordi', 'son', { region: EAST }]],
      daughter: [['աղջիկ', 'aghjik', 'daughter, girl', { region: EAST }], ['դուստր', 'dustr', 'daughter (formal)', { region: EAST }]],
      friend: [['ընկեր', 'enker', 'friend', { region: EAST }], ['ընկերուհի', 'enkeruhi', 'friend (female)', { region: EAST }], ['ախպեր', 'akhper', 'bro (colloquial)', { region: EAST, register: 'casual' }]],
    },
    affection: [
      ['ջան', 'jan', 'dear (after a name: "Ani jan")'],
      ['հոգիս', 'hogis', 'my soul, darling', { region: EAST }],
      ['ցավդ տանեմ', 'tsavd tanem', 'deep affection (literally, may I take your pain)', { region: EAST }],
      ['սիրելիս', 'sirelis', 'my dear', { region: EAST }],
    ],
    polite: [
      ['Խնդրեմ', 'khndrem', "Please / You're welcome", { region: EAST }],
      ['Ներողություն', 'neroghutyun', 'Excuse me / Sorry', { region: EAST }],
      ['Ներողութիւն', 'nerogutyun', 'Excuse me / Sorry', { region: WEST }],
      ['Բարի ախորժակ', 'bari akhorzhak', 'Enjoy your meal', { region: EAST }],
    ],
    food: [
      ['դոլմա', 'dolma', 'stuffed grape leaves or vegetables'],
      ['խորոված', 'khorovats', 'grilled meat, barbecue', { region: EAST }],
      ['լավաշ', 'lavash', 'thin flatbread', { region: EAST }],
      ['հարիսա', 'harisa', 'slow-cooked wheat and chicken porridge'],
      ['ժինգյալով հաց', 'zhingyalov hats', 'flatbread stuffed with greens', { region: EAST }],
      ['մանթի', 'manti', 'tiny baked dumplings'],
      ['լահմաջո', 'lahmajo', 'thin flatbread with spiced meat', { region: EAST }],
      ['գաթա', 'gata', 'sweet pastry'],
      ['սուրճ', 'surch', 'coffee', { region: EAST }],
    ],
    phrases: {
      weather_hot: [
        ['Շատ շոգ է', 'shat shog e', "It's very hot", { region: EAST }],
        ['Ինչ շոգ է', 'inch shog e', 'How hot it is!', { region: EAST }],
      ],
      weather_cold: [
        ['Շատ ցուրտ է', 'shat tsurt e', "It's very cold", { region: EAST }],
      ],
      weather_rain: [
        ['Անձրև է գալիս', 'andzrev e galis', "It's raining", { region: EAST }],
      ],
      tired: [
        ['Հոգնած եմ', 'hognats em', "I'm tired", { region: EAST }],
        ['Շատ եմ հոգնել', 'shat em hognel', "I'm really tired", { region: EAST }],
      ],
      busy: [
        ['Զբաղված եմ', 'zbaghvats em', "I'm busy", { region: EAST }],
      ],
      welcome: [
        ['Բարի գալուստ', 'bari galust', 'Welcome', { region: EAST }],
        ['Բարի եկաք', 'pari yegak', 'Welcome', { region: WEST }],
      ],
      good_luck: [
        ['Հաջողություն', 'hajoghutyun', 'Good luck', { region: EAST }],
      ],
      take_care: [
        ['Քեզ լավ պահիր', 'kez lav pahir', 'Take care of yourself', { region: EAST }],
        ['Զգույշ եղիր', 'zguysh yeghir', 'Be careful', { region: EAST }],
      ],
      see_you: [
        ['Մինչ հանդիպում', 'minch handipum', 'Until we meet again', { region: EAST }],
      ],
      no_problem: [
        ['Ոչինչ', 'vochinch', "It's nothing", { region: EAST }],
        ['Խնդիր չկա', 'khndir chka', 'No problem', { region: EAST }],
      ],
      its_expensive: [
        ['Շատ թանկ է', 'shat tank e', "It's very expensive", { region: EAST }],
      ],
      traffic_bad: [
        ['Խցանում է', 'khtsanum e', "There's a traffic jam", { region: EAST }],
      ],
      god_willing: [
        ['Աստված տա', 'Astvats ta', 'God willing (literally, may God grant it)', { region: EAST }],
        ['Աստուած տայ', 'Asdvadz da', 'God willing', { region: WEST }],
      ],
      thank_god: [
        ['Փառք Աստծո', 'parq Astso', 'Thank God (literally, glory to God)', { region: EAST }],
      ],
      congratulations: [
        ['Շնորհավորում եմ', 'shnorhavorum em', 'Congratulations', { region: EAST }],
        ['Շնորհավոր', 'shnorhavor', 'Congrats!', { region: EAST }],
        ['Շնորհաւոր', 'shnorhavor', 'Congrats!', { region: WEST }],
      ],
    },
  },

  farsi: {
    name: 'Farsi (Persian)', native: 'فارسی', script: 'Arab', romanization: 'informal (â for the long a)',
    notes: 'Iranian Americans in Los Angeles (Westwood, the San Fernando Valley), Irvine and the South Bay. Spoken Tehrani Persian differs from the written language ("khune" for "khane", home). Taarof, ritual courtesy, shapes everyday talk: offers are refused before they are accepted.',
    greetings: [
      ['سلام', 'salâm', 'Hello'],
      ['صبح بخیر', 'sobh bekheyr', 'Good morning', { time: 'morning' }],
      ['عصر بخیر', 'asr bekheyr', 'Good afternoon', { time: 'afternoon' }],
      ['شب بخیر', 'shab bekheyr', 'Good evening, good night', { time: 'evening' }],
      ['درود', 'dorud', 'Greetings (formal)', { register: 'formal' }],
    ],
    howAreYou: [
      ['حالت چطوره؟', 'hâlet chetore?', 'How are you?', { register: 'casual' }],
      ['حال شما چطوره؟', 'hâl-e shomâ chetore?', 'How are you? (polite)', { register: 'respect' }],
      ['چطوری؟', 'chetori?', "How're you doing?", { register: 'casual' }],
      ['خوبی؟', 'khubi?', 'You good?', { register: 'casual' }],
      ['چه خبر؟', 'che khabar?', "What's new?"],
    ],
    thanks: [
      ['مرسی', 'mersi', 'Thanks'],
      ['ممنون', 'mamnun', 'Thank you'],
      ['خیلی ممنون', 'kheyli mamnun', 'Thank you very much'],
      ['متشکرم', 'moteshakkeram', 'Thank you (formal)', { register: 'formal' }],
      ['دستت درد نکنه', 'dastet dard nakone', 'Thanks for your trouble (literally, may your hand not hurt)'],
    ],
    farewells: [
      ['خداحافظ', 'khodâhâfez', 'Goodbye'],
      ['فعلاً', "fe'lan", 'Bye for now', { register: 'casual' }],
      ['به امید دیدار', 'be omid-e didâr', 'Hope to see you again'],
      ['خدانگهدار', 'khodânegahdâr', 'Goodbye (God keep you)'],
    ],
    yes: [
      ['بله', 'bale', 'Yes'],
      ['آره', 'âre', 'Yeah', { register: 'casual' }],
      ['حتماً', 'hatman', 'Definitely'],
    ],
    no: [
      ['نه', 'na', 'No'],
      ['خیر', 'kheyr', 'No (formal)', { register: 'formal' }],
      ['نه بابا', 'na bâbâ', 'No way, come on', { register: 'casual' }],
    ],
    interjections: {
      surprise: [
        ['وای!', 'vây!', 'Wow! / Oh!'],
        ['جدی؟', 'jeddi?', 'Seriously?'],
        ['واقعاً؟', "vâqe'an?", 'Really?'],
        ['خدای من!', 'khodây-e man!', 'My God!'],
      ],
      frustration: [
        ['ای بابا!', 'ey bâbâ!', 'Oh, come on!'],
        ['ای وای!', 'ey vây!', 'Oh no!'],
        ['خسته شدم!', 'khaste shodam!', "I'm fed up!"],
      ],
      delight: [
        ['عالیه!', 'âliye!', 'Excellent!'],
        ['چه خوب!', 'che khub!', 'How nice!'],
        ['به به!', 'bah bah!', 'Mmm, wonderful! (for food)'],
        ['دمت گرم!', 'damet garm!', 'Nice one! Thanks, buddy!', { register: 'casual' }],
      ],
    },
    family: {
      grandmother: [['مادربزرگ', 'mâdarbozorg', 'grandmother'], ['مامان‌بزرگ', 'mâmânbozorg', 'grandma']],
      grandfather: [['پدربزرگ', 'pedarbozorg', 'grandfather'], ['بابابزرگ', 'bâbâbozorg', 'grandpa']],
      mother: [['مادر', 'mâdar', 'mother'], ['مامان', 'mâmân', 'mom']],
      father: [['پدر', 'pedar', 'father'], ['بابا', 'bâbâ', 'dad']],
      aunt: [['خاله', 'khâle', "mother's sister"], ['عمه', 'amme', "father's sister"]],
      uncle: [['دایی', 'dâyi', "mother's brother"], ['عمو', 'amu', "father's brother"]],
      son: [['پسر', 'pesar', 'son, boy']],
      daughter: [['دختر', 'dokhtar', 'daughter, girl']],
      friend: [['دوست', 'dust', 'friend'], ['رفیق', 'rafiq', 'buddy', { register: 'casual' }]],
    },
    affection: [
      ['عزیزم', 'azizam', 'my dear'],
      ['جان', 'jân', 'dear (after a name)'],
      ['عشقم', 'eshqam', 'my love'],
      ['گلم', 'golam', 'my flower, dear'],
      ['قربونت برم', 'qorbunet beram', 'deep affection (literally, may I be sacrificed for you)'],
    ],
    polite: [
      ['لطفاً', 'lotfan', 'please'],
      ['ببخشید', 'bebakhshid', 'excuse me, sorry'],
      ['خواهش می‌کنم', 'khâhesh mikonam', "you're welcome; please"],
      ['بفرمایید', 'befarmâyid', 'please, go ahead; help yourself; come in'],
      ['قابلی نداره', 'qâbeli nadâre', "it's nothing (offering something, as taarof)"],
      ['نوش جان', 'nush-e jân', 'enjoy your meal'],
    ],
    food: [
      ['چلوکباب', 'chelow kabâb', 'rice with kebab'],
      ['قورمه‌سبزی', 'qormeh sabzi', 'herb stew'],
      ['ته‌دیگ', 'tahdig', 'crispy rice from the bottom of the pot'],
      ['فسنجان', 'fesenjân', 'pomegranate walnut stew'],
      ['آش رشته', 'âsh reshteh', 'noodle and herb soup'],
      ['زرشک پلو', 'zereshk polow', 'rice with barberries'],
      ['باقالی پلو', 'bâqâli polow', 'dill rice with fava beans'],
      ['سبزی خوردن', 'sabzi khordan', 'fresh herb platter'],
      ['نان سنگک', 'nân-e sangak', 'stone-baked flatbread'],
      ['بستنی سنتی', 'bastani sonnati', 'saffron ice cream'],
      ['چای', 'chây', 'tea'],
    ],
    phrases: {
      weather_hot: [
        ['چقدر گرمه!', 'cheqadr garme!', "It's so hot!"],
        ['هوا خیلی گرمه', 'havâ kheyli garme', 'The weather is very hot'],
      ],
      weather_cold: [
        ['چقدر سرده!', 'cheqadr sarde!', "It's so cold!"],
        ['هوا خیلی سرده', 'havâ kheyli sarde', 'The weather is very cold'],
      ],
      weather_rain: [
        ['بارون میاد', 'bârun miyâd', "It's raining"],
        ['داره بارون میاد', 'dâre bârun miyâd', "It's raining right now"],
      ],
      tired: [
        ['خسته‌ام', 'khasteam', "I'm tired"],
        ['خیلی خسته‌ام', 'kheyli khasteam', "I'm very tired"],
      ],
      busy: [
        ['سرم شلوغه', 'saram sholuqe', "I'm busy (literally, my head is crowded)"],
        ['خیلی گرفتارم', 'kheyli gereftâram', "I'm really tied up"],
      ],
      welcome: [
        ['خوش آمدید', 'khosh âmadid', 'Welcome'],
        ['خوش اومدی', 'khosh umadi', 'Welcome', { register: 'casual' }],
        ['بفرمایید تو', 'befarmâyid tu', 'Please come in'],
      ],
      good_luck: [
        ['موفق باشی', 'movaffaq bâshi', 'Good luck (may you succeed)'],
        ['موفق باشید', 'movaffaq bâshid', 'Good luck (polite)', { register: 'respect' }],
      ],
      take_care: [
        ['مواظب خودت باش', 'movâzeb-e khodet bâsh', 'Take care of yourself'],
      ],
      see_you: [
        ['می‌بینمت', 'mibinamet', 'See you'],
        ['فردا می‌بینمت', 'fardâ mibinamet', 'See you tomorrow'],
      ],
      no_problem: [
        ['مشکلی نیست', 'moshkeli nist', 'No problem'],
        ['اشکالی نداره', 'eshkâli nadâre', "It's okay"],
      ],
      its_expensive: [
        ['خیلی گرونه', 'kheyli gerune', "It's very expensive"],
        ['اجاره خیلی گرونه', 'ejâre kheyli gerune', 'The rent is very expensive'],
      ],
      traffic_bad: [
        ['ترافیک خیلی سنگینه', 'terâfik kheyli sangine', 'The traffic is very heavy'],
        ['تو ترافیک گیر کردم', 'tu terâfik gir kardam', 'I got stuck in traffic'],
      ],
      god_willing: [
        ['ان‌شاءالله', 'enshâllâh', 'God willing'],
        ['به امید خدا', 'be omid-e khodâ', "Hopefully, with God's help (literally, with hope in God)"],
      ],
      thank_god: [
        ['خدا رو شکر', 'khodâ ro shokr', 'Thank God'],
      ],
      congratulations: [
        ['تبریک می‌گم', 'tabrik migam', 'Congratulations'],
        ['مبارک باشه', 'mobârak bâshe', 'Congratulations (may it be blessed)'],
        ['نوروز مبارک', 'nowruz mobârak', 'Happy Nowruz'],
      ],
    },
  },

  dari: {
    name: 'Dari', native: 'دری', script: 'Arab', romanization: 'informal (â for the long a)',
    notes: 'Afghan Persian, spoken by Afghan families in Fremont, Hayward, Sacramento and Orange County. Close to Farsi, with its own everyday words: "tashakor" for thanks, "mânda nabâshi" to greet someone at work, "kâkâ" and "mâmâ" for paternal and maternal uncles.',
    greetings: [
      ['سلام', 'salâm', 'Hello'],
      ['السلام علیکم', 'assalâmu alaykum', 'Peace be upon you'],
      ['صبح بخیر', 'sobh bakhayr', 'Good morning', { time: 'morning' }],
      ['مانده نباشی', 'mânda nabâshi', 'Hello (to someone working; literally, may you not be tired)'],
    ],
    howAreYou: [
      ['چطور هستی؟', 'chetor hasti?', 'How are you?'],
      ['جور هستی؟', 'jor hasti?', 'Are you well?'],
      ['خوب هستی؟', 'khub hasti?', 'Are you doing well?'],
    ],
    thanks: [
      ['تشکر', 'tashakor', 'Thank you'],
      ['تشکر زیاد', 'tashakor ziyâd', 'Thank you very much'],
      ['سپاس', 'sepâs', 'Thank you (formal)', { register: 'formal' }],
    ],
    farewells: [
      ['خدا حافظ', 'khudâ hâfiz', 'Goodbye'],
      ['به امان خدا', 'ba amân-e khudâ', 'Go with God'],
    ],
    yes: [
      ['بلی', 'bale', 'Yes'],
      ['ها', 'hâ', 'Yeah', { register: 'casual' }],
    ],
    no: [
      ['نه', 'na', 'No'],
      ['نخیر', 'nakhayr', 'No (polite)', { register: 'respect' }],
    ],
    interjections: {
      surprise: [['راستی؟', 'râsti?', 'Really?']],
      frustration: [],
      delight: [['عالی!', 'âli!', 'Excellent!']],
    },
    family: {
      grandmother: [['بی‌بی', 'bibi', 'grandmother'], ['مادرکلان', 'mâdar kalân', 'grandmother']],
      grandfather: [['پدرکلان', 'padar kalân', 'grandfather']],
      mother: [['مادر', 'mâdar', 'mother']],
      father: [['پدر', 'padar', 'father']],
      aunt: [['خاله', 'khâla', "mother's sister"], ['عمه', 'amma', "father's sister"]],
      uncle: [['کاکا', 'kâkâ', "father's brother"], ['ماما', 'mâmâ', "mother's brother"]],
      son: [['پسر', 'pesar', 'son'], ['بچه', 'bacha', 'boy, son']],
      daughter: [['دختر', 'dukhtar', 'daughter']],
      friend: [['دوست', 'dost', 'friend'], ['رفیق', 'rafiq', 'buddy']],
    },
    affection: [
      ['جان', 'jân', 'dear (after a name)'],
      ['عزیزم', 'azizam', 'my dear'],
      ['بچیم', 'bachem', 'my child'],
    ],
    polite: [
      ['لطفاً', 'lutfan', 'please'],
      ['مهربانی کده', 'mehrabâni kada', 'please (literally, do a kindness)'],
      ['ببخشید', 'bebakhshid', 'excuse me, sorry'],
    ],
    food: [
      ['قابلی پلو', 'qâbuli palaw', 'rice with carrots, raisins and lamb'],
      ['منتو', 'mantu', 'steamed meat dumplings'],
      ['آشک', 'âshak', 'leek dumplings'],
      ['بولانی', 'bolâni', 'stuffed flatbread'],
      ['کباب', 'kabâb', 'kebab'],
      ['نان', 'nân', 'bread'],
      ['چای سبز', 'chây-e sabz', 'green tea'],
      ['فرنی', 'firni', 'milk pudding'],
    ],
    phrases: {
      weather_hot: [['هوا بسیار گرم است', 'hawâ besyâr garm ast', 'The weather is very hot']],
      weather_cold: [['هوا بسیار سرد است', 'hawâ besyâr sard ast', 'The weather is very cold']],
      weather_rain: [['باران می‌بارد', 'bârân mebârad', "It's raining"]],
      tired: [['مانده شدم', 'mânda shodam', "I'm tired"]],
      busy: [['مصروف هستم', 'masruf hastam', "I'm busy"]],
      welcome: [['خوش آمدید', 'khosh âmadid', 'Welcome']],
      good_luck: [['موفق باشید', 'muwaffaq bâshed', 'Good luck (may you succeed)']],
      take_care: [['مواظب خود باش', 'mowâzeb-e khod bâsh', 'Take care of yourself']],
      see_you: [['باز می‌بینمت', 'bâz mebinamet', 'See you again']],
      no_problem: [['مشکل نیست', 'moshkel nist', 'No problem'], ['پروا ندارد', 'parwâ nadârad', "It doesn't matter, no worries"]],
      its_expensive: [['بسیار قیمت است', 'besyâr qimat ast', "It's very expensive"]],
      god_willing: [['انشاءالله', 'inshâllâh', 'God willing']],
      thank_god: [['الحمدلله', 'alhamdulillâh', 'Thank God']],
      congratulations: [['مبارک باشد', 'mubârak bâshad', 'Congratulations'], ['تبریک', 'tabrik', 'Congratulations']],
    },
  },

  pashto: {
    name: 'Pashto', native: 'پښتو', script: 'Arab', romanization: 'informal',
    notes: 'Spoken by Pashtun families from Afghanistan and Pakistan, especially around Sacramento and the East Bay. "Staray ma she" (may you not be tired) is the everyday greeting.',
    greetings: [
      ['السلام علیکم', 'assalâmu alaykum', 'Peace be upon you'],
      ['سلام', 'salâm', 'Hello'],
      ['ستړی مه شې', 'staray ma she', 'Hello (literally, may you not be tired)'],
    ],
    howAreYou: [
      ['څنګه یې؟', 'tsanga ye?', 'How are you?'],
      ['ښه یې؟', 'kha ye?', 'Are you well?'],
      ['جوړ یې؟', 'joṛ ye?', 'Are you well?'],
    ],
    thanks: [
      ['مننه', 'manana', 'Thank you'],
      ['ډېره مننه', 'ḍera manana', 'Thank you very much'],
    ],
    farewells: [
      ['په مخه دې ښه', 'pa makha de kha', 'Goodbye (have a good journey)'],
      ['خدای پامان', 'khudây pâmân', 'Goodbye (God keep you)'],
    ],
    yes: [['هو', 'ho', 'Yes']],
    no: [['نه', 'na', 'No']],
    interjections: {
      surprise: [['رښتیا؟', 'rikhtyâ?', 'Really?']],
      frustration: [],
      delight: [['ډېر ښه!', 'ḍer kha!', 'Very good!'], ['شاباش!', 'shâbâsh!', 'Well done!']],
    },
    family: {
      grandmother: [['انا', 'anâ', 'grandmother']],
      grandfather: [['نیکه', 'nika', 'grandfather']],
      mother: [['مور', 'mor', 'mother']],
      father: [['پلار', 'plâr', 'father']],
      aunt: [['خاله', 'khâla', "mother's sister"], ['ترور', 'tror', "father's sister"]],
      uncle: [['ماما', 'mâmâ', "mother's brother"], ['تره', 'tra', "father's brother"]],
      son: [['زوی', 'zoy', 'son']],
      daughter: [['لور', 'lur', 'daughter']],
      friend: [['ملګری', 'malgaray', 'friend'], ['دوست', 'dost', 'friend']],
    },
    affection: [
      ['ګرانه', 'grâna', 'dear'],
      ['زما ګرانه', 'zmâ grâna', 'my dear'],
    ],
    polite: [
      ['مهرباني وکړئ', 'mehrabâni wokṛay', 'please'],
      ['بښنه غواړم', 'bakhana ghwâṛam', "I'm sorry, excuse me"],
    ],
    food: [
      ['کابلي پلاو', 'kâbuli palâw', 'rice with carrots and raisins'],
      ['منتو', 'mantu', 'steamed meat dumplings'],
      ['بولاني', 'bolâni', 'stuffed flatbread'],
      ['چپلي کباب', 'chapli kabâb', 'spiced flat kebab'],
      ['ډوډۍ', 'ḍoḍəy', 'bread; a meal'],
      ['شنه چای', 'shna chây', 'green tea'],
    ],
    phrases: {
      weather_hot: [['هوا ډېره ګرمه ده', 'hawâ ḍera garma da', 'The weather is very hot']],
      weather_cold: [['هوا ډېره سړه ده', 'hawâ ḍera saṛa da', 'The weather is very cold']],
      weather_rain: [['باران اوري', 'bârân wori', "It's raining"]],
      tired: [['ستړی یم', 'staray yam', "I'm tired", { sex: 'M' }], ['ستړې یم', 'staṛe yam', "I'm tired", { sex: 'F' }]],
      busy: [['بوخت یم', 'bukht yam', "I'm busy"]],
      welcome: [['ښه راغلاست', 'kha râghlâst', 'Welcome'], ['هر کله راشه', 'har kala râsha', 'Welcome (literally, come any time)']],
      good_luck: [['بریالی اوسې', 'bryâlay ose', 'May you succeed']],
      take_care: [['ځان ته پام کوه', 'dzân ta pâm kawa', 'Take care of yourself']],
      see_you: [['بیا به سره ووینو', 'byâ ba sara wowino', "We'll see each other again"]],
      no_problem: [['کومه خبره نه ده', 'kuma khabara na da', "It's nothing, no problem"]],
      its_expensive: [['ډېر ګران دی', 'ḍer grân day', "It's very expensive"]],
      god_willing: [['ان شاء الله', 'inshâllâh', 'God willing']],
      thank_god: [['الحمدلله', 'alhamdulillâh', 'Thank God']],
      congratulations: [['مبارک شه', 'mubârak sha', 'Congratulations']],
    },
  },

  arabic: {
    name: 'Arabic', native: 'العربية', script: 'Arab', romanization: 'informal (ā ī ū long vowels, ḥ ʿ for the deep h and ayn)',
    notes: 'Arab Californians are Lebanese, Syrian, Palestinian, Jordanian, Egyptian, Iraqi and Yemeni, Christian and Muslim. Everyday speech is dialect, not the standard written language; entries here are pan-Arabic or Levantine unless marked. Many phrases change with the listener: kīfak to a man, kīfik to a woman. The Islamic greeting as-salāmu ʿalaykum is tagged Muslim (many Arab Christians greet with marḥaba or ṣabāḥ al-khayr); in-shāʾ allāh and al-ḥamdu lillāh are said across faiths.',
    greetings: [
      ['السلام عليكم', 'as-salāmu ʿalaykum', 'Peace be upon you', { faith: 'muslim' }],
      ['وعليكم السلام', 'wa ʿalaykum as-salām', 'And upon you peace (the reply)', { faith: 'muslim' }],
      ['مرحبا', 'marḥaba', 'Hello'],
      ['أهلاً', 'ahlan', 'Hi, welcome'],
      ['صباح الخير', 'ṣabāḥ al-khayr', 'Good morning', { time: 'morning' }],
      ['صباح النور', 'ṣabāḥ an-nūr', 'Good morning (the reply; literally, morning of light)', { time: 'morning' }],
      ['مساء الخير', 'masāʾ al-khayr', 'Good evening', { time: 'evening' }],
    ],
    howAreYou: [
      ['كيف الحال؟', 'kayf al-ḥāl?', 'How are you?'],
      ['كيفك؟', 'kīfak?', 'How are you? (to a man, Levantine)', { to: 'M' }],
      ['كيفك؟', 'kīfik?', 'How are you? (to a woman, Levantine)', { to: 'F' }],
      ['شو الأخبار؟', 'shū l-akhbār?', "What's new? (Levantine)"],
    ],
    thanks: [
      ['شكراً', 'shukran', 'Thank you'],
      ['شكراً كتير', 'shukran ktīr', 'Thanks a lot (Levantine)'],
      ['شكراً جزيلاً', 'shukran jazīlan', 'Thank you very much (formal)', { register: 'formal' }],
      ['يسلمو', 'yislamu', 'Thanks (Levantine; literally, may they be safe)'],
    ],
    farewells: [
      ['مع السلامة', 'maʿa s-salāma', 'Goodbye'],
      ['إلى اللقاء', 'ilā l-liqāʾ', 'Until we meet again'],
      ['باي', 'bāy', 'Bye', { register: 'casual' }],
    ],
    yes: [
      ['نعم', 'naʿam', 'Yes (formal)'],
      ['أيوه', 'aywa', 'Yes'],
      ['إيه', 'ē', 'Yeah (Levantine)', { register: 'casual' }],
      ['طبعاً', 'ṭabʿan', 'Of course'],
      ['أكيد', 'akīd', 'Sure'],
    ],
    no: [
      ['لا', 'lā', 'No'],
      ['أبداً', 'abadan', 'Not at all'],
    ],
    interjections: {
      surprise: [
        ['معقول؟', 'maʿqūl?', 'Seriously? Is that possible?'],
        ['والله؟', 'wallāh?', 'Really? (literally, by God?)'],
        ['يا الله!', 'yā allāh!', 'Oh my God!'],
      ],
      frustration: [
        ['يا ربي', 'yā rabbī', 'Oh Lord'],
        ['أف', 'uff', 'Ugh'],
        ['خلص!', 'khalaṣ!', "Enough! That's it!"],
      ],
      delight: [
        ['يا سلام!', 'yā salām!', 'Wow, how wonderful!'],
        ['ممتاز!', 'mumtāz!', 'Excellent!'],
        ['حلو كتير!', 'ḥilu ktīr!', 'Very nice! (Levantine)'],
        ['تحفة!', 'tuḥfa!', 'Amazing! (literally, a masterpiece)'],
      ],
    },
    family: {
      grandmother: [['جدة', 'jadda', 'grandmother'], ['تيتا', 'tēta', 'grandma (Levantine)']],
      grandfather: [['جد', 'jadd', 'grandfather'], ['جدو', 'jiddo', 'grandpa']],
      mother: [['أم', 'umm', 'mother'], ['ماما', 'māma', 'mom']],
      father: [['أب', 'ab', 'father'], ['بابا', 'bāba', 'dad']],
      aunt: [['خالة', 'khāla', "mother's sister"], ['عمة', 'ʿamma', "father's sister"]],
      uncle: [['خال', 'khāl', "mother's brother"], ['عم', 'ʿamm', "father's brother"], ['عمو', 'ʿammo', 'uncle; also a polite way to address an older man']],
      son: [['ابن', 'ibn', 'son'], ['ابني', 'ibnī', 'my son']],
      daughter: [['بنت', 'bint', 'daughter, girl'], ['بنتي', 'bintī', 'my daughter']],
      friend: [['صديق', 'ṣadīq', 'friend'], ['صاحب', 'ṣāḥib', 'friend, buddy']],
    },
    affection: [
      ['حبيبي', 'ḥabībī', 'my dear (to a man or boy)', { to: 'M' }],
      ['حبيبتي', 'ḥabībtī', 'my dear (to a woman or girl)', { to: 'F' }],
      ['يا عمري', 'yā ʿumrī', 'my darling (literally, my life)'],
      ['روحي', 'rūḥī', 'my soul, darling'],
      ['يا قلبي', 'yā albī', 'my heart (Levantine)'],
    ],
    polite: [
      ['من فضلك', 'min faḍlak', 'please (to a man)', { to: 'M' }],
      ['من فضلك', 'min faḍlik', 'please (to a woman)', { to: 'F' }],
      ['عفواً', 'ʿafwan', "you're welcome; excuse me"],
      ['آسف', 'āsif', "I'm sorry", { sex: 'M' }],
      ['آسفة', 'āsfe', "I'm sorry", { sex: 'F' }],
      ['صحتين', 'ṣaḥtēn', 'enjoy your meal (literally, two healths)'],
    ],
    food: [
      ['حمص', 'ḥummuṣ', 'hummus'],
      ['فلافل', 'falāfil', 'falafel'],
      ['شاورما', 'shāwarma', 'shawarma'],
      ['تبولة', 'tabbūleh', 'parsley and bulgur salad'],
      ['فتوش', 'fattūsh', 'bread salad'],
      ['كبة', 'kibbeh', 'bulgur and meat croquettes'],
      ['منقوشة', 'manʾūsheh', "flatbread with za'atar"],
      ['كنافة', 'knāfeh', 'sweet cheese pastry'],
      ['بقلاوة', 'baqlāwa', 'baklava'],
      ['خبز', 'khubz', 'bread'],
      ['ملوخية', 'mulūkhiyya', 'jute leaf stew'],
      ['كشري', 'kushari', 'rice, lentils and pasta (Egyptian)'],
      ['مسخن', 'musakhkhan', 'sumac chicken on flatbread (Palestinian)'],
    ],
    phrases: {
      weather_hot: [
        ['الجو حر كتير', 'il-jaww ḥarr ktīr', "It's very hot (Levantine)"],
        ['شوب!', 'shōb!', 'So hot! (Levantine)'],
      ],
      weather_cold: [
        ['الجو برد كتير', 'il-jaww bard ktīr', "It's very cold (Levantine)"],
        ['برد!', 'bard!', "It's cold!"],
      ],
      weather_rain: [
        ['عم تشتي', 'ʿam tishti', "It's raining (Levantine)"],
        ['الدنيا بتمطر', 'id-dunya bitmaṭṭar', "It's raining (Egyptian)"],
      ],
      tired: [
        ['تعبان', 'taʿbān', "I'm tired", { sex: 'M' }],
        ['تعبانة', 'taʿbāne', "I'm tired", { sex: 'F' }],
      ],
      busy: [
        ['مشغول', 'mashghūl', "I'm busy", { sex: 'M' }],
        ['مشغولة', 'mashghūle', "I'm busy", { sex: 'F' }],
      ],
      welcome: [
        ['أهلاً وسهلاً', 'ahlan wa sahlan', 'Welcome'],
        ['تفضل', 'tfaḍḍal', 'Please, come in (to a man)', { to: 'M' }],
        ['تفضلي', 'tfaḍḍali', 'Please, come in (to a woman)', { to: 'F' }],
      ],
      good_luck: [
        ['بالتوفيق', 'bit-tawfīq', 'Good luck'],
      ],
      take_care: [
        ['دير بالك', 'dīr bālak', 'Take care (to a man, Levantine)', { to: 'M' }],
        ['ديري بالك', 'dīri bālik', 'Take care (to a woman, Levantine)', { to: 'F' }],
      ],
      see_you: [
        ['منشوفك', 'minshūfak', "We'll see you (to a man)", { to: 'M' }],
        ['منشوفك', 'minshūfik', "We'll see you (to a woman)", { to: 'F' }],
      ],
      no_problem: [
        ['مش مشكلة', 'mish mushkile', 'No problem'],
        ['ما في مشكلة', 'mā fī mushkile', 'No problem (Levantine)'],
      ],
      its_expensive: [
        ['غالي كتير', 'ghāli ktīr', 'Very expensive'],
        ['الإيجار غالي', 'il-ʾījār ghāli', 'The rent is expensive'],
      ],
      traffic_bad: [
        ['زحمة كتير', 'zaḥme ktīr', 'The traffic is really heavy'],
        ['في عجقة سير', 'fī ʿajʾit sēr', "There's a traffic jam (Lebanese)"],
      ],
      god_willing: [
        ['إن شاء الله', 'in shāʾ allāh', 'God willing'],
      ],
      thank_god: [
        ['الحمد لله', 'al-ḥamdu lillāh', 'Thank God'],
      ],
      blessing: [
        ['ما شاء الله', 'mā shāʾ allāh', 'God has willed it (said in admiration of good news, a child, a new home)'],
      ],
      congratulations: [
        ['مبروك', 'mabrūk', 'Congratulations'],
        ['ألف مبروك', 'alf mabrūk', 'A thousand congratulations'],
      ],
    },
  },

  assyrian: {
    name: 'Assyrian (Neo-Aramaic)', native: 'Sureth', script: 'Latn', romanization: 'community romanization of Assyrian Neo-Aramaic',
    notes: 'Assyrian Neo-Aramaic (Sureth) is spoken by Assyrian families in Turlock, Modesto and San Jose; the closely related Chaldean Neo-Aramaic is spoken in El Cajon. It is written in the Syriac alphabet; these entries are romanized. Many speakers also use Arabic or Farsi phrases.',
    greetings: [
      ['Shlama', 'Peace; hello'],
      ['Shlama lokh', 'Peace be with you (to a man)', { to: 'M' }],
      ['Shlama lakh', 'Peace be with you (to a woman)', { to: 'F' }],
    ],
    howAreYou: [
      ['Dakhi wit?', 'How are you? (to a man)', { to: 'M' }],
      ['Dakhi wat?', 'How are you? (to a woman)', { to: 'F' }],
    ],
    thanks: [
      ['Tawdi', 'Thank you'],
      ['Tawdi raba', 'Thank you very much'],
      ['Basima', 'Thanks (literally, pleasant, sweet)'],
    ],
    farewells: [
      ['Push bshena', 'Stay in peace (said by the one leaving)'],
      ['Zil bshena', 'Go well (said to the one leaving)'],
    ],
    yes: [['Eh', 'Yes']],
    no: [['La', 'No']],
    interjections: { surprise: [], frustration: [], delight: [] },
    family: {
      grandmother: [['nana', 'grandmother']],
      grandfather: [['sawa', 'grandfather']],
      mother: [['yimma', 'mother']],
      father: [['baba', 'father']],
      aunt: [['khalta', "mother's sister"], ['amta', "father's sister"]],
      uncle: [['khalu', "mother's brother"], ['mamu', "father's brother"]],
      son: [['brona', 'son']],
      daughter: [['brata', 'daughter']],
      friend: [['khawra', 'friend']],
      brother: [['akhona', 'brother']],
      sister: [['khatha', 'sister']],
    },
    affection: [
      ['gyani', 'my soul, my dear'],
    ],
    polite: [],
    food: [
      ['dolma', 'stuffed grape leaves and vegetables'],
      ['kubba', 'bulgur and meat dumplings'],
      ['pacha', 'slow-cooked stew for special occasions'],
      ['kade', 'savory pastry'],
      ['kileche', 'date-filled cookies'],
      ['booshala', 'warm yogurt soup'],
    ],
    phrases: {
      welcome: [['Bshena', 'Welcome']],
    },
  },

  amharic: {
    name: 'Amharic', native: 'አማርኛ', script: 'Ethi', romanization: 'informal',
    notes: 'Ethiopian Californians live in Oakland, San Jose and around Fairfax Avenue in Los Angeles. Amharic marks the listener\'s gender in many everyday phrases (indet neh to a man, indet nesh to a woman), and elders get the polite forms. Phrases naming Egziabher, the Ethiopian Christian name for God, are tagged Christian; Ethiopian Muslims say inshallah and alhamdulillah instead.',
    greetings: [
      ['ሰላም', 'selam', 'Hello (literally, peace)'],
      ['ጤና ይስጥልኝ', 'tena yistilign', 'Hello (formal; literally, may God give you health for me)', { register: 'formal' }],
      ['እንደምን አደርክ?', 'indemin aderk?', 'Good morning (to a man; literally, how did you spend the night?)', { to: 'M', time: 'morning' }],
      ['እንደምን አደርሽ?', 'indemin adersh?', 'Good morning (to a woman)', { to: 'F', time: 'morning' }],
    ],
    howAreYou: [
      ['እንዴት ነህ?', 'indet neh?', 'How are you? (to a man)', { to: 'M' }],
      ['እንዴት ነሽ?', 'indet nesh?', 'How are you? (to a woman)', { to: 'F' }],
      ['እንዴት ኖት?', 'indet not?', 'How are you? (polite)', { register: 'respect' }],
      ['ደህና ነህ?', 'dehna neh?', 'Are you well? (to a man)', { to: 'M' }],
      ['ደህና ነሽ?', 'dehna nesh?', 'Are you well? (to a woman)', { to: 'F' }],
    ],
    thanks: [
      ['አመሰግናለሁ', 'amesegnalehu', 'Thank you'],
      ['በጣም አመሰግናለሁ', 'betam amesegnalehu', 'Thank you very much'],
    ],
    farewells: [
      ['ቻው', 'chaw', 'Bye', { register: 'casual' }],
      ['ደህና ሁን', 'dehna hun', 'Goodbye, stay well (to a man)', { to: 'M' }],
      ['ደህና ሁኚ', 'dehna hugn', 'Goodbye, stay well (to a woman)', { to: 'F' }],
      ['በኋላ እንገናኝ', 'behuala ingenagn', 'See you later'],
    ],
    yes: [
      ['አዎ', 'awo', 'Yes'],
      ['እሺ', 'ishi', 'Okay'],
    ],
    no: [
      ['አይ', 'ay', 'No', { register: 'casual' }],
      ['አይደለም', 'aydelem', "No, it isn't"],
    ],
    interjections: {
      surprise: [
        ['እውነት?', 'iwnet?', 'Really?'],
        ['እንዴ!', 'inde!', 'What?! / Oh!'],
      ],
      frustration: [
        ['ኧረ!', 'ere!', 'Come on!'],
        ['ወይኔ!', 'weyne!', 'Oh no!'],
      ],
      delight: [
        ['በጣም ጥሩ!', 'betam tiru!', 'Very good!'],
        ['ጎበዝ!', 'gobez!', 'Well done!'],
        ['ጣፋጭ ነው!', 'tafach new!', "It's delicious!"],
      ],
    },
    family: {
      grandmother: [['አያት', 'ayat', 'grandparent, grandmother'], ['እማማ', 'imama', 'grandma, mama (respectful)']],
      grandfather: [['አያት', 'ayat', 'grandparent, grandfather'], ['አባባ', 'ababa', 'grandpa, papa (respectful)']],
      mother: [['እናት', 'enat', 'mother'], ['እማዬ', 'imaye', 'mom']],
      father: [['አባት', 'abat', 'father'], ['አባዬ', 'abaye', 'dad']],
      aunt: [['አክስት', 'akist', 'aunt']],
      uncle: [['አጎት', 'agot', 'uncle']],
      son: [['ወንድ ልጅ', 'wend lij', 'son'], ['ልጅ', 'lij', 'child']],
      daughter: [['ሴት ልጅ', 'set lij', 'daughter']],
      friend: [['ጓደኛ', 'guadegna', 'friend']],
    },
    affection: [
      ['ልጄ', 'lije', 'my child'],
      ['ውዴ', 'wude', 'my dear'],
      ['የኔ ቆንጆ', 'yene konjo', 'my beautiful one'],
    ],
    polite: [
      ['እባክህ', 'ibakih', 'please (to a man)', { to: 'M' }],
      ['እባክሽ', 'ibakish', 'please (to a woman)', { to: 'F' }],
      ['ይቅርታ', 'yikirta', 'sorry, excuse me'],
      ['ምንም አይደል', 'minim aydel', "it's nothing, no problem"],
    ],
    food: [
      ['እንጀራ', 'injera', 'sourdough flatbread'],
      ['ዶሮ ወጥ', 'doro wat', 'spicy chicken stew'],
      ['ምስር ወጥ', 'misir wat', 'spicy lentil stew'],
      ['ሽሮ', 'shiro', 'chickpea stew'],
      ['ክትፎ', 'kitfo', 'minced seasoned beef'],
      ['ጥብስ', 'tibs', 'sautéed meat'],
      ['በርበሬ', 'berbere', 'chili spice blend'],
      ['ቡና', 'buna', 'coffee; the coffee ceremony'],
      ['ጠጅ', 'tej', 'honey wine'],
    ],
    phrases: {
      weather_hot: [['በጣም ሞቃት ነው', 'betam mokat new', "It's very hot"]],
      weather_cold: [['በጣም ቀዝቃዛ ነው', 'betam kezkaza new', "It's very cold"], ['ይበርዳል', 'yiberdal', "It's cold"]],
      weather_rain: [['ዝናብ እየዘነበ ነው', 'zinab iyezenebe new', "It's raining"]],
      tired: [['ደክሞኛል', 'dekmognal', "I'm tired"]],
      busy: [['ስራ በዝቶብኛል', 'sira beztobignal', "I have too much work"]],
      welcome: [
        ['እንኳን ደህና መጣህ', 'inkuan dehna metah', 'Welcome (to a man)', { to: 'M' }],
        ['እንኳን ደህና መጣሽ', 'inkuan dehna metash', 'Welcome (to a woman)', { to: 'F' }],
        ['እንኳን ደህና መጣችሁ', 'inkuan dehna metachihu', 'Welcome (to everyone)'],
      ],
      good_luck: [['መልካም እድል', 'melkam idil', 'Good luck']],
      take_care: [['ራስህን ጠብቅ', 'rasihin tebik', 'Take care of yourself (to a man)', { to: 'M' }]],
      see_you: [['በኋላ እንገናኝ', 'behuala ingenagn', 'See you later'], ['ነገ እንገናኝ', 'nege ingenagn', 'See you tomorrow']],
      no_problem: [['ችግር የለም', 'chigir yelem', 'No problem'], ['ምንም አይደል', 'minim aydel', "It's nothing"]],
      its_expensive: [['በጣም ውድ ነው', 'betam wid new', "It's very expensive"]],
      god_willing: [
        ['እግዚአብሔር ቢፈቅድ', 'igziabher bifekid', 'If God permits (God willing)', { faith: 'christian' }],
      ],
      thank_god: [
        ['እግዚአብሔር ይመስገን', 'igziabher yimesgen', 'Thank God', { faith: 'christian' }],
      ],
      congratulations: [
        ['እንኳን ደስ አለህ', 'inkuan des aleh', 'Congratulations (to a man)', { to: 'M' }],
        ['እንኳን ደስ አለሽ', 'inkuan des alesh', 'Congratulations (to a woman)', { to: 'F' }],
        ['እንኳን ደስ አላችሁ', 'inkuan des alachihu', 'Congratulations (to everyone)'],
      ],
    },
  },
};
