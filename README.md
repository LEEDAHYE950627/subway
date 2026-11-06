# 중동역 실시간 도착 안내

React + Vite로 만든 수도권 1호선 중동역 전광판입니다. 큰 서울 시간 시계, 양방향 도착정보, 송내 → 중동 → 부천 노선도, 움직이는 열차 아이콘, 전체화면, 모바일 화면을 제공합니다.

## 실행

Node.js 22.12 이상에서 실행하세요.

```sh
npm install
cp .env.example .env.local
npm run dev
```

.env.local의 SEOUL_SUBWAY_API_KEY에 발급받은 인증키를 입력합니다. Windows PowerShell의 실행 정책 오류가 발생하면 npm 대신 npm.cmd를 사용합니다. 개발 서버 주소는 http://127.0.0.1:5173 입니다. 인증키 파일은 Git에서 제외됩니다.

## GitHub Pages 배포

저장소: https://github.com/LEEDAHYE950627/subway

1. Settings → Pages → Build and deployment → Source를 GitHub Actions로 선택합니다.
2. Actions → Deploy to GitHub Pages에서 Run workflow를 실행합니다. 이후 main 브랜치에 push하면 자동 배포됩니다.
3. 접속 주소: https://leedahye950627.github.io/subway/

**GitHub Pages는 정적 화면만 제공합니다. 실시간 정보를 표시하려면 아래 API 서버를 배포해야 합니다.** 서버 주소가 설정되지 않으면 화면에 연결 준비 중이라는 안내를 표시합니다.

## 실시간 API 서버 (Cloudflare Worker)

Worker의 ALLOWED_ORIGIN은 https://leedahye950627.github.io 로 설정되어 있습니다.

```sh
npx wrangler login
npx wrangler secret put SEOUL_SUBWAY_API_KEY
npx wrangler deploy
```

secret 입력 창에 서울시 인증키를 입력합니다. 키를 소스나 wrangler.toml에 넣지 마세요.

GitHub Settings → Secrets and variables → Actions → Variables에서 VITE_API_BASE_URL을 생성하고 배포된 Worker 주소를 입력합니다. 예: https://jungdong-subway-api.계정.workers.dev (마지막 /api/arrivals 제외). 그 다음 Pages workflow를 다시 실행합니다.

브라우저는 HTTPS Worker에 접속하고 Worker가 서울시 HTTP API를 조회하므로 혼합 콘텐츠와 CORS 문제를 피합니다. API는 /api/arrivals 경로만 지원합니다.

## 데이터 표시 원칙과 제한

- 서울시 [실시간 도착정보 API](https://data.seoul.go.kr/dataList/OA-12764/A/1/datasetView.do)를 1초마다 조회합니다. 진행 중인 요청은 중복하지 않습니다. 서버 응답 캐시는 사용하지 않습니다.
- 현재 인증키에서 일일 1,000회 호출 제한 오류(ERROR-337)가 확인되었습니다. 1초마다 조회하면 한 화면에서도 약 17분 만에 1,000회에 도달합니다. 운영 시 호출 한도 상향 또는 조회 주기 조정이 필요합니다.
- barvlDt(초)와 recptnDt(한국 시간)를 반영해 남은 시간을 매초 계산합니다.
- 중동역 응답에서 barvlDt가 0으로 반환되는 경우가 확인되었습니다. 이 경우 전역 출발 약 70초, 전역 도착 약 110초, 전역 진입 약 140초, 여러 역 전이면 역당 약 110초로 추정합니다. 화면에 **약 / 도착 추정**으로 구분합니다. 이는 실제 시간표나 카카오맵 예측값과 같은 데이터가 아닙니다.
- 동일한 원천 상태의 최초 수신 시각부터 추정 카운트다운을 계산합니다. 매초 조회해도 타이머가 초기화되지 않습니다.
- 진입·도착 상태는 상태 문구를 표시합니다. 시간이 0이 되어도 실제 도착으로 단정하지 않고 도착 확인 중으로 표시합니다.
- 원천 정보가 2분 이상 오래되면 갱신 지연 안내와 함께 마지막 계산 결과를 표시하고 위치 아이콘은 숨깁니다.
- 위치는 역간 약 110초를 가정한 추정이며 GPS가 아닙니다. 3역 범위 밖 열차는 노선도 양 끝에 표시됩니다.
- 상행은 송내에서 중동을 거쳐 부천·구로 방면이고 하행은 그 반대입니다. 급행·특급·ITX와 이미 출발한 열차는 제외합니다.
- API 오류 시 마지막 수신 데이터를 유지하고 자동 재시도합니다. 샘플 데이터를 실시간 정보로 표시하지 않습니다.

## 검증

```sh
npm test
npm run build
```

GitHub Actions에서 테스트와 빌드 후 배포합니다. npm run preview는 정적 빌드만 제공합니다. 배포 API를 미리보기에서 사용하려면 VITE_API_BASE_URL을 설정하고 빌드해야 합니다.

실제 인증키는 저장소에 포함하지 않습니다. GitHub 연결만으로 Cloudflare 서버가 자동 생성되지는 않습니다.
