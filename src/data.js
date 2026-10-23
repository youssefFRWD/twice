/* Static data, transit graph and route planning, ported from the original single-file page. */
import { locale } from './locale.js'
import en from './locales/en.js'

/** English fallback when a caller does not pass a translator to the route planners. */
const enT=(k,v)=>{let s=en[k]??(v&&typeof v.n==='number'?en[`${k}_${v.n===1?'one':'other'}`]:undefined)??k;return v?s.replace(/\{(\w+)\}/g,(_,x)=>v[x]??''):s};
const ICON={
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  heart:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  disc:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  map:'<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  arrow:'<path d="M3 11l18-8-8 18-2-8z"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18.5 14.2A6.5 6.5 0 0 1 21.5 20"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
  mail:'<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  eye:'<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff:'<path d="M3 3l18 18"/><path d="M10.6 5.6a9.8 9.8 0 0 1 1.4-.1c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.2 3.9M6.3 7.3A16.7 16.7 0 0 0 2 12s3.6 6.5 10 6.5a9.6 9.6 0 0 0 4-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
  walk:'<circle cx="13" cy="4.5" r="1.8"/><path d="M9.5 21l2-6 2.5 2.2V21M11.5 15l.8-5-3.3 1.6L8 15M12.3 10l3 2 2.7.5"/>',
  train:'<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/>',
  flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  all:'<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
  pin:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  up:'<path d="M6 15l6-6 6 6"/>', whole:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  bag:'<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>', tag:'<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  leaf:'<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19c3-5 6-7 10-9"/>',
  card:'<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h4"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>',
  star:'<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  down:'<path d="M6 9l6 6 6-6"/>',
  checks:'<path d="M2.5 12.5l4.5 4.5L16 8M12 16.5l1 1L22 8"/>',
  phone:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  wallet:'<path d="M4 7.5V18a2 2 0 0 0 2 2h14V9H6a2 2 0 0 1-2-2 2 2 0 0 1 2-2h12"/><circle cx="16" cy="14.5" r="1"/>',
  car:'<path d="M4 16V12l2-5h12l2 5v4M4 16h16M4 16v2M20 16v2"/><circle cx="8" cy="13" r=".6"/><circle cx="16" cy="13" r=".6"/>'
};

/* ---------- categories & items ---------- */
const CATS=[
 {id:'furniture',label:'Furniture',art:'<path class="ic" d="M20 56V42a8 8 0 0 1 8-8h44a8 8 0 0 1 8 8v14"/><rect class="ic" x="13" y="56" width="74" height="17" rx="6"/><path class="ic" d="M24 73v8M76 73v8"/>'},
 {id:'fashion',label:'Fashion',art:'<path class="ic" d="M50 30a6 6 0 1 1 6 6c-3 1-6 3-6 7v3L16 67a5 5 0 0 0 3 9h62a5 5 0 0 0 3-9L50 46"/>'},
 {id:'electronics',label:'Electronics',art:'<rect class="ic" x="22" y="30" width="56" height="37" rx="4"/><path class="ic" d="M11 74h78"/>'},
 {id:'books',label:'Books & Media',art:'<path class="ic" d="M16 28h24a9 9 0 0 1 10 9v40a7 7 0 0 0-7-6H16z"/><path class="ic" d="M84 28H60a9 9 0 0 0-10 9v40a7 7 0 0 1 7-6h27z"/>'},
 {id:'sports',label:'Sports & Bikes',art:'<circle class="ic" cx="26" cy="64" r="15"/><circle class="ic" cx="74" cy="64" r="15"/><path class="ic" d="M26 64l15-28h22l11 28M41 36l13 28H26M58 36h9"/>'},
 {id:'home',label:'Home & Decor',art:'<path class="ic" d="M34 26h32l9 28H25z"/><path class="ic" d="M50 54v20M37 76h26"/>'},
 {id:'kids',label:'Kids',art:'<rect class="ic" x="22" y="50" width="26" height="26" rx="3"/><rect class="ic" x="52" y="50" width="26" height="26" rx="3"/><rect class="ic" x="37" y="22" width="26" height="26" rx="3"/>'}
];
const ITEMS=[
 {id:1,t:'Mid-century oak sideboard',p:180,c:'furniture',cond:'Very good',s:'Marie L.',a:'Le Marais, Paris 3e',lat:48.8620,lon:2.3610,d:'Three doors, brass handles, a few light marks on the top. You carry it, it fits in a small van.'},
 {id:2,t:'Velvet two-seater sofa',p:240,c:'furniture',cond:'Good',s:'Karim B.',a:'Montreuil',lat:48.8610,lon:2.4380,d:'Deep green velvet, solid wood legs. Smoke-free, no pets. Fourth-floor walk-up, so bring friends.'},
 {id:3,t:'White ladder bookshelf',p:35,c:'furniture',cond:'Good',s:'Léa D.',a:'Boulogne-Billancourt',lat:48.8350,lon:2.2400,d:'Five shelves, 180 cm tall. Comes apart in ten minutes with one Allen key.'},
 {id:4,t:'Vintage leather jacket, size M',p:85,c:'fashion',cond:'Very good',s:'Samir A.',a:'Belleville, Paris 20e',lat:48.8720,lon:2.3790,d:'Brown, soft, quilted lining. Worn for two winters and still holds its shape.'},
 {id:5,t:'Wool trench coat, size M',p:60,c:'fashion',cond:'Like new',s:'Camille R.',a:'Saint-Germain, Paris 6e',lat:48.8530,lon:2.3330,d:'Camel, double-breasted. Dry cleaned in September, bought the wrong size.'},
 {id:6,t:'Leather ankle boots, size 39',p:45,c:'fashion',cond:'Good',s:'Inès M.',a:'Batignolles, Paris 17e',lat:48.8860,lon:2.3190,d:'Black, block heel, resoled last spring. Comfortable for a full day of walking.'},
 {id:7,t:'13-inch ultrabook, 16 GB RAM',p:420,c:'electronics',cond:'Very good',s:'Julien P.',a:'Puteaux, La Défense',lat:48.8840,lon:2.2380,d:'512 GB SSD, battery lasts around 9 hours. Reset and ready; charger included.'},
 {id:8,t:'35 mm film camera with 50 mm lens',p:130,c:'electronics',cond:'Good',s:'Nina G.',a:'Montmartre, Paris 18e',lat:48.8870,lon:2.3430,d:'Fully mechanical, light meter works. Shutter tested on a fresh roll.'},
 {id:9,t:'Turntable with built-in preamp',p:150,c:'electronics',cond:'Very good',s:'Hugo T.',a:'Vincennes',lat:48.8470,lon:2.4390,d:'Belt drive, new stylus this year. Plays 33 and 45 rpm. Dust cover included.'},
 {id:10,t:'Noise-cancelling headphones',p:90,c:'electronics',cond:'Good',s:'Aïcha N.',a:'Saint-Denis',lat:48.9360,lon:2.3560,d:'Over-ear, wireless, new ear pads. Case and cable included.'},
 {id:11,t:'Box of 40 French paperbacks',p:25,c:'books',cond:'Good',s:'Paul V.',a:'Quartier Latin, Paris 5e',lat:48.8470,lon:2.3500,d:'Crime, classics and a few essays. Sold as one lot, pickup only.'},
 {id:12,t:'Illustrated atlas of Paris, 1950s',p:40,c:'books',cond:'Fair',s:'Odile F.',a:'Saint-Ouen-sur-Seine',lat:48.9110,lon:2.3340,d:'Fold-out maps intact, spine reglued. A nice object for a shelf or a wall.'},
 {id:13,t:'30 jazz LPs, mixed labels',p:120,c:'books',cond:'Very good',s:'Marc E.',a:'Pigalle, Paris 9e',lat:48.8800,lon:2.3380,d:'Sleeves graded, records cleaned. Happy for you to listen before you buy.'},
 {id:14,t:'Road bike, 54 cm frame',p:320,c:'sports',cond:'Very good',s:'Thomas K.',a:'Bastille, Paris 11e',lat:48.8550,lon:2.3720,d:'Aluminium frame, 2x10 gears, new tyres and chain. Pedals not included.'},
 {id:15,t:'Folding bike, 20-inch wheels',p:180,c:'sports',cond:'Good',s:'Claire S.',a:'Issy-les-Moulineaux',lat:48.8240,lon:2.2700,d:'Folds in 15 seconds, fits under a desk. Three speeds, rear rack.'},
 {id:16,t:'Two yoga mats and four blocks',p:20,c:'sports',cond:'Good',s:'Anaïs C.',a:'Ivry-sur-Seine',lat:48.8110,lon:2.3850,d:'Non-slip, 6 mm. Washed and rolled up. Strap included.'},
 {id:17,t:'Climbing shoes, size 42',p:40,c:'sports',cond:'Good',s:'Yann H.',a:'Montparnasse, Paris 14e',lat:48.8400,lon:2.3260,d:'Velcro, moderate downturn. Rubber has plenty of life left.'},
 {id:18,t:'Ceramic table lamp',p:28,c:'home',cond:'Like new',s:'Elsa W.',a:'Canal Saint-Martin, Paris 10e',lat:48.8720,lon:2.3640,d:'Hand-glazed base, linen shade, warm bulb included.'},
 {id:19,t:'Large jute rug, 200 x 300 cm',p:55,c:'home',cond:'Good',s:'David O.',a:'Créteil',lat:48.7900,lon:2.4550,d:'Natural fibre, rolled up for storage. Lightly vacuumed, no stains.'},
 {id:20,t:'Six stoneware dinner plates',p:30,c:'home',cond:'Very good',s:'Sofia J.',a:'Nanterre',lat:48.8920,lon:2.2060,d:'Speckled grey glaze, dishwasher safe. No chips.'},
 {id:21,t:'Gilt wall mirror, 90 cm',p:95,c:'home',cond:'Good',s:'Bernard Q.',a:'Versailles',lat:48.8050,lon:2.1230,d:'Carved frame with age. Hanging wire already attached. Pickup near the château.'},
 {id:22,t:'Wooden toy kitchen',p:45,c:'kids',cond:'Very good',s:'Laura Z.',a:'Levallois-Perret',lat:48.8970,lon:2.2870,d:'Pine, with a working door and a cooker top. Pots and pans included.'},
 {id:23,t:'Lightweight stroller',p:110,c:'kids',cond:'Good',s:'Mehdi R.',a:'Paris 15e',lat:48.8420,lon:2.2930,d:'Folds with one hand, rain cover and shopping basket included.'},
 {id:24,t:'3 kg of building bricks',p:35,c:'kids',cond:'Good',s:'Chloé B.',a:'Paris 13e',lat:48.8280,lon:2.3600,d:'Mixed sets, washed. Comes in a storage crate with a lid.'},
 {id:25,t:'Cot with mattress',p:70,c:'kids',cond:'Very good',s:'Valérie A.',a:'Neuilly-sur-Seine',lat:48.8840,lon:2.2600,d:'Three height settings, drop side. Mattress is still in its cover.'},
 {id:26,t:'Espresso machine, two group heads',p:75,c:'electronics',cond:'Good',s:'Antoine L.',a:'Paris 7e',lat:48.8570,lon:2.3120,d:'Descaled this month, steam wand works. Portafilter and tamper included.'},
 {id:27,t:'Electric standing desk',p:150,c:'furniture',cond:'Very good',s:'Rania D.',a:'Paris 12e',lat:48.8400,lon:2.3900,d:'140 x 70 cm top, memory presets. Disassembles flat for transport.'},
 {id:28,t:'Hand-knit wool sweater',p:22,c:'fashion',cond:'Like new',s:'Geneviève M.',a:'Paris 16e',lat:48.8640,lon:2.2740,d:'Oatmeal, size L, from a small workshop. Worn twice.'},
 {id:29,t:'Garden chairs, set of four',p:60,c:'home',cond:'Good',s:'Olivier P.',a:'Saint-Germain-en-Laye',lat:48.8980,lon:2.0940,d:'Powder-coated steel, foldable. Repainted last summer.'}
];
const catOf=id=>CATS.find(c=>c.id===id)||{id,label:id,art:CATS[0].art};
const CAT_ALL=[{id:'all',label:'All'},{id:'nearest',label:'Nearest'},...CATS];

/* ---------- transit data ---------- */
const LINES=[
 ['1','#FFCD00','#14201a','La Défense=48.8919,2.2380;Esplanade de la Défense=48.8884,2.2500;Pont de Neuilly=48.8847,2.2584;Les Sablons=48.8813,2.2721;Porte Maillot=48.8780,2.2820;Argentine=48.8755,2.2896;Charles de Gaulle–Étoile=48.8738,2.2950;George V=48.8723,2.3003;Franklin D. Roosevelt=48.8690,2.3098;Champs-Élysées–Clemenceau=48.8675,2.3144;Concorde=48.8656,2.3212;Tuileries=48.8645,2.3296;Palais Royal=48.8625,2.3366;Louvre–Rivoli=48.8608,2.3410;Châtelet=48.8584,2.3470;Hôtel de Ville=48.8575,2.3516;Saint-Paul=48.8553,2.3608;Bastille=48.8531,2.3690;Gare de Lyon=48.8443,2.3744;Reuilly–Diderot=48.8472,2.3865;Nation=48.8483,2.3959;Porte de Vincennes=48.8472,2.4108;Saint-Mandé=48.8461,2.4186;Bérault=48.8450,2.4277;Château de Vincennes=48.8444,2.4405'],
 ['2','#2253B8','#fff','Porte Dauphine=48.8714,2.2770;Victor Hugo=48.8699,2.2859;Charles de Gaulle–Étoile;Ternes=48.8783,2.2982;Courcelles=48.8795,2.3036;Monceau=48.8806,2.3092;Villiers=48.8814,2.3157;Rome=48.8826,2.3197;Place de Clichy=48.8836,2.3274;Blanche=48.8837,2.3326;Pigalle=48.8820,2.3371;Anvers=48.8828,2.3441;Barbès–Rochechouart=48.8838,2.3499;La Chapelle=48.8844,2.3597;Stalingrad=48.8842,2.3658;Jaurès=48.8825,2.3705;Colonel Fabien=48.8778,2.3703;Belleville=48.8723,2.3770;Couronnes=48.8692,2.3801;Ménilmontant=48.8663,2.3835;Père Lachaise=48.8627,2.3868;Philippe Auguste=48.8581,2.3898;Alexandre Dumas=48.8564,2.3947;Avron=48.8518,2.4010;Nation'],
 ['3','#837902','#fff','Pont de Levallois=48.8970,2.2690;Wagram=48.8835,2.3040;Malesherbes=48.8826,2.3086;Villiers;Europe=48.8788,2.3223;Saint-Lazare=48.8760,2.3253;Havre-Caumartin=48.8734,2.3282;Opéra=48.8707,2.3321;Quatre-Septembre=48.8693,2.3361;Bourse=48.8686,2.3413;Sentier=48.8675,2.3469;Réaumur–Sébastopol=48.8663,2.3523;Arts et Métiers=48.8654,2.3563;Temple=48.8667,2.3614;République=48.8675,2.3636;Parmentier=48.8650,2.3743;Rue Saint-Maur=48.8639,2.3800;Père Lachaise;Gambetta=48.8654,2.3986;Porte de Bagnolet=48.8645,2.4092;Gallieni=48.8656,2.4163'],
 ['4','#BD1F8E','#fff','Porte de Clignancourt=48.8975,2.3445;Simplon=48.8940,2.3475;Marcadet–Poissonniers=48.8912,2.3498;Château Rouge=48.8870,2.3503;Barbès–Rochechouart;Gare du Nord=48.8809,2.3553;Gare de l\'Est=48.8766,2.3590;Château d\'Eau=48.8728,2.3556;Strasbourg–Saint-Denis=48.8695,2.3543;Réaumur–Sébastopol;Étienne Marcel=48.8636,2.3511;Les Halles=48.8620,2.3463;Châtelet;Cité=48.8548,2.3471;Saint-Michel=48.8535,2.3440;Odéon=48.8520,2.3386;Saint-Germain-des-Prés=48.8538,2.3335;Saint-Sulpice=48.8513,2.3306;Saint-Placide=48.8470,2.3266;Montparnasse–Bienvenüe=48.8433,2.3239;Vavin=48.8421,2.3288;Raspail=48.8393,2.3303;Denfert-Rochereau=48.8339,2.3324;Mouton-Duvernet=48.8312,2.3303;Alésia=48.8282,2.3271;Porte d\'Orléans=48.8234,2.3254'],
 ['5','#F26B1D','#14201a','Bobigny–Pablo Picasso=48.9065,2.4492;Bobigny–Pantin=48.8996,2.4283;Église de Pantin=48.8928,2.4113;Hoche=48.8918,2.4020;Porte de Pantin=48.8883,2.3925;Ourcq=48.8869,2.3843;Laumière=48.8851,2.3794;Jaurès;Stalingrad;Gare du Nord;Gare de l\'Est;Jacques Bonsergent=48.8708,2.3610;République;Oberkampf=48.8648,2.3685;Richard-Lenoir=48.8610,2.3718;Bréguet–Sabin=48.8559,2.3707;Bastille;Quai de la Rapée=48.8465,2.3665;Gare d\'Austerlitz=48.8428,2.3658;Saint-Marcel=48.8383,2.3600;Campo-Formio=48.8352,2.3586;Place d\'Italie=48.8312,2.3555'],
 ['6','#4FB383','#14201a','Charles de Gaulle–Étoile;Kléber=48.8713,2.2933;Boissière=48.8669,2.2899;Trocadéro=48.8631,2.2872;Passy=48.8575,2.2858;Bir-Hakeim=48.8541,2.2893;Dupleix=48.8510,2.2936;La Motte-Picquet–Grenelle=48.8490,2.2985;Cambronne=48.8475,2.3028;Sèvres-Lecourbe=48.8455,2.3095;Pasteur=48.8426,2.3128;Montparnasse–Bienvenüe;Edgar Quinet=48.8408,2.3256;Raspail;Denfert-Rochereau;Saint-Jacques=48.8329,2.3372;Glacière=48.8310,2.3436;Corvisart=48.8299,2.3503;Place d\'Italie;Nationale=48.8332,2.3623;Chevaleret=48.8350,2.3676;Quai de la Gare=48.8370,2.3731;Bercy=48.8401,2.3796;Dugommier=48.8390,2.3893;Daumesnil=48.8393,2.3957;Bel-Air=48.8411,2.4009;Picpus=48.8458,2.4011;Nation'],
 ['7','#E887AA','#14201a','La Courneuve–8 Mai 1945=48.9206,2.4100;Fort d\'Aubervilliers=48.9146,2.4106;Aubervilliers–Quatre Chemins=48.9040,2.3925;Porte de la Villette=48.8978,2.3855;Corentin Cariou=48.8947,2.3822;Crimée=48.8905,2.3769;Riquet=48.8883,2.3737;Stalingrad;Louis Blanc=48.8812,2.3653;Château-Landon=48.8789,2.3620;Gare de l\'Est;Poissonnière=48.8774,2.3490;Cadet=48.8758,2.3445;Le Peletier=48.8750,2.3400;Chaussée d\'Antin–La Fayette=48.8731,2.3333;Opéra;Pyramides=48.8663,2.3342;Palais Royal;Pont Neuf=48.8587,2.3427;Châtelet;Pont Marie=48.8532,2.3574;Sully–Morland=48.8512,2.3617;Jussieu=48.8460,2.3552;Place Monge=48.8420,2.3524;Censier–Daubenton=48.8403,2.3515;Les Gobelins=48.8356,2.3529;Place d\'Italie;Tolbiac=48.8260,2.3573;Maison Blanche=48.8222,2.3586;Porte d\'Italie=48.8190,2.3600;Porte de Choisy=48.8196,2.3648;Porte d\'Ivry=48.8213,2.3694;Pierre et Marie Curie=48.8157,2.3769;Mairie d\'Ivry=48.8111,2.3833'],
 ['8','#C795D6','#14201a','Balard=48.8366,2.2787;Lourmel=48.8385,2.2822;Boucicaut=48.8410,2.2878;Félix Faure=48.8423,2.2914;Commerce=48.8447,2.2937;La Motte-Picquet–Grenelle;École Militaire=48.8548,2.3063;La Tour-Maubourg=48.8576,2.3103;Invalides=48.8617,2.3144;Concorde;Madeleine=48.8699,2.3252;Opéra;Richelieu–Drouot=48.8717,2.3385;Grands Boulevards=48.8715,2.3430;Bonne Nouvelle=48.8706,2.3485;Strasbourg–Saint-Denis;République;Filles du Calvaire=48.8631,2.3664;Saint-Sébastien–Froissart=48.8610,2.3675;Chemin Vert=48.8573,2.3687;Bastille;Ledru-Rollin=48.8512,2.3764;Faidherbe–Chaligny=48.8500,2.3837;Reuilly–Diderot;Montgallet=48.8442,2.3896;Daumesnil;Michel Bizot=48.8366,2.4026;Porte Dorée=48.8353,2.4064;Porte de Charenton=48.8325,2.4025;Liberté=48.8264,2.4130;Charenton–Écoles=48.8213,2.4141;École Vétérinaire de Maisons-Alfort=48.8148,2.4219;Créteil–Préfecture=48.7803,2.4592'],
 ['9','#A9B000','#14201a','Pont de Sèvres=48.8296,2.2300;Billancourt=48.8321,2.2377;Marcel Sembat=48.8338,2.2418;Porte de Saint-Cloud=48.8379,2.2573;Exelmans=48.8421,2.2597;Michel-Ange–Molitor=48.8449,2.2641;Michel-Ange–Auteuil=48.8479,2.2640;Jasmin=48.8527,2.2680;Ranelagh=48.8551,2.2704;La Muette=48.8581,2.2742;Rue de la Pompe=48.8639,2.2778;Trocadéro;Iéna=48.8648,2.2937;Alma–Marceau=48.8645,2.3012;Franklin D. Roosevelt;Saint-Philippe-du-Roule=48.8714,2.3100;Miromesnil=48.8736,2.3150;Saint-Augustin=48.8749,2.3213;Havre-Caumartin;Chaussée d\'Antin–La Fayette;Richelieu–Drouot;Grands Boulevards;Bonne Nouvelle;Strasbourg–Saint-Denis;République;Oberkampf;Saint-Ambroise=48.8613,2.3743;Voltaire=48.8580,2.3800;Charonne=48.8546,2.3852;Rue des Boulets=48.8521,2.3892;Nation;Buzenval=48.8519,2.4010;Maraîchers=48.8527,2.4056;Porte de Montreuil=48.8537,2.4107;Robespierre=48.8556,2.4235;Croix de Chavaux=48.8586,2.4358;Mairie de Montreuil=48.8623,2.4439'],
 ['10','#C9910D','#14201a','Boulogne–Pont de Saint-Cloud=48.8408,2.2282;Boulogne–Jean Jaurès=48.8427,2.2380;Porte d\'Auteuil=48.8479,2.2582;Michel-Ange–Auteuil;Michel-Ange–Molitor;Chardon-Lagache=48.8451,2.2689;Mirabeau=48.8470,2.2732;Javel–André Citroën=48.8461,2.2778;Charles Michels=48.8470,2.2859;Avenue Émile Zola=48.8472,2.2946;La Motte-Picquet–Grenelle;Ségur=48.8470,2.3069;Duroc=48.8466,2.3164;Vaneau=48.8488,2.3213;Sèvres–Babylone=48.8513,2.3265;Mabillon=48.8530,2.3350;Odéon;Cluny–La Sorbonne=48.8510,2.3440;Maubert–Mutualité=48.8503,2.3484;Cardinal Lemoine=48.8465,2.3510;Jussieu;Gare d\'Austerlitz'],
 ['11','#7A5230','#fff','Châtelet;Hôtel de Ville;Rambuteau=48.8611,2.3535;Arts et Métiers;République;Goncourt=48.8697,2.3705;Belleville;Pyrénées=48.8736,2.3890;Jourdain=48.8752,2.3892;Place des Fêtes=48.8769,2.3929;Télégraphe=48.8756,2.3987;Porte des Lilas=48.8764,2.4064;Mairie des Lilas=48.8795,2.4162'],
 ['12','#007852','#fff','Mairie d\'Issy=48.8240,2.2730;Corentin Celton=48.8272,2.2790;Porte de Versailles=48.8323,2.2876;Convention=48.8370,2.2965;Vaugirard=48.8397,2.3009;Volontaires=48.8414,2.3077;Pasteur;Montparnasse–Bienvenüe;Notre-Dame-des-Champs=48.8453,2.3278;Rennes=48.8481,2.3277;Sèvres–Babylone;Rue du Bac=48.8559,2.3256;Solférino=48.8585,2.3231;Assemblée nationale=48.8606,2.3200;Concorde;Madeleine;Saint-Lazare;Trinité=48.8766,2.3330;Notre-Dame-de-Lorette=48.8760,2.3380;Saint-Georges=48.8787,2.3377;Pigalle;Abbesses=48.8843,2.3388;Lamarck–Caulaincourt=48.8898,2.3400;Jules Joffrin=48.8924,2.3447;Marcadet–Poissonniers;Porte de la Chapelle=48.8975,2.3594;Front Populaire=48.9065,2.3655'],
 ['13','#59B6DE','#14201a','Châtillon–Montrouge=48.8100,2.3010;Malakoff–Plateau de Vanves=48.8223,2.2990;Porte de Vanves=48.8277,2.3053;Plaisance=48.8318,2.3140;Pernety=48.8340,2.3180;Gaîté=48.8387,2.3225;Montparnasse–Bienvenüe;Duroc;Saint-François-Xavier=48.8513,2.3142;Varenne=48.8567,2.3150;Invalides;Champs-Élysées–Clemenceau;Miromesnil;Saint-Lazare;Liège=48.8796,2.3270;Place de Clichy;La Fourche=48.8873,2.3258;Guy Môquet=48.8929,2.3277;Porte de Saint-Ouen=48.8974,2.3292;Garibaldi=48.9068,2.3318;Mairie de Saint-Ouen=48.9122,2.3335;Carrefour Pleyel=48.9208,2.3452;Saint-Denis–Porte de Paris=48.9293,2.3567;Basilique de Saint-Denis=48.9361,2.3556;Saint-Denis–Université=48.9462,2.3637'],
 ['14','#6B2C9E','#fff','Saint-Denis–Pleyel=48.9187,2.3427;Mairie de Saint-Ouen;Porte de Clichy=48.8946,2.3139;Pont Cardinet=48.8886,2.3157;Saint-Lazare;Madeleine;Pyramides;Châtelet;Gare de Lyon;Bercy;Cour Saint-Émilion=48.8337,2.3866;Bibliothèque François Mitterrand=48.8298,2.3764;Olympiades=48.8271,2.3668;Maison Blanche;Aéroport d\'Orly=48.7262,2.3659'],
 ['A','#E2231A','#fff','Saint-Germain-en-Laye=48.8985,2.0943;Le Vésinet–Le Pecq=48.8933,2.1170;Chatou–Croissy=48.8860,2.1560;Rueil-Malmaison=48.8767,2.1805;Nanterre-Ville=48.8939,2.1934;Nanterre-Préfecture=48.8976,2.2041;La Défense;Charles de Gaulle–Étoile;Auber=48.8725,2.3300;Châtelet;Gare de Lyon;Nation;Vincennes=48.8473,2.4375;Fontenay-sous-Bois=48.8488,2.4750;Neuilly-Plaisance=48.8541,2.5126;Noisy-le-Grand–Mont d\'Est=48.8394,2.5546;Marne-la-Vallée–Chessy=48.8697,2.7832'],
 ['B','#4B8FD2','#fff','Aéroport Charles de Gaulle 2=49.0043,2.5710;Aulnay-sous-Bois=48.9425,2.4960;Le Bourget=48.9319,2.4240;La Courneuve–Aubervilliers=48.9160,2.3890;La Plaine–Stade de France=48.9206,2.3558;Gare du Nord;Châtelet;Saint-Michel;Luxembourg=48.8465,2.3398;Port-Royal=48.8403,2.3373;Denfert-Rochereau;Cité Universitaire=48.8213,2.3375;Gentilly=48.8152,2.3340;Arcueil–Cachan=48.7992,2.3288;Bagneux=48.7955,2.3098;Bourg-la-Reine=48.7795,2.3167;Antony=48.7540,2.3000;Massy–Palaiseau=48.7258,2.2599']
];
const toXY=(lat,lon)=>[(lon-2.35)*73.3,-(lat-48.85)*111.2];
const fromXY=(x,y)=>({lat:48.85-y/111.2,lon:x/73.3+2.35});
const slug=s=>s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-');
const STN=[], STNMAP=new Map(), LM={}, LINE_ST={};
LINES.forEach(([id,col,txt,src])=>{
  LM[id]={id,col,txt,rer:id==='A'||id==='B'};
  LINE_ST[id]=[];
  src.split(';').forEach(tok=>{
    const [name,co]=tok.split('=');
    const key=slug(name);
    let s=STNMAP.get(key);
    if(!s){
      if(!co){console.warn('station without coordinates',name);return}
      const [la,lo]=co.split(',').map(Number);
      const [x,y]=toXY(la,lo);
      s={id:key,name,lat:la,lon:lo,x,y,lines:[]};STNMAP.set(key,s);STN.push(s);
    }
    if(!s.lines.includes(id))s.lines.push(id);
    LINE_ST[id].push(s);
  });
});
const PLACES=[ // [name, lat, lon, rank]
 ['Paris',48.8566,2.3522,1],['La Défense',48.8919,2.2380,3],['Saint-Denis',48.9362,2.3574,2],['Montreuil',48.8610,2.4410,3],
 ['Boulogne-Billancourt',48.8350,2.2400,3],['Versailles',48.8049,2.1204,2],['Créteil',48.7904,2.4556,3],['Nanterre',48.8924,2.2069,3],
 ['Vincennes',48.8473,2.4440,4],['Ivry-sur-Seine',48.8114,2.3847,4],['Saint-Germain-en-Laye',48.8987,2.0940,3],['Issy-les-Moulineaux',48.8245,2.2730,4],
 ['Neuilly-sur-Seine',48.8846,2.2686,4],['Levallois-Perret',48.8957,2.2877,4],['Saint-Ouen',48.9117,2.3339,4],['Cergy',49.0366,2.0763,1],
 ['Roissy-CDG',49.0097,2.5479,2],['Orly',48.7262,2.3665,3],['Meaux',48.9601,2.8785,1],['Melun',48.5396,2.6603,1],['Fontainebleau',48.4047,2.7016,1],
 ['Rambouillet',48.6439,1.8294,1],['Étampes',48.4344,2.1612,1],['Mantes-la-Jolie',48.9907,1.7171,1],['Marne-la-Vallée',48.8397,2.5800,2],['Évry',48.6297,2.4417,2],['Massy',48.7258,2.2599,3]
];
const REGION=[[49.24,1.75],[49.22,2.40],[49.06,3.05],[48.92,3.56],[48.62,3.46],[48.34,3.02],[48.12,2.62],[48.15,1.95],[48.36,1.60],[48.66,1.45],[48.95,1.45]];
const PARIS=[[48.9020,2.3330],[48.9010,2.3700],[48.8960,2.3980],[48.8780,2.4110],[48.8550,2.4150],[48.8300,2.4090],[48.8210,2.3900],[48.8130,2.3680],[48.8150,2.3360],[48.8180,2.3100],[48.8260,2.2770],[48.8330,2.2530],[48.8450,2.2500],[48.8620,2.2540],[48.8780,2.2700],[48.8950,2.3000]];
const SEINE=[[48.7000,2.4400],[48.7640,2.4110],[48.7900,2.3900],[48.8190,2.3930],[48.8340,2.3880],[48.8420,2.3660],[48.8530,2.3499],[48.8583,2.3375],[48.8639,2.3135],[48.8610,2.2930],[48.8560,2.2870],[48.8460,2.2740],[48.8370,2.2700],[48.8270,2.2400],[48.8280,2.2260],[48.8450,2.2120],[48.8720,2.2150],[48.8920,2.2350],[48.9000,2.2650],[48.9150,2.2900],[48.9350,2.3320],[48.9550,2.3050],[48.9500,2.2450],[48.9250,2.2150],[48.9000,2.1700],[48.9000,2.1100],[48.9300,2.0500],[49.0100,1.9000],[49.0000,1.7000]];
const MARNE=[[48.8700,2.7200],[48.8650,2.6300],[48.8500,2.5300],[48.8400,2.4900],[48.8370,2.4730],[48.8210,2.4670],[48.7980,2.4700],[48.8080,2.4160]];
const FORESTS=[[48.8620,2.2500,2.1,1.7],[48.8280,2.4380,1.9,1.3],[48.9500,2.1200,3.5,2.2],[48.7550,2.2300,3.0,2.0],[48.8100,2.2000,1.8,1.4],[48.7750,2.5500,3.5,2.5],[48.8500,2.6600,2.6,2.0],[48.9750,2.4400,2.6,2.0]];

/* ---------- routing ---------- */
const hav=(a,b,c,d)=>{const r=Math.PI/180,dl=(c-a)*r,dg=(d-b)*r,x=Math.sin(dl/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dg/2)**2;return 12742*Math.asin(Math.sqrt(x))};
const walkMin=km=>km*15; // km*1.25 street factor at 5 km/h
const NODES=[], NIDX=new Map(), ADJ=[];
function node(sid,line){const k=sid+'#'+line;let n=NIDX.get(k);if(n===undefined){n=NODES.length;NIDX.set(k,n);NODES.push({sid,line,s:STNMAP.get(sid)});ADJ.push([])}return n}
const hop=(a,b,line)=>0.8+hav(a.lat,a.lon,b.lat,b.lon)*(LM[line].rer?1.1:1.7);
Object.keys(LINE_ST).forEach(L=>{const arr=LINE_ST[L];for(let i=0;i<arr.length;i++){node(arr[i].id,L);if(i){const a=node(arr[i-1].id,L),b=node(arr[i].id,L),w=hop(arr[i-1],arr[i],L);ADJ[a].push({v:b,w});ADJ[b].push({v:a,w})}}});
STN.forEach(s=>{for(const l1 of s.lines)for(const l2 of s.lines)if(l1!==l2){ADJ[node(s.id,l1)].push({v:node(s.id,l2),w:LM[l1].rer||LM[l2].rer?5:4})}});
for(let i=0;i<STN.length;i++)for(let j=i+1;j<STN.length;j++){const a=STN[i],b=STN[j];if(Math.abs(a.lat-b.lat)>.004||Math.abs(a.lon-b.lon)>.006)continue;const d=hav(a.lat,a.lon,b.lat,b.lon);if(d>.28)continue;for(const l1 of a.lines)for(const l2 of b.lines){if(l1===l2)continue;const w=4+walkMin(d);ADJ[node(a.id,l1)].push({v:node(b.id,l2),w});ADJ[node(b.id,l2)].push({v:node(a.id,l1),w})}}
const STN_NODES=new Map();NODES.forEach((n,i)=>{if(!STN_NODES.has(n.sid))STN_NODES.set(n.sid,[]);STN_NODES.get(n.sid).push(i)});

const nearStations=(p,max=2.2,n=6)=>STN.map(s=>({s,d:hav(p.lat,p.lon,s.lat,s.lon)})).filter(o=>o.d<=max).sort((a,b)=>a.d-b.d).slice(0,n);
const compass=(a,b,c,d)=>{const r=Math.PI/180,y=Math.sin((d-b)*r)*Math.cos(c*r),x=Math.cos(a*r)*Math.sin(c*r)-Math.sin(a*r)*Math.cos(c*r)*Math.cos((d-b)*r);const br=(Math.atan2(y,x)/r+360)%360;return ['north','north-east','east','south-east','south','south-west','west','north-west'][Math.round(br/45)%8]};
const fmtD=km=>km<1?`${Math.max(10,Math.round(km*100)*10)} m`:`${km<10?km.toLocaleString(locale(),{minimumFractionDigits:1,maximumFractionDigits:1}):Math.round(km)} km`;
const fmtT=m=>{m=Math.max(1,Math.round(m));return m>=60?`${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')}`:`${m} min`};

function planWalk(from,to,t=enT){
  const km=hav(from.lat,from.lon,to.lat,to.lon),rk=km*1.25,min=rk/5*60;
  const ns=nearStations(to,1.5,1)[0];
  return {mode:'walk',min,km:rk,
    steps:[{k:'walk',tx:t('plan.head',{dir:t('dir.'+compass(from.lat,from.lon,to.lat,to.lon))}),sub:t('plan.byStreet',{street:fmtD(rk),crow:fmtD(km)}),mn:fmtT(min)},
           {k:'flag',tx:t('plan.arrive',{place:to.a}),sub:ns?t('plan.nearestStation',{name:ns.s.name,d:fmtD(ns.d)}):t('plan.noStation'),mn:''}],
    geo:[{kind:'walk',pts:[[from.lat,from.lon],[to.lat,to.lon]]}]};
}
function planMetro(from,to,t=enT){
  const A=nearStations(from),B=nearStations(to);if(!A.length||!B.length)return {mode:'metro',none:true,why:!A.length?t('plan.noStationFrom'):t('plan.noStationTo')};
  const N=NODES.length,dist=new Float64Array(N).fill(Infinity),prev=new Int32Array(N).fill(-1),done=new Uint8Array(N);
  A.forEach(o=>STN_NODES.get(o.s.id).forEach(n=>{const w=walkMin(o.d)+2.5;if(w<dist[n]){dist[n]=w;prev[n]=-2}}));
  for(;;){let u=-1,b=Infinity;for(let i=0;i<N;i++)if(!done[i]&&dist[i]<b){b=dist[i];u=i}if(u<0)break;done[u]=1;for(const e of ADJ[u]){const nd=b+e.w;if(nd<dist[e.v]){dist[e.v]=nd;prev[e.v]=u}}}
  let best=-1,bt=Infinity,bd=0;
  B.forEach(o=>STN_NODES.get(o.s.id).forEach(n=>{const t=dist[n]+walkMin(o.d);if(t<bt){bt=t;best=n;bd=o.d}}));
  if(best<0||!isFinite(bt))return {mode:'metro',none:true,why:t('plan.noConnection')};
  const path=[];for(let n=best;n>=0;n=prev[n])path.unshift(n);
  const legs=[];let cur=null;
  path.forEach(i=>{const n=NODES[i];if(!cur||cur.line!==n.line){cur={line:n.line,nodes:[n]};legs.push(cur)}else cur.nodes.push(n)});
  if(legs.length===1&&legs[0].nodes.length<2)return {mode:'metro',none:true,why:t('plan.sameStation')};
  const lineName=l=>LM[l].rer?t('plan.rer',{id:l}):t('plan.line',{id:l});
  const first=NODES[path[0]].s,last=NODES[best].s,a0=A.find(o=>o.s===first),steps=[],geo=[];
  steps.push({k:'walk',tx:t('plan.walkTo',{name:first.name}),sub:t('plan.onFoot',{d:fmtD(a0?a0.d*1.25:0)}),mn:fmtT(walkMin(a0?a0.d:0)+0.01)});
  geo.push({kind:'walk',pts:[[from.lat,from.lon],[first.lat,first.lon]]});
  legs.forEach((lg,i)=>{
    const ord=LINE_ST[lg.line],ia=ord.indexOf(lg.nodes[0].s),ib=ord.indexOf(lg.nodes[lg.nodes.length-1].s);
    if(lg.nodes.length>1){
      const toward=(ib>ia?ord[ord.length-1]:ord[0]).name,stops=lg.nodes.length-1;
      let m=0;for(let j=1;j<lg.nodes.length;j++)m+=hop(lg.nodes[j-1].s,lg.nodes[j].s,lg.line);
      steps.push({k:'ride',line:lg.line,tx:t('plan.take',{line:lineName(lg.line),toward}),sub:t('plan.stopsOff',{n:stops,name:lg.nodes[lg.nodes.length-1].s.name}),mn:fmtT(m)});
      geo.push({kind:'ride',line:lg.line,pts:lg.nodes.map(n=>[n.s.lat,n.s.lon])});
    }
    const nx=legs[i+1];
    if(nx){const e=lg.nodes[lg.nodes.length-1].s,s2=nx.nodes[0].s;
      if(e.id===s2.id)steps.push({k:'change',line:nx.line,tx:t('plan.changeAt',{name:e.name}),sub:t('plan.continueOn',{line:lineName(nx.line)}),mn:fmtT(4)});
      else{const d=hav(e.lat,e.lon,s2.lat,s2.lon);steps.push({k:'change',line:nx.line,tx:t('plan.walkChange',{name:s2.name}),sub:t('plan.betweenStations',{d:fmtD(d*1.25),line:lineName(nx.line)}),mn:fmtT(4+walkMin(d))});geo.push({kind:'walk',pts:[[e.lat,e.lon],[s2.lat,s2.lon]]})}}
  });
  steps.push({k:'walk',tx:t('plan.walkToItem'),sub:t('plan.onFootFrom',{d:fmtD(bd*1.25),name:last.name}),mn:fmtT(walkMin(bd)+0.01)});
  steps.push({k:'flag',tx:t('plan.arrive',{place:to.a}),sub:'',mn:''});
  geo.push({kind:'walk',pts:[[last.lat,last.lon],[to.lat,to.lon]]});
  return {mode:'metro',min:bt,km:hav(from.lat,from.lon,to.lat,to.lon),steps,geo};
}

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
/** Profile banner colour styles (see .cover-* in index.css). */
const COVER_STYLES=['forest','coral','sand','ink','sky','plum'];
export {COVER_STYLES,ICON,CATS,ITEMS,catOf,CAT_ALL,LM,LINE_ST,STN,STNMAP,toXY,fromXY,PLACES,REGION,PARIS,SEINE,MARNE,FORESTS,hav,walkMin,nearStations,fmtD,fmtT,planWalk,planMetro,clamp};
