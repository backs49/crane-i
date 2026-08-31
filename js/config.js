const CAT = {
  WALL: 0x0001,
  PLUSH: 0x0002,
  CLAW: 0x0004,
};

const WORLD = {
  w: 420,
  h: 500,
  wall: 18,
};

const CHUTE = {
  x: 210,
  y: 452,
  r: 32,
};

const HOME = {
  x: 210,
  y: 440,
};

const START_COINS = 8;
const CLAW_SPEED = 168;
const CLAW_POWER = 0.42;

const PLUSH_TYPES = {
  bear: { name: "곰돌이", points: 100, radius: 26, mass: 1.12, color: "#ffb3c7", rarity: "common" },
  bunny: { name: "토끼", points: 120, radius: 24, mass: 0.95, color: "#fff0e0", rarity: "common" },
  cat: { name: "고양이", points: 120, radius: 23, mass: 0.92, color: "#ffb37a", rarity: "common" },
  chick: { name: "병아리", points: 80, radius: 20, mass: 0.72, color: "#ffe36a", rarity: "common" },
  frog: { name: "개구리", points: 110, radius: 23, mass: 0.9, color: "#7de3b0", rarity: "common" },
  penguin: { name: "펭귄", points: 150, radius: 24, mass: 1.05, color: "#7ec8ff", rarity: "uncommon" },
  pig: { name: "돼지", points: 100, radius: 25, mass: 1.08, color: "#ffb6c8", rarity: "common" },
  puppy: { name: "강아지", points: 130, radius: 24, mass: 1.0, color: "#e8b07a", rarity: "common" },
  panda: { name: "팬더", points: 180, radius: 26, mass: 1.15, color: "#f4f1ea", rarity: "uncommon" },
  berry: { name: "딸기", points: 200, radius: 22, mass: 0.88, color: "#ff6b8a", rarity: "rare" },
  unicorn: { name: "유니콘", points: 320, radius: 27, mass: 1.18, color: "#d7c2ff", rarity: "rare" },
  star: { name: "별뭉치", points: 260, radius: 23, mass: 0.86, color: "#ffe36a", rarity: "rare" },
  moonbunny: { name: "달토끼", points: 400, radius: 25, mass: 1.0, color: "#e8e6ff", rarity: "secret" },
};

const GOLDEN = { chance: 0.18, mult: 3 };
const FEVER = { grabs: 3, bonus: 0.1 };

const SPAWN_BAG = [
  "bear",
  "bear",
  "bear",
  "bear",
  "bear",
  "bear",
  "bunny",
  "bunny",
  "bunny",
  "bunny",
  "bunny",
  "bunny",
  "cat",
  "cat",
  "cat",
  "cat",
  "cat",
  "cat",
  "chick",
  "chick",
  "chick",
  "chick",
  "chick",
  "chick",
  "frog",
  "frog",
  "frog",
  "penguin",
  "penguin",
  "penguin",
  "pig",
  "pig",
  "pig",
  "puppy",
  "puppy",
  "puppy",
  "panda",
  "panda",
  "panda",
  "berry",
  "berry",
  "berry",
  "unicorn",
  "unicorn",
  "unicorn",
  "star",
  "star",
  "star",
];
