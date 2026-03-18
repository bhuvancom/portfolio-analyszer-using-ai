import { Router } from 'express';
import { authenticateJWT } from '../middlewares/authMiddleware';
import { triggerRefresh, getRecentAnalysis, getAnalysisDetails, refreshExistingAnalysis, deleteAnalysis, deleteAllAnalysis, deleteAnalyses } from '../controllers/analysisController';

const router = Router();

// Protect all analysis routes
router.use(authenticateJWT);

router.post('/refresh', triggerRefresh);
router.post('/:id/refresh', refreshExistingAnalysis);
router.get('/', getRecentAnalysis);
router.get('/:id', getAnalysisDetails);
router.delete('/', deleteAllAnalysis);
router.post('/bulk-delete', deleteAnalyses);
router.delete('/:id', deleteAnalysis);

export default router;
