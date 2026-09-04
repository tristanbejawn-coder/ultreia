// Small facts standing on the ground the walk crosses: what a town is known
// for, what a stone was for, what the Camino itself carries. They are placed
// at real coordinates (geocoded from OpenStreetMap) and shown only when the
// chosen route passes near them, so the Espiritual's monastery appears only
// if they take the boat, and the Central's rooster only if they go inland.
//
// Deliberately quieter than a photo: a small ring on the map, a card when
// tapped. Nothing here is generated at runtime; it is a written page of the
// walk, not a feed.

export type Lore = {
  id: string
  at: [number, number]          // lng, lat
  kind: 'town' | 'stone' | 'sea' | 'way'
  label: string                 // two or three words, for the map and the stage card
  title: string
  text: string
}

export const LORE: Lore[] = [
  // ---- Porto and the coast ----
  {
    id: 'porto-se', at: [-8.61121, 41.1428], kind: 'stone',
    label: 'The Sé',
    title: 'Porto · the Sé',
    text: 'The walk starts at the cathedral door, where the first stamp goes in the credencial. Built in the twelfth century to double as a fort, which is why it looks less like a church than a keep.',
  },
  {
    id: 'porto-ribeira', at: [-8.61114, 41.1405], kind: 'town',
    label: 'The Ribeira',
    title: 'The Ribeira',
    text: 'The old riverfront below the cathedral. The port lodges are on the far bank, in Vila Nova de Gaia; the wine crossed the Douro in flat-bottomed barcos rabelos until the dams went in.',
  },
  {
    id: 'matosinhos', at: [-8.68394, 41.18675], kind: 'town',
    label: 'Bom Jesus',
    title: 'Bom Jesus de Matosinhos',
    text: 'The coastal way leaves Porto on boardwalks past this church, whose crucifix is said to have washed ashore here. Fishermen have carried it in procession for four centuries.',
  },
  {
    id: 'vila-do-conde-aqueduct', at: [-8.73829, 41.37431], kind: 'stone',
    label: 'The aqueduct',
    title: 'The aqueduct at Vila do Conde',
    text: 'Nearly a thousand arches, built from 1705, carried water five kilometres to the convent of Santa Clara. Long stretches still stand beside the road, running to nowhere.',
  },
  {
    id: 'povoa', at: [-8.75987, 41.37942], kind: 'town',
    label: 'Fishermen’s marks',
    title: 'Póvoa de Varzim',
    text: 'A fishing town whose families could not write, so each used its own mark — the siglas poveiras — cut into boats, tools and gravestones. A son inherited his father’s sign with a stroke added.',
  },
  {
    id: 'apulia', at: [-8.76519, 41.48244], kind: 'sea',
    label: 'Seaweed coast',
    title: 'The seaweed coast',
    text: 'At Apúlia they harvested sargaço from the surf with ox carts and spread it on the fields as fertiliser. The squat thatched palheiros along the dunes were built to store it.',
  },
  {
    id: 'santa-luzia', at: [-8.83511, 41.70153], kind: 'stone',
    label: 'Santa Luzia',
    title: 'Santa Luzia, above Viana',
    text: 'The domed basilica on the hill over the mouth of the Lima, finished in 1943 and modelled on the Sacré-Cœur. A funicular climbs to it; the view down the estuary is the reason to.',
  },
  {
    id: 'ancora', at: [-8.85567, 41.81802], kind: 'stone',
    label: 'The dolmen',
    title: 'Older than the road',
    text: 'A short way inland from Vila Praia de Âncora stands the Anta da Barrosa, a dolmen roughly five thousand years old. People were walking this coast long before anyone walked it to Santiago.',
  },
  {
    id: 'caminha', at: [-8.77266, 41.8492], kind: 'sea',
    label: 'Crossing the Minho',
    title: 'Crossing the Minho',
    text: 'The border is water here. A small ferry takes pilgrims over to Spain when tide and weather allow, which is exactly why the choice is made on the day rather than planned.',
  },
  {
    id: 'santa-trega', at: [-8.87465, 41.88529], kind: 'stone',
    label: 'Santa Trega',
    title: 'Monte Santa Trega',
    text: 'Above A Guarda, the excavated circles of a Celtic hill fort, lived in around two thousand years ago. From the top you see the Minho empty into the Atlantic and Portugal on the other side.',
  },
  {
    id: 'oia', at: [-8.87644, 42.00332], kind: 'stone',
    label: 'Oia monastery',
    title: 'The monastery at the water',
    text: 'Santa María de Oia, Cistercian, built so close to the Atlantic that the spray reaches it. The monks are said to have turned their guns on raiding ships in the seventeenth century.',
  },
  {
    id: 'baiona', at: [-8.84851, 42.08813], kind: 'sea',
    label: 'The Pinta, 1493',
    title: 'Baiona, March 1493',
    text: 'The Pinta made port here with the first news in Europe that Columbus had found land across the ocean. The town still re-enacts the arrival every year. Offshore, the Cíes islands.',
  },
  {
    id: 'redondela', at: [-8.61634, 42.27991], kind: 'town',
    label: 'The viaducts',
    title: 'The town of viaducts',
    text: 'Two great iron railway viaducts stride over Redondela’s rooftops, built in the 1870s when two rival companies drove lines through the same small town. Coastal and Central meet here.',
  },
  {
    id: 'arcade', at: [-8.61047, 42.34042], kind: 'sea',
    label: 'Arcade oysters',
    title: 'Arcade oysters',
    text: 'The village at the head of the ría has grown oysters for centuries and holds a festival for them each April. Pilgrims arriving in the afternoon tend to stop longer than planned.',
  },

  // ---- Pontevedra to Santiago ----
  {
    id: 'peregrina', at: [-8.6436, 42.43077], kind: 'stone',
    label: 'The shell church',
    title: 'A church shaped like a shell',
    text: 'Pontevedra’s Virxe Peregrina, begun in 1778, is laid out on the plan of a scallop — the pilgrim’s own badge. The Pilgrim Virgin is the town’s patron and carries a staff.',
  },
  {
    id: 'caldas', at: [-8.66136, 42.61828], kind: 'town',
    label: 'Hot springs',
    title: 'Caldas de Reis',
    text: 'Hot springs rise in the middle of town, hot enough to sting. There is a fountain by the bridge where pilgrims sit and put their feet in, which after twenty kilometres is the whole point.',
  },
  {
    id: 'padron', at: [-8.66162, 42.73916], kind: 'stone',
    label: 'The pedrón',
    title: 'The pedrón',
    text: 'Under the altar of Padrón’s church lies a Roman stone. The story says the boat carrying the body of St James was moored to it, and the town took its name from the stone.',
  },
  {
    id: 'obradoiro', at: [-8.54576, 42.8805], kind: 'stone',
    label: 'Obradoiro',
    title: 'Praza do Obradoiro',
    text: 'The end. The botafumeiro, the great censer, hangs in the crossing of the cathedral: eight men on a rope swing it the width of the transept. It was first used, in part, to fumigate the pilgrims.',
  },

  // ---- The Central, inland ----
  {
    id: 'rates', at: [-8.67224, 41.42332], kind: 'stone',
    label: 'São Pedro de Rates',
    title: 'São Pedro de Rates',
    text: 'A severe Romanesque church for St Peter of Rates, held to be the first bishop of Braga and, in the legend, sent there by James himself. The inland road joins the Central here.',
  },
  {
    id: 'barcelos', at: [-8.61923, 41.53145], kind: 'town',
    label: 'The rooster',
    title: 'The rooster of Barcelos',
    text: 'A pilgrim was condemned to hang here for a theft he had not done. He said the judge’s roast cockerel would stand and crow to prove it. It did. The bird is now Portugal’s emblem.',
  },
  {
    id: 'ponte-de-lima', at: [-8.57347, 41.74678], kind: 'town',
    label: 'River of forgetting',
    title: 'The river of forgetting',
    text: 'Roman soldiers took the Lima for the Lethe and would not cross, believing they would lose their memories. Their general crossed alone and called each man by name from the far bank. Portugal’s oldest town, chartered 1125.',
  },
  {
    id: 'labruja', at: [-8.59513, 41.8413], kind: 'way',
    label: 'The Labruja',
    title: 'The Labruja',
    text: 'The steep climb out of the Lima valley, the hardest ascent on the whole Portuguese Way. It is short, it is stony, and it is over by lunch.',
  },
  {
    id: 'rubiaes', at: [-8.62488, 41.89778], kind: 'stone',
    label: 'Roman milestone',
    title: 'A Roman milestone',
    text: 'Beside the path at Rubiães stands a marker from the Via XIX, the imperial road from Braga to Astorga. The Camino is walking a route that was already old when the first pilgrim used it.',
  },
  {
    id: 'valenca', at: [-8.64502, 42.02925], kind: 'stone',
    label: 'The fortress',
    title: 'The fortress at Valença',
    text: 'A double ring of seventeenth-century walls in the star pattern of Vauban, aimed across the Minho at Spain. The whole town lives inside them; the Camino goes in one gate and out another.',
  },
  {
    id: 'tui', at: [-8.64437, 42.04592], kind: 'stone',
    label: 'Tui cathedral',
    title: 'Tui cathedral',
    text: 'Built like a castle, with battlements, because for centuries it faced an enemy across the river. Its carved porch is among the earliest Gothic work in Spain.',
  },

  // ---- The Espiritual ----
  {
    id: 'armenteira', at: [-8.74198, 42.46326], kind: 'stone',
    label: 'The lost abbot',
    title: 'The abbot who lost three centuries',
    text: 'At Armenteira’s monastery they tell of Ero, who stopped to listen to a bird in the wood and came back to find three hundred years had passed and no one knew his name.',
  },
  {
    id: 'pedra-auga', at: [-8.75248, 42.48984], kind: 'way',
    label: 'Stone and water',
    title: 'Stone and water',
    text: 'The descent from Armenteira follows a river past dozens of old grain mills, most of them roofless now. It is shaded the whole way down, and the loveliest hour of the Espiritual.',
  },
  {
    id: 'vilanova', at: [-8.79318, 42.55303], kind: 'sea',
    label: 'The Traslatio',
    title: 'The Traslatio',
    text: 'From Vilanova the route goes by boat up the Arousa and the Ulla — the only stretch of water on any Camino — retracing the voyage that is said to have brought the body of St James. Stone crosses stand in the sea along the way.',
  },

  // ---- The Camino itself ----
  {
    id: 'arrows', at: [-8.782, 41.533], kind: 'way',
    label: 'Yellow arrows',
    title: 'The yellow arrows',
    text: 'They are not ancient. A parish priest, Elías Valiña, began painting them in the 1980s with leftover road paint to keep pilgrims from getting lost. Every arrow since copies his.',
  },
  {
    id: 'shell', at: [-8.83, 41.693], kind: 'way',
    label: 'Why a scallop',
    title: 'Why a scallop',
    text: 'The shell is the pilgrim’s badge, worn home as proof of arrival. Its grooves all run to one point, which is how it came to stand for the many roads that end at one tomb.',
  },
  {
    id: 'isabel', at: [-8.618, 41.533], kind: 'way',
    label: 'The queen who walked',
    title: 'The queen who walked',
    text: 'Isabel of Portugal made this journey on foot in 1325, and again ten years later, leaving her crown at the tomb. She is the reason the Portuguese road became a royal one.',
  },
  {
    id: 'hundred', at: [-8.62559, 42.13644], kind: 'way',
    label: 'A hundred km',
    title: 'A hundred kilometres',
    text: 'From about here, Santiago is a hundred kilometres away — the least you must walk, with stamps to show it, before the cathedral office will give you a Compostela.',
  },
  {
    id: 'ultreia', at: [-8.658, 42.738], kind: 'way',
    label: 'Ultreia',
    title: 'Ultreia',
    text: 'The old greeting between pilgrims, from a twelfth-century songbook: ultreia, further; et suseia, and higher. One called it, the other answered. It is what this whole thing is named for.',
  },
]
