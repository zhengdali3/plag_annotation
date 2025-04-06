import React, { useState } from 'react';

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    if (!username) {
      setError('Please enter a username.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Login successful:', data);
        onLoginSuccess(data.username); // Pass username up to parent
      } else {
        setError(data.error || 'Login failed. Please try again.');
        console.error('Login failed:', data);
      }
    } catch (err) {
      setError('An error occurred during login. Check if the backend server is running.');
      console.error('Login network error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div>
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      {/* Link/button to switch to registration can be added here */}
    </div>
  );
}

export default Login;
