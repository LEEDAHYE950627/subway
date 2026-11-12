import { arrivalsUrl } from '../src/api.js';

const endpoint = arrivalsUrl(process.env.VITE_API_BASE_URL, true);
if (!process.env.PAGES_ORIGIN) throw new Error('PAGES_ORIGIN을 설정해 주세요.');
const origin = new URL(process.env.PAGES_ORIGIN).origin;
const response = await fetch(endpoint, {
  headers: { Origin: origin },
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw new Error(`실시간 API 연결 실패 (HTTP ${response.status}). Worker 배포와 API 인증키를 확인해 주세요.`);
if (response.headers.get('Access-Control-Allow-Origin') !== origin) {
  throw new Error('Worker의 ALLOWED_ORIGIN을 GitHub Pages origin으로 설정해 주세요.');
}
const body = await response.json();
if (!Array.isArray(body.arrivals) || !Number.isFinite(body.fetchedAt) || body.error) {
  throw new Error('실시간 API 응답 형식이 올바르지 않습니다.');
}
console.log('실시간 API 연결 및 CORS 확인 완료');
