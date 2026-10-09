import type { LabelItem, LabelSize, Panel, PanelRow, PanelStyle, PrintSettings, Settings } from './types'

export const uid = () => Math.random().toString(36).slice(2, 10)

export const DEFAULT_SIZES: LabelSize[] = [
  { id: 's14', name: '1 module', width: 14, height: 10 },
  { id: 's32', name: '2 modules', width: 32, height: 10 },
  { id: 's50', name: '3 modules', width: 50, height: 10 },
]

export const PALETTE = [
  '#f5c518', // lights
  '#ef4444', // power / heavy loads
  '#3b82f6', // water / bathroom
  '#22c55e', // outdoor
  '#a855f7', // tech
  '#f97316', // kitchen
  '#06b6d4', // climate
  '#64748b', // misc
  '#ec4899',
  '#111827',
]

export const DEFAULT_STYLE: PanelStyle = {
  layout: 'auto',
  fontId: 'roboto-condensed',
  fontWeight: 600,
  uppercase: false,
  textColor: '#111111',
  background: '#ffffff',
  accentMode: 'stripe',
  showNumber: true,
  numberStyle: 'badge',
  border: false,
  borderColor: '#111111',
  borderWidth: 0.2,
  radius: 0.6,
  padding: 0.8,
  maxFont: 4.2,
  minFont: 1.6,
  iconScale: 1,
}

export const PAPER: Record<Exclude<PrintSettings['paper'], 'custom'>, [number, number]> = {
  A4: [210, 297],
  A5: [148, 210],
  Letter: [215.9, 279.4],
}

export const DEFAULT_PRINT: PrintSettings = {
  paper: 'A4',
  paperWidth: 210,
  paperHeight: 297,
  margin: 10,
  gap: 3,
  cutMarks: true,
  outline: true,
  outlineColor: '#c4c4c4',
  groupByRow: true,
  rowCaptions: true,
  ruler: true,
  overview: false,
  scaleX: 1,
  scaleY: 1,
  copies: 1,
  bleed: 0,
}

export const DEFAULT_SETTINGS: Settings = {
  sizes: DEFAULT_SIZES,
  print: DEFAULT_PRINT,
  ai: { mode: 'server', apiKey: '', accessCode: '' },
  palette: PALETTE,
}

export function newItem(partial: Partial<LabelItem> = {}): LabelItem {
  return {
    id: uid(),
    sizeId: 's14',
    text: '',
    sub: '',
    icon: '',
    number: '',
    color: '',
    layout: '',
    notes: '',
    blank: false,
    ...partial,
  }
}

export function newRow(name = 'Row', items: LabelItem[] = []): PanelRow {
  return { id: uid(), name, items }
}

export function newPanel(name = 'My panel'): Panel {
  const now = Date.now()
  return {
    id: uid(),
    name,
    rows: [newRow('Row 1')],
    style: { ...DEFAULT_STYLE },
    photoKey: '',
    createdAt: now,
    updatedAt: now,
  }
}

export function samplePanel(): Panel {
  const p = newPanel('Example panel')
  p.rows = [
    newRow('Row 1', [
      newItem({ sizeId: 's50', number: '0', text: 'Main switch', icon: 'mdi:power', color: '#111827' }),
      newItem({ sizeId: 's50', number: 'RCD1', text: 'RCD 40A 30mA', icon: 'mdi:shield-check', color: '#64748b' }),
      newItem({ number: '1', text: 'Lights', icon: 'mdi:lightbulb', color: '#f5c518' }),
      newItem({ number: '2', text: 'Kitchen', icon: 'mdi:power-socket-eu', color: '#f97316' }),
      newItem({ number: '3', text: 'Fridge', icon: 'mdi:fridge', color: '#f97316' }),
      newItem({ sizeId: 's32', number: '4', text: 'Stove', icon: 'mdi:stove', color: '#ef4444' }),
    ]),
    newRow('Row 2', [
      newItem({ number: '5', text: 'Bathroom', icon: 'mdi:bathtub', color: '#3b82f6' }),
      newItem({ number: '6', text: 'Boiler', icon: 'mdi:water-boiler', color: '#06b6d4' }),
      newItem({ number: '7', text: 'Washer', icon: 'mdi:washing-machine', color: '#3b82f6' }),
      newItem({ number: '8', text: 'A/C', icon: 'mdi:air-conditioner', color: '#06b6d4' }),
      newItem({ number: '9', text: 'Outdoor', icon: 'mdi:outdoor-lamp', color: '#22c55e' }),
      newItem({ number: '10', text: 'Spare', icon: 'mdi:circle-off-outline', color: '' }),
    ]),
  ]
  return p
}
