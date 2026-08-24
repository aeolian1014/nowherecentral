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
  [
    'SHO-2244',
    'One (1) pair of shoes. Still wet.',
    'They walked somebody home and came back on their own. The road is still out there. It does not need you on it tonight.',
  ],
  [
    'CTY-0700',
    'A view from a window that was never yours.',
    'Counted every lit floor of it for a year. Every one of those lights is somebody else also still up. You were never the only one.',
  ],
  [
    'TPE-1988',
    'A tape, unlabelled. Recorded over something.',
    'Whatever was on it first is gone and is not recoverable. It still plays. Most things you have taped over are fine.',
  ],
];

/* ------------------------------------------------------------------
   ARRIVALS

   The departures board sends you to places that were invented. This
   one lists services inbound from places you actually had, and not
   one of them is going to land. Every value in the status column is a
   way of saying no, and the platform column is a dash on every line,
   because nothing is being held for any of them.

   Names are capped at COLS.dest (16) and statuses at COLS.status (9),
   and the split-flap CHARSET has no apostrophe — anything outside it
   is dropped silently by FlapLine._fit, so it is written out here.
------------------------------------------------------------------ */
export const ARRIVALS = [
  {
    id: 'midnight',
    code: 'MDR',
    name: 'MIDNIGHT DRIVE',
    platform: '1',
    offset: 3,   // minutes from load, like the world board

    status: 'DELAYED',
    note: 'Delayed. Nobody has driven it since. The road is still lit the whole way out.',
    line: 'The service from the midnight drive is delayed. No revised time is available.',
    media: {
      type: 'image',
      src: 'assets/media/midnight-drive.webp',
      audio: 'assets/media/midnight-drive.opus',
      cues: true,        // the night programme runs here and nowhere else
    },
  },
  {
    id: 'horizon',
    code: 'EVH',
    name: 'EVENT HORIZON',
    platform: '4',
    offset: 9,   // minutes from load, like the world board

    status: 'CANCELLED',
    note: 'Cancelled. Everything that ever went that way is still going. None of it has arrived.',
    line: 'The service to the event horizon has been cancelled. It will not be rescheduled.',
    media: {
      type: 'video',
      src: 'assets/media/event-horizon.mp4',
      audio: 'assets/media/event-horizon.opus',
    },
  },
  {
    id: 'tuesday',
    code: 'TMR',
    name: 'TUESDAY IN MARCH',
    platform: '5',
    offset: 16,   // minutes from load, like the world board

    status: 'HELD',
    note: 'Held outside the station. An ordinary day you would give a great deal to stand in again.',
    line: 'The service from that Tuesday in March is being held outside the station.',
    media: {
      type: 'video',
      src: 'assets/media/gradient-girl.mp4',
      audio: 'assets/media/tuesday-in-march.opus',
    },
  },
  {
    id: 'goodyear',
    code: 'LGY',
    name: 'LAST GOOD YEAR',
    platform: '6',
    offset: 24,   // minutes from load, like the world board

    status: 'NO REPORT',
    note: 'No report. You did not know it was the last one. Nobody is ever told at the time.',
    line: 'There is no report on the service from the last good year.',
    media: {
      type: 'image',
      src: 'assets/media/heavenly-sky.webp',
      audio: 'assets/media/last-good-year.opus',
    },
  },
  {
    id: 'whoever',
    code: 'WYW',
    name: 'WHOEVER YOU WERE',
    platform: '8',
    offset: 33,   // minutes from load, like the world board

    status: 'LATE',
    note: 'Running late. Running very late. You would not recognise them at the barrier now anyway.',
    line: 'The service carrying whoever you were then is running late.',
    media: {
      type: 'image',
      src: 'assets/media/egirl.webp',
      fx: 'tape',
      audio: 'assets/media/whoever-you-were.opus',
    },
  },
  {
    id: 'spring',
    code: 'ASP',
    name: 'ANOTHER SPRING',
    platform: '9',
    offset: 47,   // minutes from load, like the world board

    status: 'NOT KNOWN',
    note: 'Not known. It belonged to somebody else and you only ever watched it from the platform.',
    line: 'The status of the service from another spring is not known.',
    media: {
      type: 'image',
      src: 'assets/media/haunted-hood.webp',
      audio: 'assets/media/another-spring.opus',
    },
  },
  {
    id: 'summer',
    code: 'EVS',
    name: 'EVERY SUMMER',
    platform: '10',
    offset: 62,   // minutes from load, like the world board

    status: 'AWAITED',
    note: 'Awaited. All of them at once, arriving on one train, which is not a thing trains can do.',
    line: 'Every summer is still awaited. They are expected to arrive together.',
    media: {
      type: 'video',
      src: 'assets/media/ancient-love.mp4',
      audio: 'assets/media/every-summer.opus',
    },
  },
];

/* ------------------------------------------------------------------
   NIGHT PROGRAMME — what the station says over the bed

   Each entry is a file in assets/voice/ — ogg, opus, wav, mp3, m4a or
   flac, the name does not matter. Filenames below are only examples;
   point them at whatever is actually in the folder.

   Playback is band-limited to 380–3200 Hz with a short tail before it
   reaches the speakers, and the bed ducks underneath. That filtering
   is what makes a line sit inside the music rather than on top of it:
   the chest and the air are what give a close-mic'd voice away as a
   separate source. Nothing routes through the tannoy rig, so there is
   no relay click and no carrier hiss.

   OPENER runs first, its `after` being the silence held once the clip
   has finished. Then LINES play one a minute. After the last one the
   opener comes back round, so the sequence never quite resolves.

   A plain string instead of { src } falls back to speech synthesis.
------------------------------------------------------------------ */
/* Played first, in this order. There is no burst any more — every cue
   in both lists is a minute apart, including these. */
export const NIGHT_OPENER = [
  { src: 'assets/voice/one.mp3' },
  { src: 'assets/voice/two.ogg' },
  { src: 'assets/voice/three.mp3' },
  { src: 'assets/voice/four.mp3' },
];

/* The rest of the rotation. After the last one there is one more
   minute and the list starts again from the top of NIGHT_OPENER. */
export const NIGHT_LINES = [
  { src: 'assets/voice/five.ogg' },
  { src: 'assets/voice/six.ogg' },
  { src: 'assets/voice/seven.ogg' },
  { src: 'assets/voice/eight.ogg' },
];

/* What the announcer says when somebody keeps pressing an arrival
   that is never going to come in. */
export const ARRIVAL_REFUSALS = [
  'That service is not expected.',
  'There is nothing further on that one.',
  'It is not coming in tonight. You can stop watching the board.',
  'The board has told you everything it knows.',
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
