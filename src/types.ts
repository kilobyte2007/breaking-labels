/** All physical dimensions are in millimetres. */

export interface LabelSize {
  id: string
  name: string
  width: number
  height: number
}

export type LabelLayout = 'auto' | 'icon-left' | 'icon-top' | 'icon-only' | 'text-only'

export interface LabelItem {
  id: string
  sizeId: string
  /** Main text printed on the label. */
  text: string
  /** Optional second line (e.g. "16A" or "Kitchen"). */
  sub: string
  /** `mdi:<name>` for the built-in sets, `img:<dataUrl>` for an uploaded icon, '' for none. */
  icon: string
  /** Circuit reference, e.g. "1", "Q3", "F12". */
  number: string
  /** Accent colour (hex) – used as stripe or full background depending on panel style. */
  color: string
  /** Per-label layout override; '' = follow panel style. */
  layout: LabelLayout | ''
  /** Free notes, never printed. */
  notes: string
  /** Blank spacer – keeps a slot on the rail but prints nothing. */
  blank: boolean
}

export interface PanelRow {
  id: string
  name: string
  items: LabelItem[]
}

export type AccentMode = 'none' | 'stripe' | 'background' | 'icon'

export interface PanelStyle {
  layout: LabelLayout
  fontId: string
  fontWeight: number
  uppercase: boolean
  textColor: string
  background: string
  accentMode: AccentMode
  showNumber: boolean
  numberStyle: 'badge' | 'plain'
  border: boolean
  borderColor: string
  borderWidth: number
  radius: number
  padding: number
  /** Largest font size the auto-fit may use (mm cap height ≈ 0.7 × this). */
  maxFont: number
  minFont: number
  iconScale: number
}

export interface Panel {
  id: string
  name: string
  rows: PanelRow[]
  style: PanelStyle
  /** IndexedDB key of the reference photo, if any. */
  photoKey: string
  createdAt: number
  updatedAt: number
}

export interface PrintSettings {
  paper: 'A4' | 'Letter' | 'A5' | 'custom'
  paperWidth: number
  paperHeight: number
  margin: number
  gap: number
  cutMarks: boolean
  outline: boolean
  outlineColor: string
  groupByRow: boolean
  rowCaptions: boolean
  ruler: boolean
  overview: boolean
  /** Printer calibration: measured / expected. 1 = exact. */
  scaleX: number
  scaleY: number
  copies: number
  bleed: number
}

export interface AiSettings {
  mode: 'server' | 'key'
  apiKey: string
  accessCode: string
}

export interface Settings {
  sizes: LabelSize[]
  print: PrintSettings
  ai: AiSettings
  palette: string[]
}
