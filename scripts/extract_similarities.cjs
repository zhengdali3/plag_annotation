const fs = require('fs');
const path = require('path');

const dataRoot = path.resolve(__dirname, '../data');
const outputFilePath = path.resolve(__dirname, '../src/selectedCases.json');

// Helper function to pad user ID (copied from CaseList.jsx)
const formatUserId = (id) => `user${String(id).padStart(3, '0')}`;

// Helper function to extract usernames and anonymize filename (copied from CaseList.jsx)
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


const allCases = [];
let userMap = {}; // Initialize userMap for anonymization
let nextUserId = 1; // Initialize nextUserId for anonymization

function walk(dir) {
  fs.readdirSync(dir).forEach(name => {
    const fullPath = path.join(dir, name);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (name === 'files') return; // skip student source files
      walk(fullPath);
    } else if (name.endsWith('.json')) {
      try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        if (data.similarities && typeof data.similarities.MAX === 'number') {
          const datasetName = path.relative(dataRoot, dir);
          const originalFilename = name; // Store the original filename

          // Generate anonymized filename
          const {
            anonymizedFilename: anonName,
            userMap: updatedUserMap,
            nextUserId: updatedNextUserId
          } = extractAndAnonymize(originalFilename, userMap, nextUserId);

          userMap     = updatedUserMap;
          nextUserId  = updatedNextUserId;


          allCases.push({
            dataset: datasetName,
            originalFilename: originalFilename, // Add original filename
            anonymizedFilename: anonName, // Add anonymized filename
            similarity: data.similarities.MAX
          });
        }
      } catch (e) {
        console.error(`Failed to parse ${fullPath}: ${e.message}`);
      }
    }
  });
}

walk(dataRoot);

// Group cases by dataset
const casesByDataset = allCases.reduce((acc, currentCase) => {
  const dataset = currentCase.dataset;
  if (!acc[dataset]) {
    acc[dataset] = [];
  }
  acc[dataset].push(currentCase);
  return acc;
}, {});

const finalSelectedCases = [];
const numCasesToSelectPerDataset = 10;

for (const datasetName in casesByDataset) {
  if (Object.hasOwnProperty.call(casesByDataset, datasetName)) {
    const datasetCases = casesByDataset[datasetName];

    // Sort cases within this dataset by similarity
    datasetCases.sort((a, b) => a.similarity - b.similarity);

    const selectedCasesForThisDataset = [];
    const totalCasesInDataset = datasetCases.length;

    if (totalCasesInDataset > 0) { // Ensure there are cases in the dataset
        if (totalCasesInDataset >= numCasesToSelectPerDataset) {
          const interval = totalCasesInDataset > 1 ? Math.floor((totalCasesInDataset -1) / (numCasesToSelectPerDataset - 1)) : 0;
          for (let i = 0; i < numCasesToSelectPerDataset; i++) {
            const index = Math.min(i * interval, totalCasesInDataset - 1);
            // Ensure index is valid, especially for interval 0 (when numCasesToSelectPerDataset is 1 or datasetCases.length is 1)
            const caseIndex = (interval === 0 && i > 0) ? totalCasesInDataset -1 : index; 
            selectedCasesForThisDataset.push(datasetCases[caseIndex]);
          }
        } else {
          // If fewer than 10 cases in this dataset, select all
          selectedCasesForThisDataset.push(...datasetCases);
        }
    }
    finalSelectedCases.push(...selectedCasesForThisDataset);
  }
}

// Write the final selected cases to a JSON file
fs.writeFileSync(outputFilePath, JSON.stringify(finalSelectedCases, null, 2), 'utf8');

console.log(`Selected ${finalSelectedCases.length} cases in total and saved to ${outputFilePath}`);
