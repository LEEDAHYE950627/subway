let pending;
const observations = new Map();
function observe(row) {
  const id = row.updnLine + ':' + row.btrainNo;
  const signature = JSON.stringify([row.recptnDt, row.arvlCd, row.arvlMsg2, row.ordkey]);
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
    const url = 'http://swopenapi.seoul.go.kr/api/subway/' + encodeURIComponent(key) + '/json/realtimeStationArrival/1/100/' + encodeURIComponent('중동') + '/';
    let response;
    try { response = await fetcher(url, { signal: AbortSignal.timeout(12_000), cache: 'no-store' }); }
    catch (error) {
      const code = error.cause?.code || error.code;
      if (code === 'EACCES' || code === 'EPERM') throw new Error('개발 서버의 외부 네트워크 접근이 차단되어 있습니다. PC 터미널에서 npm.cmd run dev를 직접 실행해 주세요.');
      throw new Error('서울시 도착정보 서버에 연결할 수 없습니다. 잠시 후 자동으로 다시 시도합니다.');
    }
    if (!response.ok) throw new Error('서울시 도착정보 서버가 응답하지 않습니다.');
    let data;
    try { data = await response.json(); }
    catch { throw new Error('서울시에서 올바르지 않은 응답을 받았습니다.'); }
    const code = data.errorMessage?.code ?? data.RESULT?.CODE ?? data.RESULT?.code ?? data.code;
    if (code && !['INFO-000', 'INFO-200'].includes(code)) {
      const message = data.errorMessage?.message ?? data.RESULT?.MESSAGE ?? data.RESULT?.message ?? data.message;
      throw new Error(code === 'INFO-100' ? '서울 지하철 API 인증키를 확인해 주세요.' : '서울시 API 오류 (' + code + ')' + (message ? ': ' + String(message).replaceAll(key, '[인증키]') : '. 잠시 후 다시 시도합니다.'));
    }
    if (!Array.isArray(data.realtimeArrivalList) && code !== 'INFO-200') throw new Error('서울시 도착정보 응답 형식을 확인할 수 없습니다.');
    return {
      fetchedAt: Date.now(),
      arrivals: (data.realtimeArrivalList ?? []).filter(row => String(row.subwayId) === '1001' && row.statnNm === '중동').map(row => ({
        observedAt: observe(row), updnLine: row.updnLine, trainLineNm: row.trainLineNm, btrainNo: row.btrainNo,
        bstatnNm: row.bstatnNm, btrainSttus: row.btrainSttus, barvlDt: row.barvlDt,
        recptnDt: row.recptnDt, arvlMsg2: row.arvlMsg2, arvlMsg3: row.arvlMsg3,
        arvlCd: row.arvlCd, ordkey: row.ordkey, lstcarAt: row.lstcarAt,
      })),
    };
  })();
  try { return await pending; } finally { pending = undefined; }
}
