// Données d'exemple : bénévoles, visiteurs, trois séances passées, celle du jour et deux à venir.
// Les dates sont calculées à partir d'aujourd'hui pour que la démo reste vivante.
import { slotsOf, type CategoryId, type Outcome } from '../shared/domain.ts';
import { transaction, type Db } from './db.ts';

const PLACE = 'Maison de quartier, 12 rue des Lilas';

const VOLUNTEERS: [name: string, skills: CategoryId[], active?: boolean][] = [
  ['Michel Garnier', ['petit-electromenager', 'electronique']],
  ['Fatou Diallo', ['textile']],
  ['Bernard Lefèvre', ['velo', 'mobilier']],
  ['Julie Moreau', ['informatique', 'electronique']],
  ['Gérard Petit', ['luminaire', 'petit-electromenager', 'autre']],
  ['Inès Haddad', ['jouet', 'textile', 'autre']],
  ['Patrick Roux', ['mobilier'], false],
];

const VISITORS: [first: string, last: string, postalCode: string][] = [
  ['Claire', 'Martin', '35000'],
  ['Ahmed', 'Benali', '35200'],
  ['Sylvie', 'Durand', '35700'],
  ['Thomas', 'Bernard', '35000'],
  ['Monique', 'Robert', '35510'],
  ['Lucas', 'Richard', '35200'],
  ['Nadia', 'Mercier', '35000'],
  ['Jean-Pierre', 'Fontaine', '35740'],
  ['Emma', 'Lambert', '35700'],
  ['Yannick', 'Le Gall', '35000'],
  ['Odile', 'Chevalier', '35136'],
  ['Karim', 'Mansouri', '35200'],
  ['Léa', 'Girard', '35000'],
  ['Henri', 'Blanc', '35650'],
  ['Sophie', 'Perrin', '35000'],
  ['Marc', 'Gauthier', '35310'],
];

type Item = [category: CategoryId, object: string, brand: string | null, problem: string, outcome: Outcome, diagnosis: string, weightKg: number | null];

const ITEMS: Item[] = [
  ['petit-electromenager', 'Grille-pain', 'Moulinex', 'Ne chauffe plus', 'repaired', 'Fil de la résistance débranché, rebranché et isolé.', 1.4],
  ['petit-electromenager', 'Cafetière', 'Philips', 'Fuit sous la machine', 'repaired', 'Joint du réservoir changé (joint apporté par le visiteur).', 1.8],
  ['petit-electromenager', 'Aspirateur', 'Rowenta', "S'arrête au bout de 2 minutes", 'repairable', 'Moteur qui surchauffe : charbons usés, pièce à commander.', 5.5],
  ['petit-electromenager', 'Bouilloire', null, "Le bouton ne reste pas enclenché", 'not_repairable', 'Thermostat soudé à la base, aucune pièce disponible.', 0.9],
  ['petit-electromenager', 'Mixeur plongeant', 'Braun', 'Ne démarre pas', 'repaired', 'Fil coupé à la sortie du manche, refait.', 0.8],
  ['electronique', 'Radio-réveil', 'Sony', "Plus de son", 'repaired', 'Soudure froide sur le haut-parleur.', 0.6],
  ['electronique', 'Ampli hi-fi', 'Marantz', 'Grésille sur le canal gauche', 'repaired', 'Potentiomètre nettoyé au contact-cleaner.', 7],
  ['electronique', 'Télévision', 'Samsung', "Écran noir, le son marche", 'not_repairable', 'Rétroéclairage HS, réparation plus chère que la valeur de la télé.', 12],
  ['informatique', 'Ordinateur portable', 'Lenovo', 'Très lent', 'repaired', 'Disque dur remplacé par un SSD et Linux installé avec la visiteuse.', 2.2],
  ['informatique', 'Téléphone', 'Samsung', 'Ne charge plus', 'repaired', 'Prise de charge pleine de peluches, nettoyée.', 0.2],
  ['informatique', 'Imprimante', 'HP', 'Bourrage papier permanent', 'advice', "Rouleaux d'entraînement usés : référence et tuto donnés.", 6],
  ['luminaire', 'Lampe de chevet', null, 'Clignote', 'repaired', 'Douille changée.', 1.1],
  ['luminaire', 'Lampadaire', 'Ikea', "L'interrupteur ne marche plus", 'repaired', 'Interrupteur à pied remplacé.', 4],
  ['textile', 'Jean', 'Levis', 'Fermeture éclair cassée', 'repaired', 'Curseur remplacé.', 0.7],
  ['textile', 'Manteau', null, 'Doublure déchirée', 'repaired', 'Doublure recousue à la machine.', 1.5],
  ['textile', 'Sac à dos', 'Eastpak', 'Bretelle arrachée', 'repaired', 'Bretelle recousue avec renfort.', 0.6],
  ['velo', 'Vélo de ville', 'Peugeot', 'Freins qui ne freinent plus', 'repaired', 'Patins changés et câbles retendus.', 15],
  ['velo', 'VTT enfant', 'Btwin', 'Chaîne qui saute', 'repaired', 'Dérailleur réglé.', 9],
  ['velo', 'Trottinette électrique', 'Xiaomi', 'Ne démarre plus', 'repairable', 'Batterie à tester : à rapporter chargée à la prochaine séance.', 12],
  ['mobilier', 'Chaise en bois', null, 'Pied qui bouge', 'repaired', 'Tenon recollé et serré au serre-joint.', 4.5],
  ['mobilier', 'Tabouret', null, 'Assise fendue', 'advice', 'Expliqué comment poser une plaque de renfort.', 3],
  ['jouet', 'Voiture télécommandée', null, 'Les roues ne tournent plus', 'repaired', 'Fil du moteur ressoudé.', 0.5],
  ['jouet', 'Peluche', null, 'Œil arraché', 'repaired', 'Œil recousu.', 0.3],
  ['autre', 'Parapluie', null, 'Baleine cassée', 'not_repairable', 'Baleine en fibre éclatée, pas de pièce.', 0.4],
];

const addDays = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('sv-SE');
};

const at = (date: string, time: string, plusMinutes = 0) => {
  const d = new Date(`${date}T${time}:00`);
  d.setMinutes(d.getMinutes() + plusMinutes);
  return d.toISOString();
};

/** Pour la séance du jour : il y a quelques minutes, pour que les durées d'attente soient crédibles. */
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export function seedDemo(db: Db): void {
  transaction(db, () => {
    const volunteerIds = VOLUNTEERS.map(([name, skills, active = true]) =>
      Number(
        db
          .prepare('insert into volunteers (name, phone, email, skills, active) values (?, ?, ?, ?, ?)')
          .run(name, `06 ${String(10 + name.length).padStart(2, '0')} 42 18 ${String(name.charCodeAt(0)).slice(-2)}`, `${name.split(' ')[0]!.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')}@exemple.fr`, JSON.stringify(skills), Number(active))
          .lastInsertRowid,
      ),
    );
    const visitorIds = VISITORS.map(([first, last, postalCode], index) =>
      Number(
        db
          .prepare('insert into visitors (first_name, last_name, phone, email, postal_code, charter_accepted_at) values (?, ?, ?, ?, ?, ?)')
          .run(
            first,
            last,
            index % 3 === 2 ? null : `06 ${String(11 + index * 7).slice(-2)} ${String(23 + index * 3).slice(-2)} 45 ${String(60 + index).slice(-2)}`,
            index % 3 === 1 ? null : `${first.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')}.${last.toLowerCase().replace(/\s/g, '')}@exemple.fr`,
            postalCode,
            new Date().toISOString(),
          ).lastInsertRowid,
      ),
    );

    const session = (days: number, notes: string | null = null) => {
      const date = addDays(days);
      const sessionId = Number(
        db.prepare('insert into sessions (date, start_time, end_time, place, slot_minutes, per_slot, notes) values (?, ?, ?, ?, ?, ?, ?)').run(date, '14:00', '18:00', PLACE, 30, 3, notes).lastInsertRowid,
      );
      return { id: sessionId, date, slots: slotsOf({ startTime: '14:00', endTime: '18:00', slotMinutes: 30 }) };
    };

    const volunteerFor = (category: CategoryId, n: number) => {
      const able = VOLUNTEERS.flatMap(([, skills, active = true], i) => (active && skills.includes(category) ? [volunteerIds[i]!] : []));
      return able[n % able.length] ?? volunteerIds[0]!;
    };

    const repair = (
      s: { id: number; date: string },
      n: number,
      slot: string | null,
      status: 'booked' | 'waiting' | 'in_progress' | 'done' | 'no_show' | 'cancelled',
      item: Item,
    ) => {
      const [category, object, brand, problem, outcome, diagnosis, weightKg] = item;
      const time = slot ?? '15:00';
      const arrived = status === 'waiting' || status === 'in_progress' || status === 'done';
      const started = status === 'in_progress' || status === 'done';
      // Séance du jour : horodatages relatifs à maintenant (plus ancien pour les terminés).
      const live = s.date === addDays(0);
      const stamp = (plusMinutes: number) => (live ? minutesAgo({ done: 90, in_progress: 50, waiting: 25 }[status as 'done'] - plusMinutes + (n % 3) * 4) : at(s.date, time, plusMinutes));
      db.prepare(
        `insert into repairs (visitor_id, session_id, slot_time, category, object, brand, age_years, problem, weight_kg, status,
          volunteer_id, outcome, diagnosis, donation_cents, arrived_at, started_at, ended_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        visitorIds[n % visitorIds.length]!,
        s.id,
        slot,
        category,
        object,
        brand,
        (n * 3) % 15 || null,
        problem,
        status === 'done' && n % 4 !== 0 ? weightKg : null,
        status,
        status === 'in_progress' || status === 'done' ? volunteerFor(category, n) : null,
        status === 'done' ? outcome : null,
        status === 'done' ? diagnosis : null,
        status === 'done' ? [0, 200, 500, 300, 1000, 0][n % 6]! : null,
        arrived ? stamp(0) : null,
        started ? stamp(15) : null,
        status === 'done' ? stamp(50) : null,
      );
    };

    // Trois séances passées, toutes terminées.
    let n = 0;
    for (const [days, count] of [
      [-63, 11],
      [-35, 13],
      [-14, 12],
    ] as const) {
      const past = session(days);
      for (let k = 0; k < count; k++, n++) {
        const status = k === count - 1 ? 'no_show' : 'done';
        repair(past, n, k % 4 === 3 ? null : past.slots[k % past.slots.length]!, status, ITEMS[(n * 7) % ITEMS.length]!);
      }
    }

    // La séance du jour, en cours.
    const day = session(0, 'Pensez à sortir la caisse à outils vélo.');
    const plan: ['booked' | 'waiting' | 'in_progress' | 'done' | 'no_show', string | null][] = [
      ['done', '14:00'],
      ['done', '14:00'],
      ['no_show', '14:00'],
      ['in_progress', '14:30'],
      ['in_progress', '14:30'],
      ['waiting', '15:00'],
      ['waiting', null],
      ['booked', '15:30'],
      ['booked', '15:30'],
      ['booked', '16:00'],
      ['booked', '17:00'],
    ];
    plan.forEach(([status, slot], k) => repair(day, n + k, slot, status, ITEMS[(k * 5 + 4) % ITEMS.length]!));
    n += plan.length;

    // Deux séances à venir, avec quelques réservations.
    const next = session(14);
    ['14:00', '14:00', '14:30', '16:00'].forEach((slot, k) => repair(next, n + k, slot, 'booked', ITEMS[(k * 11 + 1) % ITEMS.length]!));
    session(28, 'Séance spéciale vélos avec l’atelier du quartier.');
  });
}
