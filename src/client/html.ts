export const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KP-Web — Krishnamurti Paddhati Astrology</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --card-border: #334155;
      --primary: #38bdf8;
      --primary-hover: #0284c7;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --error: #f87171;
      --success: #4ade80;
      --warning: #fbbf24;
      --accent: #818cf8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container { max-width: 820px; margin: 0 auto; }
    header {
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--card-border);
      padding-bottom: 1.5rem;
    }
    .logo-badge {
      display: inline-block;
      background: #0369a1;
      color: #e0f2fe;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    h1 {
      font-size: 1.875rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 0.25rem;
    }
    .subtitle { color: var(--text-muted); font-size: 0.95rem; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 0.75rem;
      padding: 1.75rem;
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .card-title {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--primary);
    }
    .form-group { margin-bottom: 1.25rem; }
    .form-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.25rem;
    }
    label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.4rem;
      color: var(--text);
    }
    .label-hint { font-size: 0.75rem; color: var(--text-muted); font-weight: normal; }
    input[type="text"], input[type="number"], input[type="date"], select {
      width: 100%;
      padding: 0.65rem 0.85rem;
      background: #0f172a;
      border: 1px solid var(--card-border);
      border-radius: 0.5rem;
      color: var(--text);
      font-size: 0.95rem;
      transition: border-color 0.15s ease;
    }
    input:focus, select:focus { outline: none; border-color: var(--primary); }
    .time-inputs {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 0.5rem;
    }
    .time-col { display: flex; flex-direction: column; }
    .time-col span {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
      text-align: center;
    }
    .search-wrapper { position: relative; }
    .suggestions-list {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #1e293b;
      border: 1px solid var(--card-border);
      border-radius: 0.5rem;
      max-height: 240px;
      overflow-y: auto;
      z-index: 50;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
      margin-top: 0.25rem;
      display: none;
    }
    .suggestion-item {
      padding: 0.65rem 0.85rem;
      cursor: pointer;
      border-bottom: 1px solid #334155;
      font-size: 0.875rem;
    }
    .suggestion-item:last-child { border-bottom: none; }
    .suggestion-item:hover { background: #334155; }
    .suggestion-main { font-weight: 600; color: var(--text); }
    .suggestion-meta { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.15rem; }
    .badge {
      display: inline-block;
      padding: 0.15rem 0.45rem;
      border-radius: 0.25rem;
      font-size: 0.7rem;
      font-weight: 600;
      background: #334155;
      color: #38bdf8;
      margin-left: 0.4rem;
    }
    .ayanamsa-options {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .radio-card {
      border: 1px solid var(--card-border);
      border-radius: 0.5rem;
      padding: 0.85rem;
      cursor: pointer;
      background: #0f172a;
      transition: all 0.15s ease;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .radio-card:hover { border-color: var(--primary); }
    .radio-card.selected { border-color: var(--primary); background: #0c4a6e; }
    .radio-card input { display: none; }
    .radio-header { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.95rem; }
    .radio-desc { font-size: 0.78rem; color: var(--text-muted); }
    .offset-banner {
      background: #082f49;
      border: 1px solid #0284c7;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .offset-label { font-size: 0.85rem; color: #bae6fd; }
    .offset-value { font-size: 1.25rem; font-weight: 700; color: #38bdf8; font-family: monospace; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 0.5rem;
      border: none;
      cursor: pointer;
      background: var(--primary);
      color: #0f172a;
      transition: background-color 0.15s ease;
      width: 100%;
    }
    .btn:hover { background: var(--primary-hover); }
    .error-box {
      background: #450a0a;
      border: 1px solid var(--error);
      color: #fca5a5;
      padding: 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1.25rem;
      font-size: 0.875rem;
      display: none;
    }
    .error-item { margin-top: 0.25rem; padding-left: 1rem; list-style-type: disc; }
    .result-box {
      background: #064e3b;
      border: 1px solid var(--success);
      color: #a7f3d0;
      padding: 1rem;
      border-radius: 0.5rem;
      margin-bottom: 1.25rem;
      display: none;
    }
    .stored-record-pre {
      background: #0f172a;
      border: 1px solid var(--card-border);
      border-radius: 0.5rem;
      padding: 1rem;
      overflow-x: auto;
      font-family: monospace;
      font-size: 0.8rem;
      color: #e2e8f0;
      margin-top: 0.5rem;
    }
    .info-footer {
      font-size: 0.8rem;
      color: var(--text-muted);
      text-align: center;
      margin-top: 2rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-badge">KP Krishnamurti Paddhati</div>
      <h1>KP-Web Calculation Engine</h1>
      <p class="subtitle">High-precision natal and horary chart calculation. Arc-second accuracy with KP ayanamsa and IANA historical timezone data.</p>
    </header>

    <div id="errorBox" class="error-box">
      <strong>Please correct the following errors:</strong>
      <ul id="errorList"></ul>
    </div>

    <div id="successBox" class="result-box">
      <strong>Chart Input Successfully Stored and Ready for Computation!</strong>
      <p style="margin-top: 0.25rem; font-size: 0.85rem;">Raw user input has been preserved with resolved coordinates and UTC offset so this chart can be recomputed at any time.</p>
      <pre id="storedRecord" class="stored-record-pre"></pre>
    </div>

    <div class="card">
      <div class="card-title">
        <span>Birth Data Input</span>
      </div>

      <form id="chartForm" onsubmit="return false;">
        <div class="form-group">
          <label for="birthDate">Date of Birth <span class="label-hint">(Gregorian Calendar)</span></label>
          <input type="date" id="birthDate" value="1985-05-15" required>
        </div>

        <div class="form-group">
          <label>Time of Birth <span class="label-hint">(24-hour format with exact seconds)</span></label>
          <div class="time-inputs">
            <div class="time-col">
              <input type="number" id="birthHour" min="0" max="23" value="14" placeholder="HH" required>
              <span>Hours (0–23)</span>
            </div>
            <div class="time-col">
              <input type="number" id="birthMinute" min="0" max="59" value="30" placeholder="MM" required>
              <span>Minutes (0–59)</span>
            </div>
            <div class="time-col">
              <input type="number" id="birthSecond" min="0" max="59" value="25" placeholder="SS" required>
              <span>Seconds (0–59)</span>
            </div>
          </div>
          <p class="label-hint" style="margin-top: 0.4rem;">
            KP astrologers rely on time to the second because cuspal sub-lords can flip within minutes and sub-sub lords within seconds.
          </p>
        </div>

        <div class="form-group">
          <label for="placeSearch">Place of Birth <span class="label-hint">(Open-source GeoNames city search)</span></label>
          <div class="search-wrapper">
            <input type="text" id="placeSearch" placeholder="Type city name, e.g. Chennai, Kuala Lumpur, London, New York..." autocomplete="off" value="Chennai">
            <div id="suggestionsList" class="suggestions-list"></div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group" style="margin-bottom: 0;">
            <label for="latitude">Latitude <span class="label-hint">(-90 to +90)</span></label>
            <input type="number" id="latitude" step="0.0001" min="-90" max="90" value="13.0827" required>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label for="longitude">Longitude <span class="label-hint">(-180 to +180)</span></label>
            <input type="number" id="longitude" step="0.0001" min="-180" max="180" value="80.2707" required>
          </div>
        </div>

        <div class="form-group">
          <label for="timezone">IANA Timezone Identifier</label>
          <input type="text" id="timezone" value="Asia/Kolkata" required>
        </div>

        <div class="offset-banner">
          <div>
            <div class="offset-label">Computed UTC Offset (shown before calculation):</div>
            <div id="offsetDisplay" class="offset-value">UTC+05:30</div>
          </div>
          <div style="text-align: right;">
            <div class="offset-label">UTC Time:</div>
            <div id="utcDisplay" style="font-family: monospace; font-size: 0.9rem; color: #e0f2fe;">1985-05-15T09:00:25.000Z</div>
          </div>
        </div>

        <div class="form-group">
          <label>Ayanamsa Selection <span class="label-hint">(Lahiri is not used as a silent fallback)</span></label>
          <div class="ayanamsa-options">
            <label class="radio-card selected" id="optKpOld">
              <input type="radio" name="ayanamsa" value="kp_old" checked>
              <div class="radio-header">
                <span>KP Old</span>
                <span class="badge">K.S. Krishnamurti</span>
              </div>
              <div class="radio-desc">Traditional KP ayanamsa based on Prof. K.S. Krishnamurti's original baseline.</div>
            </label>

            <label class="radio-card" id="optKpNew">
              <input type="radio" name="ayanamsa" value="kp_new">
              <div class="radio-header">
                <span>KP New</span>
                <span class="badge">Swiss Ephemeris</span>
              </div>
              <div class="radio-desc">Swiss Ephemeris revised KP ayanamsa algorithm.</div>
            </label>
          </div>
        </div>

        <button type="button" id="submitBtn" class="btn">Validate & Calculate Chart Input</button>
      </form>
    </div>

    <div class="info-footer">
      KP-Web Engine &bull; Cloudflare Workers Compatible &bull; Data from GeoNames (CC-BY 4.0) & IANA tzdb
    </div>
  </div>

  <script>
    const birthDateInput = document.getElementById('birthDate');
    const birthHourInput = document.getElementById('birthHour');
    const birthMinInput = document.getElementById('birthMinute');
    const birthSecInput = document.getElementById('birthSecond');
    const placeSearchInput = document.getElementById('placeSearch');
    const suggestionsList = document.getElementById('suggestionsList');
    const latInput = document.getElementById('latitude');
    const lonInput = document.getElementById('longitude');
    const tzInput = document.getElementById('timezone');
    const offsetDisplay = document.getElementById('offsetDisplay');
    const utcDisplay = document.getElementById('utcDisplay');
    const submitBtn = document.getElementById('submitBtn');
    const errorBox = document.getElementById('errorBox');
    const errorList = document.getElementById('errorList');
    const successBox = document.getElementById('successBox');
    const storedRecord = document.getElementById('storedRecord');

    let currentAyanamsa = 'kp_old';
    let placeDebounce = null;

    document.querySelectorAll('input[name="ayanamsa"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        currentAyanamsa = e.target.value;
        document.querySelectorAll('.radio-card').forEach(card => card.classList.remove('selected'));
        e.target.closest('.radio-card').classList.add('selected');
      });
    });

    placeSearchInput.addEventListener('input', () => {
      clearTimeout(placeDebounce);
      const query = placeSearchInput.value.trim();
      if (query.length < 2) {
        suggestionsList.style.display = 'none';
        return;
      }
      placeDebounce = setTimeout(async () => {
        try {
          const res = await fetch(\`/api/places/search?q=\${encodeURIComponent(query)}&limit=8\`);
          if (!res.ok) return;
          const data = await res.json();
          renderSuggestions(data.results || []);
        } catch (e) {
          console.error('Place search error', e);
        }
      }, 200);
    });

    function renderSuggestions(places) {
      if (places.length === 0) {
        suggestionsList.style.display = 'none';
        return;
      }
      suggestionsList.innerHTML = '';
      places.forEach(place => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.innerHTML = \`
          <div class="suggestion-main">\${escapeHtml(place.name)}\${place.country ? ', ' + escapeHtml(place.country) : ''}</div>
          <div class="suggestion-meta">Lat: \${place.latitude.toFixed(4)}, Lon: \${place.longitude.toFixed(4)} &bull; \${escapeHtml(place.timezone)}</div>
        \`;
        item.addEventListener('click', () => {
          placeSearchInput.value = place.name + (place.country ? ', ' + place.country : '');
          latInput.value = place.latitude.toFixed(4);
          lonInput.value = place.longitude.toFixed(4);
          tzInput.value = place.timezone;
          suggestionsList.style.display = 'none';
          updateUtcOffset();
        });
        suggestionsList.appendChild(item);
      });
      suggestionsList.style.display = 'block';
    }

    document.addEventListener('click', (e) => {
      if (!placeSearchInput.contains(e.target) && !suggestionsList.contains(e.target)) {
        suggestionsList.style.display = 'none';
      }
    });

    async function updateUtcOffset() {
      const dateVal = birthDateInput.value;
      const h = parseInt(birthHourInput.value, 10);
      const m = parseInt(birthMinInput.value, 10);
      const s = parseInt(birthSecInput.value, 10);
      const tz = tzInput.value.trim();

      if (!dateVal || isNaN(h) || isNaN(m) || isNaN(s) || !tz) return;

      const parts = dateVal.split('-');
      if (parts.length !== 3) return;

      try {
        const res = await fetch('/api/timezone/offset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: parseInt(parts[0], 10),
            month: parseInt(parts[1], 10),
            day: parseInt(parts[2], 10),
            hours: h,
            minutes: m,
            seconds: s,
            timezone: tz
          })
        });

        if (!res.ok) {
          offsetDisplay.textContent = 'Invalid Timezone';
          utcDisplay.textContent = '—';
          return;
        }

        const data = await res.json();
        offsetDisplay.textContent = data.offsetString + (data.isDst ? ' (DST)' : '');
        utcDisplay.textContent = data.utcDateTimeString;
      } catch (e) {
        console.error('Offset calculation error', e);
      }
    }

    [birthDateInput, birthHourInput, birthMinInput, birthSecInput, tzInput].forEach(el => {
      el.addEventListener('change', updateUtcOffset);
      el.addEventListener('input', updateUtcOffset);
    });

    updateUtcOffset();

    submitBtn.addEventListener('click', async () => {
      errorBox.style.display = 'none';
      successBox.style.display = 'none';
      errorList.innerHTML = '';

      const dateVal = birthDateInput.value;
      const h = parseInt(birthHourInput.value, 10);
      const m = parseInt(birthMinInput.value, 10);
      const s = parseInt(birthSecInput.value, 10);
      const placeText = placeSearchInput.value.trim();
      const lat = parseFloat(latInput.value);
      const lon = parseFloat(lonInput.value);
      const tz = tzInput.value.trim();

      const payload = {
        date: dateVal,
        hours: h,
        minutes: m,
        seconds: s,
        placeText: placeText,
        latitude: lat,
        longitude: lon,
        timezone: tz,
        ayanamsa: currentAyanamsa
      };

      try {
        const res = await fetch('/api/charts/validate-input', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok || !data.valid) {
          const errors = data.errors || { general: data.error || data.message || 'Validation failed' };
          for (const key of Object.keys(errors)) {
            const li = document.createElement('li');
            li.className = 'error-item';
            li.textContent = errors[key];
            errorList.appendChild(li);
          }
          errorBox.style.display = 'block';
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        storedRecord.textContent = JSON.stringify(data.chart, null, 2);
        successBox.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {
        const li = document.createElement('li');
        li.className = 'error-item';
        li.textContent = 'Server connection error: ' + err.message;
        errorList.appendChild(li);
        errorBox.style.display = 'block';
      }
    });

    function escapeHtml(str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
  </script>
</body>
</html>
`;
