# Fastlane Autocomplete

Fastfile 작성을 위한 VSCode 확장 프로그램입니다. 자동완성과 신택스 하이라이팅을 통해 효율적인 fastlane 스크립트 작성을 지원합니다.

## 🚀 주요 기능

### Syntax Highlighting
- Fastfile을 위한 전용 신택스 하이라이팅
- Ruby 기반 언어 지원으로 가독성 향상
- Fastlane 액션, 레인, 변수 등에 대한 색상 구분

### 자동완성 (IntelliSense)
- **iOS 액션**: `app_store_connect_api_key`, `match`, `build_app`, `upload_to_testflight` 등
- **Android 액션**: `gradle`, `upload_to_play_store`, `increment_version_code` 등  
- **플러그인 액션**: Pluginfile에 설치된 플러그인에 따른 동적 자동완성
- **레인 키워드**: `lane`, `private_lane`, `desc` 등

### 스마트 코드 스니펫
- 자주 사용되는 패턴에 대한 템플릿 제공
- 매개변수 자리표시자로 빠른 설정 가능
- 실제 프로젝트 구조에 맞춘 경로 및 설정 제안

## 📦 설치 방법

### Visual Studio Code Marketplace에서 설치
1. VSCode 확장 탭 열기 (Ctrl+Shift+X)
2. "Fastlane Autocomplete" 검색
3. 설치 클릭

### 수동 설치
1. 이 저장소 클론
```bash
git clone https://github.com/heojeongbo/fastlane-autocomplete
cd fastlane-autocomplete
bun install
```

2. 확장 빌드
```bash
bun run compile
```

3. F5를 눌러 Extension Development Host에서 테스트

## 🔧 사용 방법

### 1. 기본 설정
- Fastfile이 있는 프로젝트 루트를 VSCode로 열기
- `/fastlane/Pluginfile`이 있으면 자동으로 플러그인 액션 인식

### 2. 자동완성 사용
Fastfile에서 타이핑 시작하면 자동완성 목록이 표시됩니다:

```ruby
# 레인 생성
lane :ios_build do |options|
  # iOS 액션 자동완성
  app_store_connect_api_key(
    key_id: ENV['APPLE_API_KEY_ID'],
    issuer_id: ENV['APPLE_API_KEY_ISSUER_ID'],
    key_filepath: options[:api_key_path]
  )
  
  # Android 액션 자동완성
  gradle(
    project_dir: "./android",
    tasks: options[:task]
  )
end
```

### 3. 지원하는 주요 액션

#### iOS
- `app_store_connect_api_key` - App Store Connect API 키 설정
- `match` - 코드 사이닝 프로필 관리
- `build_app` - iOS 앱 빌드
- `upload_to_testflight` - TestFlight 업로드
- `get_version_number` - 버전 번호 조회
- `increment_build_number` - 빌드 번호 증가

#### Android  
- `gradle` - Gradle 빌드 실행
- `android_get_version_name` - Android 버전 이름 조회
- `increment_version_code` - 버전 코드 증가
- `upload_to_play_store` - Google Play Store 업로드

#### 플러그인 (Pluginfile 기반)
- `firebase_app_distribution` - Firebase App Distribution 배포
- `firebase_app_distribution_get_latest_release` - 최신 릴리스 조회

## 🛠️ 개발 환경

### 요구사항
- Bun 1.0+ (빠른 패키지 관리와 빌드 성능을 위해 사용)
- VSCode 1.74.0+

### Why Bun?
- ⚡ 기존 npm/yarn 대비 3-5배 빠른 설치 속도
- 🚀 내장 TypeScript 지원으로 더 빠른 빌드
- 📦 단일 바이너리로 간편한 관리

### 개발 명령어
```bash
# 의존성 설치
bun install

# TypeScript 컴파일
bun run compile

# 파일 변경 감지하여 자동 컴파일
bun run dev

# 확장 패키징
vsce package
```

## 📚 프로젝트 구조
```
fastlane-autocomplete/
├── src/
│   ├── extension.ts           # 메인 확장 진입점
│   └── completionProvider.ts  # 자동완성 제공자
├── syntaxes/
│   └── fastfile.tmLanguage.json  # Fastfile 신택스 정의  
├── package.json               # 확장 메타데이터
├── tsconfig.json             # TypeScript 설정
└── language-configuration.json  # 언어 설정
```

## 🤝 기여 방법

1. 이 저장소 Fork
2. 기능 브랜치 생성 (`git checkout -b feature/amazing-feature`)
3. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 Push (`git push origin feature/amazing-feature`)
5. Pull Request 생성

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🙋‍♂️ 지원

문제가 있거나 기능 요청이 있으시면 [GitHub Issues](https://github.com/heojeongbo/fastlane-autocomplete/issues)에서 알려주세요.

---

**Made with ❤️ for fastlane developers**