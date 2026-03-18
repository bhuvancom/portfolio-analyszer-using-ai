import { Router } from 'express';
import { authenticateJWT } from '../middlewares/authMiddleware';
import { getHoldings, addHolding, updateHolding, deleteHolding, importHoldings, addDemoHoldings, deleteAllHoldings, deleteHoldings } from '../controllers/holdingsController';

const router = Router();

// Protect all holdings routes
router.use(authenticateJWT);

router.get('/', getHoldings);
router.post('/', addHolding);
router.delete('/', deleteAllHoldings);
router.post('/bulk-delete', deleteHoldings); // Using post for bulk delete to avoid long URL issues with many IDs, though delete with body is also fine
router.post('/demo', addDemoHoldings);
router.post('/import', importHoldings);
router.put('/:id', updateHolding);
router.delete('/:id', deleteHolding);

export default router;
