const axios = require('axios');

const API_URL = 'http://localhost:3000/api';

const testAuth = async () => {
    try {
        console.log('--- Testing Auth ---');
        
        // Register
        const regRes = await axios.post(`${API_URL}/auth/register`, {
            name: 'Test User',
            email: `test${Date.now()}@example.com`,
            password: 'password123',
        });
        console.log('Registration Success:', regRes.data.name);

        const token = regRes.data.token;

        // Login
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: regRes.data.email,
            password: 'password123',
        });
        console.log('Login Success:', loginRes.data.name);

        // Profile
        const profileRes = await axios.get(`${API_URL}/auth/profile`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        console.log('Profile Fetch Success:', profileRes.data.email);

        console.log('--- Auth Tests Passed ---');
    } catch (error) {
        console.error('Auth Test Failed:', error.response ? error.response.data : error.message);
    }
};

testAuth();
