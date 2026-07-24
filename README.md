# OPIc Daily Coach

한국인 학습자가 매일 두 문제씩 답변 구조와 자연스러운 영어 표현을 훈련하는 로컬 전용 앱입니다.

- 앱 버전: `v1.3.0`
- 문항: 120일 과정, 자체 제작 문항 240개
- 실행 주소: `http://127.0.0.1:4273`
- AI: 로컬 Ollama + `qwen3.5:9b` 권장, `qwen3.5:4b` 대체 가능

## 학습 흐름

1. OPIc 스타일 영어 질문을 듣고 읽습니다.
2. 답변·이유·예시·마무리를 한국어로 먼저 정리합니다.
3. 한국어 원문을 가린 상태에서 영어 답변을 직접 씁니다.
4. 원문 위의 빨간 취소선과 추천 표현으로 인라인 첨삭을 확인합니다.
5. 바로 아래에서 자연스러운 완성 문단, 모범 답안, IH→AL 확장을 비교합니다.
6. 직접 다시 쓰기는 선택 연습이며, 마지막에는 답안을 모두 가리고 말하기 타이머로 연습합니다.

한국어 계획 화면에서도 영어 질문이 계속 보이며, 상단의 `이전 단계` 버튼으로 작성 내용을 유지한 채 직전 단계로 돌아갈 수 있습니다.

결과의 `LOCAL TRAINING RUBRIC`은 답변 구성·문장 구조·복합성·규칙 위반을 같은 기준으로 비교하기 위한 로컬 훈련 지표입니다. 실제 OPIc 공식 등급이나 채점 결과가 아닙니다.

문항은 공개된 OPIc 시험의 일반적인 의사소통 기능과 설문 주제를 참고해 새로 작성했습니다. 특정 교재나 유출 문항을 복사하지 않습니다.

## 프라이버시

- 웹 서버, 교정 모델, 답변 저장소가 모두 사용자 PC에서만 동작합니다.
- 서버와 모델은 `127.0.0.1`에만 바인딩됩니다.
- 한국어 계획과 영어 답변을 외부 API로 보내지 않습니다.
- 학습 기록은 브라우저 `localStorage`에 저장됩니다.
- Git 저장소에는 답변, 백업, 로그, 음성, Ollama 실행 파일과 모델이 포함되지 않습니다.
- 백업 JSON에는 답변 원문이 들어 있으므로 개인 파일처럼 보관해야 합니다.

패키지와 모델을 처음 내려받을 때만 인터넷이 필요합니다. 회사 PC에서는 사내 소프트웨어·AI 사용 정책을 먼저 확인하세요.

## 다른 Windows PC에 설치

필요 항목:

- Git
- Node.js `22.13.0` 이상
- 비공개 저장소 `khlee1025/opic`을 읽을 수 있는 GitHub 로그인

PowerShell에서 실행합니다.

```powershell
git clone https://github.com/khlee1025/opic.git
cd opic
powershell -ExecutionPolicy Bypass -File .\installer\setup-source.ps1
```

의존성 설치, 단위 테스트, 프로덕션 빌드가 끝나면 바탕화면에 `OPIc Daily Coach` 바로가기가 만들어집니다. 바로가기를 만들지 않으려면 `-NoShortcut`을 추가합니다.

### 로컬 AI 설치

소스 저장소에는 수 GB 크기의 모델이 들어 있지 않습니다. Ollama를 먼저 설치한 다음 아래 스크립트로 앱 전용 포트와 폴더에 모델을 준비합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\installer\prepare-local-ai.ps1
```

기본 모델은 `qwen3.5:9b`이며 다운로드 용량이 약 6~7GB입니다. 더 가벼운 모델을 원하면 다음처럼 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\installer\prepare-local-ai.ps1 -Model qwen3.5:4b
```

모델 없이도 앱과 기본 규칙 교정은 동작하지만, 자연스러운 표현·모범 답안·AL 확장 품질을 위해서는 로컬 AI가 필요합니다.

### 직접 실행

```powershell
npm start
```

브라우저가 자동으로 열리지 않으면 `http://127.0.0.1:4273`에 접속합니다. 소스 빌드가 없는 경우 먼저 `npm ci`와 `npm run build`를 실행해야 합니다.

앱과 앱이 시작한 로컬 모델 프로세스를 함께 정상 종료하려면 다음을 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\installer\stop.ps1
```

## 버전 확인과 업데이트

앱의 `설정·백업` 화면에서 앱 버전과 문항 버전을 확인할 수 있습니다. 실행 중에는 다음 명령으로도 확인할 수 있습니다.

```powershell
(Invoke-RestMethod http://127.0.0.1:4273/api/health) | Select-Object version, privacy, mode
```

Git 버전과 최신 태그를 확인하고 업데이트하려면 다음 순서로 실행합니다.

```powershell
git fetch --tags
git describe --tags --always
git pull --ff-only
powershell -ExecutionPolicy Bypass -File .\installer\setup-source.ps1 -SkipTests
```

`privacy`는 `local-only`여야 합니다. `mode`가 `local-model`이면 로컬 AI가 준비된 상태이고, `rules-only`이면 모델 없이 기본 교정으로 동작하는 상태입니다.

## PC 간 학습 기록 이동

학습 답변은 GitHub로 동기화되지 않습니다.

1. 기존 PC의 `설정·백업`에서 `학습 기록 내보내기`를 누릅니다.
2. 생성된 JSON 파일을 개인 저장장치 등 승인된 방법으로 옮깁니다.
3. 새 PC에서 `백업 가져오기`를 누릅니다.

백업에는 한국어·영어 답변과 피드백이 평문으로 포함됩니다. 회사 저장소나 공용 채널에 올리지 마세요.

## 개발 및 검증

```powershell
npm ci
npm run test:unit
npm run lint
npx tsc --noEmit --incremental false
npm run build
npm test
```

로컬 모델이 실행 중일 때 품질 샘플을 확인하려면 다음을 사용합니다.

```powershell
npm run benchmark:ai
```

`next.config.ts`의 standalone 출력은 설치본에 필요한 런타임 파일만 생성합니다. 설치형 런처는 `%LOCALAPPDATA%\OPIc-Daily-Coach`를 사용하고, 소스형 런처는 현재 clone의 빌드 결과를 사용합니다.
