# 몰랑크레인 성공 요소 구현 플랜 (전체 개요)

> **구현 에이전트(Grok Build)에게:** 이 디렉터리의 명세서를 `01 → 07` 순서로 구현하세요.
> 각 파일 안의 Task를 위에서부터 순서대로 수행하고, Task마다 명시된 테스트를 실행해 통과를 확인한 뒤 명시된 메시지로 커밋합니다.
> 명세에 없는 리팩터링은 하지 마세요. 코드 블록은 그대로 사용 가능한 완성 코드입니다.

**전체 목표:** 한 판짜리 아케이드 게임을 "매일 들르고, 모으고, 자랑하는 게임"으로 확장한다.

| 단계 | 파일 | 내용 | 의존성 |
|---|---|---|---|
| 1 | `01-persistence.md` | localStorage 영속화 (평생 도감, 최고 점수, 누적 통계) | 없음 |
| 2 | `02-daily-mission.md` | 날짜 시드 기반 오늘의 부탁 + 일일 접속 보너스 | 1 |
| 3 | `03-hard-pity.md` | 연속 실패 상한(하드 피티) | 없음 |
| 4 | `04-golden-fever.md` | 황금 인형 + 박스 클리어 피버 타임 | 없음 |
| 5 | `05-share-card.md` | 결과 공유 카드 + OG 메타 태그 | 1, 2 |
| 6 | `06-pwa.md` | PWA(manifest/서비스 워커) + 폰트 로컬 번들 | 1~5 완료 후 |
| 7 | `07-collection-reward.md` | 도감 완성 보상: 비밀 인형 "달토끼" | 1, 2 |

## 프로젝트 아키텍처 (필독)

- **빌드 없음, 모듈 없음.** `index.html`의 `<script>` 태그가 전역을 공유한다. 로드 순서가 중요:
  `vendor/matter.min.js` → `js/config.js` → (`js/save.js`) → `js/fun.js` → `js/grip.js` → (`js/share.js`) → `js/audio.js` → `js/particles.js` → `js/draw.js` → `js/input.js` → `js/game.js`
  괄호는 이 플랜에서 새로 추가되는 파일. **새 스크립트를 추가하면 반드시 `index.html`과 `tests/load-scripts.js`의 `files` 배열 두 곳 모두에 추가할 것.**
- 각 파일은 전역 하나를 정의한다: `Grip`, `Fun`, `AudioFx`, `Particles`, `Draw`, `Input` (+ 새로 `Save`, `Share`). `js/game.js`는 IIFE로 모든 상태와 루프를 소유한다.
- **Node 로드 가능 모듈 패턴:** 순수 로직 파일(`grip.js`, `fun.js`, 새 `save.js`)은 최상위에서 DOM/`window`를 만지지 않고 파일 끝에 다음 가드를 둔다:
  ```js
  if (typeof module !== "undefined") module.exports = X;
  ```
- 월드는 420×500 논리 좌표, 중력 0의 탑다운. 잡기 결과는 물리가 아니라 `Grip.roll()`의 RNG가 결정한다(의도된 설계).
- UI 문구는 전부 한국어. 명세의 한국어 카피를 글자 그대로 사용할 것.

## 실행/검증 명령

```bash
# 유닛 테스트 (브라우저 불필요)
node tests/fun.test.js
node tests/save.test.js          # 1단계에서 생성
node tests/load-scripts.js       # 전 스크립트가 순서대로 로드되는지 스모크 테스트

# 게임 서빙
python3 -m http.server 8765      # http://localhost:8765

# 브라우저 E2E (playwright 필요, macOS Chrome 사용)
GAME_URL=http://127.0.0.1:8765/ node tests/chrome-play.mjs
```

브라우저 콘솔/자동화 훅: `window.__crane` — `snapshot()`, `start()`, `aim(x, y)`, `grab()`, `end()`. 검증 시 적극 사용할 것.

## 전역 제약 (모든 Task에 암묵 적용)

- `tests/chrome-play.mjs`의 기존 검증을 절대 깨지 말 것: `#missionBar` 텍스트에 항상 `부탁`이라는 단어가 포함되어야 하고, `.dex-dot` 개수는 8개 이상이어야 한다.
- `window.__crane.snapshot()`의 기존 필드는 제거·변경 금지, 확장만 허용.
- 기존 코드 스타일 유지: 세미콜론, 더블쿼트, 2칸 들여쓰기, `Object.assign` 기반 불변 갱신(`fun.js` 참고).
- 커밋 메시지는 기존 컨벤션(`feat:`, `fix:`) 유지. 커밋은 Task 단위로 원자적으로.
- 6단계 이후로는 파일을 변경하는 커밋마다 `sw.js`의 `CACHE` 버전 문자열을 올릴 것 (예: `molang-crane-v1` → `molang-crane-v2`).
- 외부 라이브러리 추가 금지 (playwright는 테스트 전용으로 이미 사용 중).
