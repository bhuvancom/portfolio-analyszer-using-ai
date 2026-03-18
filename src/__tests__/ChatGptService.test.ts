import axios from 'axios';
import { ChatGptService } from '../services/ChatGptService';
import { Holding } from '@prisma/client';
import { HistoricalData } from '../services/YahooFinanceClient';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ChatGptService Unit Tests', () => {
    let service: ChatGptService;

    const mockHolding: Holding = {
        id: 1, userId: 1, tradingSymbol: 'RELIANCE', isin: 'INE', quantity: 10, averagePrice: 2000,
        platform: 'MANUAL', createdAt: new Date(), updatedAt: new Date()
    };

    const mockHist: HistoricalData = {
        symbol: 'RELIANCE.NS', currentPrice: 2100, fiftyTwoWeekHigh: 2500, fiftyTwoWeekLow: 1900,
        currency: 'INR', closePrices: [2000, 2050, 2100], volumes: [], highPrices: [], lowPrices: []
    };

    beforeEach(() => {
        service = new ChatGptService();
        jest.clearAllMocks();
        // Set API key for tests
        (service as any).chatGptApiKey = 'test_key';
    });

    it('should analyze a stock successfully', async () => {
        const mockResponse = {
            data: {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            recommendation: 'BUY',
                            targetPrice3M: 2200,
                            targetPrice1Y: 2500,
                            stopLoss: 1950,
                            riskLevel: 'MEDIUM',
                            reasoning: 'Good trend.',
                            technicalSummary: 'Bullish.',
                            fundamentalSummary: 'Solid.',
                            newsSentiment: 'POSITIVE',
                            forecastedReturnPct: 15,
                            suggestedAction: 'Accumulate.'
                        })
                    }
                }]
            }
        };

        mockedAxios.post.mockResolvedValue(mockResponse);

        const advice = await service.analyzeStock(mockHolding, mockHist);

        expect(advice.recommendation).toBe('BUY');
        expect(advice.targetPrice1Y).toBe(2500);
        expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should retry on 429 and eventually succeed', async () => {
        const mockError = { response: { status: 429 } };
        const mockSuccess = {
            data: {
                choices: [{ message: { content: '{"recommendation": "HOLD"}' } }]
            }
        };

        mockedAxios.post
            .mockRejectedValueOnce(mockError)
            .mockResolvedValueOnce(mockSuccess);

        // Spy on sleep to make test fast
        jest.spyOn(service as any, 'sleep').mockResolvedValue(null);

        const advice = await service.analyzeStock(mockHolding, mockHist);

        expect(advice.recommendation).toBe('HOLD');
        expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should throw error after exhausting retries', async () => {
        mockedAxios.post.mockRejectedValue({ response: { status: 500 } });
        jest.spyOn(service as any, 'sleep').mockResolvedValue(null);

        await expect(service.analyzeStock(mockHolding, mockHist, 2)).rejects.toThrow('ChatGPT API failed');
    });

    it('should fall back to defaults on JSON parse error', async () => {
        mockedAxios.post.mockResolvedValue({
            data: { choices: [{ message: { content: 'Invalid JSON' } }] }
        });

        const advice = await service.analyzeStock(mockHolding, mockHist);
        expect(advice.recommendation).toBe('HOLD'); // Default
    });

    it('should analyze portfolio correctly', async () => {
        const mockPortfolioResponse = {
            data: {
                choices: [{
                    message: {
                        content: JSON.stringify({
                            diversificationScore: '7/10',
                            riskProfile: 'MODERATE',
                            topPerformer: 'RELIANCE',
                            worstPerformer: 'TCS',
                            rebalancingNeeded: true,
                            portfolioSummary: 'Looking good.',
                            sectorConcentration: 'High in Tech'
                        })
                    }
                }]
            }
        };

        mockedAxios.post.mockResolvedValue(mockPortfolioResponse);

        const portfolioAdvice = await service.analyzePortfolio([{
            holding: mockHolding,
            advice: { recommendation: 'BUY', targetPrice1Y: 2500, riskLevel: 'LOW' } as any,
            currentPrice: 2100
        }]);

        expect(portfolioAdvice.diversificationScore).toBe('7/10');
        expect(portfolioAdvice.rebalancingNeeded).toBe(true);
    });

    it('should return default portfolio advice if no data', async () => {
        const advice = await service.analyzePortfolio([]);
        expect(advice.diversificationScore).toBe('N/A');
    });
});
