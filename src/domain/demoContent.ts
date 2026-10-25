/**
 * Demo dataset content (features §8.1 "Load demo data": ~15 contacts with moments, reminders, gifts,
 * relationships). Pure data; `db/repositories/demoService.ts` saves it through the normal services so every
 * derived record (reminders, index, lastInteractionAt) is consistent. Text exists in English and Spanish.
 */
import type { Locale } from './settings';
import type { MomentKind, RelationshipType } from './types';

export interface DemoPerson {
  key: string;
  firstName: string;
  lastName?: string;
  nickname?: string;
  birthday?: { month: number; day: number; year?: number };
  company?: string;
  jobTitle?: string;
  city?: string;
  email?: string;
  phone?: string;
  bio?: string;
  stayInTouchDays?: number;
  starred?: boolean;
  groups?: ('family' | 'bookclub' | 'work')[];
}

export interface DemoMoment {
  kind: MomentKind;
  daysAgo: number;
  /** `{name}` placeholders become @mentions; `#tag` placeholders become tags. */
  text: string;
  people: string[];
  tags?: string[];
  location?: string;
  activityType?: 'meal' | 'coffee' | 'drinks' | 'trip' | 'event' | 'sport' | 'visit' | 'other';
  lifeEventType?: 'new-job' | 'moved' | 'engaged' | 'married' | 'baby' | 'graduated';
  callDirection?: 'incoming' | 'outgoing';
  mood?: 1 | 2 | 3 | 4 | 5;
}

const people: DemoPerson[] = [
  {
    key: 'elise',
    firstName: 'Élise',
    lastName: 'Aubert',
    nickname: 'lise',
    city: 'Lyon',
    email: 'elise@example.com',
    birthday: { month: 3, day: 18, year: 1987 },
    jobTitle: 'Chef',
    company: 'Le Petit Sud',
    stayInTouchDays: 30,
    starred: true,
    groups: ['bookclub'],
  },
  {
    key: 'marc',
    firstName: 'Marc',
    lastName: 'Aubert',
    city: 'Lyon',
    phone: '+33 6 12 34 56 78',
    birthday: { month: 11, day: 2, year: 1984 },
    groups: ['family'],
  },
  {
    key: 'zoe',
    firstName: 'Zoé',
    lastName: 'Martin',
    city: 'London',
    email: 'zoe@example.com',
    birthday: { month: 7, day: 2 },
    stayInTouchDays: 14,
    starred: true,
  },
  {
    key: 'jose',
    firstName: 'José',
    lastName: 'López',
    company: 'Contoso',
    jobTitle: 'Designer',
    city: 'Madrid',
    groups: ['work'],
  },
  {
    key: 'ana',
    firstName: 'Ana',
    lastName: 'García',
    city: 'Sevilla',
    birthday: { month: 12, day: 24, year: 1990 },
    groups: ['bookclub'],
    stayInTouchDays: 60,
  },
  {
    key: 'bruno',
    firstName: 'Bruno',
    lastName: 'Rossi',
    company: 'Acme',
    jobTitle: 'Engineer',
    groups: ['work'],
  },
  { key: 'chloe', firstName: 'Chloé', lastName: 'Bernard', city: 'Nantes', groups: ['bookclub'] },
  {
    key: 'mum',
    firstName: 'Isabel',
    lastName: 'Ruiz',
    nickname: 'mamá',
    city: 'Valencia',
    phone: '+34 600 11 22 33',
    birthday: { month: 5, day: 9, year: 1958 },
    stayInTouchDays: 7,
    starred: true,
    groups: ['family'],
  },
  {
    key: 'dad',
    firstName: 'Antonio',
    lastName: 'Ruiz',
    city: 'Valencia',
    birthday: { month: 9, day: 30, year: 1955 },
    groups: ['family'],
  },
  {
    key: 'sis',
    firstName: 'Lucía',
    lastName: 'Ruiz',
    city: 'Barcelona',
    birthday: { month: 1, day: 15, year: 1993 },
    groups: ['family'],
  },
  {
    key: 'hugo',
    firstName: 'Hugo',
    lastName: 'Laurent',
    city: 'Paris',
    company: 'Globex',
    jobTitle: 'Manager',
    groups: ['work'],
  },
  {
    key: 'ines',
    firstName: 'Inès',
    lastName: 'Moreau',
    city: 'Bordeaux',
    email: 'ines@example.com',
  },
  { key: 'mateo', firstName: 'Mateo', lastName: 'Navarro', city: 'Porto', stayInTouchDays: 90 },
  {
    key: 'lea',
    firstName: 'Léa',
    lastName: 'Petit',
    nickname: 'leap',
    birthday: { month: 2, day: 29 },
  },
  {
    key: 'oscar',
    firstName: 'Óscar',
    lastName: 'Fernández',
    company: 'Hooli',
    jobTitle: 'Founder',
    city: 'Bilbao',
  },
];

export const demoRelationships: [string, string, RelationshipType][] = [
  ['elise', 'marc', 'sibling'],
  ['sis', 'mum', 'parent'],
  ['sis', 'dad', 'parent'],
  ['mum', 'dad', 'spouse'],
  ['elise', 'zoe', 'best-friend'],
  ['jose', 'bruno', 'colleague'],
  ['hugo', 'jose', 'boss'],
  ['ana', 'chloe', 'friend'],
];

const text = {
  en: {
    bios: {
      elise: 'Old friend from Lyon. Thinking about moving back.',
      zoe: 'Met at university. Loves jazz.',
    },
    groups: { family: 'Family', bookclub: 'Book club', work: 'Work' },
    moments: [
      {
        kind: 'activity',
        daysAgo: 2,
        text: 'Coffee with {elise} — she might move back to Lyon. Ask about the job in March. #family',
        people: ['elise'],
        tags: ['family'],
        location: 'Le Petit Sud',
        activityType: 'coffee',
      },
      {
        kind: 'call',
        daysAgo: 4,
        text: 'Long call with {mum}. Her knee is better; she wants to visit in spring.',
        people: ['mum'],
        callDirection: 'incoming',
      },
      {
        kind: 'note',
        daysAgo: 6,
        text: '{jose} recommended "The Design of Everyday Things". #books',
        people: ['jose'],
        tags: ['books'],
      },
      {
        kind: 'activity',
        daysAgo: 9,
        text: "Book club at {ana}'s: we finished Dune. {chloe} hated the ending. #books",
        people: ['ana', 'chloe'],
        tags: ['books'],
        activityType: 'event',
      },
      {
        kind: 'journal',
        daysAgo: 10,
        text: 'Quiet weekend. Grateful for good friends.',
        people: [],
        mood: 4,
      },
      {
        kind: 'life-event',
        daysAgo: 15,
        text: '{zoe} started a new job at a record label in London! #work',
        people: ['zoe'],
        tags: ['work'],
        lifeEventType: 'new-job',
      },
      {
        kind: 'activity',
        daysAgo: 21,
        text: 'Dinner with {marc} and {elise}. Marc is training for a marathon.',
        people: ['marc', 'elise'],
        activityType: 'meal',
        location: 'Lyon',
      },
      {
        kind: 'call',
        daysAgo: 25,
        text: 'Called {dad} for his advice on the car.',
        people: ['dad'],
        callDirection: 'outgoing',
      },
      {
        kind: 'note',
        daysAgo: 33,
        text: '{lea} is allergic to peanuts — remember for the party.',
        people: ['lea'],
      },
      {
        kind: 'activity',
        daysAgo: 40,
        text: 'Drinks with {hugo} and {bruno} after the offsite. #work',
        people: ['hugo', 'bruno'],
        tags: ['work'],
        activityType: 'drinks',
      },
      {
        kind: 'life-event',
        daysAgo: 55,
        text: '{sis} moved to Barcelona.',
        people: ['sis'],
        lifeEventType: 'moved',
        location: 'Barcelona',
      },
      {
        kind: 'activity',
        daysAgo: 70,
        text: 'Hiked with {mateo} near Porto. #travel',
        people: ['mateo'],
        tags: ['travel'],
        activityType: 'sport',
        location: 'Porto',
      },
      {
        kind: 'note',
        daysAgo: 95,
        text: '{ines} is looking for a flat in Bordeaux.',
        people: ['ines'],
      },
      {
        kind: 'activity',
        daysAgo: 120,
        text: 'Visited {mum} and {dad} for their anniversary. #family',
        people: ['mum', 'dad'],
        tags: ['family'],
        activityType: 'visit',
        location: 'Valencia',
      },
      {
        kind: 'call',
        daysAgo: 150,
        text: 'Quick catch-up with {oscar}; his startup raised a round.',
        people: ['oscar'],
        callDirection: 'incoming',
      },
    ] satisfies DemoMoment[],
    reminders: [
      { title: 'Send {elise} the photos from Lyon', daysFromNow: 0, person: 'elise' },
      { title: 'Water the plants', daysFromNow: 2, recurrence: 'weekly' as const },
      { title: 'Ask {zoe} how the new job is going', daysFromNow: 5, person: 'zoe' },
    ],
    gifts: [
      { person: 'mum', name: 'Gardening gloves', status: 'idea' as const, occasion: 'Birthday' },
      {
        person: 'elise',
        name: 'Jazz vinyl',
        status: 'bought' as const,
        price: 28,
        occasion: 'Birthday',
      },
      { person: 'zoe', name: 'Concert tickets', status: 'given' as const, price: 60 },
    ],
    debts: [
      { person: 'bruno', direction: 'they-owe' as const, amount: 35, reason: 'Concert tickets' },
      { person: 'elise', direction: 'i-owe' as const, amount: 12.5, reason: 'Lunch' },
    ],
    tasks: [
      { title: 'Book flights to Lyon', person: 'elise' },
      { title: 'Return the drill', person: 'dad' },
      { title: 'Plan the book club next month' },
    ],
    goals: [
      {
        title: 'Visit Élise in Lyon',
        why: 'Friendships need time together, not only messages.',
        nextAction: 'Pick two weekends that work',
        daysAhead: 60,
        people: ['elise'],
        milestones: ['Agree on dates', 'Book the trip'],
      },
    ],
    pets: [{ person: 'elise', name: 'Miso', species: 'Cat' }],
    importantDates: [
      { person: 'mum', label: 'Wedding anniversary', month: 6, day: 14, year: 1982 },
    ],
  },
  es: {
    bios: {
      elise: 'Amiga de Lyon. Se plantea volver.',
      zoe: 'Nos conocimos en la universidad. Le encanta el jazz.',
    },
    groups: { family: 'Familia', bookclub: 'Club de lectura', work: 'Trabajo' },
    moments: [
      {
        kind: 'activity',
        daysAgo: 2,
        text: 'Café con {elise}: puede que vuelva a Lyon. Preguntarle por el trabajo en marzo. #familia',
        people: ['elise'],
        tags: ['familia'],
        location: 'Le Petit Sud',
        activityType: 'coffee',
      },
      {
        kind: 'call',
        daysAgo: 4,
        text: 'Larga llamada con {mum}. La rodilla va mejor; quiere venir en primavera.',
        people: ['mum'],
        callDirection: 'incoming',
      },
      {
        kind: 'note',
        daysAgo: 6,
        text: '{jose} me recomendó «La psicología de los objetos cotidianos». #libros',
        people: ['jose'],
        tags: ['libros'],
      },
      {
        kind: 'activity',
        daysAgo: 9,
        text: 'Club de lectura en casa de {ana}: terminamos Dune. A {chloe} no le gustó el final. #libros',
        people: ['ana', 'chloe'],
        tags: ['libros'],
        activityType: 'event',
      },
      {
        kind: 'journal',
        daysAgo: 10,
        text: 'Fin de semana tranquilo. Agradecido por los buenos amigos.',
        people: [],
        mood: 4,
      },
      {
        kind: 'life-event',
        daysAgo: 15,
        text: '¡{zoe} empezó en una discográfica en Londres! #trabajo',
        people: ['zoe'],
        tags: ['trabajo'],
        lifeEventType: 'new-job',
      },
      {
        kind: 'activity',
        daysAgo: 21,
        text: 'Cena con {marc} y {elise}. Marc se prepara para un maratón.',
        people: ['marc', 'elise'],
        activityType: 'meal',
        location: 'Lyon',
      },
      {
        kind: 'call',
        daysAgo: 25,
        text: 'Llamé a {dad} para pedirle consejo sobre el coche.',
        people: ['dad'],
        callDirection: 'outgoing',
      },
      {
        kind: 'note',
        daysAgo: 33,
        text: '{lea} es alérgica a los cacahuetes: recordarlo para la fiesta.',
        people: ['lea'],
      },
      {
        kind: 'activity',
        daysAgo: 40,
        text: 'Copas con {hugo} y {bruno} después del offsite. #trabajo',
        people: ['hugo', 'bruno'],
        tags: ['trabajo'],
        activityType: 'drinks',
      },
      {
        kind: 'life-event',
        daysAgo: 55,
        text: '{sis} se mudó a Barcelona.',
        people: ['sis'],
        lifeEventType: 'moved',
        location: 'Barcelona',
      },
      {
        kind: 'activity',
        daysAgo: 70,
        text: 'Ruta con {mateo} cerca de Oporto. #viajes',
        people: ['mateo'],
        tags: ['viajes'],
        activityType: 'sport',
        location: 'Porto',
      },
      { kind: 'note', daysAgo: 95, text: '{ines} busca piso en Burdeos.', people: ['ines'] },
      {
        kind: 'activity',
        daysAgo: 120,
        text: 'Visité a {mum} y {dad} por su aniversario. #familia',
        people: ['mum', 'dad'],
        tags: ['familia'],
        activityType: 'visit',
        location: 'Valencia',
      },
      {
        kind: 'call',
        daysAgo: 150,
        text: 'Charla rápida con {oscar}: su startup ha cerrado una ronda.',
        people: ['oscar'],
        callDirection: 'incoming',
      },
    ] satisfies DemoMoment[],
    reminders: [
      { title: 'Mandar a {elise} las fotos de Lyon', daysFromNow: 0, person: 'elise' },
      { title: 'Regar las plantas', daysFromNow: 2, recurrence: 'weekly' as const },
      { title: 'Preguntar a {zoe} qué tal el trabajo nuevo', daysFromNow: 5, person: 'zoe' },
    ],
    gifts: [
      {
        person: 'mum',
        name: 'Guantes de jardinería',
        status: 'idea' as const,
        occasion: 'Cumpleaños',
      },
      {
        person: 'elise',
        name: 'Vinilo de jazz',
        status: 'bought' as const,
        price: 28,
        occasion: 'Cumpleaños',
      },
      { person: 'zoe', name: 'Entradas de concierto', status: 'given' as const, price: 60 },
    ],
    debts: [
      {
        person: 'bruno',
        direction: 'they-owe' as const,
        amount: 35,
        reason: 'Entradas de concierto',
      },
      { person: 'elise', direction: 'i-owe' as const, amount: 12.5, reason: 'Comida' },
    ],
    tasks: [
      { title: 'Reservar vuelos a Lyon', person: 'elise' },
      { title: 'Devolver el taladro', person: 'dad' },
      { title: 'Organizar el club de lectura del mes que viene' },
    ],
    goals: [
      {
        title: 'Visitar a Élise en Lyon',
        why: 'Las amistades necesitan tiempo juntos, no solo mensajes.',
        nextAction: 'Elegir dos fines de semana posibles',
        daysAhead: 60,
        people: ['elise'],
        milestones: ['Acordar las fechas', 'Reservar el viaje'],
      },
    ],
    pets: [{ person: 'elise', name: 'Miso', species: 'Gato' }],
    importantDates: [
      { person: 'mum', label: 'Aniversario de boda', month: 6, day: 14, year: 1982 },
    ],
  },
};

export function demoContent(locale: Locale) {
  return { people, relationships: demoRelationships, ...text[locale] };
}
