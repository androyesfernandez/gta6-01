// Solis Heat — tuning constants shared by every module.
// The world is a 3600x2700 beach town: seven north-south avenues, five
// east-west streets, a sand beach and the sea along the west edge.

export const WORLD_W = 3600;
export const WORLD_H = 2700;
export const TICK = 1 / 60;
export const SAVE_KEY = 'solis-heat-save-v1';

// Road centre lines. Every road is ROAD_W wide; avenues run the full height,
// streets begin at the beach and run to the east edge.
export const AVENUES = [620, 1070, 1520, 1970, 2420, 2870, 3320];
export const STREETS = [360, 810, 1260, 1710, 2160];
export const ROAD_W = 124;
export const WATER_X = 250; // sea west of this line
export const BEACH_X = 430; // town ground east of this line, sand in between

export const WALKER = {
  radius: 13,
  walk: 178,
  run: 292,
  maxHealth: 100,
};

export const VEHICLE = {
  radius: 21,
  accel: 340,
  brake: 520,
  reverseTop: 120,
  drag: 0.9,
  turnRate: 2.6, // steering speed at full lock, scaled by road speed
  maxHealth: 100,
};

// Wanted heat runs 0..170: one star per 34 points, five stars at the top.
export const HEAT = {
  cap: 170,
  perStar: 34,
  carTheft: 36,
  carTheftQuiet: 16,
  gunshot: 10,
  fenderBender: 14,
  hitCopCar: 52,
  hitPedestrian: 68,
  killPedestrian: 96,
  robbery: 90,
  coolCalm: 4.2, // heat lost per second when unseen and things are quiet
  coolSeen: 1.4, // heat lost per second with police nearby
  witnessDist: 270,
  copSight: 520,
};

export const PALETTE = {
  sea: '#1d7f9e',
  seaDeep: '#146a89',
  sand: '#ecd28f',
  grass: '#79b657',
  sidewalk: '#cfc4ae',
  asphalt: '#3c4048',
  laneMark: '#e8e3d0',
};
