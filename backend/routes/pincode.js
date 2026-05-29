import express from 'express';
import https from 'https';

const router = express.Router();

// GET /api/pincode/:pincode
// Fetches city and state for a given Indian pincode
router.get('/:pincode', async (req, res) => {
    try {
        const { pincode } = req.params;

        // Validate pincode format
        if (!/^\d{6}$/.test(pincode)) {
            return res.status(400).json({ error: 'Invalid pincode format' });
        }

        // Try multiple pincode APIs as fallback
        const apis = [
            `https://api.postalpincode.in/pincode/${pincode}`,
            `https://pincode.in/api/v1/pincode/${pincode}`,
        ];

        let lastError = null;

        for (const apiUrl of apis) {
            try {
                const data = await fetchFromAPI(apiUrl);
                
                if (data && Array.isArray(data) && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
                    const location = data[0].PostOffice[0];
                    return res.json({
                        success: true,
                        city: location.District || '',
                        state: location.State || '',
                        country: 'India'
                    });
                }
            } catch (error) {
                lastError = error;
                console.log(`API ${apiUrl} failed, trying next...`);
                continue;
            }
        }

        // If all APIs fail, return error
        console.error('All pincode APIs failed:', lastError);
        return res.status(404).json({ 
            error: 'Could not find location for this pincode',
            details: lastError?.message 
        });

    } catch (error) {
        console.error('Error in pincode endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to fetch from API with timeout
function fetchFromAPI(url) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('API request timeout'));
        }, 5000);

        https.get(url, { rejectUnauthorized: false }, (response) => {
            clearTimeout(timeout);
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(new Error('Invalid JSON response'));
                }
            });
        }).on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
        });
    });
}

export default router;
