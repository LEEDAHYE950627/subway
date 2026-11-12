let pending;
let positionCache;
const trainId = value => String(value ?? '').trim().replace(/^K/i, '').replace(/^0+(?=\d)/, '');

export function stoppingAtJungdong(arrivals, positions) {
  const trains = new Map(positions.filter(row => String(row.subwayId) === '1001').map(row => [trainId(row.trainNo), row]));
  return arrivals.filter(row => {
    const position = trains.get(trainId(row.btrainNo));
    if (!position) return false;
    const service = row.btrainSttus + ' ' + (row.trainLineNm || '');
    if (/특급|ITX/i.test(service)) return false;
    const destination = String(row.bstatnNm || row.trainLineNm?.split(' - ')[0] || '')
      .replace(/\([^)]*\)/g, '').replace(/\s/g, '').replace(/행$/, '');
    // Gyeongwon express trains stop locally on the Gyeongin section.
    // Do not confuse Incheon with Dongincheon (Gyeongin express).
    const localSectionExpress = (destination === '동두천' && row.updnLine === '상행')
      || (destination === '인천' && row.updnLine === '하행');
    if (localSectionExpress) return ['0', '1'].includes(String(position.directAt));
    return String(position.directAt) === '0'
      && !/급행/.test(service)
      && !/^[01]\d\d{3}.+[1-9]$/.test(String(row.ordkey ?? ''));
  });
}

async function getPositions(key, fetcher) {
  if (positionCache?.key === key && Date.now() - positionCache.at < 15000) return positionCache.rows;
  try {
    const response = await fetcher(`http://swopenapi.seoul.go.kr/api/subway/${encodeURIComponent(key)}/json/realtimePosition/1/1000/${encodeURIComponent('1호선')}/`, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (!Array.isArray(data.realtimePositionList)) throw new Error();
    positionCache = { key, at: Date.now(), rows: data.realtimePositionList };
    return positionCache.rows;
  } catch {
    throw new Error('열차의 중동역 정차 여부를 확인하지 못했습니다. 잠시 후 자동으로 다시 확인합니다.');
  }
}
const observations = new Map();
function observe(row) {
  const id = `${row.updnLine}:${row.btrainNo}`;
  const signature = JSON.stringify([row.arvlCd, row.arvlMsg2, row.arvlMsg3, row.ordkey]);
  const previous = observations.get(id);
  const observedAt = previous?.signature === signature ? previous.observedAt : Date.now();
  observations.set(id, { signature, observedAt });
  for (const [key, value] of observations) if (Date.now() - value.observedAt > 3600000) observations.delete(key);
  return observedAt;
}
export async function getArrivals(key, fetcher = fetch) {
  if (!key) throw new Error('서버에 서울 지하철 API 인증키를 설정해 주세요.');
  if (pending) return pending;
  pending = (async () => {
    const url = `http://swopenapi.seoul.go.kr/api/subway/${encodeURIComponent(key)}/json/realtimeStationArrival/1/100/${encodeURIComponent('중동')}/`;
    let response;
    try { response = await fetcher(url, { signal: AbortSignal.timeout(12_000), cache: 'no-store' }); }
    catch (error) {
      const code = error.cause?.code || error.code;
      if (code === 'EACCES' || code === 'EPERM') {
        throw new Error('개발 서버의 외부 네트워크 접근이 차단되어 있습니다. PC 터미널에서 npm.cmd run dev를 직접 실행해 주세요.');
      }
      throw new Error('서울시 도착정보 서버에 연결할 수 없습니다. 잠시 후 자동으로 다시 시도합니다.');
    }
    if (!response.ok) throw new Error('서울시 도착정보 서버가 응답하지 않습니다.');
    let data;
    try { data = await response.json(); }
    catch { throw new Error('서울시에서 올바르지 않은 응답을 받았습니다.'); }
    const code = data.errorMessage?.code ?? data.RESULT?.CODE ?? data.RESULT?.code ?? data.code;
    if (code && !['INFO-000', 'INFO-200'].includes(code)) {
      const message = data.errorMessage?.message ?? data.RESULT?.MESSAGE ?? data.RESULT?.message ?? data.message;
      throw new Error(code === 'INFO-100' ? '서울 지하철 API 인증키를 확인해 주세요.' : `서울시 API 오류 (${code})${message ? `: ${String(message).replaceAll(key, '[인증키]')}` : '. 잠시 후 다시 시도합니다.'}`);
    }
    if (!Array.isArray(data.realtimeArrivalList) && code !== 'INFO-200') throw new Error('서울시 도착정보 응답 형식을 확인할 수 없습니다.');
    const arrivals = (data.realtimeArrivalList ?? []).filter(row => String(row.subwayId) === '1001' && row.statnNm === '중동');
    const stopping = arrivals.length ? stoppingAtJungdong(arrivals, await getPositions(key, fetcher)) : [];
    return {
      fetchedAt: Date.now(),
      arrivals: stopping.map(row => ({
        observedAt: observe(row),
        updnLine: row.updnLine, trainLineNm: row.trainLineNm, btrainNo: row.btrainNo,
        bstatnNm: row.bstatnNm, btrainSttus: row.btrainSttus, barvlDt: row.barvlDt,
        recptnDt: row.recptnDt, arvlMsg2: row.arvlMsg2, arvlMsg3: row.arvlMsg3,
        arvlCd: row.arvlCd, ordkey: row.ordkey, lstcarAt: row.lstcarAt,
      })),
    };
  })();
  try { return await pending; } finally { pending = undefined; }
}
