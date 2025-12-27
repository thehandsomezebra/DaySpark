import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';
import { requestUrl } from 'obsidian';

interface WikiEvent {
    year: number;
    text: string;
}

interface WikiResponse {
    selected: WikiEvent[];
}

export class HistoryProvider implements SparkProvider {
    id = 'history-events';
    displayName = 'On This Day';
    targetHeader = '## On This Day';
    settings: DaySparkSettings;

    constructor(settings: DaySparkSettings) {
        this.settings = settings;
        if (this.settings.historyHeader) this.targetHeader = this.settings.historyHeader;
    }

    async getDataForDate(targetDate: Date, fileContent?: string): Promise<ProviderResult> {
        if (!this.settings.enableHistory) return { items: [] };

        // Wikipedia API format: MM/DD (e.g. 12/25)
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        
        const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/selected/${month}/${day}`;

        // eslint-disable-next-line no-undef
        console.debug(`DaySpark History: Fetching ${url}`);

        try {
            const response = await requestUrl({ 
                url,
                headers: { 'User-Agent': 'DaySpark-Obsidian-Plugin/1.0' }
            });
            
            if (response.status !== 200) return { items: [] };

            const data = JSON.parse(response.text) as WikiResponse;
            
            if (!data || !data.selected || data.selected.length === 0) {
                return { items: [] };
            }

            const items: string[] = [];
            
            // Limit events based on settings (Default 5)
            const limit = this.settings.historyLimit || 5;
            const events = data.selected.slice(0, limit);

            for (const event of events) {
                // Format: "📜 **1969:** Neil Armstrong steps on the moon."
                items.push(`📜 **${event.year}:** ${event.text}`);
            }

            return { items };

        } catch (err) {
            // eslint-disable-next-line no-undef
            console.error("DaySpark: History API Error", err);
            return { items: [] };
        }
    }
}