/**
 * The built-in Prayer Book. Deliberately small — a supporting feature, not
 * a second application hidden inside this one, per the spec.
 *
 * Every text here is either an ancient liturgical prayer in its
 * traditional, long-established English rendering, or drawn from the 1662
 * Book of Common Prayer, which is unambiguously in the public domain. None
 * of these are a modern copyrighted translation or paraphrase — this list
 * should stay that way if more are ever added.
 *
 * These are also the pool Threshold draws from (see routes/Threshold.tsx).
 * The spec allows Threshold to show "a randomized short Scripture passage
 * or historic Christian prayer" — this app deliberately only uses the
 * prayer option, never a Scripture excerpt, since the app is designed to
 * never contain Bible text at all (the physical Bible is the sanctuary;
 * this app is only ever the narthex). Using prayers exclusively keeps that
 * boundary clean and sidesteps any question of Bible-translation licensing
 * entirely.
 */

export interface Prayer {
  id: string;
  title: string;
  attribution: string;
  text: string;
}

export const PRAYER_BOOK: Prayer[] = [
  {
    id: "chrysostom",
    title: "A Prayer of St. Chrysostom",
    attribution: "Ascribed to St. John Chrysostom (4th c.); Book of Common Prayer, 1662",
    text: "Almighty God, who hast given us grace at this time with one accord to make our common supplications unto thee; and dost promise that when two or three are gathered together in thy Name thou wilt grant their requests: Fulfil now, O Lord, the desires and petitions of thy servants, as may be most expedient for them; granting us in this world knowledge of thy truth, and in the world to come life everlasting. Amen.",
  },
  {
    id: "ephrem",
    title: "The Prayer of St. Ephrem",
    attribution: "St. Ephrem the Syrian (4th c.), traditional Lenten prayer",
    text: "O Lord and Master of my life, take from me the spirit of sloth, faint-heartedness, lust of power, and idle talk. But give rather the spirit of chastity, humility, patience, and love to Thy servant. Yea, O Lord and King, grant me to see my own transgressions, and not to judge my brother; for blessed art Thou, unto ages of ages. Amen.",
  },
  {
    id: "jesus-prayer",
    title: "The Jesus Prayer",
    attribution: "Ancient, Eastern Christian tradition",
    text: "Lord Jesus Christ, Son of God, have mercy on me, a sinner.",
  },
  {
    id: "morning-collect",
    title: "A Collect for Grace",
    attribution: "Book of Common Prayer, 1662 — Morning Prayer",
    text: "O Lord, our heavenly Father, Almighty and everlasting God, who hast safely brought us to the beginning of this day: Defend us in the same with thy mighty power; and grant that this day we fall into no sin, neither run into any kind of danger; but that all our doings may be ordered by thy governance, to do always that is righteous in thy sight; through Jesus Christ our Lord. Amen.",
  },
  {
    id: "evening-collect",
    title: "A Collect for Aid Against All Perils",
    attribution: "Book of Common Prayer, 1662 — Evening Prayer",
    text: "Lighten our darkness, we beseech thee, O Lord; and by thy great mercy defend us from all perils and dangers of this night; for the love of thy only Son, our Saviour, Jesus Christ. Amen.",
  },
];

export function randomPrayer(): Prayer {
  return PRAYER_BOOK[Math.floor(Math.random() * PRAYER_BOOK.length)];
}
