// The story: four jobs for Tía Carmen, who holds every debt and every
// favour in Marina Solis, then an endless string of side jobs. A mission is
// a list of stages; each stage names a kind, a place, the line the HUD
// shows, and the hooks (timer, ambush, crime, heat floor) the world applies
// while it is active. world.js walks the stages.
import { PLACES } from './city.js';

export const GO_TO = 'go-to'; // be inside the marker, on foot or driving
export const BRING_CAR = 'bring-car'; // arrive inside the marker, in a car
export const HOLD_SPOT = 'hold-spot'; // stay in the marker until the ring fills
export const GO_DARK = 'go-dark'; // get the wanted level back to zero

export const STORY = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Tía Carmen',
    intro: 'Rafi. You owe me two months on the crash pad. Earn it back: bring me a car — any car that runs — to Vela\'s Chop Shop by the marina. Vela pays cash, I forget the rent.',
    reward: 350,
    stages: [
      { kind: GO_TO, at: PLACES.mercado, text: 'Meet Tía Carmen at the Mercado del Sol', done: 'Carmen: "Any car, Rafi. The keys are a detail."' },
      { kind: BRING_CAR, at: PLACES.chopShop, text: 'Steal a car and deliver it to Vela\'s Chop Shop', done: 'Vela counts the cash out slow, like always.' },
    ],
    outro: 'Carmen, by phone: "Good. You can still drive. Keep your ears open — work finds you."',
  },
  {
    id: 'cold-box',
    title: 'The Cold Box',
    giver: 'Tía Carmen',
    intro: 'A refrigerated box came in at Coral Marina, Dock 3. Pick it up and take it to Dr. Ives at the Miramar Clinic, fast and cold. Do not ask what is in it. I did not.',
    reward: 600,
    stages: [
      { kind: GO_TO, at: PLACES.marina, text: 'Pick up the cold box at Coral Marina, Dock 3', done: 'The dockmaster\'s hands shake. Behind you, a siren clears its throat — the box was hot.', ambush: 2 },
      { kind: GO_TO, at: PLACES.clinic, text: 'Deliver the cold box to Dr. Ives at Miramar Clinic', time: 150, done: 'Dr. Ives signs without looking up: "You just saved someone you will never meet."' },
    ],
    outro: 'Carmen: "Whatever it was, it is delivered. That is the whole job, every time."',
  },
  {
    id: 'sunset-pawn',
    title: 'Sunset Pawn',
    giver: 'Tía Carmen',
    intro: 'The Sunset Pawn holds a guitar that belonged to my brother. The owner will not sell. So: walk in, take it off the wall, and then make the Solis PD forget your face. Come back to me clean.',
    reward: 900,
    stages: [
      { kind: HOLD_SPOT, at: PLACES.pawn, text: 'Take the guitar from Sunset Pawn (stay in the marker)', holdSeconds: 4, crime: 'robbery', done: 'The alarm goes off like it has been waiting years to sing.' },
      { kind: GO_DARK, at: null, text: 'Lose the police — get your wanted level to zero', done: 'Quiet streets. Your face is your own again.' },
      { kind: GO_TO, at: PLACES.mercado, text: 'Bring the guitar back to Tía Carmen', done: 'Carmen holds the guitar a long moment. "He played terribly," she says. "Worth every star."' },
    ],
    outro: 'Carmen: "One more run, Rafi, and the town is yours. Rest. I will call."',
  },
  {
    id: 'neon-heat-run',
    title: 'The Neon Heat Run',
    giver: 'Tía Carmen',
    intro: 'Last job. A singer at the Old Lighthouse needs to be at Solis Airfield before her plane, and half the town wants her stopped. Pick her up, keep her safe, and do not be late. The PD will be listening — stay hot and stay moving.',
    reward: 1500,
    stages: [
      { kind: GO_TO, at: PLACES.lighthouse, text: 'Pick up the singer at Old Lighthouse Point', done: '"You\'re late," says Val Marín, climbing in. "Drive like the song depends on it."' },
      { kind: GO_TO, at: PLACES.airfield, text: 'Get Val Marín to Solis Airfield Gate', time: 180, heatFloor: 3, done: 'Val waves from the gate, already a rumour. The town exhales.' },
    ],
    outro: 'Carmen: "Solis is yours now, Rafi. Take work when you want it. The phone stays on."',
  },
];

// A repeatable job once the story is told: fetch from one landmark, deliver
// to another, against a clock priced by the distance.
export function sideJob(rng, places) {
  const from = rng.pick(places);
  let to = rng.pick(places);
  if (to === from) to = places[(places.indexOf(from) + 3) % places.length];
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    id: 'side-job',
    title: 'Solis Side Job',
    giver: 'A neighbour',
    intro: '',
    reward: Math.round(120 + span / 6),
    stages: [
      { kind: GO_TO, at: from, text: `Pick up at ${from.label}`, done: 'Picked up. The clock is running.' },
      { kind: GO_TO, at: to, text: `Deliver to ${to.label}`, time: Math.round(60 + span / 22), done: 'Delivered, on time.' },
    ],
    outro: '',
  };
}
