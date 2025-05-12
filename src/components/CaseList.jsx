import React, { useState, useEffect, useMemo } from 'react';
import { APP_CONFIG } from '../config';
import selectedCasesData from '../selectedCases.json'; // Import the selected cases

// Helper function to pad user ID
const formatUserId = (id) => `user${String(id).padStart(3, '0')}`;

// Helper function to extract usernames and anonymize filename
const extractAndAnonymize = (filename, userMap, nextUserId) => {
  const parts = filename.replace(/\.json$/, '').split('-assignment-');
  if (parts.length !== 2) {
    console.warn(`Unexpected filename format, skipping anonymization: ${filename}`);
    return { anonymizedFilename: filename, userMap, nextUserId };
  }

  const firstPartSegments  = parts[0].split('-');
  const secondPartSegments = parts[1].split('-');
  if (firstPartSegments.length < 3 || secondPartSegments.length < 2) {
     console.warn(`Unexpected filename format after split, skipping anonymization: ${filename}`);
     return { anonymizedFilename: filename, userMap, nextUserId };
  }

  const assignmentNum1 = firstPartSegments[1];
  const usernameA      = firstPartSegments.slice(2).join('-');
  const assignmentNum2 = secondPartSegments[0];
  const usernameB      = secondPartSegments.slice(1).join('-');

  let userIdA = userMap[usernameA];
  if (!userIdA) {
    userIdA = formatUserId(nextUserId);
    userMap[usernameA] = userIdA;
    nextUserId++;
  }

  let userIdB = userMap[usernameB];
  if (!userIdB) {
    userIdB = formatUserId(nextUserId);
    userMap[usernameB] = userIdB;
    nextUserId++;
  }

  const anonymizedFilename = `assignment-${assignmentNum1}-${userIdA}-${userIdB}`;

  return { anonymizedFilename, userMap, nextUserId };
};

function CaseList({ dataset, currentUser, onSelectCase }) {
  const [rawCasesData, setRawCasesData] = useState([]);
  const [decisions, setDecisions]       = useState({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState('');
  const [processedSelectedCases, setProcessedSelectedCases] = useState([]); // State for processed selected cases

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const base = `${APP_CONFIG.API_BASE_URL}/api/${dataset}`;
        const casesResponse = await fetch(`${base}/cases`);
        if (!casesResponse.ok) {
          throw new Error(`Failed to fetch cases: ${casesResponse.statusText}`);
        }

        // NEW: backend may return { cases: [...] }
        const payload = await casesResponse.json();
        console.log('Fetched payload from /api/cases:', payload);

        // unwrap either bare array or { cases: [...] }
        let fetchedCasesData;
        if (Array.isArray(payload)) {
          fetchedCasesData = payload;
        } else if (Array.isArray(payload.cases)) {
          fetchedCasesData = payload.cases;
        } else {
          fetchedCasesData = [];
        }

        // Filter out anything missing filename or similarities.MAX
        const validCasesData = fetchedCasesData.filter(item =>
          item &&
          typeof item.filename === 'string' &&
          typeof item.similarities?.MAX === 'number'
        );
        console.log('Filtered case data from API:', validCasesData);
        setRawCasesData(validCasesData);

        // Fetch user's decisions
        if (currentUser) {
          const originalFilenames = validCasesData.map(item => item.filename);
          const decisionsResponse = await fetch(`${base}/decisions/${currentUser}`);
          if (!decisionsResponse.ok) {
            if (decisionsResponse.status === 404) {
              console.warn(`No decisions found for user ${currentUser}`);
              setDecisions({});
            } else {
              throw new Error(`Failed to fetch decisions: ${decisionsResponse.statusText}`);
            }
          } else {
            const decisionsData = await decisionsResponse.json();
            setDecisions(decisionsData);
          }
        } else {
          setDecisions({});
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load case data. Is the backend server running?');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dataset, currentUser]);

  // Process & anonymize all cases
  const processedCases = useMemo(() => {
    if (loading || error || rawCasesData.length === 0) {
      return [];
    }
    console.log('Processing fetched data for anonymization...');

    let userMap = {};
    let nextUserId = 1;
    const casesWithDetails = [];

    rawCasesData.forEach(caseItem => {
      const originalFilename = caseItem.filename;
      const similarity       = caseItem.similarities.MAX;

      const {
        anonymizedFilename: anonName,
        userMap: updatedUserMap,
        nextUserId: updatedNextUserId
      } = extractAndAnonymize(originalFilename, userMap, nextUserId);

      userMap     = updatedUserMap;
      nextUserId  = updatedNextUserId;

      casesWithDetails.push({
        originalFilename,
        anonymizedFilename: anonName,
        similarity
      });
    });

    casesWithDetails.sort((a, b) => b.similarity - a.similarity);
    return casesWithDetails;
  }, [rawCasesData, loading, error]);

  // Process and anonymize selected cases
  useEffect(() => {
    if (selectedCasesData.length === 0 || !dataset) { // Also check if dataset is defined
      setProcessedSelectedCases([]);
      return;
    }
    console.log('Processing selected cases data for dataset:', dataset);

    const filteredCases = selectedCasesData.filter(caseItem => caseItem.dataset === dataset);

    const casesWithDetails = filteredCases.map(caseItem => ({
      dataset: caseItem.dataset, // Ensure dataset is included
      originalFilename: caseItem.originalFilename,
      anonymizedFilename: caseItem.anonymizedFilename,
      similarity: caseItem.similarity
    }));

    setProcessedSelectedCases(casesWithDetails);
  }, [selectedCasesData, dataset]); // Add dataset to dependency array


  // Compute color scale for all cases
  const { minSimilarity, maxSimilarity } = useMemo(() => {
     if (processedCases.length === 0) return { minSimilarity: 0, maxSimilarity: 0 };
     const vals = processedCases.map(c => c.similarity);
     return { minSimilarity: Math.min(...vals), maxSimilarity: Math.max(...vals) };
  }, [processedCases]);

  // Compute color scale for selected cases (using overall min/max for consistency)
  const { minSimilarity: minSelectedSimilarity, maxSimilarity: maxSelectedSimilarity } = useMemo(() => {
     if (processedSelectedCases.length === 0) return { minSimilarity: 0, maxSimilarity: 0 };
     const vals = processedSelectedCases.map(c => c.similarity);
     return { minSimilarity: Math.min(...vals), maxSimilarity: Math.max(...vals) };
  }, [processedSelectedCases]);


  const getColorForSimilarity = (sim, overallMin, overallMax) => {
    if (typeof sim !== 'number') return '#888';
    if (overallMax === overallMin) {
      return sim > 0.5 ? '#FF8C00' : '#FFD700';
    }
    const norm = (sim - overallMin) / (overallMax - overallMin);
    const hue  = (1 - norm) * 120;
    return `hsl(${hue}, 100%, 45%)`;
  };

  if (loading) return <p>Loading cases...</p>;
  if (error)   return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h2>Selected Cases</h2>
      {processedSelectedCases.length === 0 ? (
        <p>No selected cases found.</p>
      ) : (
        <ul style={{ padding: 0 }}>
          {processedSelectedCases.map(caseInfo => {
            const decisionInfo   = decisions[caseInfo.originalFilename];
            const isDecided      = !!decisionInfo;
            const decisionText   = isDecided ? 'Decided' : 'Pending';

            return (
              <li key={caseInfo.originalFilename} style={{
                marginBottom: '5px',
                paddingLeft: '8px',
                listStyleType: 'none'
              }}>
                <button
                  onClick={() =>
                    onSelectCase({
                      dataset: caseInfo.dataset, // Pass the dataset from the case
                      original: caseInfo.originalFilename,
                      anonymized: caseInfo.anonymizedFilename,
                      isSelectedCase: true
                    })
                  }>
                  {caseInfo.anonymizedFilename}
                </button>
                <span style={{ marginLeft: '10px', color: isDecided ? 'green' : 'orange' }}>
                  {decisionText}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <h2>Available Cases</h2>
      {processedCases.length === 0 ? (
        <p>No valid JSON cases found or loaded.</p>
      ) : (
        <ul style={{ padding: 0 }}>
          {processedCases.map(caseInfo => {
            const decisionInfo   = decisions[caseInfo.originalFilename];
            const isDecided      = !!decisionInfo;
            const decisionText   = isDecided ? 'Decided' : 'Pending';
            const similarityColor = getColorForSimilarity(caseInfo.similarity, minSimilarity, maxSimilarity);

            return (
              <li key={caseInfo.originalFilename} style={{
                marginBottom: '5px',
                borderLeft: `4px solid ${similarityColor}`,
                paddingLeft: '8px',
                listStyleType: 'none'
              }}>
                <button
                  onClick={() =>
                    onSelectCase({
                      original: caseInfo.originalFilename,
                      anonymized: caseInfo.anonymizedFilename
                    })
                  }>
                  {caseInfo.anonymizedFilename}
                </button>
                <span style={{ marginLeft: '10px', color: isDecided ? 'green' : 'orange' }}>
                  {decisionText}
                </span>
                <span style={{ marginLeft: '10px', color: similarityColor, fontWeight: 'bold' }}>
                  (Similarity: {caseInfo.similarity.toFixed(3)})
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
