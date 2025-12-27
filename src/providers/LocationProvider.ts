import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';
import { reverseGeocode } from '../utils';

export class LocationProvider implements SparkProvider {
    id = 'location-injector';
    displayName = 'Location Context';
    targetHeader = '## My Location';
    settings: DaySparkSettings;

    constructor(settings: DaySparkSettings) {
        this.settings = settings;
    }

    async getDataForDate(_date: Date, fileContent?: string): Promise<ProviderResult> {
        // Check if "## My Location" already exists
        if (fileContent && /## My Location/i.test(fileContent)) {
            return { items: [] }; 
        }

        let locationName = `${this.settings.latitude.toFixed(4)}, ${this.settings.longitude.toFixed(4)}`;
        
        try {
            const friendlyName = await reverseGeocode(this.settings.latitude, this.settings.longitude);
            if (friendlyName) {
                locationName = friendlyName;
            }
        } catch {
            // Silently fail for location naming; the coordinates are the fallback
        }
        
        return {
            items: [locationName] 
        };
    }
}