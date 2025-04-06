import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import Login from './components/Login';
import Register from './components/Register';
import CaseList from './components/CaseList';
import CaseViewer from './components/CaseViewer';
import './App.css'; // Keep existing styles for now

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogin, setShowLogin] = useState(true); // Show login form by default
  const [selectedCase, setSelectedCase] = useState(null); // State for the selected case filename
  // State to force CaseList refresh after decision - increment a counter
  const [decisionCounter, setDecisionCounter] = useState(0);

  // Persist user session (optional, using localStorage)
  useEffect(() => {
    const storedUser = localStorage.getItem('plagAnnoUser');
    if (storedUser) {
      setCurrentUser(storedUser);
    }
  }, []);

  const handleLoginSuccess = (username) => {
    setCurrentUser(username);
    localStorage.setItem('plagAnnoUser', username); // Store user
  };

  const handleRegisterSuccess = (username) => {
    // After successful registration, switch to the login view
    setShowLogin(true);
    // Optionally log them in automatically:
    // handleLoginSuccess(username);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('plagAnnoUser'); // Clear stored user
    setShowLogin(true); // Go back to login screen
  };

  return (
    <div className="App">
      <h1>Plagiarism Annotation Tool</h1>

      {currentUser ? (
        // --- Logged In View ---
        <div>
          <p>Welcome, {currentUser}! <button onClick={handleLogout}>Logout</button></p>
          <hr />
          {selectedCase ? (
            <CaseViewer
              key={selectedCase} // Force re-mount on case change if needed
              caseFilename={selectedCase}
              currentUser={currentUser}
              onBack={() => setSelectedCase(null)} // Go back to list
              onDecisionMade={() => {
                setDecisionCounter(c => c + 1); // Increment counter to trigger potential list refresh
                setSelectedCase(null); // Go back to list after decision
              }}
            />
          ) : (
            // Pass decisionCounter as key to force re-fetch in CaseList when decision is made
            <CaseList
              key={decisionCounter}
              currentUser={currentUser}
              onSelectCase={setSelectedCase}
            />
          )}
        </div>
      ) : (
        // --- Logged Out View (Login/Register) ---
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
      )}
    </div>
  );
}

export default App;
