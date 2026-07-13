/**
 * Genni's language registry.
 *
 * Pure languages use the native script with brand/technical terms (website,
 * logo, WhatsApp) kept in English. Mixed variants ("Tanglish" etc.) are the
 * base language in NATIVE script with natural English code-switching for
 * business/tech words; if the user writes romanized, Genni mirrors romanized.
 *
 * `templates` are the deterministic fixed prompts of the onboarding flow —
 * instant (no LLM round-trip) and exact. Dynamic/conversational turns go
 * through the LLM with the style rules + few-shots from this file.
 */

const LANGUAGES = {
  en: {
    code: 'en',
    label: 'English',
    nativeLabel: 'English',
    speechLang: 'en-IN',
    styleRules: 'Reply in simple, warm Indian English. Short sentences.',
    fewShots: [],
  },
  ta: {
    code: 'ta',
    label: 'Tamil',
    nativeLabel: 'தமிழ்',
    speechLang: 'ta-IN',
    styleRules: 'Reply in Tamil (தமிழ்) using Tamil script only. Keep brand/technical terms like website, logo, email in English. Use respectful நீங்கள் forms.',
    fewShots: [
      { user: 'எனக்கு ஒரு website வேணும்', genni: 'கண்டிப்பா செய்யலாம்! உங்க business பத்தி கொஞ்சம் சொல்லுங்க — பெயர் என்ன, எந்த ஊர்ல இருக்கீங்க?' },
    ],
  },
  'ta-en': {
    code: 'ta-en',
    label: 'Tamil + English',
    nativeLabel: 'தமிழ் + English',
    speechLang: 'ta-IN',
    styleRules: 'Reply in casual Tanglish — Tamil in Tamil script mixed naturally with English words for business/tech terms (website, design, customers, book pannunga style). If the user writes Tamil in Roman letters, mirror that and reply in romanized Tanglish. Friendly நீங்கள் register.',
    fewShots: [
      { user: 'website venum bro', genni: 'Sure bro! உங்க business name என்ன, எந்த area-ல இருக்கீங்க? சொல்லுங்க, நான் details எல்லாம் Google-ல இருந்து எடுத்துடறேன்.' },
    ],
  },
  te: {
    code: 'te',
    label: 'Telugu',
    nativeLabel: 'తెలుగు',
    speechLang: 'te-IN',
    styleRules: 'Reply in Telugu (తెలుగు) using Telugu script only. Keep brand/technical terms like website, logo, email in English. Use respectful మీరు forms.',
    fewShots: [
      { user: 'నాకు ఒక website కావాలి', genni: 'తప్పకుండా చేద్దాం! ముందుగా మీ business గురించి చెప్పండి — పేరు ఏమిటి, ఏ ఊరిలో ఉన్నారు?' },
    ],
  },
  'te-en': {
    code: 'te-en',
    label: 'Telugu + English',
    nativeLabel: 'తెలుగు + English',
    speechLang: 'te-IN',
    styleRules: 'Reply in casual Telugu-English mix — Telugu in Telugu script with natural English code-switching for business/tech words. If the user writes romanized Telugu, mirror romanized. Friendly మీరు register.',
    fewShots: [
      { user: 'website kavali andi', genni: 'Sure andi! మీ business name ఏంటి, ఏ area-లో ఉంది? చెప్పండి, నేను details అన్నీ Google నుంచి తీసుకుంటాను.' },
    ],
  },
  ml: {
    code: 'ml',
    label: 'Malayalam',
    nativeLabel: 'മലയാളം',
    speechLang: 'ml-IN',
    styleRules: 'Reply in Malayalam (മലയാളം) using Malayalam script only. Keep brand/technical terms like website, logo, email in English. Polite, friendly register.',
    fewShots: [
      { user: 'എനിക്ക് ഒരു website വേണം', genni: 'തീർച്ചയായും! ആദ്യം നിങ്ങളുടെ business-നെ കുറിച്ച് പറയൂ — പേര് എന്താണ്, ഏത് സ്ഥലത്താണ്?' },
    ],
  },
  'ml-en': {
    code: 'ml-en',
    label: 'Malayalam + English',
    nativeLabel: 'മലയാളം + English',
    speechLang: 'ml-IN',
    styleRules: 'Reply in casual Malayalam-English mix — Malayalam in Malayalam script with natural English code-switching for business/tech words. If the user writes romanized Malayalam (Manglish), mirror romanized. Friendly register.',
    fewShots: [
      { user: 'oru website venam', genni: 'Sure aanu! നിങ്ങളുടെ business name എന്താ, ഏത് area-യിലാ? പറയൂ, ഞാൻ details ഒക്കെ Google-ൽ നിന്ന് എടുക്കാം.' },
    ],
  },
  hi: {
    code: 'hi',
    label: 'Hindi',
    nativeLabel: 'हिन्दी',
    speechLang: 'hi-IN',
    styleRules: 'Reply in Hindi (हिन्दी) using Devanagari script only. Keep brand/technical terms like website, logo, email in English. Use respectful आप forms.',
    fewShots: [
      { user: 'मुझे एक website चाहिए', genni: 'बिलकुल बनाते हैं! पहले अपने business के बारे में बताइए — नाम क्या है, और किस शहर में हैं?' },
    ],
  },
  'hi-en': {
    code: 'hi-en',
    label: 'Hindi + English',
    nativeLabel: 'हिन्दी + English',
    speechLang: 'hi-IN',
    styleRules: 'Reply in casual Hinglish — Hindi in Devanagari mixed naturally with English words for business/tech terms. If the user writes romanized Hindi, mirror romanized Hinglish. Friendly आप register.',
    fewShots: [
      { user: 'website chahiye yaar', genni: 'बिलकुल! आपके business का name क्या है, और कौन से area में है? बताइए, मैं details Google से निकाल लूँगी।' },
    ],
  },
};

const DEFAULT_LANGUAGE = 'en';

function getLanguage(code) {
  return LANGUAGES[code] || LANGUAGES[DEFAULT_LANGUAGE];
}

function listLanguages() {
  return Object.values(LANGUAGES).map(({ code, label, nativeLabel, speechLang }) => ({ code, label, nativeLabel, speechLang }));
}

// ---------------------------------------------------------------------------
// Deterministic onboarding templates, keyed by template id then language code.
// {name} placeholders are substituted by the flow. Missing codes fall back to en.
// ---------------------------------------------------------------------------

const T = {
  greeting: {
    en: `Hi{name}! I'm Genni 👋 — I'll build your business website with you, right here in this chat. It takes just a few minutes, and your first home page is free. First — which language would you like to chat in?`,
    ta: `வணக்கம்{name}! நான் Genni 👋 — இந்த chat-லேயே உங்க business website-ஐ உங்களோட சேர்ந்து உருவாக்குவேன். சில நிமிஷங்கள்தான் ஆகும், உங்க முதல் home page இலவசம். முதல்ல — எந்த மொழியில பேசலாம்?`,
    'ta-en': `Hi{name}! நான் Genni 👋 — இந்த chat-லேயே உங்க business website ready பண்ணிடலாம். ஒரு சில நிமிஷம்தான், first home page free! முதல்ல — எந்த language-ல chat பண்ணலாம்?`,
    te: `నమస్తే{name}! నేను Genni 👋 — ఈ chat లోనే మీ business website ని మీతో కలిసి తయారు చేస్తాను. కొన్ని నిమిషాలే పడుతుంది, మీ మొదటి home page ఉచితం. ముందుగా — ఏ భాషలో మాట్లాడుకుందాం?`,
    'te-en': `Hi{name}! నేను Genni 👋 — ఈ chat లోనే మీ business website ready చేసేద్దాం. కొన్ని minutes చాలు, first home page free! ముందుగా — ఏ language లో chat చేద్దాం?`,
    ml: `നമസ്കാരം{name}! ഞാൻ Genni 👋 — ഈ chat-ൽ തന്നെ നിങ്ങളുടെ business website ഞാൻ നിങ്ങളോടൊപ്പം ഉണ്ടാക്കാം. കുറച്ച് മിനിറ്റുകൾ മതി, ആദ്യത്തെ home page സൗജന്യമാണ്. ആദ്യം — ഏത് ഭാഷയിൽ സംസാരിക്കാം?`,
    'ml-en': `Hi{name}! ഞാൻ Genni 👋 — ഈ chat-ൽ തന്നെ നിങ്ങളുടെ business website ready ആക്കാം. കുറച്ച് minutes മതി, first home page free! ആദ്യം — ഏത് language-ൽ chat ചെയ്യാം?`,
    hi: `नमस्ते{name}! मैं Genni हूँ 👋 — इसी chat में आपके साथ मिलकर आपकी business website बनाऊँगी। बस कुछ ही मिनट लगेंगे, और आपका पहला home page मुफ़्त है। सबसे पहले — किस भाषा में बात करें?`,
    'hi-en': `Hi{name}! मैं Genni 👋 — इसी chat में आपकी business website ready कर देंगे। बस कुछ minutes, और first home page free! सबसे पहले — किस language में chat करें?`,
  },
  language_set: {
    en: `Great, let's do this in English!`,
    ta: `சரி, இனிமே தமிழ்ல பேசலாம்! 😊`,
    'ta-en': `Super! இனிமே Tanglish-ல பேசலாம் 😊`,
    te: `సరే, ఇక తెలుగులో మాట్లాడుకుందాం! 😊`,
    'te-en': `Super! ఇక Telugu-English mix లో మాట్లాడుకుందాం 😊`,
    ml: `ശരി, ഇനി മലയാളത്തിൽ സംസാരിക്കാം! 😊`,
    'ml-en': `Super! ഇനി Malayalam-English mix-ൽ സംസാരിക്കാം 😊`,
    hi: `बहुत बढ़िया, अब हिन्दी में बात करते हैं! 😊`,
    'hi-en': `Super! अब Hinglish में बात करते हैं 😊`,
  },
  ask_business: {
    en: `Tell me your business name and the city or locality — for example "Saravana Stores, T Nagar Chennai". I'll find your details on Google so you don't have to type them.`,
    ta: `உங்க business பெயரும் ஊர் / பகுதியும் சொல்லுங்க — உதாரணமா "Saravana Stores, T Nagar Chennai". உங்க விவரங்களை நான் Google-ல தேடி எடுத்துடறேன், நீங்க type பண்ண வேண்டாம்.`,
    'ta-en': `உங்க business name-உம் city / area-வும் சொல்லுங்க — example: "Saravana Stores, T Nagar Chennai". நான் Google-ல இருந்து details எடுத்துடறேன், நீங்க type பண்ண வேண்டாம்!`,
    te: `మీ business పేరు మరియు ఊరు / ప్రాంతం చెప్పండి — ఉదాహరణకి "Sri Lakshmi Sweets, Kukatpally Hyderabad". మీ వివరాలు నేను Google లో వెతికి తీసుకుంటాను, మీరు type చేయనవసరం లేదు.`,
    'te-en': `మీ business name మరియు city / area చెప్పండి — example: "Sri Lakshmi Sweets, Kukatpally Hyderabad". Details అన్నీ నేను Google నుంచి తీసుకుంటాను!`,
    ml: `നിങ്ങളുടെ business പേരും സ്ഥലവും പറയൂ — ഉദാഹരണം: "Ariya Bakery, Edappally Kochi". വിവരങ്ങൾ ഞാൻ Google-ൽ നിന്ന് കണ്ടെത്താം, നിങ്ങൾ type ചെയ്യേണ്ട.`,
    'ml-en': `നിങ്ങളുടെ business name-ഉം city / area-യും പറയൂ — example: "Ariya Bakery, Edappally Kochi". Details ഒക്കെ ഞാൻ Google-ൽ നിന്ന് എടുക്കാം!`,
    hi: `अपने business का नाम और शहर / इलाक़ा बताइए — जैसे "Sharma Sweets, Karol Bagh Delhi". आपकी जानकारी मैं Google से ढूँढ लूँगी, आपको type नहीं करनी पड़ेगी।`,
    'hi-en': `अपने business का name और city / area बताइए — jaise "Sharma Sweets, Karol Bagh Delhi". Details मैं Google से निकाल लूँगी, आपको type नहीं करना पड़ेगा!`,
  },
  search_results: {
    en: `I found these on Google — is one of them your business? Tap it, or choose "None of these" to enter details yourself.`,
    ta: `Google-ல இவை கிடைத்தன — இதுல உங்க business இருக்கா? அதை தட்டுங்க, இல்லைனா "None of these" தேர்ந்தெடுத்து நீங்களே விவரம் கொடுக்கலாம்.`,
    'ta-en': `Google-ல இது எல்லாம் கிடைச்சது — இதுல உங்க business இருக்கா? Tap பண்ணுங்க, இல்லைனா "None of these" select பண்ணி நீங்களே details கொடுக்கலாம்.`,
    te: `Google లో ఇవి దొరికాయి — వీటిలో మీ business ఉందా? దాన్ని tap చేయండి, లేకపోతే "None of these" ఎంచుకుని మీరే వివరాలు ఇవ్వచ్చు.`,
    'te-en': `Google లో ఇవి దొరికాయి — వీటిలో మీ business ఉందా? Tap చేయండి, లేదా "None of these" select చేసి మీరే details ఇవ్వచ్చు.`,
    ml: `Google-ൽ ഇവയാണ് കിട്ടിയത് — ഇതിൽ നിങ്ങളുടെ business ഉണ്ടോ? അതിൽ tap ചെയ്യൂ, ഇല്ലെങ്കിൽ "None of these" തിരഞ്ഞെടുത്ത് സ്വയം വിവരങ്ങൾ നൽകാം.`,
    'ml-en': `Google-ൽ ഇതൊക്കെയാണ് കിട്ടിയത് — ഇതിൽ നിങ്ങളുടെ business ഉണ്ടോ? Tap ചെയ്യൂ, അല്ലെങ്കിൽ "None of these" select ചെയ്ത് details സ്വയം കൊടുക്കാം.`,
    hi: `Google पर मुझे ये मिले — क्या इनमें आपका business है? उस पर tap कीजिए, या "None of these" चुनकर ख़ुद जानकारी भर सकते हैं।`,
    'hi-en': `Google पर ये मिले — इनमें आपका business है क्या? Tap कीजिए, या "None of these" चुनकर ख़ुद details भर सकते हैं।`,
  },
  no_results: {
    en: `I couldn't find that on Google. No problem — let's fill in the details together.`,
    ta: `Google-ல அது கிடைக்கலை. பரவாயில்லை — விவரங்களை நாமே சேர்த்துக்கலாம்.`,
    'ta-en': `Google-ல அது கிடைக்கலை. Problem இல்லை — details நாமே fill பண்ணலாம்.`,
    te: `అది Google లో దొరకలేదు. పర్వాలేదు — వివరాలు మనమే కలిసి నింపుదాం.`,
    'te-en': `అది Google లో దొరకలేదు. పర్వాలేదు — details మనమే fill చేద్దాం.`,
    ml: `അത് Google-ൽ കണ്ടില്ല. കുഴപ്പമില്ല — വിവരങ്ങൾ നമുക്ക് ഒരുമിച്ച് ചേർക്കാം.`,
    'ml-en': `അത് Google-ൽ കിട്ടിയില്ല. Problem ഇല്ല — details നമുക്ക് fill ചെയ്യാം.`,
    hi: `वो Google पर नहीं मिला। कोई बात नहीं — जानकारी हम साथ मिलकर भर लेते हैं।`,
    'hi-en': `वो Google पर नहीं मिला। कोई बात नहीं — details हम साथ में fill कर लेते हैं।`,
  },
  ask_logo: {
    en: `Do you have a logo? Upload it here and I'll design the site around it. No logo? Just skip — I'll style your business name beautifully instead.`,
    ta: `உங்ககிட்ட logo இருக்கா? இங்கே upload பண்ணுங்க, அதை வைத்து site-ஐ design பண்றேன். Logo இல்லைனா skip பண்ணுங்க — உங்க business பெயரையே அழகா style பண்ணிடறேன்.`,
    'ta-en': `Logo இருக்கா? இங்கே upload பண்ணுங்க, அத வைச்சு site design பண்றேன். இல்லைனா skip பண்ணுங்க — business name-ஐயே stylish-ஆ போட்டுடறேன்.`,
    te: `మీ దగ్గర logo ఉందా? ఇక్కడ upload చేయండి, దాని చుట్టూ site ని design చేస్తాను. Logo లేకపోతే skip చేయండి — మీ business పేరునే అందంగా style చేస్తాను.`,
    'te-en': `Logo ఉందా? ఇక్కడ upload చేయండి, దానితో site design చేస్తాను. లేకపోతే skip చేయండి — business name నే stylish గా చేస్తాను.`,
    ml: `നിങ്ങൾക്ക് logo ഉണ്ടോ? ഇവിടെ upload ചെയ്യൂ, അതിന് ചുറ്റും site design ചെയ്യാം. Logo ഇല്ലെങ്കിൽ skip ചെയ്യൂ — business പേര് തന്നെ ഭംഗിയായി style ചെയ്യാം.`,
    'ml-en': `Logo ഉണ്ടോ? ഇവിടെ upload ചെയ്യൂ, അത് വെച്ച് site design ചെയ്യാം. ഇല്ലെങ്കിൽ skip ചെയ്യൂ — business name തന്നെ stylish ആക്കാം.`,
    hi: `क्या आपके पास logo है? यहाँ upload कीजिए, मैं site उसी के आस-पास design करूँगी। Logo नहीं है? Skip कर दीजिए — मैं आपके business के नाम को ही सुंदर style दे दूँगी।`,
    'hi-en': `Logo है क्या? यहाँ upload कीजिए, site उसी से design करूँगी। नहीं है तो skip कर दीजिए — business name को ही stylish बना दूँगी।`,
  },
  ask_competitor: {
    en: `Almost done! Is there a competitor whose website you like? Paste their link — I'll take styling cues from it (optional, feel free to skip).`,
    ta: `கிட்டத்தட்ட முடிந்தது! உங்க போட்டியாளர் யாருடைய website உங்களுக்கு பிடிச்சிருக்கா? அந்த link-ஐ இங்கே ஒட்டுங்க — அதிலிருந்து style யோசனைகள் எடுத்துக்கறேன் (optional, skip பண்ணலாம்).`,
    'ta-en': `Almost done! எந்த competitor website உங்களுக்கு பிடிச்சிருக்கு? Link paste பண்ணுங்க — அதுல இருந்து style ideas எடுத்துக்கறேன் (optional, skip பண்ணலாம்).`,
    te: `దాదాపు అయిపోయింది! మీకు నచ్చిన website ఉన్న competitor ఎవరైనా ఉన్నారా? వారి link ఇక్కడ paste చేయండి — దాని నుంచి style ideas తీసుకుంటాను (optional, skip చేయవచ్చు).`,
    'te-en': `Almost done! మీకు నచ్చిన competitor website ఏదైనా ఉందా? Link paste చేయండి — దాని నుంచి style ideas తీసుకుంటాను (optional, skip చేయవచ్చు).`,
    ml: `ഏകദേശം കഴിഞ്ഞു! നിങ്ങൾക്ക് ഇഷ്ടപ്പെട്ട website ഉള്ള competitor ഉണ്ടോ? അവരുടെ link paste ചെയ്യൂ — അതിൽ നിന്ന് style ideas എടുക്കാം (optional, skip ചെയ്യാം).`,
    'ml-en': `Almost done! ഇഷ്ടപ്പെട്ട competitor website ഉണ്ടോ? Link paste ചെയ്യൂ — style ideas എടുക്കാം (optional, skip ചെയ്യാം).`,
    hi: `बस थोड़ा और! क्या किसी competitor की website आपको पसंद है? उनका link यहाँ paste कीजिए — मैं उससे styling के संकेत लूँगी (optional है, skip कर सकते हैं)।`,
    'hi-en': `बस थोड़ा और! किसी competitor की website पसंद है क्या? Link paste कीजिए — उससे style ideas लूँगी (optional, skip कर सकते हैं)।`,
  },
  ask_reference: {
    en: `And is there any website — from anywhere — whose look you'd love yours to have? Paste the link (optional).`,
    ta: `உலகில் எந்த website-ன் look உங்க site-க்கு வேண்டும்னு நினைக்கிறீங்க? அந்த link-ஐ ஒட்டுங்க (optional).`,
    'ta-en': `வேற எந்த website look உங்க site-க்கு வேணும்னு நினைக்கிறீங்க? Link paste பண்ணுங்க (optional).`,
    te: `ఇంకా — ఏదైనా website look మీ site కి కావాలనుకుంటున్నారా? ఆ link paste చేయండి (optional).`,
    'te-en': `ఇంకా — ఏ website look అయినా మీ site కి కావాలా? Link paste చేయండి (optional).`,
    ml: `പിന്നെ — ഏതെങ്കിലും website-ന്റെ look നിങ്ങളുടെ site-ന് വേണമെന്നുണ്ടോ? Link paste ചെയ്യൂ (optional).`,
    'ml-en': `പിന്നെ — ഏതെങ്കിലും website look നിങ്ങളുടെ site-ന് വേണോ? Link paste ചെയ്യൂ (optional).`,
    hi: `और — कहीं की भी कोई website जिसका look आप अपनी site में चाहते हैं? उसका link paste कीजिए (optional)।`,
    'hi-en': `और — कोई भी website जिसका look आपको अपनी site के लिए चाहिए? Link paste कीजिए (optional)।`,
  },
  summary_intro: {
    en: `Here's everything I have. Check it once — if it all looks right, I'll start building your website. Your first home page is free! 🎉`,
    ta: `இதோ எல்லா விவரங்களும். ஒருமுறை பார்த்துக்கொள்ளுங்க — எல்லாம் சரியா இருந்தா, உங்க website-ஐ உருவாக்க ஆரம்பிக்கிறேன். முதல் home page இலவசம்! 🎉`,
    'ta-en': `இதோ full details. ஒரு தடவை check பண்ணுங்க — எல்லாம் correct-ஆ இருந்தா, உங்க website build பண்ண start பண்றேன். First home page free! 🎉`,
    te: `ఇవిగో అన్ని వివరాలు. ఒకసారి చూసుకోండి — అన్నీ సరిగ్గా ఉంటే, మీ website ని తయారు చేయడం మొదలుపెడతాను. మొదటి home page ఉచితం! 🎉`,
    'te-en': `ఇవిగో full details. ఒకసారి check చేయండి — అన్నీ correct గా ఉంటే, మీ website build చేయడం start చేస్తాను. First home page free! 🎉`,
    ml: `ഇതാ എല്ലാ വിവരങ്ങളും. ഒന്ന് നോക്കൂ — എല്ലാം ശരിയാണെങ്കിൽ, നിങ്ങളുടെ website ഉണ്ടാക്കാൻ തുടങ്ങാം. ആദ്യത്തെ home page സൗജന്യം! 🎉`,
    'ml-en': `ഇതാ full details. ഒന്ന് check ചെയ്യൂ — എല്ലാം correct ആണെങ്കിൽ, website build ചെയ്യാൻ start ചെയ്യാം. First home page free! 🎉`,
    hi: `ये रही पूरी जानकारी। एक बार देख लीजिए — सब सही है तो मैं आपकी website बनाना शुरू करती हूँ। पहला home page मुफ़्त है! 🎉`,
    'hi-en': `ये रही full details. एक बार check कर लीजिए — सब सही है तो website build करना start करती हूँ। First home page free! 🎉`,
  },
  build_started: {
    en: `We're off! 🚀 Watch your website come to life — I'll show you the design as it takes shape.`,
    ta: `ஆரம்பிச்சாச்சு! 🚀 உங்க website உருவாகுவதை நேரலையா பாருங்க — design உருவாகும்போதே காண்பிக்கிறேன்.`,
    'ta-en': `Start ஆயிடுச்சு! 🚀 உங்க website உருவாகறத live-ஆ பாருங்க — design ready ஆகும்போதே காட்டறேன்.`,
    te: `మొదలైంది! 🚀 మీ website రూపుదిద్దుకోవడం live గా చూడండి — design వస్తున్న కొద్దీ చూపిస్తాను.`,
    'te-en': `Start అయ్యింది! 🚀 మీ website తయారవడం live గా చూడండి — design వచ్చిన వెంటనే చూపిస్తాను.`,
    ml: `തുടങ്ങി! 🚀 നിങ്ങളുടെ website രൂപപ്പെടുന്നത് live ആയി കാണൂ — design വരുന്ന മുറയ്ക്ക് കാണിക്കാം.`,
    'ml-en': `Start ആയി! 🚀 Website രൂപപ്പെടുന്നത് live ആയി കാണൂ — design ready ആകുമ്പോൾ കാണിക്കാം.`,
    hi: `शुरू हो गया! 🚀 अपनी website को बनते हुए live देखिए — design जैसे-जैसे तैयार होगा, मैं दिखाती जाऊँगी।`,
    'hi-en': `Start हो गया! 🚀 अपनी website बनते हुए live देखिए — design तैयार होते ही दिखाती जाऊँगी।`,
  },
  skip: {
    en: 'Skip', ta: 'தவிர்க்கவும்', 'ta-en': 'Skip', te: 'దాటవేయి', 'te-en': 'Skip',
    ml: 'ഒഴിവാക്കുക', 'ml-en': 'Skip', hi: 'छोड़ें', 'hi-en': 'Skip',
  },
};

/**
 * Deterministic localized template. vars: { name: 'Pream' } etc.
 */
function template(id, langCode, vars = {}) {
  const entry = T[id];
  if (!entry) return '';
  let text = entry[langCode] || entry[DEFAULT_LANGUAGE] || '';
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, v ? (k === 'name' ? ` ${v}` : v) : '');
  }
  return text;
}

module.exports = { LANGUAGES, DEFAULT_LANGUAGE, getLanguage, listLanguages, template };
