// 저장소 루트의 게임 파일을 app/www로 복사한다. 앱에는 게임 파일이 통째로 들어가므로
// 인터넷 없이도 실행되고, 웹사이트 배포 상태와 상관없이 같은 버전이 실행된다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");
const out = path.resolve(here, "..", "www");

const ITEMS = ["index.html", "privacy.html", "manifest.webmanifest", "css", "js", "assets", "vendor"];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of ITEMS) {
  const from = path.join(root, item);
  if (!fs.existsSync(from)) throw new Error(`missing ${item}`);
  fs.cpSync(from, path.join(out, item), { recursive: true });
}
// 앱 안에서는 서비스 워커를 쓰지 않는다 (index.html이 Capacitor 환경에서는 등록하지 않음)
console.log(`copied ${ITEMS.length} items to ${path.relative(root, out)}`);
