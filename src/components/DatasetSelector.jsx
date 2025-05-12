import React, { useEffect, useState } from 'react';
import { APP_CONFIG } from '../config';

export default function DatasetSelector({ onSelect }) {
  const [datasets, setDatasets] = useState([]);
  const [err, setErr]         = useState('');

  useEffect(() => {
    fetch(`${APP_CONFIG.API_BASE_URL}/api/datasets`)
      .then(r => r.json())
      .then(setDatasets)
      .catch(e => setErr('Could not load datasets'));
  }, []);

  if (err) return <p style={{color:'red'}}>{err}</p>;
  if (!datasets.length) return <p>Loading datasets…</p>;

  return (
    <div>
      <h2>Select a Dataset</h2>
      <ul>
        {datasets.map(ds => (
          <li key={ds}>
            <button onClick={()=>onSelect(ds)}>
              {ds.replace(/^assignment-/, 'Assignment ')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}