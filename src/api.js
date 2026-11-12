export function arrivalsUrl(base, production = false) {
  const value = (base || '').trim().replace(/\/+$/, '');
  if (!value) {
    if (production) throw new Error('실시간 API 서버가 연결되지 않았습니다. 배포 설정의 VITE_API_BASE_URL에 Cloudflare Worker 주소를 등록한 뒤 다시 배포해 주세요.');
    return '/api/arrivals';
  }
  let url;
  try { url = new URL(value); } catch { throw new Error('VITE_API_BASE_URL에 올바른 API 서버 주소를 설정해 주세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('VITE_API_BASE_URL에는 경로 없는 HTTPS API 서버 주소를 설정해 주세요.');
  }
  return `${url.origin}/api/arrivals`;
}
