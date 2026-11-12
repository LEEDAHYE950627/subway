# 중동역 실시간 도착 안내

React + Vite로 만든 수도권 1호선 중동역 전광판입니다. 서울 시간의 큰 시계, 양방향 도착시간, 송내 → 중동 → 부천 노선도, 움직이는 열차 아이콘, 전체화면, 모바일 화면을 제공합니다.

## 실행

Node.js 22.12 이상이 필요합니다.

```sh
npm install
cp .env.example .env.local
```

`.env.local`의 `SEOUL_SUBWAY_API_KEY`에 발급받은 인증키를 입력한 뒤 실행합니다. Windows PowerShell에서 npm 실행 정책 오류가 나면 `npm.cmd`를 사용합니다.

```sh
npm run dev
```

http://127.0.0.1:5173 에서 확인합니다. 개발 서버가 API를 중계하므로 인증키는 브라우저로 전달되지 않습니다. `.env.local`은 Git에 포함되지 않습니다.

## GitHub Pages 배포

배포 전에 `VITE_API_BASE_URL`에 실제로 배포한 HTTPS Worker 주소가 필요합니다. 로컬의 `/api/arrivals`는 Vite 개발 서버에서만 실행되며 GitHub Pages에는 포함되지 않습니다. GitHub Actions는 이제 빌드 전에 API 응답과 CORS를 확인하므로, 변수 누락·Worker 인증키 누락·허용 origin 오류가 있으면 배포를 중단합니다. Variables를 변경한 뒤에는 Actions에서 **Deploy to GitHub Pages → Run workflow**로 다시 배포하세요.

GitHub Pages는 정적 호스팅이므로 서울시 API를 중계할 별도 서버가 필요합니다. 이 프로젝트에는 Cloudflare Worker가 포함되어 있습니다. 서울시 API의 HTTP 주소는 Worker 서버에서 호출하고, 브라우저는 HTTPS Worker에 연결하므로 혼합 콘텐츠와 CORS 문제를 피합니다.

1. `wrangler.toml`의 `ALLOWED_ORIGIN`을 `https://사용자명.github.io`로 바꿉니다. 저장소 경로와 마지막 `/`는 넣지 않습니다. 사용자 도메인이 있으면 그 origin을 사용합니다.
2. Cloudflare 계정에서 Worker를 배포합니다.

   ```sh
   npx wrangler login
   npx wrangler secret put SEOUL_SUBWAY_API_KEY
   npx wrangler deploy
   ```

   secret 입력 창에 인증키를 넣습니다. 소스나 `wrangler.toml`에 인증키를 넣지 않습니다. Worker는 `/api/arrivals` 경로만 지원합니다.

3. GitHub 저장소의 **Settings → Secrets and variables → Actions → Variables**에서 `VITE_API_BASE_URL`을 생성하고 Worker 주소(예: `https://jungdong-subway-api.계정.workers.dev`)를 입력합니다. 마지막 `/api/arrivals`는 넣지 않습니다. 이 변수는 공개 API 주소이며 인증키가 아닙니다.
4. **Settings → Pages → Source**를 **GitHub Actions**로 설정합니다.
5. 파일을 저장소의 `main` 브랜치에 push하면 포함된 workflow가 테스트·빌드·배포합니다. 다른 기본 브랜치라면 `.github/workflows/deploy.yml`의 브랜치도 수정합니다.
6. `https://사용자명.github.io/저장소명/`으로 접속합니다. Vite의 상대 경로 설정으로 저장소 하위 경로도 지원합니다.

로컬에서 배포 API를 사용하려면 `.env.local`의 `VITE_API_BASE_URL`에 Worker 주소를 넣고, Worker `ALLOWED_ORIGIN`을 로컬 origin으로 변경해야 합니다. 일반 로컬 개발에서는 이 변수를 비워 두면 됩니다.

## 데이터 표시 원칙

- 서울시 [실시간 도착정보 API](https://data.seoul.go.kr/dataList/OA-12764/A/1/datasetView.do)를 15초마다 조회합니다. 서버 응답 캐시는 사용하지 않으며 진행 중인 동시 요청만 병합합니다. 이전 요청이 끝나지 않았다면 중복 요청을 보내지 않습니다. 원천 API의 갱신 주기에 따라 연속 응답 내용이 같을 수 있습니다.
- `barvlDt`(초)와 `recptnDt`(한국 시간)를 반영해 남은 시간을 매초 다시 계산합니다. 화면이 백그라운드에 있다 돌아와도 실제 현재 시각으로 계산합니다.
- 열차 위치는 GPS가 아닙니다. 역간 약 110초를 가정한 보간이며 화면에 **추정 위치**라고 표시합니다. 3역 범위보다 멀리 있는 열차는 지도 양 끝에 표시합니다.
- 상행은 송내에서 중동을 거쳐 부천·구로 방면, 하행은 그 반대입니다. 최종 행선지는 API 값을 표시합니다.
- 2분 이상 지난 원천 정보에는 갱신 지연 안내를 표시하고 위치 아이콘을 숨깁니다. 카운트다운은 계속 표시하되 만료되면 예정 시간 경과으로 표시합니다. 도착 예정 시간이 0이 되어도 실제 도착으로 단정하지 않습니다.
- API 도착코드와 메시지로 전역 출발·전역 진입·전역 도착·진입·도착 등의 상태를 표시합니다. 도착 예정 초가 0인 경우 전역 출발(약 70초), 전역 도착(약 110초), 전역 진입(약 140초), 남은 역 수(역당 약 110초)를 바탕으로 추정 시간을 ‘약’으로 표시합니다. 추정 타이머는 동일 상태의 최초 수신 시각부터 계산해 매초 조회에도 초기화되지 않습니다. 진입·도착 상태는 시간을 추정하지 않고 상태를 표시합니다. 추정값은 실제 운행시간이나 시간표를 보장하지 않습니다.
- 중동역을 통과하는 열차와 이미 출발한 열차는 제외하고, 정차하는 동두천행 급행은 표시합니다. 열차 정보가 없으면 빈 상태를 표시하고 재시도합니다. 샘플 데이터를 실시간 정보로 표시하지 않습니다.
- 네트워크 오류 시 마지막 수신 정보를 유지하고 자동 재시도합니다. API 키 오류, 응답 지연, 무응답 상태를 화면에서 확인할 수 있습니다.

## 검증

```sh
npm test
npm run build
```

`npm run preview`는 빌드 결과만 제공합니다. 개발용 API 프록시는 포함하지 않으므로 미리보기에서 실시간 데이터를 보려면 `VITE_API_BASE_URL`을 설정한 상태로 빌드해야 합니다.

실제 공개 배포에는 사용자의 GitHub 저장소와 Cloudflare 계정 연결이 필요합니다. 인증키를 브라우저 코드의 `VITE_` 변수, 저장소, 로그에 기록하지 마세요.

## 도착 시간 계산 보정

예정 시간이 없어서 추정할 때에도 원천 생성 시각과 동일 상태 최초 관측 시각 중 이른 시각부터 경과 시간을 뺍니다. 진입·도착·출발 상태는 숫자 예정 시간보다 우선합니다. 화면은 API 서버 시각을 기준으로 계산하며, 중복 열차는 최신 정보를 선택하고 남은 역 수를 우선해 정렬합니다. 추정 시간이 만료되면 역에 도착했다고 단정하지 않고 위치 아이콘을 숨깁니다. 오래된 정보는 갱신 지연 배지를 표시하며, 계산 가능한 남은 시간은 계속 표시합니다.

상태별 70/110/140초와 역당 110초는 여전히 가정한 추정값이며 실측 운행시간이 아닙니다. 카카오맵이나 실제 도착시각과의 정량적인 정확도 비교는 수행하지 않았습니다.
