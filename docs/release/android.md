# 안드로이드 출시 가이드 (PC에서 따라 하기)

몰랑크레인은 Capacitor로 게임 파일을 앱 안에 통째로 넣는다. 그래서 인터넷 없이 돌아가고, 웹사이트 배포 상태와 상관없이 앱에 들어간 버전이 실행된다.

이 저장소의 클라우드 작업 환경에는 안드로이드 SDK가 없어 앱 파일(AAB)은 PC에서 만든다.

## 0. 준비물

- Android Studio (JDK 포함)
- Node.js 20 이상
- Google Play 개발자 계정
- 테스트에 참여할 가족·지인 12명 이상의 구글 계정 이메일

## 1. 앱 파일 만들기

```bash
git clone https://github.com/backs49/crane-i.git
cd crane-i
git checkout ccr-6345473b-3hssbi   # main에 합쳐졌다면 main
cd app
npm install
npm run sync        # 게임 파일을 app/www로 복사하고 안드로이드 프로젝트에 반영
npm run open        # Android Studio로 열기
```

게임 코드를 고친 뒤에는 항상 `npm run sync`를 다시 실행한다.

## 2. 휴대폰에서 먼저 확인

Android Studio에서 휴대폰을 USB로 연결하고 ▶ 실행. 아래를 확인한다.

- [ ] 시작 화면과 아이콘이 몰랑크레인 곰 인형으로 나온다
- [ ] 세로 화면으로 고정된다
- [ ] 비행기 모드에서도 게임이 된다
- [ ] 소리가 나고, 음소거 버튼이 동작한다
- [ ] 자랑하기·방 사진 찍기를 누르면 휴대폰 공유 창이 뜬다
- [ ] 도전장 링크가 `https://crane-i.vercel.app/?vs=...` 형태다
- [ ] 앱을 껐다 켜도 도감·인형 방·내 인형이 남아 있다

## 3. 서명된 앱 번들(AAB) 만들기

1. Android Studio 메뉴 **Build → Generate Signed App Bundle or APK → Android App Bundle**
2. **Create new...** 로 업로드 키(keystore)를 만든다.
3. **키 파일과 비밀번호를 두 곳 이상에 백업한다.** (예: 외장 저장장치 + 비밀번호 관리자) 잃어버리면 업데이트가 어려워진다.
4. `release` 로 빌드하면 `app/android/app/release/app-release.aab` 가 생긴다.
5. 키 파일(`*.jks`)은 저장소에 올리지 않는다.

버전을 올릴 때는 `app/android/app/build.gradle` 의 `versionCode`(정수, 매번 +1)와 `versionName`(예: "1.0.1")을 바꾼다.

## 4. Play Console 설정

1. 앱 만들기: 이름 `몰랑크레인`, 기본 언어 한국어, 게임, 무료
2. **앱 콘텐츠** 항목을 모두 채운다. 답안은 `store/listing-ko.md` 참고
   - 개인정보처리방침 URL
   - 광고: 없음
   - 앱 액세스 권한: 모든 기능을 제한 없이 이용 가능
   - 콘텐츠 등급 설문
   - 타깃층 및 콘텐츠
   - 데이터 보안
3. **기본 스토어 등록정보**: 설명 문구와 `store/` 폴더 이미지를 올린다.
4. Play 앱 서명은 기본값(Google이 관리)을 사용한다.

## 5. 비공개 테스트 (개인 계정 필수)

1. **테스트 → 비공개 테스트** 트랙을 만들고 AAB를 올린다.
2. 테스터 이메일 목록(12명 이상)을 등록하고, 참여 링크를 보낸다.
3. 테스터 12명 이상이 **14일 연속** 참여한 상태를 유지해야 한다.
4. 테스트 중 받은 의견을 반영해 새 버전을 올려도 된다 (versionCode 올리기).

## 6. 프로덕션 출시

1. 14일이 지나면 **프로덕션 액세스 신청**을 한다.
2. 승인 후 프로덕션 트랙에 출시하고 심사를 기다린다.

## 출시 전 남은 확인 사항

- [ ] 앱 ID `com.molangcrane.game` 확정 (첫 업로드 후 변경 불가)
- [ ] 작업 브랜치를 main에 합쳐 웹사이트에 배포 (개인정보처리방침 URL이 열려야 함)
- [ ] Google Play 인형뽑기(크레인 게임)·사행성 정책 원문 확인
- [ ] 개인정보처리방침 법률 검토
