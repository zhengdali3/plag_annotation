// CaseViewer.jsx
import React, { useState, useEffect, useMemo } from 'react'; // Remove useCallback import
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark }                       from 'react-syntax-highlighter/dist/esm/styles/prism';
import { APP_CONFIG }                     from '../config';
import './CaseViewer.css';  // see below

// Full-bleed wrapper so your code panes use the entire viewport width
const FullBleed = ({ children }) => (
  <div
    style={{
      position: 'relative',
      left: '50%',
      marginLeft: '-50vw',
      width: '100vw',
      padding: 0,
    }}
  >
    {children}
  </div>
);

const generateColor = idx => {
  const cols = [
    'rgba(255,0,0,0.3)',
    'rgba(0,0,255,0.3)',
    'rgba(0,255,0,0.3)',
    'rgba(255,255,0,0.3)',
    'rgba(0,255,255,0.3)',
    'rgba(255,0,255,0.3)',
  ];
  return cols[idx % cols.length];
};

const parseAnonymizedFilename = filename => {
  if (!filename) return { userIdA: '?', userIdB: '?' };
  const parts = filename.split('-');
  if (parts.length < 4) return { userIdA: '?', userIdB: '?' };
  return {
    userIdA: parts[parts.length - 2],
    userIdB: parts[parts.length - 1],
  };
};

const getLanguageFromFilename = fn => {
  if (!fn) return 'clike';
  if (fn.endsWith('.java'))   return 'java';
  if (fn.endsWith('.py'))     return 'python';
  if (fn.match(/\.(js|jsx)$/))return 'javascript';
  if (fn.match(/\.(ts|tsx)$/))return 'typescript';
  return 'clike';
};

export default function CaseViewer(props) { // Changed to accept props
  const {
    dataset,
    originalFilename,
    anonymizedFilename,
    currentUser,
    onBack,
    onDecisionMade,
    isSelectedCase // Destructure isSelectedCase here
  } = props;
  // ── State ─────────────────────────────────────────
  const [caseData, setCaseData]           = useState(null);
  const [fileContents, setFileContents]   = useState({});
  const [groups, setGroups]               = useState([]);
  const [colors, setColors]               = useState({});
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');

  // for the per-match modal
  const [focusedMatchIndex, setFocusedMatchIndex] = useState(null);
  const [assessments, setAssessments]             = useState({});

  // for the overall decision
  const [finalLevel, setFinalLevel]     = useState(3);
  const [finalComment, setFinalComment] = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [submitErr, setSubmitErr]       = useState('');

  // Key derived from assessments to force re-render when assessments change
  const assessmentsKey = useMemo(() => JSON.stringify(assessments), [assessments]);

  const { userIdA, userIdB } = useMemo(
    () => parseAnonymizedFilename(anonymizedFilename),
    [anonymizedFilename]
  );

  // ── Load everything ───────────────────────────────── useEffect
  useEffect(() => {
    if (!originalFilename) return;
    (async () => {
      try {
        setLoading(true);
        setError('');

        // 1) case JSON
        let resp = await fetch(
          `${APP_CONFIG.API_BASE_URL}/api/${dataset}/case/${originalFilename}`
        );
        if (!resp.ok) throw new Error(`Case load failed: ${resp.statusText}`);
        const data = await resp.json();
        setCaseData(data);

        // 2) build color map
        const cmap = {};
        (data.matches||[]).forEach((m,i) => {
          m.originalIndex = i;
          cmap[i] = generateColor(i);
        });
        setColors(cmap);

        // 3) fetch source files
        const paths = new Set();
        data.matches.forEach(m => {
          paths.add(m.firstFile.replace(/\\/g,'/'));
          paths.add(m.secondFile.replace(/\\/g,'/'));
        });
        const fm = {};
        await Promise.all(Array.from(paths).map(async p => {
          const r = await fetch(
            `${APP_CONFIG.API_BASE_URL}/api/${dataset}/file/${encodeURIComponent(p)}`
          );
          fm[p] = r.ok ? await r.text() : `Error: ${r.statusText}`;
        }));
        setFileContents(fm);

        // 4) group matches into pairs
        const gs = {};
        data.matches.forEach(m => {
          const a = m.firstFile.replace(/\\/g,'/');
          const b = m.secondFile.replace(/\\/g,'/');
          const key = `${a}<->${b}`;
          if (!gs[key]) gs[key] = { fileA: a, fileB: b, matches: [] };
          gs[key].matches.push(m);
        });
        setGroups(Object.values(gs));

        // 5) load per-match assessments
        resp = await fetch(
          `${APP_CONFIG.API_BASE_URL}/api/${dataset}/assessments/${currentUser}/${originalFilename}`
        );
        if (resp.ok) {
          const arr = await resp.json();
          const map = {};
          arr.forEach(x => {
            map[x.match_index] = {
              level:   x.level,
              comment: x.comment || ''
            };
          });
          setAssessments(map);
        }

        // 6) load overall decision
        resp = await fetch(
          `${APP_CONFIG.API_BASE_URL}/api/${dataset}/decisions/${currentUser}`
        );
        if (resp.ok) {
          const allDec = await resp.json();
          const cd = allDec[originalFilename];
          if (cd) {
            setFinalLevel(cd.level);
            setFinalComment(cd.comment||'');
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [dataset, originalFilename, currentUser]);

  // ── Helpers ─────────────────────────────────────────
  // Hooks must be called unconditionally before early returns
  // Define createLineProps directly - new function on every render
  const createLineProps = (matches, paneIdx) => lineNumber => {
    const props = { style: {}, onClick: null };
    matches.forEach(m => {
      const start = paneIdx === 0 ? m.startInFirst : m.startInSecond;
      const end = paneIdx === 0 ? m.endInFirst : m.endInSecond;
      if (lineNumber >= start.line && lineNumber <= end.line) {
        const originalColor = colors[m.originalIndex];
        const hasAssessment = !!assessments[m.originalIndex]; // Check if assessed

        // *** DEBUGGING ***
        if (hasAssessment && lineNumber === start.line) { // Log only for the first line of the match
          console.log(`Line ${lineNumber} (Match ${m.originalIndex}): HAS assessment. Applying class 'assessed-line'.`);
        }
        // *** END DEBUGGING ***

        // Always apply the base background color
        props.style.backgroundColor = originalColor; // Keep dynamic background color inline

        // Add a class name if assessed
        if (hasAssessment) {
          props.className = 'assessed-line';
        } else {
          props.className = ''; // Ensure class is removed if not assessed
        }

        props.style.cursor = 'pointer';
        props.onClick = () => setFocusedMatchIndex(m.originalIndex);
      }
    });
    return props;
  }; // No useCallback dependencies now


  if (loading) return <p>Loading…</p>;
  if (error)
    return (
      <div>
        <p style={{ color:'red' }}>{error}</p>
        <button onClick={onBack}>Back</button>
      </div>
    );
  if (!caseData)
    return (
      <div>
        <p>No data</p>
        <button onClick={onBack}>Back</button>
      </div>
    );


  // prepare the snippet for the modal
  let snippet = null;
  if (focusedMatchIndex != null) {
    const m = caseData.matches[focusedMatchIndex];
    const A = m.firstFile.replace(/\\/g,'/');
    const B = m.secondFile.replace(/\\/g,'/');
    const txtA = (fileContents[A]||'').split('\n');
    const txtB = (fileContents[B]||'').split('\n');
    snippet = {
      fileA: A.split('/').pop(),
      fileB: B.split('/').pop(),
      a:     txtA.slice(m.startInFirst.line-1, m.endInFirst.line).join('\n'),
      b:     txtB.slice(m.startInSecond.line-1, m.endInSecond.line).join('\n'),
    };
  }

  const changeMatchLevel = lvl => {
    setAssessments(prev => ({
      ...prev,
      [focusedMatchIndex]: {
        ...(prev[focusedMatchIndex]||{}),
        level: lvl
      }
    }));
    // No need for manual trigger now
  };
  const changeMatchComment = txt => {
    setAssessments(prev => ({
      ...prev,
      [focusedMatchIndex]: {
        ...(prev[focusedMatchIndex]||{}),
        comment: txt
      }
    }));
    // No need for manual trigger now
  };

  // submit all
  const handleSubmitAll = async () => {
    setSubmitting(true);
    setSubmitErr('');
    try {
      // build array
      const arr = caseData.matches.map(m => {
        const idx = m.originalIndex;
        const assessmentEntry = assessments[idx];
        // Ensure level is valid, default to 3 if missing or invalid
        const levelToSend = (assessmentEntry?.level != null && typeof assessmentEntry.level === 'number' && assessmentEntry.level >= 1 && assessmentEntry.level <= 5)
                              ? assessmentEntry.level
                              : 3;
        const commentToSend = assessmentEntry?.comment || null;

        return {
          match_index: idx,
          first_file:  m.firstFile.replace(/\\/g,'/'),
          start1_line: m.startInFirst.line,
          start1_col:  m.startInFirst.col,
          end1_line:   m.endInFirst.line,
          end1_col:    m.endInFirst.col,
          second_file: m.secondFile.replace(/\\/g,'/'),
          start2_line: m.startInSecond.line,
          start2_col:  m.startInSecond.col,
          end2_line:   m.endInSecond.line,
          end2_col:    m.endInSecond.col,
          level:       levelToSend,
          comment:     commentToSend,
        };
      });

      let r = await fetch(
        `${APP_CONFIG.API_BASE_URL}/api/${dataset}/assessments/${currentUser}/${originalFilename}`,
        {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify(arr)
        }
      );
      if (!r.ok) throw new Error((await r.json()).error||r.statusText);

      // overall decision
      r = await fetch(
        `${APP_CONFIG.API_BASE_URL}/api/${dataset}/decisions/${currentUser}/${originalFilename}`,
        {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ level: finalLevel, comment: finalComment||null })
        }
      );
      if (!r.ok) throw new Error((await r.json()).error||r.statusText);

      onDecisionMade();
    } catch (e) {
      setSubmitErr(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────
  return (
    <div style={{ width:'100%', margin:0, padding:0 }}>
      <h2>Case: {anonymizedFilename}</h2>
      <button onClick={onBack} disabled={submitting}>Back to List</button>
      <hr/>

      {!isSelectedCase && ( // Conditionally render based on the flag
        <div>
          <strong>Similarity Scores:</strong>
          <ul>
            {Object.entries(caseData.similarities).map(([k,v])=>(
              <li key={k}>{k}: {v.toFixed(4)}</li>
            ))}
          </ul>
        </div>
      )}
      <hr/>

      <FullBleed>
        {groups.map((g,i)=> {
          const lpA = createLineProps(g.matches, 0);
          const lpB = createLineProps(g.matches, 1);
          const langA = getLanguageFromFilename(g.fileA);
          const langB = getLanguageFromFilename(g.fileB);
          return (
            <div key={i} style={{ padding:'1rem 0', borderTop: i? '1px solid #ccc' : 'none' }}>
              <h4 style={{ textAlign:'center' }}>
                Pair {i+1}: {g.fileA.split('/').pop()} vs {g.fileB.split('/').pop()}
              </h4>
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1, overflowX:'auto' }}>
                  <h5 style={{ textAlign:'center' }}>
                    {g.fileA.split('/').pop()} ({userIdA})
                  </h5>
                  <SyntaxHighlighter
                    key={`A-${i}-${assessmentsKey}`} // Use key derived from assessments
                    language={langA}
                    style={atomDark}
                    showLineNumbers
                    wrapLines
                    lineProps={lpA}
                    customStyle={{ margin:0, padding:'0.5em 1em' }}
                  >
                    {fileContents[g.fileA]||''}
                  </SyntaxHighlighter>
                </div>
                <div style={{ flex:1, overflowX:'auto' }}>
                  <h5 style={{ textAlign:'center' }}>
                    {g.fileB.split('/').pop()} ({userIdB})
                  </h5>
                  <SyntaxHighlighter
                    key={`B-${i}-${assessmentsKey}`} // Use key derived from assessments
                    language={langB}
                    style={atomDark}
                    showLineNumbers
                    wrapLines
                    lineProps={lpB}
                    customStyle={{ margin:0, padding:'0.5em 1em' }}
                  >
                    {fileContents[g.fileB]||''}
                  </SyntaxHighlighter>
                </div>
              </div>
            </div>
          );
        })}
      </FullBleed>

      {/* per-match modal */}
      {snippet && (
        <div className="modal-overlay" onClick={()=>setFocusedMatchIndex(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <button className="modal-close" onClick={()=>setFocusedMatchIndex(null)}>×</button>
            <h3>Matched Snippet</h3>
            <div className="modal-pair">
              <div className="modal-snippet">
                <h5>{snippet.fileA} ({userIdA})</h5>
                <SyntaxHighlighter
                  language={getLanguageFromFilename(snippet.fileA)}
                  style={atomDark}
                  customStyle={{ margin:0, padding:'0.5em' }}
                >{snippet.a}</SyntaxHighlighter>
              </div>
              <div className="modal-snippet">
                <h5>{snippet.fileB} ({userIdB})</h5>
                <SyntaxHighlighter
                  language={getLanguageFromFilename(snippet.fileB)}
                  style={atomDark}
                  customStyle={{ margin:0, padding:'0.5em' }}
                >{snippet.b}</SyntaxHighlighter>
              </div>
            </div>
            <label>
              Match Confidence (1–5):
              <input
                type="range" min="1" max="5" step="1"
                value={assessments[focusedMatchIndex]?.level||3}
                onChange={e=>changeMatchLevel(Number(e.target.value))}
              />
            </label>
            <textarea
              rows="2"
              placeholder="Comment…"
              value={assessments[focusedMatchIndex]?.comment||''}
              onChange={e=>changeMatchComment(e.target.value)}
            />
          </div>
        </div>
      )}

      <hr/>

      {/* overall decision */}
      <div style={{ margin:'1rem 0' }}>
        <h3>Overall Confidence</h3>
        <label>
          <input
            type="range" min="1" max="5" step="1"
            value={finalLevel}
            onChange={e=>setFinalLevel(Number(e.target.value))}
            style={{ width:'100%' }}
          />
        </label>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.9em' }}>
          <span>1 = Confident Non-Plagiarism</span>
          <span>5 = Confident Plagiarism</span>
        </div>
        <textarea
          rows="3"
          placeholder="Overall comment…"
          value={finalComment}
          onChange={e=>setFinalComment(e.target.value)}
          style={{ width:'100%', marginTop:8 }}
        />
        <button
          onClick={handleSubmitAll}
          disabled={submitting}
          style={{ marginTop:12 }}
        >
          {submitting ? 'Submitting…' : 'Submit All'}
        </button>
        {submitErr && <p style={{ color:'red' }}>{submitErr}</p>}
      </div>
    </div>
  );
}
