// The Camino catalogue: places (nodes), the walkable pieces between them
// (segments), and the places where a pilgrim genuinely chooses (forks).
//
// Distances are published guide figures in km and are indicative; the
// geometry in src/data/segments/*.json (built from OpenStreetMap) is what
// the app actually measures against. Stage suggestions are the common
// splits, editable per walk.
//
// A walk's *plan* is an ordered list of segment ids. A fork lists the
// alternative segment chains that leave a node; choosing one replaces the
// plan's default chain between that node and where the alternatives rejoin.

export type NodeId = string
export type SegmentId = string

export type Node = {
  id: NodeId
  name: string
  country: 'PT' | 'ES'
  note?: string
}

export type Segment = {
  id: SegmentId
  from: NodeId
  to: NodeId
  km: number
  name: string            // as pilgrims say it
  character: string       // one line, for the stage card
  ascent?: number         // m, indicative
  transport?: 'boat'      // not walked
  stages?: string[]       // suggested overnight stops within, if usually split
}

export type ForkOption = {
  id: string
  label: string           // "Cross to A Guarda by boat"
  chain: SegmentId[]      // segments from the fork node to the rejoin node
  then?: string           // route id to follow from the rejoin node, when the rejoin is not on the current plan
  summary: string         // one sentence, for the choice card
  km: number
  days: number
}

export type Fork = {
  id: string
  at: NodeId
  rejoinAt: NodeId
  question: string        // "Which way from Caminha?"
  options: ForkOption[]
  defaultOption: string
}

export type Camino = {
  id: string
  name: string
  nodes: Node[]
  segments: Segment[]
  forks: Fork[]
  routes: { id: string; name: string; from: NodeId; plan: SegmentId[]; km: number; days: string; blurb: string }[]
}

const nodes: Node[] = [
  { id: 'porto',           name: 'Porto',             country: 'PT', note: 'Sé Catedral; the first stamp' },
  { id: 'matosinhos',      name: 'Matosinhos',        country: 'PT' },
  { id: 'vila-do-conde',   name: 'Vila do Conde',     country: 'PT' },
  { id: 'esposende',       name: 'Esposende',         country: 'PT' },
  { id: 'viana',           name: 'Viana do Castelo',  country: 'PT' },
  { id: 'caminha',         name: 'Caminha',           country: 'PT', note: 'The Minho: boat to Spain, or follow the river inland' },
  { id: 'a-guarda',        name: 'A Guarda',          country: 'ES' },
  { id: 'a-ramallosa',     name: 'A Ramallosa',       country: 'ES', note: 'Baiona is 2 km off-route and worth it' },
  { id: 'vigo',            name: 'Vigo',              country: 'ES' },
  { id: 'valenca',         name: 'Valença',           country: 'PT', note: 'The old bridge to Tui; the last Portuguese stamp' },
  { id: 'tui',             name: 'Tui',               country: 'ES' },
  { id: 'o-porrino',       name: 'O Porriño',         country: 'ES' },
  { id: 'redondela',       name: 'Redondela',         country: 'ES', note: 'Coastal and Central become one road here' },
  { id: 'pontevedra',      name: 'Pontevedra',        country: 'ES', note: 'Straight on to Caldas, or the Variante Espiritual' },
  { id: 'caldas',          name: 'Caldas de Reis',    country: 'ES' },
  { id: 'padron',          name: 'Padrón',            country: 'ES' },
  { id: 'armenteira',      name: 'Armenteira',        country: 'ES' },
  { id: 'vilanova',        name: 'Vilanova de Arousa',country: 'ES' },
  { id: 'santiago',        name: 'Santiago de Compostela', country: 'ES', note: 'The Praza do Obradoiro. Ultreia.' },
  // Central from Porto (for other walkers)
  { id: 'vilarinho',       name: 'Vilarinho',         country: 'PT' },
  { id: 'rates',           name: 'São Pedro de Rates', country: 'PT', note: 'Romanesque church; the Coastal and Central touch here' },
  { id: 'barcelos',        name: 'Barcelos',          country: 'PT' },
  { id: 'ponte-de-lima',   name: 'Ponte de Lima',     country: 'PT' },
  { id: 'rubiaes',         name: 'Rubiães',           country: 'PT' },
]

const segments: Segment[] = [
  // ---- Coastal (Caminho da Costa / Senda Litoral interleave) ----
  { id: 'porto-vila-do-conde',     from: 'porto',         to: 'vila-do-conde', km: 28.5, name: 'Porto → Vila do Conde',       character: 'Down the Douro to the sea, then boardwalks and beaches all the way; flat, long, exposed' },
  { id: 'vila-do-conde-esposende', from: 'vila-do-conde', to: 'esposende',     km: 23.7, name: 'Vila do Conde → Esposende',   character: 'Beach, then dunes and pine; flat' },
  { id: 'esposende-viana',         from: 'esposende',     to: 'viana',         km: 26.3, name: 'Esposende → Viana do Castelo',character: 'Inland through villages, one real hill, then the Lima bridge', ascent: 350 },
  { id: 'viana-caminha',           from: 'viana',         to: 'caminha',       km: 26.6, name: 'Viana → Caminha',             character: 'Cliff paths and fishing villages; the Minho appears', ascent: 300 },
  // Fork at Caminha — option A: boat across the Minho, stay on the coast
  { id: 'caminha-boat-a-guarda',   from: 'caminha',       to: 'a-guarda',      km: 2,    name: 'Caminha → A Guarda by boat',  character: 'A small boat over the Minho; tide and weather decide', transport: 'boat' },
  { id: 'a-guarda-a-ramallosa',    from: 'a-guarda',      to: 'a-ramallosa',   km: 32,   name: 'A Guarda → A Ramallosa',      character: 'Atlantic edge past Oia monastery; long, wild, often split at Oia or Viladesuso', stages: ['Oia'], ascent: 400 },
  { id: 'a-ramallosa-vigo',        from: 'a-ramallosa',   to: 'vigo',          km: 24,   name: 'A Ramallosa → Vigo',          character: 'Ría de Vigo; suburbs, then the city' },
  { id: 'vigo-redondela',          from: 'vigo',          to: 'redondela',     km: 15,   name: 'Vigo → Redondela',            character: 'The Senda da Auga above the ría; short and green', ascent: 250 },
  // Fork at Caminha — option B: the river to Valença, then the Central
  { id: 'caminha-valenca',         from: 'caminha',       to: 'valenca',       km: 28,   name: 'Caminha → Valença',           character: 'Riverside ecovia along the Minho; flat and quiet, Vila Nova de Cerveira halfway', stages: ['Vila Nova de Cerveira'] },
  { id: 'valenca-o-porrino',       from: 'valenca',       to: 'o-porrino',     km: 20,   name: 'Valença → O Porriño',         character: 'The iron bridge into Spain and Tui’s cathedral stamp, then woods and an industrial estate best walked early' },
  { id: 'o-porrino-redondela',     from: 'o-porrino',     to: 'redondela',     km: 15.5, name: 'O Porriño → Redondela',       character: 'Over the hill at Mos; the first view of the ría', ascent: 300 },
  // Shared to Pontevedra
  { id: 'redondela-pontevedra',    from: 'redondela',     to: 'pontevedra',    km: 19.5, name: 'Redondela → Pontevedra',      character: 'The Ponte Sampaio and a stony climb; the old town at the end', ascent: 300 },
  // Fork at Pontevedra — option A: Central
  { id: 'pontevedra-caldas',       from: 'pontevedra',    to: 'caldas',        km: 21,   name: 'Pontevedra → Caldas de Reis', character: 'Vineyards and river; gentle' },
  { id: 'caldas-padron',           from: 'caldas',        to: 'padron',        km: 18.5, name: 'Caldas → Padrón',             character: 'Forest tracks; Padrón peppers at the end' },
  // Fork at Pontevedra — option B: Variante Espiritual
  { id: 'pontevedra-armenteira',   from: 'pontevedra',    to: 'armenteira',    km: 21,   name: 'Pontevedra → Armenteira',     character: 'Combarro’s hórreos, then the climb to the monastery', ascent: 500 },
  { id: 'armenteira-vilanova',     from: 'armenteira',    to: 'vilanova',      km: 23,   name: 'Armenteira → Vilanova de Arousa', character: 'The Ruta da Pedra e da Auga: mills and river all the way down' },
  { id: 'vilanova-boat-padron',    from: 'vilanova',      to: 'padron',        km: 28,   name: 'Vilanova → Padrón by boat',   character: 'The Traslatio up the Ría de Arousa and the Ulla; book ahead', transport: 'boat' },
  // The last day
  { id: 'padron-santiago',         from: 'padron',        to: 'santiago',      km: 24.5, name: 'Padrón → Santiago',           character: 'Eucalyptus, then suburbs, then the bells', ascent: 350 },

  // ---- Central from Porto (catalogue only; other walkers) ----
  { id: 'porto-vilarinho',         from: 'porto',         to: 'vilarinho',     km: 27,   name: 'Porto → Vilarinho',           character: 'Out through the suburbs; many take the metro to Vilar do Pinheiro' },
  { id: 'vilarinho-rates',         from: 'vilarinho',     to: 'rates',         km: 12,   name: 'Vilarinho → Rates',           character: 'Roman bridges and the Ave valley' },
  { id: 'rates-barcelos',          from: 'rates',         to: 'barcelos',      km: 16,   name: 'Rates → Barcelos',            character: 'Farm tracks and cobbles into the town of the rooster' },
  // Connector: leave the coast on day two, join the Central at Rates
  { id: 'vila-do-conde-rates',     from: 'vila-do-conde', to: 'rates',         km: 11,   name: 'Vila do Conde → Rates',       character: 'Inland through farmland and eucalyptus; quiet, well marked' },
  { id: 'barcelos-ponte-de-lima',  from: 'barcelos',      to: 'ponte-de-lima', km: 34,   name: 'Barcelos → Ponte de Lima',    character: 'Long; usually split at Balugães or Vitorino', stages: ['Balugães'] },
  { id: 'ponte-de-lima-rubiaes',   from: 'ponte-de-lima', to: 'rubiaes',       km: 18,   name: 'Ponte de Lima → Rubiães',     character: 'The Labruja: the hardest climb of the whole Camino', ascent: 450 },
  { id: 'rubiaes-valenca',         from: 'rubiaes',       to: 'valenca',       km: 19,   name: 'Rubiães → Valença',           character: 'Downhill to the Minho and the fortress' },
]

const forks: Fork[] = [
  {
    id: 'vila-do-conde',
    at: 'vila-do-conde',
    rejoinAt: 'rates',
    question: 'Stay on the coast, or cut inland to the Central?',
    defaultOption: 'coast',
    options: [
      { id: 'coast',  label: 'Stay on the coast',
        chain: [], summary: 'Esposende, Viana, Caminha: boardwalks and fishing towns for another four days.', km: 0, days: 0 },
      { id: 'inland', label: 'Inland to Rates and the Central', then: 'central',
        chain: ['vila-do-conde-rates'],
        summary: 'Eleven quiet kilometres to the church at Rates, then the classic road: Barcelos, Ponte de Lima, the Labruja.', km: 11, days: 1 },
    ],
  },
  {
    id: 'caminha',
    at: 'caminha',
    rejoinAt: 'redondela',
    question: 'Which way from Caminha?',
    defaultOption: 'coast',
    options: [
      { id: 'coast',  label: 'Boat to A Guarda, stay on the coast',
        chain: ['caminha-boat-a-guarda','a-guarda-a-ramallosa','a-ramallosa-vigo','vigo-redondela'],
        summary: 'Three more days of Atlantic: Oia, Baiona, the Ría de Vigo. Depends on the boat running.', km: 73, days: 3 },
      { id: 'inland', label: 'Follow the river to Valença, then the Central',
        chain: ['caminha-valenca','valenca-o-porrino','o-porrino-redondela'],
        summary: 'Flat riverside to Valença, cross to Tui, then the classic road with more pilgrims and albergues.', km: 63.5, days: 3 },
    ],
  },
  {
    id: 'pontevedra',
    at: 'pontevedra',
    rejoinAt: 'padron',
    question: 'Straight on, or the Variante Espiritual?',
    defaultOption: 'central',
    options: [
      { id: 'central',    label: 'Straight on to Caldas and Padrón',
        chain: ['pontevedra-caldas','caldas-padron'],
        summary: 'Two gentle days through vineyards.', km: 39.5, days: 2 },
      { id: 'espiritual', label: 'Variante Espiritual, with the boat',
        chain: ['pontevedra-armenteira','armenteira-vilanova','vilanova-boat-padron'],
        summary: 'Three days: Combarro, the monastery at Armenteira, the river of mills, then the Traslatio boat to Padrón.', km: 72, days: 3 },
    ],
  },
]

const coastalPlan: SegmentId[] = [
  'porto-vila-do-conde','vila-do-conde-esposende','esposende-viana','viana-caminha',
  'caminha-boat-a-guarda','a-guarda-a-ramallosa','a-ramallosa-vigo','vigo-redondela',
  'redondela-pontevedra','pontevedra-caldas','caldas-padron','padron-santiago',
]
const centralPlan: SegmentId[] = [
  'porto-vilarinho','vilarinho-rates','rates-barcelos','barcelos-ponte-de-lima','ponte-de-lima-rubiaes','rubiaes-valenca',
  'valenca-o-porrino','o-porrino-redondela','redondela-pontevedra','pontevedra-caldas','caldas-padron','padron-santiago',
]

export const PORTUGUES: Camino = {
  id: 'portugues',
  name: 'Camino Portugués',
  nodes, segments, forks,
  routes: [
    { id: 'coastal', name: 'Coastal (Caminho da Costa)', from: 'porto', plan: coastalPlan, km: 274, days: '12–15',
      blurb: 'Sea on your left for eight days, then inland through Galicia. Boardwalks, fishing towns, the boat over the Minho. Marking gets confusing around Vigo.' },
    { id: 'litoral', name: 'Litoral (Senda Litoral)', from: 'porto', plan: coastalPlan, km: 280, days: '12–15',
      blurb: 'The Coastal’s beach-side twin: the same towns, but on the sand and the boardwalks wherever there are any. Flattest of all, and the least marked — the two interleave, so choose each morning.' },
    { id: 'central', name: 'Central', from: 'porto', plan: centralPlan, km: 243.5, days: '10–13',
      blurb: 'The classic, and the best marked. Roman roads, Barcelos, Ponte de Lima, the Labruja climb, then the same road through Galicia.' },
  ],
}

export const CAMINOS: Record<string, Camino> = { portugues: PORTUGUES }

export function segmentById(c: Camino, id: SegmentId): Segment {
  const s = c.segments.find(x => x.id === id)
  if (!s) throw new Error(`unknown segment ${id}`)
  return s
}
export function nodeById(c: Camino, id: NodeId): Node {
  const n = c.nodes.find(x => x.id === id)
  if (!n) throw new Error(`unknown node ${id}`)
  return n
}

// Apply fork choices to a default plan: for each fork whose node the plan
// passes through, replace the chain between fork.at and fork.rejoinAt.
export function applyChoices(c: Camino, plan: SegmentId[], choices: Record<string, string>): SegmentId[] {
  let out = [...plan]
  for (const fork of c.forks) {
    const optId = choices[fork.id]
    if (!optId) continue
    const opt = fork.options.find(o => o.id === optId)
    if (!opt) continue
    const start = out.findIndex(id => segmentById(c, id).from === fork.at)
    if (start < 0) continue
    if (!opt.chain.length && !opt.then) continue           // "stay as planned"
    const end = out.findIndex(id => segmentById(c, id).to === fork.rejoinAt)
    if (end >= start) {
      out = [...out.slice(0, start), ...opt.chain, ...out.slice(end + 1)]
    } else if (opt.then) {
      // The rejoin is on another route: follow that route from the rejoin node on.
      const other = c.routes.find(r => r.id === opt.then)?.plan ?? []
      const from = other.findIndex(id => segmentById(c, id).from === fork.rejoinAt)
      if (from < 0) continue
      out = [...out.slice(0, start), ...opt.chain, ...other.slice(from)]
    }
  }
  return out
}
