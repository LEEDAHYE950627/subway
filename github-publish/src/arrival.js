export const STALE_MS = 120_000;
export function receivedTime(value) {
  if (!value) return NaN;
  const iso = value.replace(' ', 'T');
  return Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + '+09:00');
}
export function arrivalTiming(row, now) {
  const code = String(row.arvlCd);
  // Confirmed station state takes precedence over a conflicting countdown.
  if (['0', '1', '2'].includes(code)) return { seconds: null, estimated: false };
  const seconds = Number(row.barvlDt);
  const generated = receivedTime(row.recptnDt);
  if (Number.isFinite(seconds) && seconds > 0 && Number.isFinite(generated)) {
    return { seconds: Math.max(0, Math.ceil(seconds - Math.max(0, now - generated) / 1000)), estimated: false };
  }
  // A zero from Seoul means no ETA was supplied, not an actual arrival.
  const message = row.arvlMsg2 || '';
  const minutes = message.match(/(\d+)\s*분/);
  const messageSeconds = message.match(/(\d+)\s*초/);
  const stations = message.match(/\[?(\d+)\]?\s*번째\s*전역/);
  const orderDistance = /^\d{5}/.test(row.ordkey || '') ? Number(row.ordkey.slice(2, 5)) : 0;
  const distance = stations ? Number(stations[1]) : orderDistance;
  const statusEstimate = { '3': 70, '4': 140, '5': 110 }[code];
  const total = minutes || messageSeconds ? Number(minutes?.[1] || 0) * 60 + Number(messageSeconds?.[1] || 0) : statusEstimate ?? (distance > 0 ? distance * 110 : null);
  if (total === null) return { seconds: null, estimated: false };
  // Retain the first observation of an unchanged status: polling must not reset the timer.
  const references = [row.observedAt, generated].filter(Number.isFinite);
  const reference = references.length ? Math.min(...references) : NaN;
  if (!Number.isFinite(reference)) return { seconds: null, estimated: false };
  const elapsed = Math.max(0, now - reference) / 1000;
  return { seconds: Math.max(0, Math.ceil(total - elapsed)), estimated: true };
}
export function remaining(row, now) { return arrivalTiming(row, now).seconds; }
export function isStale(row, now) {
  const time = receivedTime(row.recptnDt);
  const unchangedArrival = ['0', '1'].includes(String(row.arvlCd)) && Number.isFinite(row.observedAt) && now - row.observedAt > STALE_MS;
  return !Number.isFinite(time) || now - time > STALE_MS || unchangedArrival;
}
export function selectTrains(rows, direction) {
  // Resolve repeated records before excluding departed trains; an old inbound
  // record must never replace a newer departure record for the same train.
  const latest = new Map();
  for (const row of rows.filter(row => row.updnLine === direction)) {
    const id = row.btrainNo || row.ordkey;
    const previous = latest.get(id);
    if (!previous || (receivedTime(row.recptnDt) || 0) > (receivedTime(previous.recptnDt) || 0)) latest.set(id, row);
  }
  const distance = row => {
    if (String(row.arvlCd) === '1') return -2;
    if (String(row.arvlCd) === '0') return -1;
    return /^\d{5}/.test(row.ordkey || '') ? Number(row.ordkey.slice(2, 5)) : Infinity;
  };
  return [...latest.values()].filter(row => String(row.arvlCd) !== '2')
    .sort((a, b) => distance(a) - distance(b) || Number(a.barvlDt) - Number(b.barvlDt) || String(a.ordkey ?? '').localeCompare(String(b.ordkey ?? '')));
}
export function trainPosition(row, now, direction) {
  if (!row || isStale(row, now)) return null;
  const seconds = remaining(row, now);
  const code = String(row.arvlCd);
  let distance;
  if (seconds === 0) return null; // An expired prediction is not a measured station arrival.
  if (seconds !== null) distance = Math.min(1.65, seconds / 110);
  else distance = ({ '0': 0.12, '1': 0, '3': 0.85, '4': 1.12, '5': 1 })[code];
  if (distance === undefined) return null;
  return direction === '상행' ? 50 - distance * 34 : 50 + distance * 34;
}
