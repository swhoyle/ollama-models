import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';
import Icon from './Icon.jsx';
import { matchesRange } from './ranges.js';

const external = { target: '_blank', rel: 'noreferrer' };
const number = value => value.toLocaleString();
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
}
export function magnitude(label) {
  const match = label?.match(/^([\d.]+)\s*([KMGT])?B?$/i);
  return match ? Number(match[1]) * (1000 ** (match[2] ? 'KMGT'.indexOf(match[2].toUpperCase()) + 1 : 0)) : null;
}
export function paramValue(label) {
  const match = String(label).match(/([\d.]+)([mb])$/i);
  return match ? Number(match[1]) * (match[2].toLowerCase() === 'm' ? 0.001 : 1) : null;
}
const RANGE_PRESETS = {
  'File size': [
    ['any', 'Any file size'], ['0:1', '\u2264 1 GB'], ['1:3', '>1\u20133 GB'],
    ['3:6', '>3\u20136 GB'], ['6:8', '>6\u20138 GB'], ['8:16', '>8\u201316 GB'],
    ['16:32', '>16\u201332 GB'], ['32:64', '>32\u201364 GB'], ['64:', '>64 GB'],
  ],
  Context: [
    ['any', 'Any context'], ['0:4', '\u2264 4K tokens'], ['4:8', '>4\u20138K tokens'],
    ['8:16', '>8\u201316K tokens'], ['16:32', '>16\u201332K tokens'], ['32:64', '>32\u201364K tokens'],
    ['64:128', '>64\u2013128K tokens'], ['128:', '>128K tokens'],
  ],
};
function matchesAnyBucket(value, keys) {
  if (!keys.length) return true;
  return keys.some(key => {
    const [min, max] = key.split(':');
    return matchesRange(value, { mode: 'bucket', min, max });
  });
}
function MultiSelect({ title, allText, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const items = options.map(o => typeof o === 'string' ? { value: o, label: o } : o);
  const toggle = v => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  return <div className={`multi-select${value.length ? ' selected' : ''}`} ref={ref}>
    <button type="button" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(o => !o)}><span className="multi-select-label">{value.length ? `${title} (${value.length})` : allText}</span> <Icon name="sort" /></button>
    {open && <div className="multi-select-menu">
      <div className="multi-select-actions"><button type="button" onClick={() => onChange(items.map(i => i.value))}>All</button><button type="button" onClick={() => onChange([])}>None</button></div>
      <div className="multi-select-list">{items.map(o => <label key={o.value}><input type="checkbox" checked={value.includes(o.value)} onChange={() => toggle(o.value)} /> {o.label}</label>)}</div>
    </div>}
  </div>;
}
function App() {
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [view, setView] = useState('families');
  const defaults = v => ({ query: '', families: [], capabilities: [], params: [], sizeBuckets: [], contextBuckets: [], sort: v === 'families' ? 'pulls' : 'name', asc: v !== 'families' });
  const [views, setViews] = useState(() => ({families: defaults('families'), variants: defaults('variants')}));
  const {query, families: familiesSel, capabilities: capabilitiesSel, params, sizeBuckets, contextBuckets, sort, asc} = views[view];
  const update = patch => setViews(all => ({...all, [view]: {...all[view], ...patch}}));
  const scrollRef = useRef(null);
  const scrollPositions = useRef({families:0, variants:0});
  const helpRef = useRef(null);
  useEffect(() => {
    const close = e => { if (helpRef.current && !helpRef.current.contains(e.target)) helpRef.current.open = false; };
    const escape = e => { if (e.key === 'Escape' && helpRef.current) helpRef.current.open = false; };
    document.addEventListener('pointerdown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, []);
  useEffect(() => { fetch(`${import.meta.env.BASE_URL}data/models.json`).then(r => { if (!r.ok) throw Error(`HTTP ${r.status}`); return r.json(); }).then(setData).catch(e => setError(e.message)); }, []);
  const families = data?.models || [];
  const variants = useMemo(() => (data?.models || []).flatMap(m => (m.variants || []).map(v => ({ ...v, family: m.name, description: m.description, capabilities: m.capabilities, bytes: magnitude(v.sizeLabel), context: magnitude(v.contextLabel) }))), [data]);
  const source = view === 'variants' ? variants : families;
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const rows = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return source.filter(m => {
      const name = m.family || m.name;
      if (familiesSel.length && !familiesSel.includes(name)) return false;
      if (capabilitiesSel.length && !capabilitiesSel.some(c => (m.capabilities || []).includes(c))) return false;
      if (view === 'families' && params.length && !params.some(p => (m.sizes || []).includes(p))) return false;
      if (view === 'variants' && !matchesAnyBucket(m.bytes == null ? null : m.bytes / 1e9, sizeBuckets)) return false;
      if (view === 'variants' && !matchesAnyBucket(m.context == null ? null : m.context / 1000, contextBuckets)) return false;
      return words.every(w => [m.name, view === 'families' ? m.description : '', ...(m.capabilities || [])].join(' ').toLowerCase().includes(w));
    }).sort((a,b) => {
      const x = a[sort], y = b[sort];
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
      const result = typeof x === 'number' ? x-y : String(x).localeCompare(String(y), undefined, {numeric:true});
      return (asc ? result : -result) || a.name.localeCompare(b.name);
    });
  }, [source, familiesSel, capabilitiesSel, params, sizeBuckets, contextBuckets, query, sort, asc, view]);
  const paramOptions = useMemo(() => [...new Set(families.flatMap(m => m.sizes || []))].sort((a, b) => {
    const x = paramValue(a), y = paramValue(b);
    if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
    return x - y || a.localeCompare(b);
  }), [families]);
  const capabilityOptions = useMemo(() => [...new Set(families.flatMap(m => m.capabilities || []))].sort(), [families]);
  const familyOptions = useMemo(() => families.map(m => m.name), [families]);
  const sizeOptions = useMemo(() => RANGE_PRESETS['File size'].filter(([k]) => k !== 'any').map(([value, label]) => ({value, label})), []);
  const contextOptions = useMemo(() => RANGE_PRESETS.Context.filter(([k]) => k !== 'any').map(([value, label]) => ({value, label})), []);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageStart = rows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(currentPage * pageSize, rows.length);
  useEffect(() => { setPage(1); }, [query, familiesSel, capabilitiesSel, params, sizeBuckets, contextBuckets, sort, asc, view]);
  const gotoPage = p => {
    setPage(Math.min(Math.max(1, p), pageCount));
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };
  const reset = () => update({...defaults(view)});
  const switchView = value => { scrollPositions.current[view] = scrollRef.current?.scrollTop || 0; setView(value); };
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollPositions.current[view]; }, [view]);
  const openTags = name => {
    scrollPositions.current[view] = scrollRef.current?.scrollTop || 0;
    setViews(all => ({...all, variants: {...defaults('variants'), families:[name]}}));
    scrollPositions.current.variants = 0;
    setView('variants');
  };
  const heading = (key,label) => <th scope="col" aria-sort={sort===key ? asc?'ascending':'descending':'none'}><button className="sort" onClick={() => {update({sort:key, asc:sort===key ? !asc : key !== 'pulls'});}}>{label} <Icon name={sort===key ? asc?'up':'down':'sort'} /></button></th>;
  const badges = m => { const caps = m.capabilities || []; return <div className="badges">{caps.map(c => <span key={c} className={`badge ${c}`}>{c}</span>)}{!caps.length && <span className="muted">—</span>}</div>; };
  const age = data ? Math.max(0,Math.floor((Date.now()-Date.parse(data.fetchedAt))/86400000)) : 0;
  return <main>
    <header><div className="title"><img className="app-logo" src={`${import.meta.env.BASE_URL}images/ollama.png`} alt="" width="28" height="32" /><h1>Ollama Models</h1></div><nav><a className="github" href="https://ollama.com/library" {...external} aria-label="Ollama source library"><img className="nav-icon" src={`${import.meta.env.BASE_URL}images/ollama.png`} alt="" width="16" height="19" />Library</a><a className="github" href="https://github.com/swhoyle/ollama-models" {...external} aria-label="Project on GitHub"><svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.39v-1.49c-2.23.49-2.7-.95-2.7-.95-.37-.93-.89-1.18-.89-1.18-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.71 1.22 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 4 0c1.52-1.03 2.19-.82 2.19-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.08-1.87 3.76-3.65 3.96.29.25.54.73.54 1.48v2.21c0 .22.15.47.55.39A8 8 0 0 0 8 0Z"/></svg>GitHub</a></nav></header>
    <div className="metadata"><span>{number(families.length)} models <span className="dot">·</span> {number(variants.length)} tags</span><span className={`freshness ${age>7?'old':''}`}><Icon name="clock" /> Last checked: {data ? <time dateTime={data.fetchedAt} title={data.fetchedAt}>{new Date(data.fetchedAt).toLocaleDateString()}</time> : '—'}</span><details ref={helpRef}><summary>About this data <Icon name="info" /></summary><div className="help">
<p><strong>Source & freshness.</strong> Scraped from the <a className="source-link" href="https://ollama.com/library" {...external}>Ollama library</a> and its tags pages. Last checked is the snapshot date, not a live check. Names link to the original pages. Capabilities are model-level labels; missing values mean not listed. Pull counts are rounded.</p>
<p><strong>File size</strong> is the listed model download size. Running it also needs memory for context and other overhead; this is not a RAM/VRAM estimate. Smaller models and quantized tags are useful starting points for limited hardware.</p>
<p><strong>Context</strong> is the listed token window: the text the model can work with at once, including the prompt, chat history, and generated response. Tokens are pieces of text, not words. Longer windows help with long documents and code, but require more memory; actual runtime settings may use less than the listed maximum. <a href="https://docs.ollama.com/context-length" {...external}>Context guide</a></p>
<p><strong>Reading tags.</strong> A tag is the part after the colon in <code>model:tag</code>. It identifies a model variant or an alias. Common naming patterns:</p>
<ul className="tag-guide">
<li><strong>Parameter count:</strong> a number followed by <code>b</code> (billions) or <code>m</code> (millions), such as <code>7b</code>, <code>70b</code>, or <code>350m</code>. This describes model size, not file size or memory needed.</li>
<li><strong>Training style:</strong> <code>instruct</code> or <code>chat</code> usually means tuned for following instructions or conversation. <code>base</code> or <code>text</code> often indicates a pretrained completion model; check the model documentation.</li>
<li><strong>Quantization:</strong> labels such as <code>q4</code>, <code>q5</code>, or <code>q8</code> describe reduced weight precision. Lower precision generally saves storage and memory with a quality tradeoff. Suffixes such as <code>_0</code>, <code>_K</code>, and <code>_S</code>/<code>_M</code>/<code>_L</code> distinguish quantization schemes, not context length.</li>
<li><strong>Floating-point precision:</strong> <code>f16</code>/<code>fp16</code> and <code>bf16</code> are 16-bit formats. They generally need more storage than quantized versions of the same model.</li>
<li><strong>Default alias:</strong> <code>latest</code> is the default tag. It does not guarantee the newest or largest version. Different tags can refer to identical weights.</li>
<li><strong>Hosted usage:</strong> <code>cloud</code> indicates a hosted variant; local downloadable weights may not be available.</li>
<li><strong>Other labels:</strong> versions, task names, languages, and context sizes may appear. There is no universal tag grammar; the linked model page defines what a particular tag means.</li>
</ul>
<p><strong>Choosing a model.</strong> For chat, start with an instruct model that fits your hardware; Q4 is a practical size/quality starting point. For document retrieval, use embedding models to create search vectors, then a chat model to answer. Choose vision for image input, tools for tool-calling workflows, or a coding-tuned family for code tasks. Larger models may improve quality but cost memory and speed; compare on your own tasks. <a href="https://ollama.com/library/llama2" {...external}>Example of model sizes & quantization</a></p>
</div></details></div>
    <section className="catalog" aria-label="Model catalog"><div className="controls"><div className="tabs" aria-label="Catalog view">{['families','variants'].map(v => <button key={v} aria-pressed={view===v} className={view===v?'active':''} onClick={() => switchView(v)}>{v==='variants'?'Tags':'Models'}</button>)}</div><label className="search"><span className="sr-only">Search catalog</span><input type="search" placeholder="Search…" value={query} onChange={e=>update({query:e.target.value})}/></label><MultiSelect title="Models" allText="All models" options={familyOptions} value={familiesSel} onChange={value=>update({families:value})}/><MultiSelect title="Capabilities" allText="All capabilities" options={capabilityOptions} value={capabilitiesSel} onChange={value=>update({capabilities:value})}/>{view==='families' && <MultiSelect title="Parameters" allText="All parameters" options={paramOptions} value={params} onChange={value=>update({params:value})}/>}{view==='variants' && <><MultiSelect title="File size" allText="Any file size" options={sizeOptions} value={sizeBuckets} onChange={value=>update({sizeBuckets:value})}/><MultiSelect title="Context" allText="Any context" options={contextOptions} value={contextBuckets} onChange={value=>update({contextBuckets:value})}/></>}<button onClick={reset}>Reset</button></div>
    <div className="toolbar"><span aria-live="polite"><strong>{number(rows.length)}</strong> results <span className="muted">/ {number(source.length)} {view==='variants'?'tags':'models'}</span></span></div>
    {error ? <p className="message" role="alert">Could not load catalog: {error} <button onClick={()=>location.reload()}>Retry</button></p> : !data ? <p className="message" role="status">Loading catalog…</p> : <div ref={scrollRef} className="table-scroll" tabIndex="0" role="region" aria-label="Catalog table"><table><caption className="sr-only">Sortable {view} catalog</caption><thead><tr>{heading('name',view==='variants'?'Model : tag':'Model')}{view==='families' && <th scope="col">Description</th>}{view==='variants' ? <>{heading('family','Model')}<th scope="col">Capabilities</th>{heading('bytes','File size')}{heading('context','Context')}{heading('inputLabel','Input')}</> : <><th scope="col">Capabilities</th><th scope="col">Parameters</th>{heading('pulls','Pulls')}{heading('tags','Tags')}{heading('updatedAt','Updated')}</>}</tr></thead><tbody>{pageRows.map(m=><tr key={m.name}><td className="name"><a href={m.url} {...external}>{m.name} <Icon name="external" className="external" /></a></td>{view==='families' && <td className="description-cell">{m.description||'Not listed'}</td>}{view==='variants'?<><td><a className="muted" href={families.find(f=>f.name===m.family)?.url} {...external}>{m.family}</a></td><td title="Capabilities listed for the model family">{badges(m)}</td><td className="numeric">{m.sizeLabel||'—'}</td><td className="numeric">{m.contextLabel||'—'}</td><td>{m.inputLabel||'—'}</td></>:<><td>{badges(m)}</td><td className="parameters">{(m.sizes||[]).join(' · ')||'—'}</td><td className="numeric">{m.pullsLabel}</td><td><button className="link" onClick={()=>openTags(m.name)}>{m.tags}</button></td><td className="numeric">{formatDate(m.updatedAt)}</td></>}</tr>)}</tbody></table>{!rows.length && <div className="message">No matching models. <button onClick={reset}>Reset filters</button></div>}</div>}{pageCount > 1 && <nav className="pagination" aria-label="Table pagination"><span className="pagination-status">Showing <strong>{number(pageStart)}–{number(pageEnd)}</strong> of <strong>{number(rows.length)}</strong> results <span className="muted">· {pageSize} per page</span></span><div className="pagination-buttons"><button onClick={() => gotoPage(currentPage - 1)} disabled={currentPage === 1}>Previous</button><span className="muted">Page {currentPage} of {pageCount}</span><button onClick={() => gotoPage(currentPage + 1)} disabled={currentPage === pageCount}>Next</button></div></nav>}
    </section>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
