// why: the venue reports prices in cents as strings
// TODO(#12): drop the string branch once the venue sends integers
/** Parses a cents string from the venue. */
export function parseCents(raw: string): number {
  return Number.parseInt(raw, 10);
}

// oxlint-disable-next-line no-console
console.info(parseCents("1"));

// oxlint-disable-next-line no-console -- startup banner for the CLI
console.info(parseCents("2"));

/** A doc block that is not on an export. */
const unused = 1;
export const used = unused;
