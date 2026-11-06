// Display-only expense mapping. Never writes classification or remembered merchant rules.
const ANALYTICS_RULES=[];
function rule(id,pattern,condition,category,subcategory,confidence,reason,source='Merchant descriptor / heuristic') {
  ANALYTICS_RULES.push({id,pattern,condition,category,subcategory,confidence,reason,source});
}
rule('R01','^ANE MEYDAN','always','Alcohol','Alcohol retail','High','User confirmed ANE Meydan is alcohol.','User confirmation, 2026-11-06');
rule('R02','^CAREEM PLUS|^NOON ONE|^QLUB .*MEMBERSH','always','Subscriptions','Delivery / dining membership','High','Explicit membership descriptor.');
rule('R03','^NOON|^AMAZON','amount > 400','Shopping','Large online purchase - review','Low','Above user grocery threshold; actual goods need confirmation.','User threshold, 2026-11-06');
rule('R04','^NOON|^AMAZON','amount <= 400','Groceries','Online groceries','Medium','User default: Noon / Amazon up to AED 400 = groceries.','User rule, 2026-11-06');
rule('R05','SPINNEYS LUNCH','always','Food & drink','Lunch','High','Manual description explicitly says lunch.');
rule('R06','SPINNEYS|SPINNEY|FRENCHMART|FRENCH MARKET|GRANDIOSE|CARREFOUR|CAREF OUR|CAREFOUR|GMG CONSUMER|ROYAL BAY STAR','reliable time; Mon-Fri; 12:00 <= time < 13:00; 10 <= amount <= 80','Food & drink','Lunch','Medium','Weekday supermarket purchase at lunchtime; AED 10-80 is a provisional meal-size range.','User lunchtime guidance; amount range is analyst assumption');
rule('R07','^THE KITCHEN BY SPINNEY','always','Food & drink','Prepared food / snacks','Medium','Prepared-food merchant; exact items unknown.');
rule('R08','SPINNEYS|FRENCHMART|FRENCH MARKET|GRANDIOSE|CARREFOUR|CAREFOUR|GMG CONSUMER|ROYAL BAY STAR','amount < 10','Food & drink','Snacks / drinks','Low','Small supermarket purchase, likely a snack or drink; could be grocery items.');
rule('R09','SPINNEYS|FRENCHMART|FRENCH MARKET|GRANDIOSE|CARREFOUR|CAREFOUR|GMG CONSUMER|ROYAL BAY STAR','always','Groceries','Supermarket','Medium','Supermarket descriptor; GMG is a probable grocery merchant, outlet unconfirmed.','Descriptor; GMG reference: https://b2bhint.com/en/company/ae-du/gmg-consumer-llc--379841');
rule('R10','^CAREEM QUIK|INSTASHOP','always','Groceries','Delivered groceries','Medium','Grocery-delivery default; order contents unavailable.');
rule('R11','^AJMAN-SEBZE','always','Groceries','Fruit & vegetables','High','Manual description: sebze means vegetables.');
rule('R12','^MEATERY','always','Groceries','Meat','Medium','Meat-trading descriptor; purchase contents inferred.');
rule('R13','^DETERJAN','always','Household','Cleaning supplies','High','Manual description: deterjan means detergent.');
rule('R14','ADNOC|ENOC|EPPCO|EMARAT','amount < 30','Food & drink','Service-station snacks / drinks','Low','Small fuel-station charge; may be shop purchase, small fuel top-up or another service.');
rule('R15','ADNOC|ENOC|EPPCO|EMARAT','amount >= 30','Transport','Petrol','Medium','Fuel merchant and plausible fuel amount; shop / car services remain possible.');
rule('R16','PARKONIC|VALET PARKING','always','Transport','Parking','High','Explicit parking descriptor.');
rule('R17','^DIGITAL DUBAI','amount <= 25','Transport','Parking','Medium','Repeated small charges suggest parking; payment gateway does not identify the service.');
rule('R18','^DIGITAL DUBAI','always','Needs review','Government / transport payment','Low','Payment gateway only; larger payment could be parking top-up or another service.');
rule('R19','^DIFC INVESTMENTS|^REGAL TOWER','always','Transport','Parking','Low','Possible location-related parking payment; confirm purpose.');
rule('R20','INVYGO','always','Transport','Car rental','High','Car-rental merchant descriptor.');
rule('R21','CAREEM HOMESRVICES|JUSTLIFE','always','Household','Home services / cleaning','Medium','Home-services merchant; cleaning is likely but exact service unknown.');
rule('R22','DUBAI ELECTRICITY','always','Bills','Electricity & water','High','Utility descriptor.');
rule('R23','SOENGINEERS','always','Fees','Professional registration / fees','Medium','Society of Engineers descriptor; exact fee unconfirmed.');
rule('R24','BAY AVENUE DENTAL','always','Health','Dental','High','Dental clinic descriptor.');
rule('R25','MEDICLINIC|^PHC ','always','Health','Medical','High','Clinic / primary healthcare descriptor.');
rule('R26','^IHERB','always','Health','Supplements / wellness','Medium','Wellness retailer; exact items unavailable.');
rule('R27','GOLD APPLE BOX','always','Personal care','Beauty / cosmetics','High','Gold Apple Box cosmetics retailer.','https://goldapple.ae/');
rule('R28','CLASSPASS|GYMNATION','amount >= 30','Fitness','Membership / classes','High','Gym / fitness merchant and membership-size amount.');
rule('R29','GYMNATION','amount < 30','Food & drink','Gym snacks / drinks','Low','AED 2 repeated charges suggest water; AED 15 also tentative, could be a gym fee.');
rule('R30','H AND M|LC WAIKIKI|MATALAN','always','Shopping','Clothing / homeware','High','Fashion / homeware retailer; exact items unavailable.');
rule('R31','MARKS AND SPENCER','always','Shopping','Department store - review','Low','Could be clothing, food or homeware; no item details.');
rule('R32','MUMZWORLD','always','Family','Baby / children supplies','High','Children and baby retailer.');
rule('R33','SAFA BRITISH SCHOOL','always','Family','School expenses','High','School merchant; exact fee / purchase unknown.');
rule('R34','^ARABICA|STARBUCKS|LUMIERE COFFEE|KAM CAFE|FEELS KITE|QLUB.*BATEEL','always','Food & drink','Coffee / cafe','Medium','Cafe merchant; category may include food as well as drinks.');
rule('R35','GELATO|CINNAMOOD|^CHOCOLATE','always','Food & drink','Dessert / snacks','High','Dessert merchant or explicit snack description.');
rule('R36','CAREEM FOOD|DELIVEROO|KITOPI','always','Food & drink','Food delivery','Medium','Food-delivery / catering default; groceries also possible on delivery apps.');
rule('R37','CAREEM DELIVERIES','always','Food & drink','Food delivery','Low','Generic Careem deliveries may be food, groceries or courier; confirm.');
rule('R38','RESTAURANT|GUNAYDIN|MCDONALDS|EMIRATES FAST FOOD|KCAL|TUCK SHOP|ADNH CATERING|CAFE DE PALMA','reliable time; Mon-Fri; 12:00 <= time < 13:00','Food & drink','Lunch','Medium','Food merchant during weekday lunch hour.');
rule('R39','RESTAURANT|GUNAYDIN|MCDONALDS|EMIRATES FAST FOOD|KCAL|TUCK SHOP|ADNH CATERING|CAFE DE PALMA','always','Food & drink','Restaurants / meals','High','Restaurant / catering merchant; meal type not asserted.');
rule('R40','THE LOUNGE','always','Food & drink','Cafe / lounge','Low','Name suggests cafe / lounge, exact business and purchase unconfirmed.');
rule('R41','GRAND HYATT|INTERCONTINE','always','Needs review','Hotel charge - review','Low','Could be food, parking, leisure or accommodation.');
rule('R42','^AJET','always','Travel','Flights','High','Airline merchant.');
rule('R43','^TABBY','always','Needs review','Instalment - underlying purchase unknown','Low','Payment provider does not identify goods.');
rule('R99','.*','always','Needs review','Unknown merchant / purpose','Low','Descriptor insufficient; confirm from receipt or bank transaction.');

const DAY_MS = 86400000;
export function normalizeMerchant(value) {
  return String(value || '').replace(/\s+Amount:\s.*$/i, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

export function dubaiDateTime(value) {
  const timestamp = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(timestamp)) return null;
  const date = new Date(timestamp + 4 * 3600000);
  return { date: date.toISOString().slice(0, 10), time: date.toISOString().slice(11, 16),
    weekday: date.getUTCDay(), hour: date.getUTCHours() + date.getUTCMinutes() / 60 };
}

export function mapDailyExpense(item) {
  if (item.classification !== 'daily_spend') return null;
  const local = dubaiDateTime(item.occurredAt);
  const amount = Number(item.amount);
  if (!local || item.amount == null || item.amount === '' || !Number.isFinite(amount) || amount < 0) return null;
  const merchant = normalizeMerchant(item.merchant);
  const currency = String(item.currency || 'AED').trim().toUpperCase();
  const lunch = item.source !== 'manual-web' && local.weekday >= 1 && local.weekday <= 5 && local.hour >= 12 && local.hour < 13;
  const conditions = {
    always: true, 'amount > 400': amount > 400, 'amount <= 400': amount <= 400,
    'amount < 10': amount < 10, 'amount < 30': amount < 30, 'amount >= 30': amount >= 30,
    'amount <= 25': amount <= 25,
    'reliable time; Mon-Fri; 12:00 <= time < 13:00': lunch,
    'reliable time; Mon-Fri; 12:00 <= time < 13:00; 10 <= amount <= 80': lunch && amount >= 10 && amount <= 80,
  };
  const match = ANALYTICS_RULES.find(rule => new RegExp(rule.pattern, 'i').test(merchant) && conditions[rule.condition]
    && (!rule.condition.includes('amount') || currency === 'AED'));
  return { ...item, amount, currency,
    normalizedMerchant: merchant, localDate: local.date, localTime: local.time,
    category: match.category, subcategory: match.subcategory, confidence: match.confidence,
    needsReview: match.confidence === 'Low', mappingReason: match.reason, mappingRule: match.id,
    timeBasis: item.source === 'manual-web' ? 'Manual entry; time not used' : 'Dubai time (UTC+4)' };
}

export function budgetCycleForDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  const month = date.getUTCMonth() + (date.getUTCDate() >= 28 ? 1 : 0);
  const end = new Date(Date.UTC(date.getUTCFullYear(), month, 27));
  const start = new Date(Date.UTC(date.getUTCFullYear(), month - 1, 28));
  return { key: end.toISOString().slice(0, 7), start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10),
    label: end.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) };
}

export function aggregateExpenses(items, { currency = 'AED', start = '', end = '' } = {}) {
  const rows = items.filter(item => item.currency === currency && (!start || item.localDate >= start) && (!end || item.localDate <= end));
  const categories = new Map(), subcategories = new Map(), days = new Map();
  let totalCents = 0, reviewCents = 0;
  rows.forEach(item => {
    const cents = Math.round(item.amount * 100);
    totalCents += cents;
    if (item.needsReview) reviewCents += cents;
    for (const [map, key] of [[categories, item.category], [subcategories, `${item.category}\u0000${item.subcategory}`]]) {
      const group = map.get(key) || { name: key, cents: 0, count: 0 };
      group.cents += cents; group.count += 1; map.set(key, group);
    }
    days.set(item.localDate, (days.get(item.localDate) || 0) + cents);
  });
  const first = start || [...days.keys()].sort()[0], last = end || [...days.keys()].sort().at(-1);
  const daily = [];
  if (first && last && first <= last) {
    for (let time = Date.parse(`${first}T00:00:00Z`); time <= Date.parse(`${last}T00:00:00Z`); time += DAY_MS) {
      const date = new Date(time).toISOString().slice(0, 10);
      daily.push({ date, total: (days.get(date) || 0) / 100 });
    }
  }
  const groups = map => [...map.values()].map(g => ({ name: g.name, total: g.cents / 100, count: g.count }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  return { rows, total: totalCents / 100, reviewTotal: reviewCents / 100,
    reviewCount: rows.filter(row => row.needsReview).length, categories: groups(categories),
    subcategories: groups(subcategories).map(g => { const [category, subcategory] = g.name.split('\u0000'); return { ...g, category, subcategory }; }),
    daily, dayCount: daily.length, average: daily.length ? totalCents / 100 / daily.length : 0 };
}

function csvCell(value) {
  const text = String(value ?? '');
  // Merchant descriptions are untrusted text; prevent spreadsheet formula execution.
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function breakdownCsv(rows) {
  const headers = ['Occurred At', 'Dubai Date', 'Dubai Time', 'Merchant', 'Amount', 'Currency', 'Category', 'Subcategory', 'Confidence', 'Needs Review', 'Reason', 'Transaction ID'];
  return '\uFEFF' + [headers, ...rows.map(row => [row.occurredAt, row.localDate, row.localTime, row.merchant,
    row.amount, row.currency, row.category, row.subcategory, row.confidence, row.needsReview ? 'Yes' : 'No', row.mappingReason, row.id])]
    .map(row => row.map(csvCell).join(',')).join('\r\n');
}

