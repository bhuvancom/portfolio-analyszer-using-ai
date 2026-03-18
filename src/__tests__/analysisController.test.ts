import request from 'supertest';
import app from '../app';
import { prismaMock } from './setup';
import { generateMockToken } from './testUtils';

// Mock YahooFinanceClient and ChatGptService
jest.mock('../services/YahooFinanceClient', () => {
  return {
    YahooFinanceClient: jest.fn().mockImplementation(() => {
      return {
        getHistoricalData: jest.fn().mockResolvedValue({
            symbol: 'mock_symbol',
            currentPrice: 150,
            history: []
        })
      };
    })
  };
});

jest.mock('../services/ChatGptService', () => {
  return {
    ChatGptService: jest.fn().mockImplementation(() => {
      return {
        analyzeStock: jest.fn().mockResolvedValue({
            recommendation: 'BUY',
            reasoning: 'Strong fundamentals based on mock data.',
            rawResponse: {}
        }),
        analyzePortfolio: jest.fn().mockResolvedValue({
            diversificationScore: 8,
            riskProfile: 'Moderate',
            topPerformer: 'mock_symbol',
            worstPerformer: 'mock_symbol',
            rebalancingNeeded: false,
            portfolioSummary: 'Healthy portfolio.',
            sectorConcentration: {}
        })
      };
    })
  };
});

describe('Analysis Controller Integration Tests', () => {
    const token = generateMockToken(1);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/analysis/refresh', () => {
        it('should trigger a new analysis refresh if no refreshing status exists', async () => {
            // No existing refreshing analysis
            prismaMock.analysisMetadata.findFirst.mockResolvedValue(null);
            
            // Return a mocked created instance
            const newMetadata = { id: 10, userId: 1, status: 'refreshing', interval: '1d', range: '1y', createdAt: new Date(), completedAt: null, diversificationScore: null, riskProfile: null, topPerformer: null, worstPerformer: null, rebalancingNeeded: null, portfolioSummary: null, sectorConcentration: null };
            prismaMock.analysisMetadata.create.mockResolvedValue(newMetadata);

            // The background job runs asynchronously. We need to wait for it to process the mock holdings.
            // Setup mock holdings for the job to find
            prismaMock.holding.findMany.mockResolvedValue([
                { id: 100, userId: 1, tradingSymbol: 'RELIANCE', isin: 'INE002A01018', quantity: 10, averagePrice: 2000, platform: 'MANUAL', createdAt: new Date(), updatedAt: new Date() }
            ]);

            // Setup DB mock responses for the side-effects of runAnalysisJob
            prismaMock.analysisHoldingSnapshot.create.mockResolvedValue({} as any);
            prismaMock.analysisMetadata.update.mockResolvedValue({} as any);
            prismaMock.analysisMetadata.findMany.mockResolvedValue([]);

            const response = await request(app)
                .post('/api/analysis/refresh')
                .set('Authorization', `Bearer ${token}`)
                .send({ interval: '1 Day', range: '1 Year' });

            expect(response.status).toBe(202);
            expect(response.body.message).toContain('triggered successfully');
            expect(prismaMock.analysisMetadata.create).toHaveBeenCalled();

            // The background job runs asynchronously. We need to wait for it to process the mock holdings.


            // Give the event loop a tick to process the un-awaited async job
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Verify the background job successfully created snapshots and updated metadata status using the mocked external services
            expect(prismaMock.analysisHoldingSnapshot.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        advice: 'BUY',
                        reasoning: 'Strong fundamentals based on mock data.'
                    })
                })
            );

            expect(prismaMock.analysisMetadata.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        status: 'completed',
                        diversificationScore: 8,
                        portfolioSummary: 'Healthy portfolio.'
                    })
                })
            );
        });

        it('should return 429 if an analysis is already refreshing', async () => {
            const existingMetadata = { id: 10, userId: 1, status: 'refreshing', interval: '1d', range: '1y', createdAt: new Date(), completedAt: null, diversificationScore: null, riskProfile: null, topPerformer: null, worstPerformer: null, rebalancingNeeded: null, portfolioSummary: null, sectorConcentration: null };
            prismaMock.analysisMetadata.findFirst.mockResolvedValue(existingMetadata);

            const response = await request(app)
                .post('/api/analysis/refresh')
                .set('Authorization', `Bearer ${token}`)
                .send({ interval: '1 Day', range: '1 Year' });

            expect(response.status).toBe(429);
            expect(response.body.message).toContain('already refreshing');
        });
    });

    describe('GET /api/analysis', () => {
        it('should fetch the N most recent analyses for the user', async () => {
            const metadatas = [
                 { id: 1, userId: 1, status: 'completed', interval: '1d', range: '1y', createdAt: new Date(), completedAt: new Date(), diversificationScore: null, riskProfile: null, topPerformer: null, worstPerformer: null, rebalancingNeeded: null, portfolioSummary: null, sectorConcentration: null }
            ];
            prismaMock.analysisMetadata.findMany.mockResolvedValue(metadatas);

            const response = await request(app)
                .get('/api/analysis?n=2')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.data.length).toBe(1);
            expect(prismaMock.analysisMetadata.findMany).toHaveBeenCalledWith({
                where: { userId: 1 },
                orderBy: { createdAt: 'desc' },
                take: 2
            });
        });
    });

    describe('DELETE /api/analysis/:id', () => {
        it('should delete a specific analysis if not refreshing', async () => {
             const existingMetadata = { id: 10, userId: 1, status: 'completed', interval: '1d', range: '1y', createdAt: new Date(), completedAt: new Date(), diversificationScore: null, riskProfile: null, topPerformer: null, worstPerformer: null, rebalancingNeeded: null, portfolioSummary: null, sectorConcentration: null };
             prismaMock.analysisMetadata.findUnique.mockResolvedValue(existingMetadata);
             prismaMock.analysisMetadata.delete.mockResolvedValue(existingMetadata);

             const response = await request(app)
                 .delete('/api/analysis/10')
                 .set('Authorization', `Bearer ${token}`);

             expect(response.status).toBe(200);
             expect(prismaMock.analysisMetadata.delete).toHaveBeenCalledWith({ where: { id: 10 } });
        });

        it('should prevent deleting an actively refreshing analysis', async () => {
             const existingMetadata = { id: 10, userId: 1, status: 'refreshing', interval: '1d', range: '1y', createdAt: new Date(), completedAt: new Date(), diversificationScore: null, riskProfile: null, topPerformer: null, worstPerformer: null, rebalancingNeeded: null, portfolioSummary: null, sectorConcentration: null };
             prismaMock.analysisMetadata.findUnique.mockResolvedValue(existingMetadata);

             const response = await request(app)
                 .delete('/api/analysis/10')
                 .set('Authorization', `Bearer ${token}`);

             expect(response.status).toBe(400);
             expect(response.body.message).toContain('Cannot delete');
        });
    });

    describe('DELETE /api/analysis', () => {
        it('should delete all analyses if none are refreshing', async () => {
            prismaMock.analysisMetadata.findFirst.mockResolvedValue(null);
            prismaMock.analysisMetadata.deleteMany.mockResolvedValue({ count: 3 });

            const response = await request(app)
                .delete('/api/analysis')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Successfully deleted all 3 analyses');
        });
    });
});
