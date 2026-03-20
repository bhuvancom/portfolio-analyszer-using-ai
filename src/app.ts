import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import holdingsRoutes from './routes/holdingsRoutes';
import analysisRoutes from './routes/analysisRoutes';
import { CronService } from './services/cronService';

// Initialize Cron Jobs
if (!process.env.VERCEL) {
    CronService.init();
}


const app = express();

const corsOptions = {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true,
    optionsSuccessStatus: 200
};

// 1. Enable CORS for all origins - MUST BE FIRST
app.use(cors(corsOptions));

// 2. Handle preflight requests for all routes - Handled by app.use(cors()) above
// No need for app.options() anymore as the middleware handles it globablly.


app.use(express.json());

// Root routes after CORS
app.all('/', (req, res) => {
    res.json({ message: "Welcome to Vantage AI Portfolio Advisor" });
});
app.all('/fevicon.ico', (req, res) => {
    res.send();
});


// Main Routes
app.use('/api/auth', authRoutes);
app.use('/api/holdings', holdingsRoutes);
app.use('/api/analysis', analysisRoutes);

// Health Check route mapped from original Java app
app.get('/api/advisor/health', (req: Request, res: Response) => {
    res.json({
        status: "UP",
        service: "Vantage AI Portfolio Advisor (Express)",
        version: "1.0.0"
    });
});

export default app;
