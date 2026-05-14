// Runner-side for batch-import. Returnerer HTML med inline script som
// auto-pinger /api/admin/import-all-missing-strava?batch=20&offset=N
// til alle missing er importert. Viser løpende fremdrift og samler
// total-resultatet.
//
// Åpne denne i nettleseren mens innlogget. Ingen knapp — den starter
// automatisk og viser status. Lukk fanen for å stoppe.

const HTML = `<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="utf-8">
<title>Strava bulk-import runner</title>
<style>
  body { font-family: ui-monospace, monospace; background: #0A0A0B; color: #F0F0F2; padding: 24px; max-width: 900px; margin: 0 auto; }
  h1 { font-size: 20px; color: #FF4500; margin: 0 0 16px; }
  .row { padding: 6px 0; border-bottom: 1px solid #1E1E22; font-size: 13px; }
  .stat { display: inline-block; padding: 6px 10px; margin: 4px 6px 4px 0; background: #13131A; border: 1px solid #1E1E22; }
  .stat b { color: #FF4500; }
  .ok { color: #28A86E; }
  .fail { color: #E11D48; }
  .skip { color: #8A8A96; }
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
<h1>Strava bulk-import runner</h1>

<div class="controls">
  <label>days: <input id="days" type="number" value="365"></label>
  <label>batch: <input id="batch" type="number" value="20"></label>
  <button id="start">Start</button>
  <button id="stop" disabled>Stop</button>
</div>

<div id="stats" style="margin-top: 16px;">
  <span class="stat">Batches kjørt: <b id="batches">0</b></span>
  <span class="stat">Importert: <b id="imported" class="ok">0</b></span>
  <span class="stat">Skipped: <b id="skipped" class="skip">0</b></span>
  <span class="stat">Feilet: <b id="failed" class="fail">0</b></span>
  <span class="stat">Igjen: <b id="remaining">?</b></span>
</div>

<div id="status" style="margin-top: 16px; font-size: 14px; color: #8A8A96;">Klikk Start for å begynne.</div>

<div class="log" id="log"></div>

<script>
let stopFlag = false;
let totals = { batches: 0, imported: 0, skipped: 0, failed: 0 };
const failedBySport = {};

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
  $('imported').textContent = totals.imported;
  $('skipped').textContent = totals.skipped;
  $('failed').textContent = totals.failed;
};

async function runBatch(days, batch, offset) {
  const url = '/api/admin/import-all-missing-strava?days=' + days + '&batch=' + batch + '&offset=' + offset;
  log('Henter batch offset=' + offset + '...');
  const res = await fetch(url);
  if (!res.ok) {
    const t = await res.text();
    throw new Error('HTTP ' + res.status + ': ' + t.slice(0, 200));
  }
  return await res.json();
}

async function start() {
  stopFlag = false;
  totals = { batches: 0, imported: 0, skipped: 0, failed: 0 };
  $('log').innerHTML = '';
  $('start').disabled = true;
  $('stop').disabled = false;
  $('status').textContent = 'Kjører...';
  updateStats();

  const days = parseInt($('days').value) || 365;
  const batch = parseInt($('batch').value) || 20;
  let offset = 0;

  try {
    while (!stopFlag) {
      const t0 = Date.now();
      const r = await runBatch(days, batch, offset);
      const elapsedMs = Date.now() - t0;
      totals.batches++;
      totals.imported += r.imported_this_batch;
      totals.skipped += r.skipped_this_batch;
      totals.failed += r.failed_this_batch;
      $('remaining').textContent = r.total_remaining;
      for (const sport in r.failed_by_sport_type) {
        failedBySport[sport] = (failedBySport[sport] || 0) + r.failed_by_sport_type[sport];
      }
      log('Batch offset=' + offset + ' ferdig på ' + elapsedMs + 'ms — imp=' + r.imported_this_batch + ' skip=' + r.skipped_this_batch + ' fail=' + r.failed_this_batch + ' (igjen: ' + r.total_remaining + ')');
      for (const item of r.results) {
        const cls = item.status === 'imported' ? 'ok' : item.status === 'failed' ? 'fail' : 'skip';
        const txt = item.status + ' — ' + item.date + ' ' + item.sport_type + ' "' + item.name + '"' + (item.error ? ' — ' + item.error : '');
        log(txt, cls);
      }
      updateStats();

      // Rate-limited? Pause auto til Strava-vinduet er nytt (15 min) og prøv samme offset.
      if (r.rate_limited) {
        const waitSec = r.retry_after_seconds || 900;
        log('429 RATE-LIMIT — venter ' + waitSec + ' sek før retry på samme offset (' + offset + ')...', 'fail');
        $('status').textContent = 'Rate-limit — venter ' + waitSec + ' sek...';
        for (let s = waitSec; s > 0 && !stopFlag; s -= 5) {
          $('status').textContent = 'Rate-limit — venter ' + s + ' sek (offset=' + offset + ')...';
          await new Promise(r => setTimeout(r, 5000));
        }
        if (stopFlag) break;
        $('status').textContent = 'Retry offset=' + offset + ' etter pause...';
        log('Pause ferdig — fortsetter på offset=' + offset, 'skip');
        continue; // retry samme offset (next_offset er = offset pga 429-failed-rader er ikke skrevet)
      }

      if (r.is_done || r.next_offset === null) {
        $('status').textContent = 'FERDIG! Totalt importert ' + totals.imported + ' av ' + r.total_missing_at_start + '.';
        log('=== FERDIG ===', 'ok');
        if (Object.keys(failedBySport).length > 0) {
          log('Failed_by_sport_type: ' + JSON.stringify(failedBySport), 'fail');
        }
        break;
      }
      offset = r.next_offset;
      // Pause mellom batcher (1.5s) for å holde under 100 req/15min-snittet.
      await new Promise(r => setTimeout(r, 1500));
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
