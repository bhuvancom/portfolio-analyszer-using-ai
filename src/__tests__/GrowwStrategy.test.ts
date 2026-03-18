import axios from 'axios';
import { GrowwStrategy } from '../services/brokerStrategies/GrowwStrategy';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GrowwStrategy Unit Tests', () => {
    let strategy: GrowwStrategy;

    beforeEach(() => {
        strategy = new GrowwStrategy();
        jest.clearAllMocks();
    });

    it('should generate access token and fetch holdings successfully', async () => {
        const mockTokenResponse = {
            data: { token: 'mock_access_token' }
        };

        const mockHoldingsResponse = {
            data: {
                status: 'SUCCESS',
                payload: {
                    holdings: [
                        { trading_symbol: 'RELIANCE', isin: 'INE002A01018', quantity: 10, average_price: 2000 },
                        { tradingSymbol: 'TCS', isin: 'INE467B01029', quantity: 5, averagePrice: 3500 }
                    ]
                }
            }
        };

        mockedAxios.post.mockResolvedValue(mockTokenResponse);
        mockedAxios.get.mockResolvedValue(mockHoldingsResponse);

        const holdings = await strategy.fetchHoldings('apiKey', 'apiSecret');

        expect(holdings).toHaveLength(2);
        expect(holdings[0].tradingSymbol).toBe('RELIANCE');
        expect(holdings[1].tradingSymbol).toBe('TCS');
        expect(mockedAxios.post).toHaveBeenCalledWith(expect.stringContaining('/v1/token/api/access'), expect.any(Object), expect.any(Object));
        expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/v1/holdings/user'), expect.any(Object));
    });

    it('should throw error if apiSecret is missing', async () => {
        await expect(strategy.fetchHoldings('apiKey')).rejects.toThrow('Groww integration requires an API Secret to generate the access token.');
    });

    it('should throw error if token generation fails', async () => {
        mockedAxios.post.mockResolvedValue({ data: { error: 'Invalid keys' } });

        await expect(strategy.fetchHoldings('apiKey', 'apiSecret')).rejects.toThrow('Groww access token generation failed');
    });

    it('should throw error if holdings API returns failure status', async () => {
        mockedAxios.post.mockResolvedValue({ data: { token: 'token' } });
        mockedAxios.get.mockResolvedValue({ data: { status: 'FAILURE', error: { code: '123', message: 'API Down' } } });

        await expect(strategy.fetchHoldings('apiKey', 'apiSecret')).rejects.toThrow('Groww API error 123: API Down');
    });
});
