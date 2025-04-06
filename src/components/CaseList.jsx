import React, { useState, useEffect } from 'react';

function CaseList({ currentUser, onSelectCase }) {
  const [cases, setCases] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch all case filenames
        const casesResponse = await fetch('http://localhost:3001/api/cases');
        if (!casesResponse.ok) {
          throw new Error(`Failed to fetch cases: ${casesResponse.statusText}`);
        }
        const casesData = await casesResponse.json();
        setCases(casesData);

        // Fetch user's decisions
        if (currentUser) {
          const decisionsResponse = await fetch(`http://localhost:3001/api/decisions/${currentUser}`);
          if (!decisionsResponse.ok) {
            // Handle 404 (user not found) gracefully if needed, though login should prevent this
             if (decisionsResponse.status === 404) {
                 console.warn(`Decisions not found for user ${currentUser}, maybe new user?`);
                 setDecisions({}); // Set empty decisions
             } else {
                throw new Error(`Failed to fetch decisions: ${decisionsResponse.statusText}`);
             }
          } else {
             const decisionsData = await decisionsResponse.json();
             setDecisions(decisionsData);
          }
        } else {
            setDecisions({}); // No user, no decisions
        }

      } catch (err) {
        console.error('Error fetching case data:', err);
        setError('Failed to load case data. Is the backend server running?');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]); // Re-fetch if user changes (though unlikely in this flow)

  if (loading) {
    return <p>Loading cases...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  return (
    <div>
      <h2>Available Cases</h2>
      {cases.length === 0 ? (
        <p>No cases found in the data directory.</p>
      ) : (
        <ul>
          {cases.map((caseFile) => {
            const decisionInfo = decisions[caseFile];
            const isDecided = !!decisionInfo;
            const decisionText = isDecided ? `(${decisionInfo.decision})` : '(Pending)';

            return (
              <li key={caseFile} style={{ marginBottom: '5px' }}>
                <button onClick={() => onSelectCase(caseFile)}>
                  {caseFile}
                </button>
                <span style={{ marginLeft: '10px', color: isDecided ? 'green' : 'orange' }}>
                  {decisionText}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CaseList;
