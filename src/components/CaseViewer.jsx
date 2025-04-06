import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Choose a style

// Helper function to generate distinct colors (simple version)
const generateColor = (index) => {
  const colors = ['rgba(255, 0, 0, 0.3)', 'rgba(0, 0, 255, 0.3)', 'rgba(0, 255, 0, 0.3)', 'rgba(255, 255, 0, 0.3)', 'rgba(0, 255, 255, 0.3)', 'rgba(255, 0, 255, 0.3)'];
  return colors[index % colors.length];
};

// Helper to create line props for highlighting
const createLineProps = (matches, fileIndex, colorMap) => (lineNumber) => {
  const props = { style: {} };
  matches.forEach((match, matchIndex) => {
    const range = fileIndex === 0 ? match.startInFirst : match.startInSecond;
    const endRange = fileIndex === 0 ? match.endInFirst : match.endInSecond;
    // Simple line-based highlighting for now
    if (lineNumber >= range.line && lineNumber <= endRange.line) {
      props.style.backgroundColor = colorMap[matchIndex];
      props.style.display = 'block'; // Ensure background covers the whole line
    }
  });
  return props;
};


function CaseViewer({ caseFilename, currentUser, onBack, onDecisionMade }) {
  const [caseData, setCaseData] = useState(null);
  const [file1Content, setFile1Content] = useState('');
  const [file2Content, setFile2Content] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [matchColors, setMatchColors] = useState({});

  useEffect(() => {
    const fetchCaseDetails = async () => {
      setLoading(true);
      setError('');
      setFile1Content('');
      setFile2Content('');
      setCaseData(null);
      setMatchColors({});

      try {
        // 1. Fetch case JSON data
        const caseResponse = await fetch(`http://localhost:3001/api/case/${caseFilename}`);
        if (!caseResponse.ok) throw new Error(`Failed to fetch case data: ${caseResponse.statusText}`);
        const data = await caseResponse.json();
        setCaseData(data);

        // Generate colors for matches
        const colors = {};
        data.matches.forEach((_, index) => {
            colors[index] = generateColor(index);
        });
        setMatchColors(colors);

        // Ensure matches array exists and has at least one element
        if (!data.matches || data.matches.length === 0) {
            throw new Error('Case data is missing match information needed to fetch source files.');
        }
        const firstMatch = data.matches[0];

        // 2. Fetch source file 1 content using the path from the first match
        // Note: The file paths in the JSON might contain backslashes, ensure they are handled correctly for the URL
        const file1Path = firstMatch.firstFile.replace(/\\/g, '/'); // Basic normalization
        console.log(`Fetching file 1 from: /api/file/${file1Path}`); // Add logging
        const file1Response = await fetch(`http://localhost:3001/api/file/${file1Path}`);
        if (!file1Response.ok) throw new Error(`Failed to fetch file ${firstMatch.firstFile}: ${file1Response.statusText}`);
        const file1Text = await file1Response.text();
        setFile1Content(file1Text);

        // 3. Fetch source file 2 content using the path from the first match
        const file2Path = firstMatch.secondFile.replace(/\\/g, '/'); // Basic normalization
        console.log(`Fetching file 2 from: /api/file/${file2Path}`); // Add logging
        const file2Response = await fetch(`http://localhost:3001/api/file/${file2Path}`);
        if (!file2Response.ok) throw new Error(`Failed to fetch file ${firstMatch.secondFile}: ${file2Response.statusText}`);
        const file2Text = await file2Response.text();
        setFile2Content(file2Text);

      } catch (err) {
        console.error('Error fetching case details:', err);
        setError(`Failed to load case details: ${err.message}. Is the backend running and paths correct?`);
      } finally {
        setLoading(false);
      }
    };

    if (caseFilename) {
      fetchCaseDetails();
    }
  }, [caseFilename]);

  const handleSubmitDecision = async (decision) => {
    setSubmitLoading(true);
    setSubmitError('');
    try {
      const response = await fetch(`http://localhost:3001/api/decisions/${currentUser}/${caseFilename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to submit decision: ${response.statusText}`);
      }
      console.log(`Decision '${decision}' submitted for ${caseFilename}`);
      onDecisionMade(); // Notify parent to potentially refresh list state
      // Optionally show a success message or automatically go back
    } catch (err) {
      console.error('Error submitting decision:', err);
      setSubmitError(`Failed to submit decision: ${err.message}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) return <p>Loading case details...</p>;
  if (error) return <div><p style={{ color: 'red' }}>{error}</p><button onClick={onBack}>Back to List</button></div>;
  if (!caseData) return <div><p>No case data loaded.</p><button onClick={onBack}>Back to List</button></div>;

  // Determine language for syntax highlighting (simple check)
  const language = caseData.id1.endsWith('.java') ? 'java' : 'clike'; // Default or guess based on extension

  return (
    <div>
      <h2>Case: {caseFilename}</h2>
      <button onClick={onBack} disabled={submitLoading}>Back to List</button>
      <hr />
      <div>
        <strong>Similarity Scores:</strong>
        <ul>
          {Object.entries(caseData.similarities).map(([key, value]) => (
            <li key={key}>{key}: {value.toFixed(4)}</li>
          ))}
        </ul>
      </div>
       <div>
        <strong>Matches Legend:</strong>
        <ul>
          {caseData.matches.map((_, index) => (
            <li key={index} style={{ color: matchColors[index]?.replace('0.3', '1') }}>
              Match {index + 1} <span style={{ display: 'inline-block', width: '20px', height: '10px', backgroundColor: matchColors[index], marginLeft: '5px' }}></span>
            </li>
          ))}
        </ul>
      </div>
      <hr />
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <h3>{caseData.id1}</h3>
          <SyntaxHighlighter
            language={language}
            style={atomDark}
            showLineNumbers
            wrapLines={true}
            lineProps={createLineProps(caseData.matches, 0, matchColors)}
          >
            {file1Content}
          </SyntaxHighlighter>
        </div>
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <h3>{caseData.id2}</h3>
          <SyntaxHighlighter
            language={language}
            style={atomDark}
            showLineNumbers
            wrapLines={true}
            lineProps={createLineProps(caseData.matches, 1, matchColors)}
          >
            {file2Content}
          </SyntaxHighlighter>
        </div>
      </div>
      <hr />
      <div>
        <h3>Make Decision:</h3>
        <button onClick={() => handleSubmitDecision('Plagiarism')} disabled={submitLoading}>
          Mark as Plagiarism
        </button>
        <button onClick={() => handleSubmitDecision('Not Plagiarism')} disabled={submitLoading} style={{ marginLeft: '10px' }}>
          Mark as Not Plagiarism
        </button>
        {submitLoading && <p>Submitting...</p>}
        {submitError && <p style={{ color: 'red' }}>{submitError}</p>}
      </div>
    </div>
  );
}

export default CaseViewer;
