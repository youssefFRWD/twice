/**
 * Picks the illustration (public/items) that matches a listing, from its title. Sample listings have their own
 * picture; this covers listings from the database that have no photo. Order matters: specific words come first.
 */
const RULES = [
  [/climbing|bouldering/, '17'],
  [/folding bike|foldable bike|brompton|velo pliant/, '15'],
  [/road bike|racing bike|racer|velo de course/, '14'],
  [/bike|bicycle|cycle|velo\b|vtt|mountain bike/, '14'],
  [/scooter|skateboard|trottinette|skate\b|rollerblade/, 'scooter'],
  [/yoga|pilates|dumbbell|kettlebell|gym\b|fitness|exercise mat|weights/, '16'],
  [/tennis|badminton|squash|racket|racquet|raquette|ping.?pong/, 'racket'],
  [/football|soccer|basketball|volleyball|rugby|handball|\bball\b|ballon/, 'ball'],
  [/ankle boot|boots?\b|bottine/, '6'],
  [/sneaker|trainers?\b|running shoe|baskets?\b|shoes?\b|chaussure/, 'sneakers'],
  [/jacket|blouson|veste|bomber|blazer/, '4'],
  [/trench|coat\b|manteau|parka|overcoat|anorak/, '5'],
  [/sweater|jumper|pullover|cardigan|knit|pull\b|tricot|hoodie/, '28'],
  [/dress|skirt|gown|robe\b|jupe/, 'dress'],
  [/handbag|\bbag\b|purse|backpack|satchel|tote|sac\b|suitcase|luggage/, 'bag'],
  [/garden chair|outdoor chair|patio|chaises? de jardin|deck ?chair/, '29'],
  [/sofa|couch|settee|loveseat|armchair|canape|fauteuil/, '2'],
  [/lamp|lampe|lantern|chandelier|light\b|luminaire/, '18'],
  [/standing desk|desk\b|bureau\b|workstation/, '27'],
  [/bookshelf|bookcase|shelving|shelf|etagere|bibliotheque/, '3'],
  [/sideboard|buffet|credenza|cabinet|dresser|chest of drawers|wardrobe|commode|tv stand/, '1'],
  [/dining table|coffee table|side table|\btable\b/, 'table'],
  [/chair|stool|chaise|tabouret|bench/, 'chair'],
  [/laptop|ultrabook|notebook|macbook|chromebook|computer|ordinateur/, '7'],
  [/camera|polaroid|lens\b|reflex|film camera|appareil photo/, '8'],
  [/turntable|record player|platine|gramophone/, '9'],
  [/headphone|earphone|earbud|airpods?|casque/, '10'],
  [/speaker|hi-?fi|amplifier|subwoofer|soundbar|enceinte/, 'speaker'],
  [/phone|iphone|smartphone|android|tablet|ipad|telephone|portable\b/, 'phone'],
  [/guitar|ukulele|violin|piano|keyboard|drum|saxophone|flute|trumpet|guitare/, 'guitar'],
  [/atlas|map\b|encyclop|dictionary|dictionnaire/, '12'],
  [/\blps?\b|vinyl|records?\b|\bcds?\b|disque/, '13'],
  [/paperback|novel|comics?\b|poche|livres?\b|books?\b|textbook|manga/, '11'],
  [/espresso|coffee machine|coffee maker|nespresso|cafetiere/, '26'],
  [/kettle|teapot|saucepan|cookware|bouilloire/, 'kettle'],
  [/toy kitchen|play kitchen|dinette|kitchen set/, '22'],
  [/stroller|pushchair|pram|buggy|poussette/, '23'],
  [/lego|bricks?|building blocks|duplo|jenga/, '24'],
  [/\bcot\b|crib|baby bed|bassinet|lit bebe|berceau/, '25'],
  [/teddy|plush|stuffed|doll\b|peluche|poupee|cuddly/, 'teddy'],
  [/rug|carpet|tapis|doormat/, '19'],
  [/plates?\b|dishes|bowls?\b|crockery|dinner set|tableware|assiettes?|mug|cups?\b|vaisselle/, '20'],
  [/mirror|miroir/, '21'],
  [/plant|pot\b|vase|cactus|succulent|planter|plante/, 'plant'],
  [/clock|watch\b|horloge|pendule/, 'clock'],
]

/** One neutral picture per category, for a title nothing above recognises. */
const BY_CATEGORY = { furniture: 'chair', fashion: 'dress', electronics: 'phone', books: 'bookstack', sports: 'ball', home: 'plant', kids: 'teddy' }

const plain = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function pictureFor(item) {
  const text = plain(`${item.t || ''}`)
  const hit = RULES.find(([re]) => re.test(text))
  const name = hit ? hit[1] : BY_CATEGORY[item.c]
  return name ? `/items/${name}.svg` : null
}
