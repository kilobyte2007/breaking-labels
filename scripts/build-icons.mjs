// Generates src/icons/curated.json: a small, offline icon set with search keywords
// (EN / RO / RU) used for auto-matching circuit names to icons.
import { readFileSync, writeFileSync } from 'node:fs'

const mdi = JSON.parse(readFileSync(new URL('../node_modules/@iconify-json/mdi/icons.json', import.meta.url)))

// [icon, category, keywords...]
const CURATED = [
  ['lightbulb', 'Lighting', 'light', 'lights', 'lighting', 'lamp', 'bulb', 'iluminat', 'iluminare', 'lumina', 'lumini', 'bec', 'becuri', 'освещение', 'свет'],
  ['lightbulb-outline', 'Lighting', 'light', 'lighting', 'iluminat'],
  ['ceiling-light', 'Lighting', 'ceiling', 'ceiling light', 'plafon', 'plafoniera', 'люстра', 'потолок'],
  ['chandelier', 'Lighting', 'chandelier', 'candelabru', 'lustra', 'люстра'],
  ['floor-lamp', 'Lighting', 'floor lamp', 'lampadar', 'торшер'],
  ['wall-sconce', 'Lighting', 'sconce', 'wall light', 'aplica', 'aplice', 'бра'],
  ['led-strip-variant', 'Lighting', 'led', 'strip', 'banda', 'banda led', 'лента'],
  ['spotlight-beam', 'Lighting', 'spot', 'spots', 'spoturi', 'spot-uri', 'спот'],
  ['outdoor-lamp', 'Lighting', 'outdoor light', 'exterior light', 'iluminat exterior', 'felinar', 'уличное', 'наружное освещение'],
  ['string-lights', 'Lighting', 'decor', 'garland', 'ghirlanda', 'гирлянда'],
  ['power-socket-eu', 'Power', 'socket', 'sockets', 'outlet', 'outlets', 'plug', 'plugs', 'receptacle', 'priza', 'prize', 'розетка', 'розетки'],
  ['power-socket-de', 'Power', 'socket', 'schuko'],
  ['power-plug', 'Power', 'plug', 'power', 'stecher', 'stecker', 'alimentare', 'питание'],
  ['power', 'Power', 'power', 'on off', 'main', 'general', 'principal', 'общий', 'главный', 'вводной'],
  ['lightning-bolt', 'Power', 'electric', 'electricity', 'energy', 'curent', 'energie', 'electric', 'электричество', 'ток'],
  ['meter-electric', 'Power', 'meter', 'counter', 'contor', 'счетчик', 'счётчик'],
  ['transmission-tower', 'Power', 'grid', 'retea', 'сеть'],
  ['shield-check', 'Protection', 'rcd', 'rccb', 'differential', 'diferential', 'diferentiala', 'protectie', 'protection', 'дифавтомат', 'узо', 'защита'],
  ['flash-alert', 'Protection', 'surge', 'spd', 'overvoltage', 'supratensiune', 'descarcator', 'перенапряжение', 'уздп'],
  ['fridge', 'Kitchen', 'fridge', 'refrigerator', 'frigider', 'combina', 'холодильник'],
  ['fridge-industrial', 'Kitchen', 'freezer', 'congelator', 'lada frigorifica', 'морозильник'],
  ['stove', 'Kitchen', 'stove', 'cooktop', 'hob', 'range', 'plita', 'aragaz', 'plita inductie', 'induction', 'плита', 'варочная'],
  ['toaster-oven', 'Kitchen', 'oven', 'cuptor', 'духовка', 'печь'],
  ['microwave', 'Kitchen', 'microwave', 'microunde', 'cuptor cu microunde', 'микроволновка', 'свч'],
  ['dishwasher', 'Kitchen', 'dishwasher', 'masina de spalat vase', 'spalat vase', 'посудомойка', 'посудомоечная'],
  ['kettle', 'Kitchen', 'kettle', 'fierbator', 'ceainic', 'чайник'],
  ['coffee-maker', 'Kitchen', 'coffee', 'espresso', 'cafea', 'espressor', 'кофе', 'кофемашина'],
  ['fan-chevron-up', 'Kitchen', 'hood', 'extractor hood', 'hota', 'вытяжка'],
  ['silverware-fork-knife', 'Kitchen', 'kitchen', 'bucatarie', 'bucataria', 'кухня'],
  ['countertop', 'Kitchen', 'countertop', 'worktop', 'blat', 'столешница'],
  ['washing-machine', 'Laundry', 'washer', 'washing machine', 'laundry', 'masina de spalat', 'spalatorie', 'стиральная', 'стиралка'],
  ['tumble-dryer', 'Laundry', 'dryer', 'uscator', 'masina de uscat', 'сушилка', 'сушильная'],
  ['iron', 'Laundry', 'iron', 'fier de calcat', 'утюг'],
  ['air-conditioner', 'Climate', 'ac', 'a/c', 'air conditioner', 'air conditioning', 'aer conditionat', 'conditioner', 'climatizare', 'кондиционер'],
  ['radiator', 'Climate', 'heating', 'heater', 'radiator', 'incalzire', 'calorifer', 'отопление', 'обогреватель', 'радиатор'],
  ['heating-coil', 'Climate', 'underfloor', 'floor heating', 'incalzire in pardoseala', 'pardoseala', 'теплый пол', 'тёплый пол'],
  ['heat-pump', 'Climate', 'heat pump', 'pompa de caldura', 'тепловой насос'],
  ['water-boiler', 'Climate', 'boiler', 'water heater', 'centrala', 'centrala termica', 'cazan', 'бойлер', 'котел', 'котёл', 'водонагреватель'],
  ['fire', 'Climate', 'fireplace', 'semineu', 'gas', 'gaz', 'камин'],
  ['fan', 'Climate', 'fan', 'ventilation', 'ventilator', 'ventilatie', 'вентилятор', 'вентиляция'],
  ['hvac', 'Climate', 'hvac', 'recuperator', 'recuperare', 'рекуператор'],
  ['thermostat', 'Climate', 'thermostat', 'termostat', 'термостат'],
  ['snowflake', 'Climate', 'cooling', 'cold', 'racire', 'охлаждение'],
  ['water-pump', 'Water', 'pump', 'water pump', 'pompa', 'hidrofor', 'насос'],
  ['water', 'Water', 'water', 'apa', 'вода'],
  ['shower', 'Water', 'shower', 'dus', 'душ'],
  ['bathtub', 'Rooms', 'bathroom', 'bath', 'baie', 'baia', 'ванная', 'ванна'],
  ['toilet', 'Rooms', 'toilet', 'wc', 'restroom', 'grup sanitar', 'toaleta', 'туалет', 'санузел'],
  ['sofa', 'Rooms', 'living', 'living room', 'lounge', 'sufragerie', 'living', 'salon', 'гостиная', 'зал'],
  ['bed', 'Rooms', 'bedroom', 'dormitor', 'спальня'],
  ['bed-king', 'Rooms', 'master bedroom', 'dormitor matrimonial', 'спальня'],
  ['baby-carriage', 'Rooms', 'nursery', 'kids', 'children', 'copii', 'camera copilului', 'детская'],
  ['teddy-bear', 'Rooms', 'kids room', 'camera copii', 'детская'],
  ['desk', 'Rooms', 'office', 'study', 'birou', 'кабинет'],
  ['door', 'Rooms', 'hall', 'hallway', 'entrance', 'corridor', 'hol', 'holul', 'intrare', 'coridor', 'прихожая', 'коридор', 'вход'],
  ['stairs', 'Rooms', 'stairs', 'staircase', 'scara', 'scari', 'лестница'],
  ['hanger', 'Rooms', 'wardrobe', 'closet', 'dressing', 'garderoba', 'гардероб'],
  ['garage', 'Rooms', 'garage', 'garaj', 'гараж'],
  ['home-floor-0', 'Rooms', 'ground floor', 'parter', 'первый этаж'],
  ['home-floor-1', 'Rooms', 'first floor', 'etaj 1', 'etajul 1', 'второй этаж'],
  ['home-floor-2', 'Rooms', 'second floor', 'etaj 2', 'etajul 2'],
  ['home-floor-b', 'Rooms', 'basement', 'cellar', 'subsol', 'pivnita', 'beci', 'подвал'],
  ['home-roof', 'Rooms', 'attic', 'loft', 'mansarda', 'pod', 'чердак', 'мансарда'],
  ['balcony', 'Rooms', 'balcony', 'terrace', 'balcon', 'terasa', 'балкон', 'терраса'],
  ['home', 'Rooms', 'house', 'home', 'casa', 'дом'],
  ['home-lightning-bolt', 'Rooms', 'whole house', 'general', 'toata casa'],
  ['tools', 'Utility', 'workshop', 'tools', 'atelier', 'scule', 'мастерская'],
  ['tree', 'Outdoor', 'garden', 'yard', 'gradina', 'curte', 'сад', 'двор'],
  ['sprinkler-variant', 'Outdoor', 'irrigation', 'sprinkler', 'irigare', 'irigatie', 'полив'],
  ['pool', 'Outdoor', 'pool', 'piscina', 'бассейн'],
  ['hot-tub', 'Outdoor', 'jacuzzi', 'hot tub', 'spa', 'джакузи'],
  ['grill', 'Outdoor', 'bbq', 'grill', 'gratar', 'барбекю'],
  ['gate', 'Outdoor', 'gate', 'poarta', 'automatizare poarta', 'ворота'],
  ['garage-open', 'Outdoor', 'garage door', 'usa garaj', 'гаражные ворота'],
  ['window-shutter', 'Outdoor', 'shutters', 'blinds', 'rolete', 'jaluzele', 'obloane', 'рольставни', 'жалюзи'],
  ['car-electric', 'Outdoor', 'ev', 'car', 'electric car', 'masina electrica', 'электромобиль'],
  ['ev-station', 'Outdoor', 'charger', 'wallbox', 'charging', 'statie incarcare', 'incarcator', 'зарядка', 'зарядная станция'],
  ['solar-panel', 'Outdoor', 'solar', 'pv', 'photovoltaic', 'panouri solare', 'fotovoltaic', 'fotovoltaice', 'солнечные панели'],
  ['battery-charging', 'Power', 'battery', 'storage', 'baterie', 'acumulator', 'аккумулятор', 'батарея'],
  ['sine-wave', 'Power', 'inverter', 'invertor', 'инвертор'],
  ['television', 'Tech', 'tv', 'television', 'televizor', 'телевизор'],
  ['desktop-tower-monitor', 'Tech', 'computer', 'pc', 'calculator', 'компьютер'],
  ['router-wireless', 'Tech', 'router', 'internet', 'wifi', 'network', 'retea', 'интернет', 'роутер'],
  ['server-network', 'Tech', 'server', 'rack', 'network cabinet', 'server', 'сервер'],
  ['cctv', 'Tech', 'cctv', 'camera', 'cameras', 'surveillance', 'supraveghere', 'camere video', 'видеонаблюдение'],
  ['shield-home', 'Tech', 'alarm', 'security', 'alarma', 'securitate', 'сигнализация', 'охрана'],
  ['doorbell-video', 'Tech', 'doorbell', 'intercom', 'interfon', 'videointerfon', 'sonerie', 'домофон', 'звонок'],
  ['smoke-detector-variant', 'Tech', 'smoke', 'fire alarm', 'detector fum', 'incendiu', 'датчик дыма'],
  ['home-automation', 'Tech', 'smart home', 'automation', 'automatizare', 'domotica', 'умный дом'],
  ['elevator-passenger', 'Utility', 'elevator', 'lift', 'лифт'],
  ['office-building', 'Utility', 'building', 'common areas', 'bloc', 'spatii comune', 'здание'],
  ['store', 'Utility', 'shop', 'magazin', 'магазин'],
  ['alert', 'Misc', 'warning', 'danger', 'atentie', 'pericol', 'внимание', 'опасно'],
  ['circle-off-outline', 'Misc', 'spare', 'reserve', 'unused', 'free', 'rezerva', 'liber', 'резерв', 'свободно'],
  ['help-circle-outline', 'Misc', 'unknown', 'necunoscut', 'неизвестно'],
  ['star', 'Misc', 'important', 'favorite'],
  ['numeric-1-box', 'Misc', 'one'], ['numeric-2-box', 'Misc', 'two'], ['numeric-3-box', 'Misc', 'three'],
]

const out = []
for (const [name, category, ...keywords] of CURATED) {
  let icon = mdi.icons[name]
  if (!icon && mdi.aliases?.[name]) icon = mdi.icons[mdi.aliases[name].parent]
  if (!icon) { console.warn('missing icon:', name); continue }
  out.push({ name, category, keywords: [...new Set(keywords)], body: icon.body })
}
writeFileSync(new URL('../src/icons/curated.json', import.meta.url), JSON.stringify(out))
console.log(`wrote ${out.length} icons`)

// UI chrome icons (buttons etc.)
const UI = ['undo', 'redo', 'printer-outline', 'cog-outline', 'plus', 'delete-outline', 'content-copy', 'upload', 'download', 'creation', 'image-outline',
  'file-document-outline', 'chevron-left', 'chevron-right', 'chevron-up', 'chevron-down', 'close', 'dots-horizontal', 'format-list-numbered', 'magnify',
  'check', 'alert-circle-outline', 'eye-outline', 'eye-off-outline', 'drag-vertical', 'file-pdf-box', 'ruler', 'palette-outline', 'table-row-plus-after',
  'arrow-left', 'folder-open-outline', 'refresh', 'magnify-plus-outline', 'magnify-minus-outline', 'lightning-bolt', 'image-plus-outline', 'text-box-outline',
  'select-group', 'shape-square-plus', 'keyboard-outline', 'information-outline', 'swap-horizontal', 'pencil-outline', 'checkbox-blank-off-outline', 'emoticon-outline']
const ui = {}
for (const name of UI) {
  const icon = mdi.icons[name] ?? mdi.icons[mdi.aliases?.[name]?.parent]
  if (!icon) { console.warn('missing ui icon:', name); continue }
  ui[name] = icon.body
}
writeFileSync(new URL('../src/icons/ui.json', import.meta.url), JSON.stringify(ui))
console.log(`wrote ${Object.keys(ui).length} ui icons`)
