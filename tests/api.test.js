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
  let positionRequests = 0;
  const fetcher = async (url) => {
    if (url.includes('/realtimePosition/')) {
      positionRequests++;
      return Response.json({ realtimePositionList: [{ subwayId: '1001', trainNo: '0042', directAt: '0' }] });
    }
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
  assert.equal(positionRequests, 1);
  const { getArrivals: empty } = await import('../server/arrivals.js?case=empty');
  assert.deepEqual((await empty('test-secret', async () => Response.json({ errorMessage: { code: 'INFO-200' } }))).arrivals, []);
});

test('cross-checks local service and excludes express trains mislabeled as normal', async () => {
  const { stoppingAtJungdong } = await import('../server/arrivals.js');
  const arrivals = [
    { btrainNo: '0152', btrainSttus: '일반', ordkey: '01002연천0' },
    { btrainNo: '1109', btrainSttus: '일반', ordkey: '12006동인천0' },
    { btrainNo: '2', btrainSttus: '일반', trainLineNm: '동인천행 (특급)' },
    { btrainNo: '3', btrainSttus: ' 일반 ', ordkey: '01005용산1' },
    { btrainNo: '4', btrainSttus: 'ITX-청춘' },
    { btrainNo: '5', btrainSttus: '일반' },
  ];
  const positions = [
    { subwayId: '1001', trainNo: 'K152', directAt: '0' },
    { subwayId: '1001', trainNo: '1109', directAt: '1' },
    ...['2', '3', '4'].map(trainNo => ({ subwayId: '1001', trainNo, directAt: '0' })),
  ];
  assert.deepEqual(stoppingAtJungdong(arrivals, positions).map(row => row.btrainNo), ['0152']);
  assert.deepEqual(stoppingAtJungdong(arrivals, []), []);
});

test('does not return unverified arrivals when service classification fails', async () => {
  const { getArrivals } = await import('../server/arrivals.js?case=position-failure');
  const fetcher = async url => url.includes('/realtimePosition/')
    ? new Response('unavailable', { status: 503 })
    : Response.json({ realtimeArrivalList: [{ subwayId: '1001', statnNm: '중동', btrainNo: '1109', btrainSttus: '일반' }] });
  await assert.rejects(getArrivals('secret-test-key', fetcher), /정차 여부/);
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

