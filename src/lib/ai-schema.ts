/** Shared between the browser and the Cloudflare Worker – keep free of DOM / Vue imports. */

export interface SizeSpec { id: string; name: string; width: number; height: number }

export type AnalyzeDoc =
  | { kind: 'image'; name?: string; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string }
  | { kind: 'pdf'; name?: string; data: string }
  | { kind: 'text'; name?: string; text: string }

export interface AnalyzeInput {
  /** Photo of the panel (base64, no data: prefix). */
  photo?: { media_type: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }
  /** The electrician's circuit list: photo, PDF, or extracted text. */
  docs?: AnalyzeDoc[]
  sizes: SizeSpec[]
  icons: string[]
  instructions?: string
}

export const KINDS = ['breaker', 'rcd', 'rcbo', 'main', 'spd', 'contactor', 'relay', 'timer', 'meter', 'blank', 'other'] as const

export interface AnalyzedItem {
  number: string
  text: string
  sub: string
  icon: string
  sizeId: string
  kind: (typeof KINDS)[number]
  notes: string
}

export interface AnalyzeResult {
  rows: { name: string; items: AnalyzedItem[] }[]
  summary: string
  warnings: string[]
}

export function resultSchema(sizeIds: string[], icons: string[]) {
  const str = { type: 'string' }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['rows', 'summary', 'warnings'],
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'items'],
          properties: {
            name: str,
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['number', 'text', 'sub', 'icon', 'sizeId', 'kind', 'notes'],
                properties: {
                  number: str,
                  text: str,
                  sub: str,
                  icon: { type: 'string', enum: ['', ...icons] },
                  sizeId: { type: 'string', enum: sizeIds },
                  kind: { type: 'string', enum: [...KINDS] },
                  notes: str,
                },
              },
            },
          },
        },
      },
      summary: str,
      warnings: { type: 'array', items: str },
    },
  }
}

export function systemPrompt(input: AnalyzeInput): string {
  const sizes = input.sizes.map(s => `- "${s.id}": ${s.name}, label window ${s.width}×${s.height} mm`).join('\n')
  return `You help a homeowner make printed labels for the devices in their electrical distribution board (DIN-rail breaker panel). Each device has a small paper window for a label, and the label sizes available are:
${sizes}

Your output is a structured map of the panel: rows top-to-bottom, devices left-to-right within each row, the way someone standing in front of the open panel sees them.

How to use the inputs:
- Panel photo: identify every DIN-rail device on each rail, in order, including main switches, RCDs/RCCBs, RCBOs, surge protectors, contactors, timers, meters and blank cover plates (kind "blank"). Pick the label size whose width best matches the device's physical width, judging relative to its neighbours: a single-module MCB (~17.5 mm wide) takes the smallest size, a 2-pole / 2-module device the next one, 3–4 module devices the largest. If a device already carries a label or circuit number, use it.
- Circuit list from the electrician (handwritten, photo, PDF, text): it maps circuit numbers to what they feed. Transcribe it faithfully, including numbering such as "Q3", "F12" or "1.2".
- If you have both, match list entries to devices by number and position, and say in "warnings" where the match was uncertain.
- With only a list and no photo, put the circuits in one row per group the list implies (or a single row), in list order, and pick sizes from the device type if it is stated (e.g. 2P/3P/4P, RCD) – otherwise the smallest size.

Writing the label fields:
- "text" is what gets printed, and it must fit a tiny label – use 1–2 short words (about 6–10 characters on the smallest size, up to ~18 on the largest). For example "Kitchen sockets", "Bathroom", "Fridge", "Lights 1st fl." Keep the language of the source document unless the user's instructions ask for another one. Keep the meaning; abbreviate sensibly.
- "sub" is an optional short second line: rating or location ("16A", "B20", "Bedroom 2"), otherwise "".
- "notes" holds the full original wording and anything else useful that does not fit on the label, otherwise "".
- "number" is the circuit reference as written (or "" if none is known). Do not invent numbers.
- "icon" is the closest icon from the allowed list, describing what the circuit powers (lights → lightbulb, sockets → power-socket-eu, a room only when nothing more specific applies). Use "" when nothing fits.
- Row "name" is something like "Row 1" unless the source names it.
- Put anything you could not read or had to guess in "warnings"; "summary" is a one-sentence description of what you found.`
}
