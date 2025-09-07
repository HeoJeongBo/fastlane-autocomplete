# CLAUDE.md - Fastlane Autocomplete Extension

## 프로젝트 개요
fastlane-autocomplete는 Fastfile 작성을 위한 VSCode extension입니다. Fastfile과 Pluginfile에 설치된 플러그인 기반으로 자동완성과 syntax highlighting을 제공합니다.

## 프로젝트 구조
```
fastlane-autocomplete/
├── src/
│   ├── extension.ts           # 메인 확장 진입점
│   └── completionProvider.ts  # 자동완성 제공자
├── syntaxes/
│   └── fastfile.tmLanguage.json  # Fastfile 신택스 정의
├── .vscode/
│   └── launch.json            # 확장 디버깅 설정
├── package.json               # 확장 메타데이터 및 설정
├── bunfig.toml               # Bun 설정 파일
├── tsconfig.json             # TypeScript 설정
├── language-configuration.json  # 언어 설정
└── .gitignore
```

## 개발 명령어
- `bun install`: 의존성 설치
- `bun run compile`: TypeScript 컴파일
- `bun run dev`: 파일 변경 감지하여 자동 컴파일
- F5: VSCode에서 확장 디버깅 실행

## 기능
1. **Syntax Highlighting**: Fastfile에 대한 색상 구문 강조
2. **자동완성**: 
   - iOS/Android fastlane 액션
   - 플러그인 액션 (Pluginfile 기반)
   - lane 키워드 (`lane`, `private_lane`, `desc`)
3. **코드 스니펫**: 자주 사용되는 패턴에 대한 템플릿 제공

## 지원하는 Fastlane 액션
### iOS
- app_store_connect_api_key
- match
- build_app
- upload_to_testflight
- get_version_number
- increment_build_number
- latest_testflight_build_number
- update_code_signing_settings
- update_project_team

### Android
- gradle
- android_get_version_name
- increment_version_code
- google_play_track_version_codes
- upload_to_play_store

### 플러그인 (Pluginfile 기반)
- firebase_app_distribution
- firebase_app_distribution_get_latest_release

## 테스트 방법
1. F5를 눌러 Extension Development Host 실행
2. 새 Fastfile 생성 또는 기존 Fastfile 열기
3. 자동완성 및 신택스 하이라이팅 확인

## 빌드 및 배포
1. `vsce package` 명령으로 .vsix 파일 생성
2. VSCode Marketplace에 게시 또는 로컬 설치

## 기술 스택
- **Package Manager**: Bun (빠른 설치와 빌드를 위해 선택)
- **Language**: TypeScript
- **Framework**: VSCode Extension API
- **Build Tool**: TypeScript Compiler (tsc)

## 참고사항
- 이 확장은 `/fastlane/Pluginfile`을 읽어 설치된 플러그인에 따라 자동완성을 동적으로 조정합니다.
- Fastfile의 Ruby 문법을 기반으로 하되, fastlane 특화 기능에 최적화되어 있습니다.
- Bun을 사용하여 개발 효율성과 성능을 최적화했습니다.