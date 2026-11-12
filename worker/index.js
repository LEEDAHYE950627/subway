import { getArrivals } from '../server/arrivals.js';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGIN;
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    if (allowed && origin === allowed) headers['Access-Control-Allow-Origin'] = allowed;
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } });
    if (new URL(request.url).pathname !== '/api/arrivals') return new Response('{"error":"Not found"}', { status: 404, headers });
    if (request.method !== 'GET') return new Response(null, { status: 405, headers });
    if (origin && origin !== allowed) return new Response('{"error":"허용되지 않은 요청입니다."}', { status: 403, headers });
    try { return Response.json(await getArrivals(env.SEOUL_SUBWAY_API_KEY), { headers }); }
    catch (error) { return Response.json({ error: error.message }, { status: 502, headers }); }
  },
};
