import React, { useState, useEffect } from 'react';

function CaseList({ currentUser, onSelectCase }) {
  const [cases, setCases] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [caseSimilarities, setCaseSimilarities] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch all case filenames and their similarity data
        const casesResponse = await fetch('http://localhost:3001/api/cases');
        if (!casesResponse.ok) {
          throw new Error(`Failed to fetch cases: ${casesResponse.statusText}`);
        }
        const casesData = await casesResponse.json();
        
        // Extract similarity data and store it separately
        const similarities = {};
        casesData.forEach(caseItem => {
          if (caseItem.similarities && caseItem.similarities.MAX !== undefined) {
            similarities[caseItem.filename] = caseItem.similarities.MAX;
          }
        });
        
        // Just store the filenames in cases
        const filenames = casesData.map(caseItem => caseItem.filename || caseItem);
        setCases(filenames);
        setCaseSimilarities(similarities);

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

  // Sort cases by MAX similarity (high to low)
  const sortedCases = [...cases].sort((a, b) => {
    const simA = caseSimilarities[a] || 0;
    const simB = caseSimilarities[b] || 0;
    return simB - simA;
  });

  // Find the min and max similarity values for color scaling
  const similarityValues = Object.values(caseSimilarities);
  const maxSimilarity = Math.max(...similarityValues, 0);
  const minSimilarity = Math.min(...similarityValues, 0);
  
  // Function to interpolate color from green to red based on similarity value
  const getColorForSimilarity = (similarity) => {
    if (similarity === undefined) return '#888'; // Gray for undefined
    
    if (maxSimilarity === minSimilarity) return '#888'; // Avoid division by zero
    
    // Normalize the similarity value to a range from 0 to 1
    const normalized = (similarity - minSimilarity) / (maxSimilarity - minSimilarity);
    
    // Convert to RGB components (green to red gradient)
    const red = Math.round(255 * normalized);
    const green = Math.round(255 * (1 - normalized));
    const blue = 0;
    
    return `rgb(${red}, ${green}, ${blue})`;
  };

  return (
    <div>
      <h2>Available Cases</h2>
      {cases.length === 0 ? (
        <p>No cases found in the data directory.</p>
      ) : (
        <ul>
          {sortedCases.map((caseFile) => {
            const decisionInfo = decisions[caseFile];
            const isDecided = !!decisionInfo;
            const decisionText = isDecided ? `(${decisionInfo.decision})` : '(Pending)';
            const similarity = caseSimilarities[caseFile];
            const similarityColor = getColorForSimilarity(similarity);

            return (
              <li key={caseFile} style={{ 
                marginBottom: '5px',
                borderLeft: `4px solid ${similarityColor}`,
                paddingLeft: '8px'
              }}>
                <button onClick={() => onSelectCase(caseFile)}>
                  {caseFile}
                </button>
                <span style={{ marginLeft: '10px', color: isDecided ? 'green' : 'orange' }}>
                  {decisionText}
                </span>
                {similarity !== undefined && (
                  <span style={{ marginLeft: '10px', color: similarityColor, fontWeight: 'bold' }}>
                    (Similarity: {similarity.toFixed(2)})
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default CaseList;