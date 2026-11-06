import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, TrainFront, Radio, RefreshCw, Maximize, Minimize, ArrowRight, CircleHelp, WifiOff } from './icons';
import { arrivalTiming, isStale, selectTrains, trainPosition } from './arrival';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const dateFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
const shortClock = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const statusNames = { '0': '중동역 진입', '1': '중동역 도착', '2': '중동역 출발', '3': '전역 출발', '4': '전역 진입', '5': '전역 도착' };

function Countdown({ row, now, small = false }) {
  const { seconds, estimated } = arrivalTiming(row, now);
  if (seconds === null) return <span className="unknown-time">{statusNames[row.arvlCd] || '시간 미제공'}</span>;
  if (seconds === 0) return <span className="unknown-time">도착 확인 중</span>;
  return <span className={small ? 'small-count' : 'countdown'}>{estimated && <span className="approx-label">약</span>}<b>{Math.floor(seconds / 60).toString().padStart(2, '0')}</b><span>분</span><b>{(seconds % 60).toString().padStart(2, '0')}</b><span>초</span>{!small && <em>{estimated ? '후 도착 추정' : '후 도착 예정'}</em>}</span>;
}

function RouteMap({ row, now, direction }) {
  const position = trainPosition(row, now, direction);
  return <div className="route-map" aria-label="송내, 중동, 부천 구간 열차 추정 위치">
    <div className="rail"><div className="rail-dashes"/></div>
    {position !== null && <div className={'train-marker ' + (direction === '하행' ? 'reverse' : '')} style={{ left: Math.max(3, Math.min(97, position)) + '%' }}><TrainFront size={22}/><span>{direction === '상행' ? '→' : '←'}</span></div>}
    <div className="stations">{['송내', '중동', '부천'].map((station, i) => <div className={'station station-' + i} key={station}><i/>{i === 1 && <small>현재 역</small>}<strong>{station}</strong></div>)}</div>
    <span className="route-caption">{direction === '상행' ? '부천 · 서울 방면 →' : '← 송내 · 인천 방면'}</span>
    <span className="estimate-label">{position !== null ? '도착정보 기반 추정 위치' : '위치정보 대기 중'}</span>
  </div>;
}

function DirectionCard({ direction, rows, now, loading, error }) {
  const trains = selectTrains(rows, direction);
  const first = trains[0];
  const east = direction === '상행';
  const Icon = east ? ArrowUpRight : ArrowDownLeft;
  return <section className={'direction-card ' + (east ? 'east' : 'west')}>
    <header className="card-header"><div className="direction-icon"><Icon size={28}/></div><div><span className="eyebrow">{east ? '서울 방면' : '인천 방면'} <span className="direction-en">{east ? 'EASTBOUND' : 'WESTBOUND'}</span></span><h2>{east ? '부천 · 구로' : '송내 · 인천'} <ArrowRight size={25}/></h2></div><span className="platform">{direction}</span></header>
    <div className="primary-arrival"><div className="arrival-top"><span className="sub-label">이번 열차</span>{first && <span className={'status-pill ' + (isStale(first, now) ? 'muted' : '')}><i/>{isStale(first, now) ? '정보 갱신 지연' : statusNames[first.arvlCd] || first.arvlMsg2 || '운행 중'}</span>}</div>
      {first ? <><div className="destination">{first.bstatnNm || first.trainLineNm?.split(' - ')[0] || '목적지 미제공'}{first.bstatnNm && '행'} <span>{first.btrainSttus || '일반'}{String(first.lstcarAt) === '1' ? ' · 막차' : ''}</span></div><Countdown row={first} now={now}/><div className="train-detail"><TrainFront size={14}/><span>{first.arvlMsg3 || first.arvlMsg2 || '열차 운행 중'}</span><span className="train-number">{first.btrainNo ? '#' + first.btrainNo : ''}</span></div></> : <div className="empty-arrival"><TrainFront size={34}/><strong>{loading ? '도착정보를 불러오고 있어요' : error ? '도착정보 연결 대기 중' : '현재 도착 예정 열차가 없습니다'}</strong><span>{loading ? '잠시만 기다려 주세요.' : '새로운 정보가 들어오면 자동으로 표시됩니다.'}</span></div>}
    </div>
    <RouteMap row={first} now={now} direction={direction}/>
    <div className="following"><span className="sub-label">다음 열차</span>{trains[1] ? <><div className="following-destination"><strong>{trains[1].bstatnNm || '목적지 미제공'}행</strong><span>{trains[1].arvlMsg2 || '운행 중'}</span></div><Countdown row={trains[1]} now={now} small/></> : <span className="following-empty">{loading ? '확인 중' : '도착정보 대기 중'}</span>}</div>
  </section>;
}

export default function App() {
  const [now, setNow] = useState(Date.now());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [full, setFull] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (import.meta.env.PROD && !API_BASE) {
      setLoading(false);
      setError('실시간 도착정보 서버 연결을 준비 중입니다. API 서버 배포 후 도착정보가 표시됩니다.');
      return;
    }
    let active = true;
    let controller;
    async function load() {
      if (controller) return;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 16000);
      if (active) setLoading(true);
      try {
        const response = await fetch(API_BASE + '/api/arrivals', { signal: controller.signal, cache: 'no-store' });
        let body;
        try { body = await response.json(); } catch { throw new Error('API 연결 주소를 확인해 주세요. GitHub Pages에서는 별도 API 서버가 필요합니다.'); }
        if (!response.ok || body.error) throw new Error(body.error || '도착정보를 가져오지 못했습니다.');
        if (!Array.isArray(body.arrivals) || !Number.isFinite(body.fetchedAt)) throw new Error('도착정보 응답이 올바르지 않습니다.');
        if (active) { setData(body); setError(''); }
      } catch (e) { if (active) setError(e.name === 'AbortError' ? '연결 시간이 초과되었습니다. 자동으로 다시 시도합니다.' : e.message); }
      finally { clearTimeout(timeout); controller = null; if (active) setLoading(false); }
    }
    load();
    const timer = setInterval(load, 1000);
    const resume = () => { if (!document.hidden) { setNow(Date.now()); load(); } };
    document.addEventListener('visibilitychange', resume);
    return () => { active = false; clearInterval(timer); controller?.abort(); document.removeEventListener('visibilitychange', resume); };
  }, [refresh]);
  useEffect(() => { const listener = () => setFull(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', listener); return () => document.removeEventListener('fullscreenchange', listener); }, []);
  const stale = data && now - data.fetchedAt > 120000;
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { setError('이 브라우저에서는 전체화면을 지원하지 않습니다.'); } }
  const hm = clock.format(now).slice(0, 5);
  const sec = clock.format(now).slice(6);
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="./"><span className="brand-icon"><TrainFront size={23}/></span><span>STATION<span className="brand-light"> LIVE</span></span></a><div className="top-actions"><span className={'connection ' + (error || stale ? 'offline' : '')}><i/>{error || stale ? '연결 확인 중' : loading && !data ? '연결 중' : '자동 업데이트'}</span><button className="icon-button" onClick={fullscreen} title={full ? '전체화면 종료' : '전체화면'} aria-label={full ? '전체화면 종료' : '전체화면'}>{full ? <Minimize size={19}/> : <Maximize size={19}/>}</button></div></header>
    <main>
      <section className="hero"><div className="station-heading"><div className="line-label"><span>1</span>수도권 전철 1호선 <i/> 경인선</div><h1>중동역<span>Jung-dong</span></h1><p>오늘도, 여유로운 출발을 위해.</p></div><div className="clock-panel"><div className="clock-label"><span className="live-dot"/>현재 시간 <span>SEOUL, KR</span></div><div className="clock" aria-label={'현재 시간 ' + clock.format(now)}>{hm}<span className="clock-seconds">:{sec}</span></div><div className="date">{dateFormat.format(now)}</div></div></section>
      <div className="section-heading"><h2><Radio size={17}/> 실시간 도착 안내</h2><span>1초마다 실시간 조회 <span className="divider">/</span> 남은 시간은 매초 업데이트</span></div>
      {(error || stale) && <div className="error-banner" role="status"><WifiOff size={18}/><span>{error || '최근 정보 수신이 지연되고 있습니다. 다시 연결합니다.'}{data ? ' · 마지막 수신 정보를 표시하고 있습니다.' : ''}</span><button disabled={loading} onClick={() => setRefresh(v => v + 1)}>다시 연결</button></div>}
      <div className="cards"><DirectionCard direction="상행" rows={data?.arrivals || []} now={now} loading={loading} error={error}/><DirectionCard direction="하행" rows={data?.arrivals || []} now={now} loading={loading} error={error}/></div>
      <div className="info-strip"><div><span className="info-icon">i</span><p>열차의 실제 운행 상황에 따라 도착 시간이 달라질 수 있습니다.<br/><span>열차 아이콘은 도착정보를 바탕으로 움직이는 추정 위치입니다.</span></p></div><button onClick={() => setHelp(v => !v)} aria-expanded={help}><CircleHelp size={16}/> 이용 안내</button></div>
      {help && <div className="help-panel"><strong>도착 안내를 읽는 방법</strong><p>서울시 API를 1초마다 조회하고, 정보 생성 시각부터 지난 시간을 반영해 남은 시간을 매초 계산합니다. 초 단위 표시는 GPS 실측값이 아닙니다. 위치는 역간 약 110초를 가정한 추정입니다. API가 도착 예정 초를 제공하지 않으면 전역 상태·남은 역 수로 추정한 시간을 ‘약’으로 표시합니다. 2분 이상 지난 원천 정보에는 갱신 지연 안내를 표시합니다. 시간이 0이 되어도 실제 도착이 확인되기 전에는 ‘도착 확인 중’으로 표시합니다. 중동역에 정차하지 않는 급행·특급은 제외합니다.</p></div>}
    </main>
    <footer><span>데이터 제공 <a href="https://data.seoul.go.kr/dataList/OA-12764/A/1/datasetView.do" target="_blank" rel="noreferrer">서울 열린데이터광장 <ArrowUpRight size={12}/></a></span><div><span className="last-update">{data ? '마지막 수신 ' + shortClock.format(data.fetchedAt) : '도착정보 수신 대기'}</span><button onClick={() => setRefresh(v => v + 1)} disabled={loading} aria-label="도착정보 다시 불러오기"><RefreshCw size={14} className={loading ? 'spin' : ''}/></button><span className="footer-line"/>JUNGDONG STATION</div></footer>
  </div>;
}
