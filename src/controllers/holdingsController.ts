import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../utils/db';
import { BrokerStrategy } from '../services/brokerStrategies/BrokerStrategy';
import { GrowwStrategy } from '../services/brokerStrategies/GrowwStrategy';
import { mockHoldings } from '../constants/mockDatar';

// GET /api/holdings
export const getHoldings = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    try {
        const holdings = await prisma.holding.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json({ success: true, data: holdings });
    } catch (error: any) {
        console.error('getHoldings error:', error);
        res.status(500).json({ success: false, message: 'Server error fetching holdings' });
    }
};

// POST /api/holdings
export const addHolding = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const { tradingSymbol, isin, quantity, averagePrice } = req.body;

    if (!tradingSymbol || quantity === undefined || averagePrice === undefined) {
        res.status(400).json({ success: false, message: 'Missing required parameters' });
        return;
    }

    try {
        const existing = await prisma.holding.findFirst({
            where: { userId: userId as number, tradingSymbol }
        });

        let holding;
        if (existing) {
            holding = await prisma.holding.update({
                where: { id: existing.id },
                data: {
                    quantity: existing.quantity + Number(quantity),
                    // Simplistic weighted average
                    averagePrice: ((existing.quantity * existing.averagePrice) + (Number(quantity) * Number(averagePrice))) / (existing.quantity + Number(quantity)),
                    platform: 'MANUAL',
                    isin: isin || existing.isin
                }
            });
        } else {
            holding = await prisma.holding.create({
                data: {
                    userId: userId as number,
                    tradingSymbol,
                    isin,
                    quantity: Number(quantity),
                    averagePrice: Number(averagePrice),
                    platform: 'MANUAL'
                }
            });
        }

        res.status(201).json({ success: true, data: holding });
    } catch (error: any) {
        console.error('addHolding error:', error);
        res.status(500).json({ success: false, message: 'Server error adding holding' });
    }
};

// PUT /api/holdings/:id
export const updateHolding = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const holdingId = parseInt(req.params.id as string, 10);
    const { quantity, averagePrice } = req.body;

    try {
        const existing = await prisma.holding.findUnique({ where: { id: holdingId } });
        if (!existing || existing.userId !== userId) {
            res.status(404).json({ success: false, message: 'Holding not found or unauthorized' });
            return;
        }

        const updated = await prisma.holding.update({
            where: { id: holdingId },
            data: {
                ...(quantity !== undefined && { quantity: Number(quantity) }),
                ...(averagePrice !== undefined && { averagePrice: Number(averagePrice) })
            }
        });

        res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
        console.error('updateHolding error:', error);
        res.status(500).json({ success: false, message: 'Server error updating holding' });
    }
};

// DELETE /api/holdings/:id
export const deleteHolding = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const holdingId = parseInt(req.params.id as string, 10);

    try {
        const existing = await prisma.holding.findUnique({ where: { id: holdingId } });
        if (!existing || existing.userId !== userId) {
            res.status(404).json({ success: false, message: 'Holding not found or unauthorized' });
            return;
        }

        await prisma.holding.delete({ where: { id: holdingId } });
        res.status(200).json({ success: true, message: 'Holding deleted successfully' });
    } catch (error: any) {
        console.error('deleteHolding error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting holding' });
    }
};

// POST /api/holdings/import
export const importHoldings = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const { platform, apiKey, apiSecret, otherTokens } = req.body;

    if (!platform || !apiKey) {
        res.status(400).json({ success: false, message: 'Platform and API key are required' });
        return;
    }

    let strategy: BrokerStrategy;

    switch (platform.toLowerCase()) {
        case 'groww':
            if (!apiSecret) {
                res.status(400).json({ success: false, message: 'Groww integration requires an apiSecret.' });
                return;
            }
            strategy = new GrowwStrategy();
            break;
        // Add additional platforms (Zerodha, Upstox, etc.) here
        default:
            res.status(400).json({ success: false, message: `Platform '${platform}' is not supported yet.` });
            return;
    }

    try {
        console.log(`[Import] Fetching holdings from ${platform} for user ${userId}`);
        const importedHoldings = await strategy.fetchHoldings(apiKey, apiSecret, otherTokens);

        if (importedHoldings.length === 0) {
             res.status(200).json({ success: true, message: `No holdings found on ${platform}` });
             return;
        }

        // Bulk upsert imported holdings
        const creationPromises = importedHoldings.map(async (h) => {
             const existing = await prisma.holding.findFirst({
                 where: { userId: userId as number, tradingSymbol: h.tradingSymbol }
             });

             if (existing) {
                 return prisma.holding.update({
                     where: { id: existing.id },
                     data: {
                         quantity: h.quantity,
                         averagePrice: h.averagePrice,
                         platform: platform.toUpperCase(),
                         isin: h.isin || existing.isin
                     }
                 });
             } else {
                 return prisma.holding.create({
                     data: {
                         userId: userId as number,
                         platform: platform.toUpperCase(),
                         tradingSymbol: h.tradingSymbol,
                         isin: h.isin,
                         quantity: h.quantity,
                         averagePrice: h.averagePrice
                     }
                 });
             }
        });

        const createdHoldings = await Promise.all(creationPromises);

        res.status(200).json({
            success: true, 
            message: `Successfully imported ${createdHoldings.length} holdings from ${platform}`,
            data: createdHoldings
        });
    } catch (error: any) {
        console.error('importHoldings error:', error);
        res.status(500).json({ success: false, message: error.message || `Server error importing from ${platform}` });
    }
};

// POST /api/holdings/demo
export const addDemoHoldings = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;

    try {
        const creationPromises = mockHoldings.map(async (h) => {
             const existing = await prisma.holding.findFirst({
                 where: { userId: userId as number, tradingSymbol: h.trading_symbol }
             });

             if (existing) {
                 return prisma.holding.update({
                     where: { id: existing.id },
                     data: {
                         quantity: h.quantity,
                         averagePrice: h.average_price,
                         platform: "DEMO - " + h.trading_symbol,
                         isin: h.isin || existing.isin
                     }
                 });
             } else {
                 return prisma.holding.create({
                     data: {
                         userId: userId as number,
                         platform: "DEMO - " + h.trading_symbol,
                         tradingSymbol: h.trading_symbol,
                         isin: h.isin,
                         quantity: h.quantity,
                         averagePrice: h.average_price
                     }
                 });
             }
        });

        const createdHoldings = await Promise.all(creationPromises);

        res.status(201).json({
            success: true, 
            message: `Successfully injected ${createdHoldings.length} demo holdings!`,
            data: createdHoldings
        });
    } catch (error: any) {
        console.error('addDemoHoldings error:', error);
        res.status(500).json({ success: false, message: 'Server error adding demo holdings' });
    }
};

// DELETE /api/holdings
export const deleteAllHoldings = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;

    try {
        const deleted = await prisma.holding.deleteMany({
            where: { userId }
        });

        res.status(200).json({ 
            success: true, 
            message: `Successfully deleted all ${deleted.count} holdings for user.` 
        });
    } catch (error: any) {
        console.error('deleteAllHoldings error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting all holdings' });
    }
};
// DELETE /api/holdings/bulk
export const deleteHoldings = async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user?.userId;
    const { ids } = req.body; // Expecting array of numbers

    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ success: false, message: 'Invalid or empty IDs array' });
        return;
    }

    try {
        const deleted = await prisma.holding.deleteMany({
            where: {
                userId,
                id: { in: ids.map(id => Number(id)) }
            }
        });

        res.status(200).json({ 
            success: true, 
            message: `Successfully deleted ${deleted.count} holdings.` 
        });
    } catch (error: any) {
        console.error('deleteHoldings (bulk) error:', error);
        res.status(500).json({ success: false, message: 'Server error deleting holdings in bulk' });
    }
};
