import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../utils/db';
import { AnalysisService } from '../services/analysisService';
import { YahooFinanceClient } from '../services/YahooFinanceClient';
import { ChatGptService } from '../services/ChatGptService';
import { AnalysisStatus } from '../constants/status';

// Dependency Injection Setup
const yahooClient = new YahooFinanceClient();
const chatGptService = new ChatGptService();
const analysisService = new AnalysisService(yahooClient, chatGptService);

// POST /api/analysis/refresh
export const triggerRefresh = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const { interval = '1 Day', range = '1 Year' } = req.body;

    try {
        // 1. Check if user already has a 'refreshing' analysis
        const existingRefreshing = await prisma.analysisMetadata.findFirst({
            where: { userId, status: AnalysisStatus.REFRESHING }
        });

        if (existingRefreshing) {
            res.status(429).json({ 
                success: false, 
                message: 'An analysis is already refreshing. Please wait for it to complete.',
                data: existingRefreshing
            });
            return;
        }

        // 2. Create new analysis metadata in 'refreshing' state
        const newMetadata = await prisma.analysisMetadata.create({
            data: {
                userId: userId as number,
                status: AnalysisStatus.REFRESHING,
                interval,
                range
            }
        });

        // 3. Trigger async logic without awaiting it
        // We pass the newMetadata.id to the async worker to be processed in background
        analysisService.runAnalysisJob(userId as number, newMetadata.id, interval, range);

        res.status(202).json({
            success: true,
            message: 'Analysis refresh triggered successfully and is running in background',
            data: newMetadata
        });
    } catch (error: any) {
        console.error('triggerRefresh error:', error);
        res.status(500).json({ success: false, message: 'Server error triggering analysis refresh' });
    }
};

// GET /api/analysis
// Query param: N (default 5)
export const getRecentAnalysis = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const n = parseInt(req.query.n as string) || 5;

    try {
        const metadatas = await prisma.analysisMetadata.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: n,
            include: {
                _count: { select: { snapshots: true } }
            }
        });

        res.status(200).json({ success: true, data: metadatas });
    } catch (error: any) {
        console.error('getRecentAnalysis error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching analysis metadata' });
    }
};

// GET /api/analysis/:id
export const getAnalysisDetails = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const metadataId = parseInt(req.params.id as string, 10);

    try {
        const metadata = await prisma.analysisMetadata.findUnique({
            where: { id: metadataId },
            include: {
                snapshots: true // Include all the holding snapshots for this analysis
            }
        });

        if (!metadata || metadata.userId !== userId) {
            res.status(404).json({ success: false, message: 'Analysis not found or unauthorized' });
            return;
        }

        res.status(200).json({ success: true, data: metadata });
    } catch (error: any) {
        console.error('getAnalysisDetails error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching analysis details' });
    }
};

// POST /api/analysis/:id/refresh
export const refreshExistingAnalysis = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const metadataId = parseInt(req.params.id as string, 10);
    const { interval = '1 Day', range = '1 Year' } = req.body;

    try {
        const existingAnalysis = await prisma.analysisMetadata.findUnique({
            where: { id: metadataId }
        });

        if (!existingAnalysis || existingAnalysis.userId !== userId) {
            res.status(404).json({ success: false, message: 'Analysis not found or unauthorized' });
            return;
        }

        if (existingAnalysis.status === AnalysisStatus.REFRESHING) {
            res.status(429).json({
                success: false,
                message: 'This analysis is already refreshing.'
            });
            return;
        }

        // Before re-running the job for the *same* analysis, delete its old snapshots
        await prisma.analysisHoldingSnapshot.deleteMany({
            where: { metadataId }
        });

        const updatedMetadata = await prisma.analysisMetadata.update({
            where: { id: metadataId },
            data: {
                status: AnalysisStatus.REFRESHING,
                interval,
                range
            }
        });

        analysisService.runAnalysisJob(userId as number, metadataId, interval, range);

        res.status(202).json({
            success: true,
            message: 'Existing analysis refresh triggered successfully',
            data: updatedMetadata
        });
    } catch (error: any) {
        console.error('refreshExistingAnalysis error:', error);
        res.status(500).json({ success: false, message: 'Server error refreshing existing analysis' });
    }
};

// DELETE /api/analysis/:id
export const deleteAnalysis = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const metadataId = parseInt(req.params.id as string, 10);

    try {
        const metadata = await prisma.analysisMetadata.findUnique({
            where: { id: metadataId }
        });

        if (!metadata || metadata.userId !== userId) {
            res.status(404).json({ success: false, message: 'Analysis not found or unauthorized' });
            return;
        }

        if (metadata.status === AnalysisStatus.REFRESHING) {
            res.status(400).json({ success: false, message: 'Cannot delete an analysis while it is refreshing' });
            return;
        }

        await prisma.analysisMetadata.delete({
            where: { id: metadataId }
        });

        res.status(200).json({ success: true, message: 'Analysis deleted successfully' });
    } catch (error: any) {
        console.error('deleteAnalysis error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting analysis' });
    }
};

// DELETE /api/analysis
export const deleteAllAnalysis = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;

    try {
        // Prevent deletion if any analysis is currently refreshing
        const refreshing = await prisma.analysisMetadata.findFirst({
            where: { userId, status: AnalysisStatus.REFRESHING }
        });

        if (refreshing) {
            res.status(400).json({ success: false, message: 'Cannot delete all analyses while one is actively refreshing.' });
            return;
        }

        const deleted = await prisma.analysisMetadata.deleteMany({
            where: { userId }
        });

        res.status(200).json({ 
            success: true, 
            message: `Successfully deleted all ${deleted.count} analyses for user.` 
        });
    } catch (error: any) {
        console.error('deleteAllAnalysis error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting all analyses' });
    }
};
// DELETE /api/analysis/bulk
export const deleteAnalyses = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ success: false, message: 'Invalid or empty IDs array' });
        return;
    }

    try {
        const deleted = await prisma.analysisMetadata.deleteMany({
            where: {
                userId,
                id: { in: ids.map(id => Number(id)) },
                status: { not: AnalysisStatus.REFRESHING } // Safety: don't delete actively refreshing ones
            }
        });

        res.status(200).json({ 
            success: true, 
            message: `Successfully deleted ${deleted.count} analyses.` 
        });
    } catch (error: any) {
        console.error('deleteAnalyses (bulk) error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting analyses in bulk' });
    }
};
