// 문구 표: 화면에 보이는 글을 언어별 표에서 꺼내 쓴다.
// 지금은 한국어(ko)만 있고, 영어·일본어는 같은 키로 표를 추가하면 된다.
// 키가 없으면 기본 언어(ko) → 키 이름 순으로 대신 보여 준다.
const I18N = {
  lang: "ko",
  fallback: "ko",
  supported: ["ko"],
  strings: {},

  add(lang, table) {
    this.strings[lang] = Object.assign({}, this.strings[lang], table);
    if (!this.supported.includes(lang)) this.supported.push(lang);
  },

  // 브라우저 언어 목록에서 지원하는 첫 언어를 고른다 ("ja-JP" → "ja")
  detect(langs) {
    for (const raw of langs || []) {
      const code = String(raw || "").toLowerCase().split("-")[0];
      if (this.supported.includes(code)) return code;
    }
    return this.fallback;
  },

  setLang(lang) {
    this.lang = this.supported.includes(lang) ? lang : this.fallback;
    return this.lang;
  },

  raw(key) {
    const own = this.strings[this.lang];
    if (own && Object.prototype.hasOwnProperty.call(own, key)) return own[key];
    const base = this.strings[this.fallback];
    if (base && Object.prototype.hasOwnProperty.call(base, key)) return base[key];
    return undefined;
  },

  has(key) {
    return this.raw(key) !== undefined;
  },

  // 마지막 글자에 받침이 있는지 (한글이 아니면 받침 없음으로 본다)
  hasBatchim(word) {
    const ch = String(word || "").trim().slice(-1);
    const code = ch.charCodeAt(0);
    if (!(code >= 0xac00 && code <= 0xd7a3)) return false;
    return (code - 0xac00) % 28 !== 0;
  },

  // {name}은 값을 그대로, {name|이야/야}는 받침이 있으면 앞, 없으면 뒤 조사를 붙인다
  format(text, vars) {
    if (!vars) return text;
    return text.replace(/\{(\w+)(?:\|([^/}]*)\/([^}]*))?\}/g, (m, k, withB, withoutB) => {
      if (vars[k] == null) return m;
      const v = String(vars[k]);
      if (withB === undefined) return v;
      return v + (this.hasBatchim(v) ? withB : withoutB);
    });
  },

  // 문자열 하나. 표에 목록이 있으면 첫 줄을 쓴다.
  t(key, vars) {
    const v = this.raw(key);
    if (v === undefined) return key;
    return this.format(Array.isArray(v) ? v[0] : v, vars);
  },

  // 같은 뜻의 여러 문장 중 하나를 고른다 (대사에 변화를 주려고)
  pick(key, vars, rng = Math.random) {
    const v = this.raw(key);
    if (v === undefined) return key;
    const list = Array.isArray(v) ? v : [v];
    return this.format(list[Math.floor(rng() * list.length) % list.length], vars);
  },

  // HTML의 data-i18n="키" 요소에 문구를 채운다
  apply(root) {
    if (!root || !root.querySelectorAll) return;
    for (const el of root.querySelectorAll("[data-i18n]")) {
      el.textContent = this.t(el.getAttribute("data-i18n"));
    }
  },
};

if (typeof module !== "undefined") module.exports = I18N;
