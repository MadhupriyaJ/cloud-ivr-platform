/**
 * Language behaviour for the realtime voice IVR.
 *
 * The realtime model hears and speaks many languages natively, so multilingual
 * support is mostly a matter of instructions: answer in the caller's language,
 * follow them when they switch, and mirror code-mixed speech (e.g. Tamil with
 * English words — "Tanglish") instead of forcing a formal register.
 *
 * A domain configures:
 *   - defaultLanguage     the language of the opening greeting
 *   - supportedLanguages  "English, Tamil"; empty means any language
 */

/** ISO-639-1 codes for the languages we expect callers to use. */
const LANGUAGE_CODES: Record<string, string> = {
  english: 'en',
  tamil: 'ta',
  hindi: 'hi',
  telugu: 'te',
  kannada: 'kn',
  malayalam: 'ml',
  marathi: 'mr',
  bengali: 'bn',
  gujarati: 'gu',
  punjabi: 'pa',
  urdu: 'ur',
  arabic: 'ar',
  french: 'fr',
  spanish: 'es',
  german: 'de',
};

export function parseLanguages(value?: string | null): string[] {
  return [
    ...new Set(
      String(value ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function languageCode(language: string): string | undefined {
  return LANGUAGE_CODES[language.trim().toLowerCase()];
}

/**
 * Transcription language hint. Only a single-language domain gets one: with a
 * hint the transcriber stops detecting the language, which would break
 * callers who switch or mix languages.
 */
export function transcriptionLanguageHint(supported: string[]): string | undefined {
  return supported.length === 1 ? languageCode(supported[0]) : undefined;
}

/** Instruction block describing which language to speak and how. */
export function buildLanguageInstructions(defaultLanguage: string, supported: string[]): string {
  const fallbackLanguage = defaultLanguage || supported[0] || 'English';
  const lines: string[] = [];

  if (supported.length === 0) {
    lines.push(
      'Callers may speak any language.',
      'Always reply in the language the caller is using, and switch whenever they switch.',
      `Until the caller has spoken, use ${fallbackLanguage}.`,
    );
  } else {
    const list = supported.join(', ');
    lines.push(
      `This line supports these languages: ${list}.`,
      'Always reply in the language the caller is using, and switch whenever they switch.',
      `Until the caller has spoken, use ${fallbackLanguage}.`,
      `If the caller uses a language outside this list, say briefly that you can help in ${list}, then continue in ${fallbackLanguage}.`,
    );
  }

  lines.push(
    "Decide the reply language from the words of the caller's most recent turn only — not from their accent, their name, or the greeting.",
    'A caller with an Indian accent who speaks English must get English. Switch to another language only when the caller actually speaks it.',
    'Many callers mix languages in one sentence. Mirror their mix: if they speak Tamil with English words, answer in the same everyday mix rather than switching fully to one language.',
    'Keep common English words that callers themselves use in English (for example appointment, doctor, scan, report, bill, OK).',
    'Keep names of people, doctors, departments and places exactly as they are.',
    "Say dates, times and amounts naturally in the caller's language. Read phone numbers, patient IDs and codes digit by digit.",
  );

  const tamil = supported.length === 0 || supported.some((item) => item.toLowerCase() === 'tamil');
  if (tamil) {
    lines.push(
      'When speaking Tamil, use natural spoken Tamil (பேச்சுத் தமிழ்) as people talk on the phone, not formal written Tamil.',
    );
  }

  return lines.join(' ');
}

/**
 * "You can also speak in X", written in X. Given as an example because the
 * model otherwise tends to say this sentence in the greeting language.
 */
const ALSO_SPEAK_IN: Record<string, string> = {
  tamil: 'நீங்க தமிழ்லயும் பேசலாம்.',
  hindi: 'आप हिंदी में भी बात कर सकते हैं।',
  telugu: 'మీరు తెలుగులో కూడా మాట్లాడవచ్చు.',
  kannada: 'ನೀವು ಕನ್ನಡದಲ್ಲೂ ಮಾತನಾಡಬಹುದು.',
  malayalam: 'നിങ്ങൾക്ക് മലയാളത്തിലും സംസാരിക്കാം.',
  english: 'You can also speak in English.',
};

/** Instruction for the assistant's first spoken turn. */
export function buildGreetingInstruction(
  welcomeMessage: string,
  defaultLanguage: string,
  supported: string[],
): string {
  const greetingLanguage = defaultLanguage || supported[0] || 'English';
  const others = supported.filter((item) => item.toLowerCase() !== greetingLanguage.toLowerCase());

  const base = `Greet the caller by saying this welcome message in ${greetingLanguage}, translating it if it is written in another language: "${welcomeMessage}"`;

  if (supported.length === 0) {
    return `${base} Then add one short sentence saying they can talk in whichever language they are comfortable with. Say nothing else.`;
  }
  if (others.length === 0) {
    return `${base} Say nothing else.`;
  }
  const invitations = others.map((language) => {
    const example = ALSO_SPEAK_IN[language.toLowerCase()];
    return example
      ? `in ${language}, say: "${example}"`
      : `in ${language} itself (not in ${greetingLanguage}), say that the caller can also speak ${language}`;
  });
  return `${base} Then, speaking each sentence in its own language and not translating it into ${greetingLanguage}: ${invitations.join('; ')}. Say nothing else.`;
}
