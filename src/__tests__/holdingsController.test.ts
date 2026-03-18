import request from 'supertest';
import app from '../app';
import { prismaMock } from './setup';
import { generateMockToken } from './testUtils';

// Mock the GrowwStrategy import
jest.mock('../services/brokerStrategies/GrowwStrategy', () => {
  return {
    GrowwStrategy: jest.fn().mockImplementation(() => {
      return {
        fetchHoldings: jest.fn().mockResolvedValue([
          { tradingSymbol: 'RELIANCE', isin: 'INE002A01018', quantity: 10, averagePrice: 2500 }
        ])
      };
    })
  };
});

describe('Holdings Controller Integration Tests', () => {
    const token = generateMockToken(1);

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /api/holdings', () => {
        it('should return a list of holdings for the user', async () => {
            const mockHoldings = [
                { id: 1, userId: 1, tradingSymbol: 'TCS', isin: 'INE467B01029', quantity: 5, averagePrice: 3500, platform: 'MANUAL', createdAt: new Date(), updatedAt: new Date() }
            ];
            
            prismaMock.holding.findMany.mockResolvedValue(mockHoldings);

            const response = await request(app)
                .get('/api/holdings')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(1);
            expect(prismaMock.holding.findMany).toHaveBeenCalledWith({
                where: { userId: 1 },
                orderBy: { createdAt: 'desc' }
            });
        });
    });

    describe('POST /api/holdings', () => {
        it('should create a new holding if one does not exist', async () => {
            const newHolding = { id: 2, userId: 1, tradingSymbol: 'INFY', isin: 'INE009A01021', quantity: 15, averagePrice: 1500, platform: 'MANUAL', createdAt: new Date(), updatedAt: new Date() };
            
            prismaMock.holding.findFirst.mockResolvedValue(null);
            prismaMock.holding.create.mockResolvedValue(newHolding);

            const response = await request(app)
                .post('/api/holdings')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    tradingSymbol: 'INFY',
                    isin: 'INE009A01021',
                    quantity: 15,
                    averagePrice: 1500
                });

            expect(response.status).toBe(201);
            expect(prismaMock.holding.findFirst).toHaveBeenCalledWith({ where: { userId: 1, tradingSymbol: 'INFY' } });
            expect(prismaMock.holding.create).toHaveBeenCalled();
        });

        it('should update an existing holding using upsert logic', async () => {
            const existing = { id: 2, userId: 1, tradingSymbol: 'INFY', isin: 'INE009A01021', quantity: 10, averagePrice: 1000, platform: 'MANUAL', createdAt: new Date(), updatedAt: new Date() };
            const updated = { ...existing, quantity: 20, averagePrice: 1250 };
            
            prismaMock.holding.findFirst.mockResolvedValue(existing);
            prismaMock.holding.update.mockResolvedValue(updated);

            const response = await request(app)
                .post('/api/holdings')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    tradingSymbol: 'INFY',
                    quantity: 10,
                    averagePrice: 1500
                });

            expect(response.status).toBe(201);
            expect(prismaMock.holding.update).toHaveBeenCalledWith({
                where: { id: 2 },
                data: expect.objectContaining({ quantity: 20 })
            });
        });
    });

    describe('POST /api/holdings/import', () => {
        it('should import holdings via GrowwStrategy', async () => {
            // Because we mocked the response from the strategy directly
            prismaMock.holding.findFirst.mockResolvedValue(null);
            // We don't need to mock transaction anymore since we use Promise.all under the hood. 
            // We just need the code to run through and map over the mocked 1 item from strategy.
            prismaMock.holding.create.mockResolvedValue({ id: 1, userId: 1, tradingSymbol: 'RELIANCE', isin: 'INE002A01018', quantity: 10, averagePrice: 2500, platform: 'GROWW', createdAt: new Date(), updatedAt: new Date() });

            const response = await request(app)
                .post('/api/holdings/import')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    platform: 'groww',
                    apiKey: 'test_key',
                    apiSecret: 'test_secret'
                });

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Successfully imported');
            // Since we use Promise.all and map, check create was called
            expect(prismaMock.holding.create).toHaveBeenCalled();
        });
    });

    describe('DELETE /api/holdings', () => {
        it('should delete all user holdings', async () => {
            prismaMock.holding.deleteMany.mockResolvedValue({ count: 5 });

            const response = await request(app)
                .delete('/api/holdings')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Successfully deleted all 5 holdings');
            expect(prismaMock.holding.deleteMany).toHaveBeenCalledWith({ where: { userId: 1 } });
        });
    });
});
