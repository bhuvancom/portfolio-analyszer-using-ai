import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import holdingsRoutes from './routes/holdingsRoutes';
import analysisRoutes from './routes/analysisRoutes';
import { CronService } from './services/cronService';

// Initialize Cron Jobs
CronService.init();

const app = express();

// Enable CORS for all origins
app.use(cors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Handle preflight requests for all routes
app.options('*', cors());
app.use(express.json());

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
