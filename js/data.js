/* ------------------------------------------------------------------
   NOWHERE CENTRAL — destination register
   Every value here is fiction. The times are not.
------------------------------------------------------------------ */

export const STATION = {
  name: 'NOWHERE CENTRAL',
  strap: 'Terminus for services that do not arrive',
  founded: 'OPERATING SINCE — RECORDS INCOMPLETE',
};

/* Offsets in minutes from the moment the page loads, so the board is
   always plausibly live. Departure times are generated, never stored. */
export const DESTINATIONS = [
  {
    id: 'glass',
    code: 'GLS',
    name: 'THE GLASS SEA',
    platform: '3',
    offset: 4,
    status: 'BOARDING',
    world: 'glass',
    strap: 'An ocean with no floor and no salt.',
    prose:
      'It remembers being a window. On still days you can see the room it used to look into — a kitchen, a chair pushed back, someone about to sit down. The water has never once broken the surface tension of that memory.',
    hue: 196,
    conditions: [
      ['TEMPERATURE', '11°', 'and falling, politely'],
      ['WIND', '4 kn', 'from the year before'],
      ['VISIBILITY', 'FAR', 'as far as you are willing'],
      ['SWELL', '1.2 m', 'measured in regret'],
      ['SURFACE', 'GLASS', 'do not knock'],
    ],
    advisory: 'Passengers are reminded not to look for their own reflection.',
  },
  {
    id: 'dunes',
    code: 'VBD',
    name: 'VANTABLACK DUNES',
    platform: '7',
    offset: 12,
    status: 'ON TIME',
    world: 'dunes',
    strap: 'Sand that eats its own shadow.',
    prose:
      'Light arrives here and does not leave. The dunes move at the speed of a rumour. Survey teams have mapped the region four times and produced four entirely different maps, all of them correct.',
    hue: 24,
    conditions: [
      ['TEMPERATURE', '61°', 'none of it warm'],
      ['WIND', '30 kn', 'abrasive, personal'],
      ['VISIBILITY', 'THEORY', 'unconfirmed by instruments'],
      ['ALBEDO', '0.00', 'nothing comes back'],
      ['SHADOW', 'NONE', 'consumed on arrival'],
    ],
    advisory: 'Do not attempt to leave footprints. They will be kept.',
  },
  {
    id: 'spire',
    code: 'HSP',
    name: 'HOLLOW SPIRE',
    platform: '0',
    offset: 19,
    status: 'DELAYED',
    world: 'spire',
    strap: 'A stairwell whose top floor has never been reached.',
    prose:
      'Eleven thousand recorded ascents. Eleven thousand returns. Every climber reports the same thing: the light gets better the higher you go, and the stairs get easier, and at some point you simply decide to come back down, and you cannot say why.',
    hue: 44,
    conditions: [
      ['TEMPERATURE', '4°', 'constant at all heights'],
      ['WIND', 'RISING', 'always, from below'],
      ['VISIBILITY', '1 FLT', 'one flight, no more'],
      ['FLOORS', '∞', 'approximate'],
      ['ECHO', '9.4 s', 'longer going up'],
    ],
    advisory: 'The handrail is load-bearing for reasons that are not structural.',
  },
  {
    id: 'noon',
    code: 'LNN',
    name: 'THE LONG NOON',
    platform: '2',
    offset: 28,
    status: 'IMMINENT',
    world: 'noon',
    strap: 'Three in the afternoon, permanently.',
    prose:
      'School let out and never resumed. The grass is the exact height it was. Somewhere behind the hedge a sprinkler is running and has been running since before anyone thought to time it. Nobody here is unhappy. Nobody here is finished.',
    hue: 46,
    conditions: [
      ['TEMPERATURE', '27°', 'golden, unbearable'],
      ['WIND', '2 kn', 'warm, carrying pollen'],
      ['VISIBILITY', 'PERFECT', 'painfully so'],
      ['LOCAL TIME', '15:04', 'always'],
      ['POLLEN', 'HIGH', 'and beautiful'],
    ],
    advisory: 'Return services depart hourly. None have ever been used.',
  },
  {
    id: 'null',
    code: 'NUL',
    name: 'NULLPOINT',
    platform: '—',
    offset: 41,
    status: 'UNKNOWN',
    world: 'null',
    strap: 'The space between two stations.',
    prose:
      'Nobody has ever bought a ticket to Nullpoint. Everybody has been. It is the four seconds when the carriage lights cut out in the tunnel and the window becomes a mirror and the mirror is not quite keeping up with you.',
    hue: 0,
    conditions: [
      ['TEMPERATURE', '—', 'not applicable'],
      ['WIND', '—', 'no medium'],
      ['VISIBILITY', '—', 'no observers'],
      ['SIGNAL', '0.0 dB', 'carrier only'],
      ['DURATION', '4 s', 'every time'],
    ],
    advisory: 'This service is not listed. Please do not ask staff about it.',
  },
  {
    id: 'inverted',
    code: 'INV',
    name: 'THE INVERTED SEA',
    platform: '11',
    offset: 57,
    status: 'ARRIVING',
    world: 'inverted',
    strap: 'The ocean is on the ceiling. The rain falls up.',
    prose:
      'The seabed is dry and cracked and full of things that were dropped from above. Look up and the whole weight of the Atlantic is hanging there, perfectly calm, deciding. It has been deciding for a very long time.',
    hue: 172,
    conditions: [
      ['TEMPERATURE', '9°', 'and hanging'],
      ['WIND', '12 kn', 'downward-up'],
      ['VISIBILITY', 'SUBMRGD', 'from underneath'],
      ['TIDE', 'OVERHEAD', 'high, always'],
      ['PRESSURE', '4.1 atm', 'above you'],
    ],
    advisory: 'Umbrellas are provided. They are worn upside down.',
  },
];

export const STATUSES = [
  'ON TIME',
  'BOARDING',
  'DELAYED',
  'IMMINENT',
  'ARRIVING',
  'UNKNOWN',
  'REROUTED',
  'HELD',
];

/* [reference, what it is, what the clerk says when you pick it up]
   The third line is the doorway: each object is an excuse to ask you
   what you are still holding on to at one in the morning. */
export const LOST_AND_FOUND = [
  [
    'UMB-0041',
    'One (1) umbrella. Black. Unopened. Bone dry.',
    'Carried every day for a year against rain that never came. Most of what we hold is like this.',
  ],
  [
    'GLV-0118',
    'A single glove. Right hand. Still warm.',
    'Its pair is not here and is not coming. Some things are only ever going to be one of two.',
  ],
  [
    'TUE-4207',
    'Four point two hours of somebody’s Tuesday.',
    'Handed in at midnight, unspent. Nobody has come back for them, and nobody ever does.',
  ],
  [
    'KEY-0003',
    'A key to a door demolished in 1974.',
    'It still turns. There is simply nothing left for it to turn in. You can put it down.',
  ],
  [
    'SNG-0862',
    'The last verse of a song you almost remember.',
    'Chasing it will keep you awake until four. Leave it with us and it will come to you on its own.',
  ],
  [
    'NAM-0001',
    'One (1) name. No longer attached to anyone.',
    'Said aloud once too often, and then not at all. We will keep saying it so you do not have to.',
  ],
  [
    'PHT-5510',
    'A photograph. Everyone in it is looking slightly left.',
    'At something outside the frame that none of them can remember now. Neither can you. That is allowed.',
  ],
  [
    'TKT-∞',
    'A return ticket. Undated. Unused. Unrefundable.',
    'Kept in case. It has never once been needed. It is very heavy for a piece of card.',
  ],
];

/* Rotated on the deposit slip, so the counter never asks twice the
   same way. Cognitive offloading before sleep is a real technique;
   this is only the station's way of phrasing it. */
export const COUNTER_PROMPTS = [
  'What are you still carrying?',
  'What is it you keep picking back up?',
  'What would you rather not take to bed with you?',
  'What is still open that could be closed until morning?',
  'What are you turning over that will not turn any further tonight?',
];

export const NOTICES = [
  'The 15:04 to THE LONG NOON is running to schedule and always will be.',
  'Platform 0 is accessible only from Platform 0.',
  'Passengers are reminded that the announcement is not for them.',
  'Would the owner of the umbrella please stop coming back for it.',
  'Services to NULLPOINT are not services.',
  'Please mind the gap. The gap does not mind you.',
  'Lost property is held for thirty days, or until claimed by someone else.',
  'The station clock is correct. Everything else is negotiable.',
];
