import axios from 'axios';
import { YahooFinanceClient } from '../services/YahooFinanceClient';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('YahooFinanceClient Unit Tests', () => {
    let client: YahooFinanceClient;

    beforeEach(() => {
        client = new YahooFinanceClient();
        jest.clearAllMocks();
    });

    it('should fetch historical data successfully', async () => {
        const mockResponse = {
            data: {
                chart: {
                    result: [{
                        meta: {
                            regularMarketPrice: 2500,
                            fiftyTwoWeekHigh: 2800,
                            fiftyTwoWeekLow: 2100,
                            currency: 'INR'
                        },
                        timestamp: [1600000000, 1600000001],
                        indicators: {
                            quote: [{
                                close: [2490, 2500],
                                volume: [1000, 1100],
                                high: [2510, 2520],
                                low: [2480, 2490]
                            }]
                        }
                    }]
                }
            }
        };

        mockedAxios.get.mockResolvedValue(mockResponse);

        const data = await client.getHistoricalData('RELIANCE-EQ', '1 Day', '1 Year');

        expect(data.symbol).toBe('RELIANCE.NS');
        expect(data.currentPrice).toBe(2500);
        expect(data.closePrices).toEqual([2490, 2500]);
        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining('RELIANCE.NS?interval=1d&range=1y'),
            expect.any(Object)
        );
    });

    it('should throw error if no data found', async () => {
        mockedAxios.get.mockResolvedValue({ data: { chart: { result: null } } });

        await expect(client.getHistoricalData('INVALID')).rejects.toThrow('No historical data found');
    });

    it('should handle null/missing fields gracefully', async () => {
         const mockResponse = {
            data: {
                chart: {
                    result: [{
                        meta: {},
                        timestamp: [1600000000],
                        indicators: {
                            quote: [{
                                close: [null],
                                volume: [null],
                                high: [null],
                                low: [null]
                            }]
                        }
                    }]
                }
            }
        };

        mockedAxios.get.mockResolvedValue(mockResponse);

        const data = await client.getHistoricalData('RELIANCE');
        expect(data.currentPrice).toBe(0);
        expect(data.closePrices).toEqual([0]);
    });

    it('should map intervals and ranges correctly', async () => {
        mockedAxios.get.mockResolvedValue({ data: { chart: { result: [{ meta: {}, timestamp: [], indicators: {} }] } } });

        await client.getHistoricalData('RELIANCE', '1 Min', 'Max');
        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining('interval=1m&range=max'),
            expect.any(Object)
        );

        await client.getHistoricalData('RELIANCE', 'Unknown', 'Unknown');
        expect(mockedAxios.get).toHaveBeenCalledWith(
            expect.stringContaining('interval=Unknown&range=Unknown'),
            expect.any(Object)
        );
    });
});
