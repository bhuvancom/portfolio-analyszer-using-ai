import dotenv from 'dotenv';
dotenv.config();

// Import tracing first to initialize OpenTelemetry synchronously
import './tracing';

import app from './app';

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(Number(PORT), '0.0.0.0', () => {
        console.log(`Server is running on http://0.0.0.0:${PORT}`);
    });
}

module.exports = app;
export default app;
