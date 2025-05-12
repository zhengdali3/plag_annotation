import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import DatasetSelector from './components/DatasetSelector';
import CaseList from './components/CaseList';
import CaseViewer from './components/CaseViewer';
import './App.css';

function App() {
  const [currentUser, setCurrentUser]         = useState(null);
  const [showLogin, setShowLogin]             = useState(true);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [selectedCase, setSelectedCase]       = useState(null);
  const [decisionCounter, setDecisionCounter] = useState(0);

  // Restore session
  useEffect(() => {
    const storedUser = localStorage.getItem('plagAnnoUser');
    if (storedUser) {
      setCurrentUser(storedUser);
    }
  }, []);

  const handleLoginSuccess = username => {
    setCurrentUser(username);
    localStorage.setItem('plagAnnoUser', username);
  };

  const handleRegisterSuccess = username => {
    setShowLogin(true);
    // optionally auto‐login:
    // handleLoginSuccess(username);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('plagAnnoUser');
    setShowLogin(true);
    setSelectedDataset(null);
    setSelectedCase(null);
  };

  // Main render
  return (
    <div className="App">
      <h1>Plagiarism Annotation Tool</h1>

      {!currentUser ? (
        // Not logged in: show login/register
        <div>
          {showLogin ? (
            <>
              <Login onLoginSuccess={handleLoginSuccess} />
              <p>
                Don't have an account?{' '}
                <button onClick={() => setShowLogin(false)}>Register here</button>
              </p>
            </>
          ) : (
            <>
              <Register onRegisterSuccess={handleRegisterSuccess} />
              <p>
                Already have an account?{' '}
                <button onClick={() => setShowLogin(true)}>Login here</button>
              </p>
            </>
          )}
        </div>
      ) : (
        // Logged in:
        <div>
          <p>
            Welcome, {currentUser}!{' '}
            <button onClick={handleLogout}>Logout</button>
          </p>
          <hr />

          {!selectedDataset ? (
            // 1) Pick a dataset first
            <DatasetSelector onSelect={ds => setSelectedDataset(ds)} />
          ) : selectedCase ? (
            // 2) Then view a single case
            console.log('Rendering CaseViewer with selectedCase:', selectedCase), // Add logging here
            <CaseViewer
              key={selectedCase.original}
              dataset={selectedCase.dataset || selectedDataset} // Use dataset from selectedCase, fallback to selectedDataset
              originalFilename={selectedCase.original}
              anonymizedFilename={selectedCase.anonymized}
              currentUser={currentUser}
              onBack={() => setSelectedCase(null)}
              onDecisionMade={() => {
                setDecisionCounter(c => c + 1);
                setSelectedCase(null);
              }}
              isSelectedCase={selectedCase.isSelectedCase} // Pass the flag
            />
          ) : (
            // 3) Otherwise show the list of cases
            <CaseList
              key={decisionCounter}
              dataset={selectedDataset}
              currentUser={currentUser}
              onSelectCase={setSelectedCase}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;
