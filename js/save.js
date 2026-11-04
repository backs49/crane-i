// 내 인형 검사 규칙은 myplush.js에 있다 (브라우저에서는 먼저 로드, Node에서는 require)
const SaveMyPlush =
  typeof MyPlush !== "undefined" ? MyPlush : typeof require !== "undefined" ? require("./myplush.js") : null;

const Save = {
  KEY: "molang-crane:v1",

  emptyDaily(dayKey) {
    return { date: dayKey || "", missionCount: 0, missionDone: false, loginBonus: false, playSec: 0, extraMin: 0 };
  },

  touchDaily(data, dayKey) {
    const isNewDay = !data.daily || data.daily.date !== dayKey;
    const daily = isNewDay ? this.emptyDaily(dayKey) : data.daily;
    return { data: Object.assign({}, data, { daily }), isNewDay };
  },

  noteMissionCatch(data) {
    const daily = Object.assign({}, data.daily, { missionCount: (data.daily.missionCount || 0) + 1 });
    return Object.assign({}, data, { daily });
  },

  completeMission(data) {
    return Object.assign({}, data, { daily: Object.assign({}, data.daily, { missionDone: true }) });
  },

  grantLogin(data) {
    return Object.assign({}, data, { daily: Object.assign({}, data.daily, { loginBonus: true }) });
  },

  defaults(typeKeys) {
    const dexCounts = Object.create(null);
    for (const t of typeKeys) dexCounts[t] = 0;
    return { v: 1, bestScore: 0, totalPrizes: 0, totalPlays: 0, dexCounts, daily: this.emptyDaily(""), moonUnlocked: false, kidMode: true, room: {}, playLimit: 30, tutorialDone: false, myPlush: null };
  },

  normalize(raw, typeKeys) {
    const base = this.defaults(typeKeys);
    if (!raw || typeof raw !== "object") return base;
    const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);
    const out = {
      v: 1,
      bestScore: num(raw.bestScore),
      totalPrizes: num(raw.totalPrizes),
      totalPlays: num(raw.totalPlays),
      dexCounts: Object.assign(Object.create(null), base.dexCounts),
      daily: this.emptyDaily(""),
      moonUnlocked: !!raw.moonUnlocked,
      // 아이 모드는 기본으로 켜져 있고, 끈 기록이 있을 때만 꺼진다
      kidMode: raw.kidMode !== false,
      room: this.normalizeRoom(raw.room, typeKeys),
      playLimit: this.LIMITS.includes(raw.playLimit) ? raw.playLimit : base.playLimit,
      tutorialDone: !!raw.tutorialDone,
      myPlush: SaveMyPlush ? SaveMyPlush.normalize(raw.myPlush) : null,
    };
    if (raw.dexCounts && typeof raw.dexCounts === "object") {
      for (const t of typeKeys) out.dexCounts[t] = num(raw.dexCounts[t]);
    }
    if (raw.daily && typeof raw.daily === "object") {
      out.daily = {
        date: typeof raw.daily.date === "string" ? raw.daily.date : "",
        missionCount: num(raw.daily.missionCount),
        missionDone: !!raw.daily.missionDone,
        loginBonus: !!raw.daily.loginBonus,
        playSec: Math.min(86400, num(raw.daily.playSec)),
        extraMin: Math.min(600, num(raw.daily.extraMin)),
      };
    }
    return out;
  },

  merge(a, b) {
    const dexCounts = Object.assign(Object.create(null), a.dexCounts);
    for (const k of Object.keys(b.dexCounts || {})) {
      dexCounts[k] = Math.max(dexCounts[k] || 0, b.dexCounts[k] || 0);
    }
    let daily;
    if (a.daily.date === b.daily.date) {
      daily = {
        date: a.daily.date,
        missionCount: Math.max(a.daily.missionCount || 0, b.daily.missionCount || 0),
        missionDone: !!(a.daily.missionDone || b.daily.missionDone),
        loginBonus: !!(a.daily.loginBonus || b.daily.loginBonus),
        // 여러 탭이 같은 날을 기록해도 놀이 시간이 줄어들지 않도록 큰 쪽
        playSec: Math.max(a.daily.playSec || 0, b.daily.playSec || 0),
        extraMin: Math.max(a.daily.extraMin || 0, b.daily.extraMin || 0),
      };
    } else {
      // date는 YYYY-MM-DD라 사전순 비교가 곧 시간순 비교
      daily = Object.assign({}, a.daily.date > b.daily.date ? a.daily : b.daily);
    }
    return {
      v: 1,
      bestScore: Math.max(a.bestScore || 0, b.bestScore || 0),
      totalPrizes: Math.max(a.totalPrizes || 0, b.totalPrizes || 0),
      totalPlays: Math.max(a.totalPlays || 0, b.totalPlays || 0),
      dexCounts,
      daily,
      moonUnlocked: !!(a.moonUnlocked || b.moonUnlocked),
      // 설정은 진행도가 아니라 선택이므로 지금 저장하는 쪽(b)을 따른다
      kidMode: b.kidMode !== false,
      room: this.mergeRoom(a.room, b.room),
      playLimit: b.playLimit != null ? b.playLimit : a.playLimit,
      tutorialDone: !!(a.tutorialDone || b.tutorialDone),
      myPlush: b.myPlush || a.myPlush || null,
    };
  },

  load(storage, typeKeys) {
    try {
      const raw = storage && storage.getItem ? JSON.parse(storage.getItem(this.KEY)) : null;
      return this.normalize(raw, typeKeys);
    } catch (_) {
      return this.defaults(typeKeys);
    }
  },

  store(storage, data) {
    try {
      if (!storage || !storage.setItem) return;
      let merged = data;
      try {
        // 다른 탭이 먼저 저장한 진행을 덮어쓰지 않도록 디스크 사본과 병합
        const disk = this.normalize(JSON.parse(storage.getItem(this.KEY)), Object.keys(data.dexCounts));
        merged = this.merge(disk, data);
      } catch (_) {
        merged = data;
      }
      storage.setItem(this.KEY, JSON.stringify(merged));
    } catch (_) {
      /* 저장 불가 환경(사파리 프라이빗 등)에서는 조용히 무시 */
    }
  },

  wipe(storage) {
    try {
      if (storage && storage.removeItem) storage.removeItem(this.KEY);
    } catch (_) {
      /* 저장 불가 환경에서는 조용히 무시 */
    }
  },

  recordCatch(data, type) {
    const dexCounts = Object.assign(Object.create(null), data.dexCounts);
    dexCounts[type] = (dexCounts[type] || 0) + 1;
    return Object.assign({}, data, { dexCounts, totalPrizes: (data.totalPrizes || 0) + 1 });
  },

  recordPlay(data) {
    return Object.assign({}, data, { totalPlays: (data.totalPlays || 0) + 1 });
  },

  recordGameOver(data, score) {
    const isBest = score > (data.bestScore || 0);
    const next = Object.assign({}, data, { bestScore: isBest ? score : data.bestScore || 0 });
    return { data: next, isBest };
  },

  dexUnique(data) {
    return Object.keys(data.dexCounts || {}).filter((k) => data.dexCounts[k] > 0).length;
  },

  dexComplete(data, keys) {
    return keys.every((k) => (data.dexCounts[k] || 0) > 0);
  },

  // 방 데이터: { [type]: { x, y, name, pets } } — 알 수 없는 종류나 잘못된 값은 버린다
  normalizeRoom(raw, typeKeys) {
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    for (const t of typeKeys) {
      const e = raw[t];
      if (!e || typeof e !== "object") continue;
      const clean = {};
      if (Number.isFinite(e.x) && Number.isFinite(e.y)) {
        clean.x = Math.max(0, Math.min(1000, e.x));
        clean.y = Math.max(0, Math.min(1000, e.y));
      }
      if (typeof e.name === "string") {
        const name = Array.from(e.name.replace(/[\u0000-\u001f\u007f<>]/g, "").trim()).slice(0, 8).join("").trim();
        if (name) clean.name = name;
      }
      if (Number.isFinite(e.pets) && e.pets > 0) clean.pets = Math.min(9999, Math.floor(e.pets));
      if (Object.keys(clean).length) out[t] = clean;
    }
    return out;
  },

  // 위치·이름은 지금 저장하는 쪽(b), 쓰다듬은 횟수는 큰 쪽을 따른다
  mergeRoom(a, b) {
    const out = {};
    const ra = a || {};
    const rb = b || {};
    for (const t of new Set(Object.keys(ra).concat(Object.keys(rb)))) {
      const pets = Math.max((ra[t] && ra[t].pets) || 0, (rb[t] && rb[t].pets) || 0);
      out[t] = Object.assign({}, ra[t], rb[t]);
      if (pets) out[t].pets = pets;
    }
    return out;
  },

  setRoom(data, room) {
    return Object.assign({}, data, { room });
  },

  // 하루 놀이 시간 한도(분). 0 = 알림 끔
  LIMITS: [0, 15, 20, 30, 45, 60],

  addPlayTime(data, sec) {
    const playSec = Math.min(86400, (data.daily.playSec || 0) + Math.max(0, sec || 0));
    return Object.assign({}, data, { daily: Object.assign({}, data.daily, { playSec }) });
  },

  addExtraTime(data, min) {
    const extraMin = Math.min(600, (data.daily.extraMin || 0) + min);
    return Object.assign({}, data, { daily: Object.assign({}, data.daily, { extraMin }) });
  },

  setPlayLimit(data, min) {
    return Object.assign({}, data, { playLimit: this.LIMITS.includes(min) ? min : data.playLimit });
  },

  setMyPlush(data, spec) {
    const myPlush = SaveMyPlush ? SaveMyPlush.normalize(spec) : spec;
    // 방에서 따로 붙인 이름이 있으면 지워서, 만들기 화면의 이름을 쓰게 한다
    const room = Object.assign({}, data.room);
    if (room.mine) {
      room.mine = Object.assign({}, room.mine);
      delete room.mine.name;
    }
    return Object.assign({}, data, { myPlush, room });
  },

  finishTutorial(data) {
    return Object.assign({}, data, { tutorialDone: true });
  },

  setKidMode(data, on) {
    return Object.assign({}, data, { kidMode: !!on });
  },

  unlockMoon(data) {
    return Object.assign({}, data, { moonUnlocked: true });
  },
};

if (typeof module !== "undefined") module.exports = Save;
