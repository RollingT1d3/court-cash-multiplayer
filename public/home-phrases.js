// COURT CASH — 0.4.2 weighted homepage subtitles.
// Exactly one line is selected on each fresh homepage load/reload.
// Weights represent percentage chances and must sum to 100.
export const HOME_PHRASES = Object.freeze([
  Object.freeze({ text: "Shoutout ceekel", weight: 5 }),
  Object.freeze({ text: "Shoutout Caeden, love you bro", weight: 5 }),
  Object.freeze({ text: "Tip: The better a player’s teamwork stat, the better they’ll follow the offensive plan!", weight: 5 }),
  Object.freeze({ text: "Tip: Even if you have a sucky team, it’s still possible for you to win the game if you use proper strategy!", weight: 2 }),
  Object.freeze({ text: "Tip: The higher a player’s Freethrow, the more often they get fouled.", weight: 18 }),
  Object.freeze({ text: "Tip: Don’t use Paint Mash dude.", weight: 10 }),
  Object.freeze({ text: "Tip: ‘Double the star’ sucks if the star is a playmaker btw.", weight: 5 }),
  Object.freeze({ text: "Fun Fact: There’s only one player below a 70 ovr.", weight: 5 }),
  Object.freeze({ text: "Fun Fact: No player has a 100 IQ, cuz you can always learn more.", weight: 5 }),
  Object.freeze({ text: "Ice man was a nice man, now I’m hot and cold🥶🔥", weight: 10 }),
  Object.freeze({ text: "Feed her some mcdonald’s on some e i e i o shi", weight: 10 }),
  Object.freeze({ text: "Fun Fact: By doing the ancient ‘Sippe Chant’ you have a 99% chance to roll The Big Sipper 🥹", weight: 10 }),
  Object.freeze({ text: "She in my phone with a nickname, it’s, it’s, it’s…Grippy!🥹", weight: 5 }),
  Object.freeze({ text: "Jesus Loves You", weight: 5 }),
]);

export function pickHomePhrase(random = Math.random) {
  const total = HOME_PHRASES.reduce((sum, phrase) => sum + phrase.weight, 0);
  if (total !== 100) throw new Error('Homepage phrase weights must total 100%.');
  const roll = random();
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new RangeError('Random value must be in [0, 1).');
  const target = roll * total;
  let cumulative = 0;
  for (const phrase of HOME_PHRASES) {
    cumulative += phrase.weight;
    if (target < cumulative) return phrase.text;
  }
  return HOME_PHRASES.at(-1).text;
}

export function renderHomePhrase(doc, random = Math.random) {
  const element = doc.getElementById('home-phrase');
  if (!element) return null;
  // textContent ensures quoted messages and emoji are treated as text, not HTML.
  element.textContent = pickHomePhrase(random);
  return element.textContent;
}

if (typeof document !== 'undefined') renderHomePhrase(document);
