import React, { useState } from 'react';
import { APP_CONFIG } from '../config';

function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

    if (!password) {
      setError('Please enter a password.');
      setLoading(false);
      return;
    }

    // Check if password matches the one in config
    if (password !== APP_CONFIG.LOGIN_PASSWORD) {
      setError('Invalid password.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/login`, {
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
      <form onSubmit={handleLogin}>
        <div>
          <label htmlFor="username">Username: </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password: </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
