/**
 * The canonical 66-book order, Genesis through Revelation. Used anywhere
 * content needs to be presented "by biblical book" rather than
 * alphabetically or by last-touched — the Scripture Notes archive and the
 * Markdown export folder structure both rely on this.
 */
export const BIBLE_BOOK_ORDER: string[] = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
  "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
  "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
  "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations",
  "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk",
  "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts",
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
  "James", "1 Peter", "2 Peter", "1 John", "2 John",
  "3 John", "Jude", "Revelation",
];

const ORDER_INDEX = new Map(BIBLE_BOOK_ORDER.map((book, i) => [book, i]));

/** Sort comparator for canonical book order. Unknown books sort last. */
export function compareBookOrder(a: string, b: string): number {
  const ai = ORDER_INDEX.get(a) ?? Infinity;
  const bi = ORDER_INDEX.get(b) ?? Infinity;
  return ai - bi;
}
