'use client';

import { useState, useCallback, useRef } from 'react';

// ── helpers ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const SHAPE_RUNS    = { straight: 1, L: 2, U: 3 };
const SHAPE_CORNERS = { straight: 0, L: 1, U: 2 };

const DEF_SETTINGS = {
  slabW: 79, slabL: 138, kitchenDepth: 25.5, vanityDepth: 21, laborRate: 25, slabCost: 0,
};

const newRun  = () => ({ length: '', isPeninsula: false, overhang: 12 });
const newUnit = () => ({
  id: uid(), name: '', shape: 'straight',
  runs: [newRun(), newRun(), newRun()],
  corners: 0, vanities: [{ width: '' }], notes: '',
});

function calcUnit(unit, s) {
  const n = SHAPE_RUNS[unit.shape] || 1;
  let kArea = 0;
  for (let i = 0; i < n; i++) {
    const r = unit.runs[i];
    const d = r.isPeninsula ? s.kitchenDepth + (Number(r.overhang) || 0) : s.kitchenDepth;
    kArea += (Number(r.length) || 0) * d;
  }
  kArea -= (Number(unit.corners) || 0) * s.kitchenDepth * s.kitchenDepth;
  const vArea = unit.vanities.reduce((a, v) => a + (Number(v.width) || 0) * s.vanityDepth, 0);
  return { k: Math.max(0, kArea / 144), v: vArea / 144, t: Math.max(0, kArea / 144) + vArea / 144 };
}

function calcSlabs(units, s) {
  const { slabW, slabL, kitchenDepth, vanityDepth } = s;
  const pieces = [];
  units.forEach((u) => {
    const n = SHAPE_RUNS[u.shape] || 1;
    for (let i = 0; i < n; i++) {
      const r = u.runs[i];
      const len = Number(r.length) || 0;
      if (len > 0)
        pieces.push({ len, w: r.isPeninsula ? kitchenDepth + (Number(r.overhang) || 0) : kitchenDepth });
    }
    u.vanities.forEach((v) => { const w = Number(v.width) || 0; if (w > 0) pieces.push({ len: w, w: vanityDepth }); });
  });
  if (!pieces.length) return 0;
  pieces.sort((a, b) => b.w - a.w);

  const lm = {};
  pieces.forEach((p) => {
    if (!lm[p.w]) lm[p.w] = [];
    const lane = lm[p.w].find((l) => l.used + p.len <= slabL);
    if (lane) lane.used += p.len;
    else lm[p.w].push({ w: p.w, used: p.len });
  });

  const vLanes = lm[vanityDepth] || [];
  const other  = Object.entries(lm)
    .filter(([w]) => Number(w) !== vanityDepth)
    .flatMap(([, ls]) => ls);
  const remainV = [];
  vLanes.forEach((vl) => {
    const host = other.find((ol) => ol.used + vl.used <= slabL);
    if (host) host.used += vl.used;
    else remainV.push(vl);
  });

  const all = [...other, ...remainV].sort((a, b) => b.w - a.w);
  const slabs = [];
  all.forEach((lane) => {
    const sl = slabs.find((sl) => sl.u + lane.w <= slabW);
    if (sl) sl.u += lane.w;
    else slabs.push({ u: lane.w });
  });
  return slabs.length || 1;
}

const RUN_LABELS = {
  straight: ['Main run'],
  L:        ['Run 1 — main / range wall', 'Run 2 — sink wall'],
  U:        ['Run 1 — main wall', 'Run 2 — sink wall', 'Run 3 — small section'],
};

// ── styles (inline, no Tailwind needed) ───────────────────────────────────
const S = {
  wrap:    { maxWidth: 880, margin: '0 auto', padding: '0 0 60px' },
  hdr:     { background: 'var(--surface-2)', borderBottom: '0.5px solid var(--border)', padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 14, borderRadius: '12px 12px 0 0', boxShadow: '0 1px 3px rgba(0,0,0,.06)' },
  tabs:    { borderBottom: '0.5px solid var(--border)', background: 'var(--surface-1)', display: 'flex', padding: '0 10px' },
  pane:    { padding: '22px 0' },
  card:    { background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  cardHdr: { background: 'var(--surface-1)', borderBottom: '0.5px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 },
  cardBdy: { padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 },
  lbl:     { fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 },
  row:     { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  runBox:  { marginBottom: 8, padding: '10px 12px', border: '0.5px solid var(--border)', borderRadius: 6, background: 'var(--surface-1)' },
  penBox:  { marginBottom: 8, padding: '10px 12px', border: '0.5px solid var(--border-success)', borderRadius: 6, background: 'var(--bg-success)' },
  inp:     { width: '100%', padding: '7px 10px', fontSize: 13, border: '0.5px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-primary)' },
  num:     { width: 84, padding: '6px 8px', fontSize: 13, textAlign: 'right', border: '0.5px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-primary)' },
  numSm:   { width: 58, padding: '6px 8px', fontSize: 13, textAlign: 'right', border: '0.5px solid var(--border-strong)', borderRadius: 6, background: 'var(--surface-2)', color: 'var(--text-primary)' },
  sel:     { fontSize: 13, border: '0.5px solid var(--border-strong)', borderRadius: 6, padding: '5px 8px', background: 'var(--surface-2)', color: 'var(--text-primary)' },
  btn:     { padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: '0.5px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text-primary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
  btnPri:  { padding: '8px 16px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: 'none', background: 'var(--fill-accent)', color: 'var(--on-accent)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 },
  badge:   { fontSize: 12, fontWeight: 500, color: 'var(--text-accent)', background: 'var(--bg-accent)', padding: '3px 10px', borderRadius: 20, marginLeft: 'auto', whiteSpace: 'nowrap' },
  metric:  { background: 'var(--surface-1)', borderRadius: 6, padding: '12px 16px', flex: 1, minWidth: 130 },
  errBar:  { background: 'var(--bg-danger)', border: '0.5px solid var(--border-danger)', color: 'var(--text-danger)', borderRadius: 6, padding: '10px 14px', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  noteBox: { marginTop: 10, background: 'var(--bg-warning)', border: '0.5px solid var(--border-warning)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: 'var(--text-warning)' },
  sumBar:  { background: 'var(--bg-accent)', border: '0.5px solid var(--border-accent)', borderRadius: 10, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  slabBox: { background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 12, padding: '16px 18px' },
};

// ── component ──────────────────────────────────────────────────────────────
export default function CountertopApp() {
  const [tab,      setTab]      = useState('upload');
  const [pdfB64,   setPdfB64]   = useState(null);
  const [fileName, setFileName] = useState('');
  const [project,  setProject]  = useState('');
  const [units,    setUnits]    = useState([]);
  const [settings, setSettings] = useState(DEF_SETTINGS);
  const [loading,  setLoading]  = useState(false);
  const [status,   setStatus]   = useState('');
  const [err,      setErr]      = useState('');
  const [copied,   setCopied]   = useState(false);
  const fileRef = useRef();

  const handleFile = useCallback((file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') { setErr('Please upload a PDF file.'); return; }
    setErr('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setPdfB64(e.target.result.split(',')[1]);
    reader.readAsDataURL(file);
  }, []);

  const onDrop  = useCallback((e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }, [handleFile]);
  const onDragOver = (e) => e.preventDefault();

  const extract = async () => {
    if (!pdfB64) { setErr('Upload a PDF first.'); return; }
    setLoading(true); setErr(''); setStatus('Sending to Claude…');
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64: pdfB64 }),
      });
      setStatus('Parsing results…');
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Server error ${res.status}`);

      const parsed = data.units.map((u) => ({
        id: uid(),
        name:    u.unit    || '',
        shape:   ['straight','L','U'].includes(u.shape) ? u.shape : 'straight',
        runs: [0,1,2].map((i) => ({
          length:      u.runs?.[i]?.length ?? '',
          isPeninsula: false,
          overhang:    12,
          label:       u.runs?.[i]?.label || '',
        })),
        corners:  u.corners ?? SHAPE_CORNERS[u.shape] ?? 0,
        vanities: u.vanities?.length ? u.vanities.map((v) => ({ width: v.width ?? '' })) : [{ width: '' }],
        notes:    u.notes || '',
      }));
      setUnits(parsed);
      setTab('units');
    } catch (e) {
      setErr('Extraction failed: ' + e.message);
    } finally {
      setLoading(false); setStatus('');
    }
  };

  // unit state helpers
  const updUnit   = (id, patch)    => setUnits((p) => p.map((u) => u.id === id ? { ...u, ...patch } : u));
  const updRun    = (id, i, patch) => setUnits((p) => p.map((u) => { if (u.id !== id) return u; const runs = [...u.runs]; runs[i] = { ...runs[i], ...patch }; return { ...u, runs }; }));
  const updVanity = (id, i, w)     => setUnits((p) => p.map((u) => { if (u.id !== id) return u; const v = [...u.vanities]; v[i] = { width: w }; return { ...u, vanities: v }; }));
  const addVanity = (id)           => setUnits((p) => p.map((u) => u.id === id ? { ...u, vanities: [...u.vanities, { width: '' }] } : u));
  const delVanity = (id, i)        => setUnits((p) => p.map((u) => u.id === id ? { ...u, vanities: u.vanities.filter((_, j) => j !== i) } : u));
  const setShape  = (id, shape)    => updUnit(id, { shape, corners: SHAPE_CORNERS[shape] });

  const setSetting = (k) => (e) => setSettings((s) => ({ ...s, [k]: parseFloat(e.target.value) || 0 }));

  // derived totals
  const slabSF    = settings.slabW * settings.slabL / 144;
  const unitCalcs = units.map((u) => ({ u, ...calcUnit(u, settings) }));
  const totK      = unitCalcs.reduce((a, c) => a + c.k, 0);
  const totV      = unitCalcs.reduce((a, c) => a + c.v, 0);
  const totSF     = totK + totV;
  const minSlabs  = calcSlabs(units, settings);
  const matRate   = totSF > 0 && settings.slabCost > 0 ? settings.slabCost / totSF : 0;
  const hasMat    = settings.slabCost > 0;

  const copyResults = () => {
    const divider = '─'.repeat(72);
    const header  = `COUNTERTOP ESTIMATE — ${project || 'Project'}\n${divider}\nUnit       | Kitchen SF | Vanity SF | Total SF | Material  | Labor     | Total\n${divider}`;
    const rows = unitCalcs.map((c) => {
      const mat = c.t * matRate, lab = c.t * settings.laborRate;
      return `${(c.u.name || '?').padEnd(10)} | ${c.k.toFixed(2).padStart(10)} | ${c.v.toFixed(2).padStart(9)} | ${c.t.toFixed(2).padStart(8)} | ${hasMat ? '$' + mat.toFixed(2).padStart(8) : '—'.padStart(9)} | $${lab.toFixed(2).padStart(8)} | ${hasMat ? '$' + (mat + lab).toFixed(2) : '$' + lab.toFixed(2)}`;
    });
    const tot   = `${'TOTAL'.padEnd(10)} | ${totK.toFixed(2).padStart(10)} | ${totV.toFixed(2).padStart(9)} | ${totSF.toFixed(2).padStart(8)} | ${hasMat ? '$' + (totSF * matRate).toFixed(2).padStart(8) : '—'.padStart(9)} | $${(totSF * settings.laborRate).toFixed(2).padStart(8)} | ${hasMat ? '$' + (totSF * (matRate + settings.laborRate)).toFixed(2) : '$' + (totSF * settings.laborRate).toFixed(2)}`;
    const footer = `\nSlabs (${settings.slabW}"×${settings.slabL}"): ${minSlabs} minimum + 1 safety = ${minSlabs + 1} to order\nMaterial: $${matRate.toFixed(2)}/SF  |  Labor: $${settings.laborRate}/SF`;
    navigator.clipboard.writeText([header, ...rows, divider, tot, footer].join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabStyle = (t) => ({
    padding: '10px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    border: 'none', borderBottom: tab === t ? '2px solid var(--fill-accent)' : '2px solid transparent',
    color: tab === t ? 'var(--fill-accent)' : 'var(--text-secondary)',
    background: 'transparent', transition: 'color .15s, border-color .15s',
  });

  const Metric = ({ val, label, sub }) => (
    <div style={S.metric}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 500 }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={S.wrap}>
      {/* header */}
      <div style={S.hdr}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 500 }}>Countertop estimator</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Upload shop drawings → extract dimensions → slabs + costs</div>
        </div>
        <input
          style={{ ...S.inp, width: 220 }}
          placeholder="Project name…"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        />
      </div>

      {/* tabs */}
      <div style={S.tabs}>
        {[['upload','Upload'], ['units',`Units (${units.length})`], ['settings','Settings'], ['results','Results']].map(([t, l]) => (
          <button key={t} style={tabStyle(t)} onClick={() => setTab(t)}>{l}</button>
        ))}
      </div>

      <div style={S.pane}>
        {err && (
          <div style={S.errBar}>
            <span>{err}</span>
            <span style={{ cursor: 'pointer', fontWeight: 500, marginLeft: 10 }} onClick={() => setErr('')}>✕</span>
          </div>
        )}

        {/* ── UPLOAD ── */}
        {tab === 'upload' && (
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            <div
              onDrop={onDrop} onDragOver={onDragOver}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${pdfB64 ? 'var(--border-success)' : 'var(--border-strong)'}`,
                borderRadius: 12, padding: '44px 32px', textAlign: 'center',
                cursor: 'pointer', background: pdfB64 ? 'var(--bg-success)' : 'var(--surface-1)',
                transition: 'all .15s',
              }}
            >
              <i className="ti ti-file-type-pdf" aria-hidden="true" style={{ fontSize: 40, color: pdfB64 ? 'var(--text-success)' : 'var(--text-muted)', display: 'block', marginBottom: 10 }} />
              {pdfB64 ? (
                <>
                  <div style={{ fontWeight: 500, color: 'var(--text-success)' }}>✓ {fileName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Click to replace</div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 500 }}>Drop shop drawings PDF here</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>or click to browse · Force Cabinets, MG Woodwork, or any cabinet shop format</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />

            <div style={{ marginTop: 16, background: 'var(--surface-1)', border: '0.5px solid var(--border)', borderRadius: 10, padding: '16px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>How it works</div>
              {['Upload a cabinet shop drawing PDF — any batch, any cabinet company.', 'Click Extract. Claude reads every page and pulls run lengths, shapes, vanity widths, and exclusions.', 'Review and edit values in the Units tab. Mark peninsula runs and set overhang depth.', 'Enter your slab cost in Settings, then view the full breakdown in Results.'].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg-accent)', color: 'var(--text-accent)', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{step}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                style={{ ...S.btnPri, flex: 1, justifyContent: 'center', padding: '11px 16px', fontSize: 14, opacity: (!pdfB64 || loading) ? 0.5 : 1 }}
                onClick={extract} disabled={!pdfB64 || loading}
              >
                {loading
                  ? <><i className="ti ti-loader-2" aria-hidden="true" /> {status || 'Extracting…'}</>
                  : <><i className="ti ti-sparkles" aria-hidden="true" /> Extract dimensions from PDF</>}
              </button>
              <button style={S.btn} onClick={() => { setUnits([newUnit()]); setTab('units'); }}>
                Manual entry
              </button>
            </div>
          </div>
        )}

        {/* ── UNITS ── */}
        {tab === 'units' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>Units / rooms</div>
              <button style={S.btn} onClick={() => setUnits((p) => [...p, newUnit()])}>
                <i className="ti ti-plus" aria-hidden="true" /> Add unit
              </button>
            </div>

            {units.length === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                No units yet — upload drawings or add manually.
              </div>
            )}

            {units.map((unit) => {
              const n    = SHAPE_RUNS[unit.shape] || 1;
              const calc = calcUnit(unit, settings);
              return (
                <div key={unit.id} style={S.card}>
                  <div style={S.cardHdr}>
                    <input
                      style={{ fontSize: 14, fontWeight: 500, border: 'none', borderBottom: '1px solid transparent', background: 'transparent', color: 'var(--text-primary)', width: 130, outline: 'none' }}
                      value={unit.name}
                      onChange={(e) => updUnit(unit.id, { name: e.target.value })}
                      onFocus={(e) => (e.target.style.borderBottomColor = 'var(--fill-accent)')}
                      onBlur={(e)  => (e.target.style.borderBottomColor = 'transparent')}
                      placeholder="Unit name"
                    />
                    <select style={S.sel} value={unit.shape} onChange={(e) => setShape(unit.id, e.target.value)}>
                      <option value="straight">Straight (1 wall)</option>
                      <option value="L">L-shape (2 walls)</option>
                      <option value="U">U-shape (3 walls)</option>
                    </select>
                    <span style={S.badge}>{calc.t.toFixed(2)} SF</span>
                    <button
                      onClick={() => setUnits((p) => p.filter((u) => u.id !== unit.id))}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
                      aria-label="Remove unit"
                    >✕</button>
                  </div>

                  <div style={S.cardBdy}>
                    {/* kitchen runs */}
                    <div>
                      <div style={S.lbl}>Kitchen runs</div>
                      {Array.from({ length: n }, (_, i) => {
                        const run   = unit.runs[i];
                        const label = (RUN_LABELS[unit.shape] || [])[i] || `Run ${i + 1}`;
                        return (
                          <div key={i} style={run.isPeninsula ? S.penBox : S.runBox}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
                            <div style={S.row}>
                              <input
                                type="number" style={S.num} placeholder="0" step="0.25"
                                value={run.length}
                                onChange={(e) => updRun(unit.id, i, { length: e.target.value })}
                              />
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>in</span>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', marginLeft: 4 }}>
                                <input
                                  type="checkbox" checked={run.isPeninsula}
                                  onChange={(e) => updRun(unit.id, i, { isPeninsula: e.target.checked })}
                                />
                                Peninsula
                              </label>
                              {run.isPeninsula && (
                                <>
                                  <input
                                    type="number" style={S.numSm} step="1"
                                    value={run.overhang}
                                    onChange={(e) => updRun(unit.id, i, { overhang: e.target.value })}
                                  />
                                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>″ overhang</span>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <div style={{ ...S.row, marginTop: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Inside corners</span>
                        <input
                          type="number" style={S.numSm} min="0" max="4"
                          value={unit.corners}
                          onChange={(e) => updUnit(unit.id, { corners: e.target.value })}
                        />
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-accent)', marginTop: 8 }}>
                        Kitchen SF: {calc.k.toFixed(2)}
                      </div>
                    </div>

                    {/* vanities */}
                    <div>
                      <div style={S.lbl}>Bath vanities</div>
                      {unit.vanities.map((v, vi) => (
                        <div key={vi} style={{ ...S.row, marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 66 }}>Vanity {vi + 1}</span>
                          <input
                            type="number" style={S.num} placeholder="0" step="0.25"
                            value={v.width}
                            onChange={(e) => updVanity(unit.id, vi, e.target.value)}
                          />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>in</span>
                          {unit.vanities.length > 1 && (
                            <button
                              onClick={() => delVanity(unit.id, vi)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}
                            >✕</button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addVanity(unit.id)}
                        style={{ fontSize: 12, color: 'var(--fill-accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >+ add vanity</button>
                      <div style={{ fontSize: 12, color: 'var(--text-accent)', marginTop: 10 }}>
                        Vanity SF: {calc.v.toFixed(2)}
                      </div>
                      {unit.notes && (
                        <div style={S.noteBox}>
                          <strong>Excluded: </strong>{unit.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {units.length > 0 && (
              <div style={S.sumBar}>
                <div style={{ fontSize: 13, color: 'var(--text-accent)' }}>
                  <strong>{units.length} units</strong> · {totK.toFixed(2)} SF kitchen · {totV.toFixed(2)} SF vanity · <strong>{totSF.toFixed(2)} SF total</strong>
                </div>
                <button style={S.btnPri} onClick={() => setTab('results')}>
                  View results <i className="ti ti-arrow-right" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === 'settings' && (
          <div style={{ maxWidth: 440 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 16 }}>Project settings</div>
            {[
              { label: 'Slab width (in)',                   key: 'slabW',        step: 1 },
              { label: 'Slab length (in)',                  key: 'slabL',        step: 1 },
              { label: 'Kitchen counter depth (in)',         key: 'kitchenDepth', step: 0.5, note: '24″ cabinet + front overhang' },
              { label: 'Vanity counter depth (in)',          key: 'vanityDepth',  step: 0.5 },
              { label: 'Total slab cost ($)',                key: 'slabCost',     step: 100, dollar: true },
              { label: 'Labor rate ($ / SF installed)',      key: 'laborRate',    step: 1,   dollar: true },
            ].map((row) => (
              <div key={row.key} style={{ background: 'var(--surface-2)', border: '0.5px solid var(--border)', borderRadius: 6, padding: '12px 16px', marginBottom: 8 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {row.label}
                  {row.note && <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>— {row.note}</span>}
                </div>
                <div style={S.row}>
                  {row.dollar && <span style={{ color: 'var(--text-muted)' }}>$</span>}
                  <input type="number" style={S.num} step={row.step} value={settings[row.key]} onChange={setSetting(row.key)} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── RESULTS ── */}
        {tab === 'results' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>
                Results{project ? ` — ${project}` : ''}
              </div>
              <button style={S.btn} onClick={copyResults}>
                <i className="ti ti-copy" aria-hidden="true" /> {copied ? '✓ Copied!' : 'Copy to clipboard'}
              </button>
            </div>

            {units.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                Add units first.
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                  <Metric val={totSF.toFixed(2) + ' SF'} label="Total countertop"     sub={`${totK.toFixed(1)} kitchen + ${totV.toFixed(1)} vanity`} />
                  <Metric val={minSlabs}                  label="Min slabs"            sub={`${minSlabs + 1} recommended w/ margin`} />
                  <Metric val={`$${(totSF * settings.laborRate).toFixed(0)}`} label="Total labor" sub={`$${settings.laborRate}/SF`} />
                  <Metric
                    val={hasMat ? `$${(totSF * (matRate + settings.laborRate)).toFixed(0)}` : 'Enter slab cost'}
                    label="Grand total"
                    sub={hasMat ? 'material + labor' : 'in Settings →'}
                  />
                </div>

                <div style={{ ...S.card, overflow: 'auto', marginBottom: 14 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-0)' }}>
                        {['Unit','Kitchen SF','Vanity SF','Total SF','Material','Labor','Total'].map((h) => (
                          <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Unit' ? 'left' : 'right', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', borderBottom: '0.5px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {unitCalcs.map((c, i) => {
                        const mat = c.t * matRate, lab = c.t * settings.laborRate;
                        return (
                          <tr key={c.u.id} style={{ background: i % 2 ? 'var(--surface-1)' : 'var(--surface-2)', borderBottom: '0.5px solid var(--border)' }}>
                            <td style={{ padding: '9px 12px', fontWeight: 500 }}>{c.u.name || `Unit ${i + 1}`}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{c.k.toFixed(2)}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{c.v.toFixed(2)}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 500 }}>{c.t.toFixed(2)}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{hasMat ? `$${mat.toFixed(2)}` : '—'}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>${lab.toFixed(2)}</td>
                            <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 500, color: 'var(--text-accent)' }}>
                              {hasMat ? `$${(mat + lab).toFixed(2)}` : `$${lab.toFixed(2)}`}
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ background: 'var(--bg-accent)', fontWeight: 500 }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-accent)' }}>Total</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-accent)' }}>{totK.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-accent)' }}>{totV.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-accent)' }}>{totSF.toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-accent)' }}>{hasMat ? `$${(totSF * matRate).toFixed(2)}` : '—'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-accent)' }}>${(totSF * settings.laborRate).toFixed(2)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-accent)' }}>
                          {hasMat ? `$${(totSF * (matRate + settings.laborRate)).toFixed(2)}` : `$${(totSF * settings.laborRate).toFixed(2)}`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={S.slabBox}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Slab estimate</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                    <div>Slab: {settings.slabW}″ × {settings.slabL}″ = {slabSF.toFixed(1)} SF gross</div>
                    <div>Kitchen depth: {settings.kitchenDepth}″ · Vanity: {settings.vanityDepth}″</div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Minimum slabs: {minSlabs}</div>
                    <div style={{ fontWeight: 500, color: 'var(--text-success)' }}>Order quantity (+ 1 buffer): {minSlabs + 1}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
                    First-fit-decreasing bin packing across all units. Natural stone vein / edge waste not included. Saw kerf not included. Confirm with your fabricator before ordering.
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
