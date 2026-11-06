import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
test('API rejects missing configuration without disclosing a key', async () => {
  const { getArrivals } = await import('../server/arrivals.js?case=missing');
  await assert.rejects(getArrivals(''), /인증키/);
  await assert.rejects(getArrivals('test-secret', async () => {
    throw new TypeError('fetch failed', { cause: { code: 'EACCES' } });
  }), /외부 네트워크 접근이 차단/);
});
test('API handles upstream errors, empty service, filtering and only merges in-flight requests', async () => {
  const { getArrivals } = await import('../server/arrivals.js?case=responses');
  await assert.rejects(getArrivals('test-secret', async () => Response.json({ errorMessage: { code: 'INFO-100' } })), /인증키/);
  await assert.rejects(getArrivals('test-secret', async () => new Response('bad json')), /올바르지 않은/);
  await assert.rejects(getArrivals('test-secret', async () => Response.json({ code: 'ERROR-336', message: '최대 1000건' })), /ERROR-336.*최대 1000건/);
  await assert.rejects(getArrivals('test-secret', async () => Response.json({ RESULT: { code: 'ERROR-336', message: '최대 1000건' } })), /ERROR-336/);
  let requests = 0;
  const fetcher = async (url) => {
    assert.ok(url.endsWith('/json/realtimeStationArrival/1/100/%EC%A4%91%EB%8F%99/'));
    requests++;
    return Response.json({ errorMessage: { code: 'INFO-000' }, realtimeArrivalList: [
      { subwayId: '1001', statnNm: '중동', btrainNo: '42', privateField: 'omit' },
      { subwayId: '1002', statnNm: '중동' }, { subwayId: '1001', statnNm: '부천' },
    ] });
  };
  const [first, second] = await Promise.all([getArrivals('test-secret', fetcher), getArrivals('test-secret', fetcher)]);
  assert.equal(requests, 1);
  assert.deepEqual(first, second);
  assert.equal(first.arrivals.length, 1);
  assert.equal(first.arrivals[0].btrainNo, '42');
  assert.equal(first.arrivals[0].privateField, undefined);
  await getArrivals('test-secret', fetcher);
  assert.equal(requests, 2);
  const { getArrivals: empty } = await import('../server/arrivals.js?case=empty');
  assert.deepEqual((await empty('test-secret', async () => Response.json({ errorMessage: { code: 'INFO-200' } }))).arrivals, []);
});
test('Worker restricts routes, methods and browser origins', async () => {
  const env = { ALLOWED_ORIGIN: 'https://example.github.io' };
  const request = (path, options) => new Request('https://api.example.com' + path, options);
  assert.equal((await worker.fetch(request('/other'), env)).status, 404);
  assert.equal((await worker.fetch(request('/api/arrivals', { method: 'POST' }), env)).status, 405);
  assert.equal((await worker.fetch(request('/api/arrivals', { headers: { Origin: 'https://other.example.com' } }), env)).status, 403);
  const response = await worker.fetch(request('/api/arrivals', { headers: { Origin: env.ALLOWED_ORIGIN } }), env);
  assert.equal(response.status, 502);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), env.ALLOWED_ORIGIN);
  assert.match((await response.json()).error, /인증키/);
});
