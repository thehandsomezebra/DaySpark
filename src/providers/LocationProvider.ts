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

    async getDataForDate(date: Date, fileContent?: string): Promise<ProviderResult> {
        // 1. Check if "## My Location" already exists in the file
        // If the user manually typed it, we don't want to overwrite or duplicate it.
        if (fileContent && /## My Location/i.test(fileContent)) {
            return { items: [] }; 
        }

        // 2. If missing, Auto-Calculate from Settings
        let locationName = `${this.settings.latitude.toFixed(4)}, ${this.settings.longitude.toFixed(4)}`;
        
        // Try to get a friendly name (Reverse Geocode)
        const friendlyName = await reverseGeocode(this.settings.latitude, this.settings.longitude);
        if (friendlyName) {
            locationName = friendlyName;
        }
        
        return {
            items: [locationName] 
        };
    }
}