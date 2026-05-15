// Runner-side for batch-backfill av Strava-soner. Auto-pinger neste batch
// til is_done. Samme pattern som import-runner men uten Strava API-kall —
// kun DB-operasjoner per workout, så ingen rate-limit-bekymringer. Pause
// på 200ms holder DB-trykk lavt uten å bremse merkbart.

const HTML = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="utf-8">
<title>Strava zones backfill runner</title>
<style>
  body { font-family: ui-monospace, monospace; background: #0A0A0B; color: #F0F0F2; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 20px; color: #FF4500; margin: 0 0 16px; }
  .stat { display: inline-block; padding: 6px 10px; margin: 4px 6px 4px 0; background: #13131A; border: 1px solid #1E1E22; }
  .stat b { color: #FF4500; }
  .ok { color: #28A86E; }
  .fail { color: #E11D48; }
  .skip { color: #8A8A96; }
  .reasons { padding: 12px; background: #13131A; border: 1px solid #1E1E22; margin-top: 12px; font-size: 12px; }
  .reasons div { padding: 3px 0; border-bottom: 1px solid #1E1E22; }
  .log { max-height: 400px; overflow-y: auto; padding: 12px; background: #13131A; border: 1px solid #1E1E22; margin-top: 16px; font-size: 12px; }
  .log div { margin-bottom: 4px; }
  .controls { margin-top: 16px; }
  button { background: #FF4500; color: #fff; border: none; padding: 8px 16px; cursor: pointer; font-family: inherit; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
  input { background: #1A1A22; color: #F0F0F2; border: 1px solid #1E1E22; padding: 6px 10px; width: 60px; font-family: inherit; }
  label { font-size: 12px; color: #8A8A96; margin-right: 12px; }
</style>
</head>
<body>
<h1>Strava zones backfill runner</h1>

<div class="controls">
  <label>batch: <input id="batch" type="number" value="20"></label>
  <button id="start">Start</button>
  <button id="stop" disabled>Stop</button>
</div>

<div id="stats" style="margin-top: 16px;">
  <span class="stat">Batches: <b id="batches">0</b></span>
  <span class="stat">Workouts oppdatert: <b id="updated" class="ok">0</b></span>
  <span class="stat">Uten endring: <b id="failed" class="skip">0</b></span>
  <span class="stat">Igjen: <b id="remaining">?</b></span>
  <span class="stat">Total: <b id="total">?</b></span>
</div>

<div id="status" style="margin-top: 16px; font-size: 14px; color: #8A8A96;">Klikk Start for å begynne.</div>

<div class="reasons" id="reasons" style="display: none;">
  <div style="color: #8A8A96; font-weight: 600; padding-bottom: 6px;">Oppsummering per status:</div>
  <div id="reasons-body"></div>
</div>

<div class="log" id="log"></div>

<script>
let stopFlag = false;
let totals = { batches: 0, updated: 0, failed: 0 };
const reasonsAcc = {};

const $ = (id) => document.getElementById(id);
const log = (msg, cls = '') => {
  const d = document.createElement('div');
  if (cls) d.className = cls;
  d.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  $('log').appendChild(d);
  $('log').scrollTop = $('log').scrollHeight;
};

const updateStats = () => {
  $('batches').textContent = totals.batches;
  $('updated').textContent = totals.updated;
  $('failed').textContent = totals.failed;
};

const renderReasons = () => {
  if (Object.keys(reasonsAcc).length === 0) return;
  $('reasons').style.display = 'block';
  const body = $('reasons-body');
  body.innerHTML = '';
  const sorted = Object.entries(reasonsAcc).sort((a, b) => b[1] - a[1]);
  for (const [reason, count] of sorted) {
    const cls = reason === 'OK' ? 'ok' : 'skip';
    const d = document.createElement('div');
    d.innerHTML = '<span class="' + cls + '">' + count + '×</span> ' + reason;
    body.appendChild(d);
  }
};

async function runBatch(batch, offset) {
  const url = '/api/admin/backfill-strava-zones?batch=' + batch + '&offset=' + offset;
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error('HTTP ' + res.status + ': ' + t.slice(0, 200));
  }
  return await res.json();
}

async function start() {
  stopFlag = false;
  totals = { batches: 0, updated: 0, failed: 0 };
  for (const k of Object.keys(reasonsAcc)) delete reasonsAcc[k];
  $('log').innerHTML = '';
  $('reasons').style.display = 'none';
  $('start').disabled = true;
  $('stop').disabled = false;
  $('status').textContent = 'Kjører...';
  updateStats();

  const batch = parseInt($('batch').value) || 20;
  let offset = 0;

  try {
    while (!stopFlag) {
      const t0 = Date.now();
      const r = await runBatch(batch, offset);
      const elapsed = Date.now() - t0;
      totals.batches++;
      totals.updated += r.updated_workouts_in_batch;
      totals.failed += r.failed_this_batch;
      $('remaining').textContent = r.total_remaining;
      $('total').textContent = r.total;
      for (const reason in r.reason_summary) {
        reasonsAcc[reason] = (reasonsAcc[reason] || 0) + r.reason_summary[reason];
      }
      log('Batch offset=' + offset + ' (' + elapsed + 'ms) — oppdatert ' + r.updated_workouts_in_batch + '/' + r.processed_in_batch + ' (igjen: ' + r.total_remaining + ')');
      for (const item of r.results) {
        const ok = item.updated_laps > 0;
        const cls = ok ? 'ok' : 'skip';
        const txt = (ok ? 'OK ' : '— ') + item.workout_id.slice(0, 8) + ' · ' + item.updated_laps + '/' + item.total_laps + ' laps · ' + item.reason;
        log(txt, cls);
      }
      updateStats();
      renderReasons();
      if (r.is_done || r.next_offset === null) {
        $('status').textContent = 'FERDIG! Oppdatert ' + totals.updated + '/' + r.total + ' workouts.';
        log('=== FERDIG ===', 'ok');
        break;
      }
      offset = r.next_offset;
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (e) {
    log('FEIL: ' + (e.message || e), 'fail');
    $('status').textContent = 'STOPPET med feil: ' + (e.message || e);
  } finally {
    $('start').disabled = false;
    $('stop').disabled = true;
    if (stopFlag) {
      $('status').textContent = 'Stoppet manuelt.';
      log('Manuelt stoppet.', 'skip');
    }
  }
}

$('start').onclick = start;
$('stop').onclick = () => { stopFlag = true; log('Stopp-signal mottatt — venter på siste batch...', 'skip'); };
</script>
</body>
</html>`

export async function GET() {
  return new Response(HTML, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  })
}
