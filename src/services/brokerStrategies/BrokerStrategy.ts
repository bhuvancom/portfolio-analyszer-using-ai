export interface ImportedHolding {
    tradingSymbol: string;
    quantity: number;
    averagePrice: number;
    isin?: string;
}

export interface BrokerStrategy {
    /**
     * Fetch holdings from the broker.
     * @param apiKey The API key or access token provided by the user.
     * @param apiSecret Optional secret if the broker requires a checksum/signature.
     * @param additionalParams Any extra information required by the specific broker.
     * @returns A promise resolving to an array of normalized holdings.
     */
    fetchHoldings(apiKey: string, apiSecret?: string, additionalParams?: Record<string, any>): Promise<ImportedHolding[]>;
}
