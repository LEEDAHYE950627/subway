export const STALE_MS = 120_000;
export function receivedTime(value) {
  if (!value) return NaN;
  const iso = value.replace(' ', 'T');
  return Date.parse(/[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + '+09:00');
}
export function arrivalTiming(row, now) {
  const seconds = Number(row.barvlDt);
  const generated = receivedTime(row.recptnDt);
  if (Number.isFinite(seconds) && seconds > 0 && Number.isFinite(generated)) {
    return { seconds: Math.max(0, Math.ceil(seconds - Math.max(0, now - generated) / 1000)), estimated: false };
  }
  const code = String(row.arvlCd);
  if (['0', '1', '2'].includes(code)) return { seconds: null, estimated: false };
  const message = row.arvlMsg2 || '';
  const minutes = message.match(/(\d+)\s*분/);
  const messageSeconds = message.match(/(\d+)\s*초/);
  const stations = message.match(/\[?(\d+)\]?\s*번째\s*전역/);
  const orderDistance = /^\d{5}/.test(row.ordkey || '') ? Number(row.ordkey.slice(2, 5)) : 0;
  const distance = stations ? Number(stations[1]) : orderDistance;
  const statusEstimate = { '3': 70, '4': 140, '5': 110 }[code];
  const total = minutes || messageSeconds ? Number(minutes?.[1] || 0) * 60 + Number(messageSeconds?.[1] || 0) : statusEstimate ?? (distance > 0 ? distance * 110 : null);
  if (total === null) return { seconds: null, estimated: false };
  const reference = Number.isFinite(row.observedAt) ? row.observedAt : generated;
  if (!Number.isFinite(reference)) return { seconds: null, estimated: false };
  const elapsed = Math.max(0, now - reference) / 1000;
  return { seconds: Math.max(0, Math.ceil(total - elapsed)), estimated: true };
}
export function remaining(row, now) { return arrivalTiming(row, now).seconds; }
export function isStale(row, now) {
  const time = receivedTime(row.recptnDt);
  return !Number.isFinite(time) || now - time > STALE_MS;
}
export function selectTrains(rows, direction) {
  const seen = new Set();
  return rows.filter(row => row.updnLine === direction && !['급행', '특급', 'ITX'].includes(row.btrainSttus) && String(row.arvlCd) !== '2')
    .sort((a, b) => String(a.ordkey ?? '').localeCompare(String(b.ordkey ?? '')) || Number(a.barvlDt) - Number(b.barvlDt))
    .filter(row => { const id = row.btrainNo || row.ordkey; if (seen.has(id)) return false; seen.add(id); return true; });
}
export function trainPosition(row, now, direction) {
  if (!row || isStale(row, now)) return null;
  const seconds = remaining(row, now);
  const code = String(row.arvlCd);
  let distance;
  if (seconds !== null) distance = Math.min(1.65, seconds / 110);
  else distance = ({ '0': 0.12, '1': 0, '3': 0.85, '4': 1.12, '5': 1 })[code];
  if (distance === undefined) return null;
  return direction === '상행' ? 50 - distance * 34 : 50 + distance * 34;
}
