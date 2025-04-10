import React, { useState } from 'react';
import { APP_CONFIG } from '../config';

function Register({ onRegisterSuccess }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    if (!username) {
      setError('Please enter a username.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${APP_CONFIG.API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(`Registration successful for ${data.username}! You can now log in.`);
        console.log('Registration successful:', data);
        // Optionally call onRegisterSuccess if needed, e.g., to switch view
        if (onRegisterSuccess) {
            onRegisterSuccess(data.username);
        }
        setUsername(''); // Clear input on success
      } else {
        setError(data.error || 'Registration failed. Please try again.');
        console.error('Registration failed:', data);
      }
    } catch (err) {
      setError('An error occurred during registration. Check if the backend server is running.');
      console.error('Registration network error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleRegister}>
        <div>
          <label htmlFor="reg-username">Username:</label>
          <input
            type="text"
            id="reg-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <p className="info-message">
          Note: All users share a common password that will be provided to you separately.
        </p>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
       {/* Link/button to switch to login can be added here */}
    </div>
  );
}

export default Register;
