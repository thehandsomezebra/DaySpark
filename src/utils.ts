import { TFile, App, requestUrl } from 'obsidian';
import { DaySparkSettings } from './interfaces';

declare global {
    interface Window {
        app: App;
        moment: (input: string, format: string, strict: boolean) => {
            isValid: () => boolean;
            toDate: () => Date;
        };
    }
}

interface NominatimAddress {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    hamlet?: string;
    suburb?: string;
    state?: string;
    country?: string;
}

interface NominatimResult {
    address?: NominatimAddress;
    lat: string;
    lon: string;
    display_name: string;
}

interface OpenMeteoResult {
    latitude: number;
    longitude: number;
    name: string;
    admin1?: string;
    country?: string;
}

// UPDATED: Now accepts 'replace' argument
export function insertOrUpdateSection(content: string, header: string, newItems: string[], replace: boolean = false): string {
    const lines = content.split('\n');
    const headerIndex = lines.findIndex(line => line.trim() === header.trim());

    // Branch A: Header doesn't exist -> Create it
    if (headerIndex === -1) {
        const sectionToAdd = `\n${header}\n` + newItems.map(item => `- ${item}`).join('\n');
        return content + sectionToAdd;
    }

    // Branch B: Header exists -> Find boundaries
    let sectionEndIndex = lines.findIndex((line, index) => index > headerIndex && line.startsWith('#'));
    if (sectionEndIndex === -1) sectionEndIndex = lines.length;

    if (replace) {
        // REPLACE MODE: Overwrite existing items in this section
        const newSectionLines = newItems.map(item => `- ${item}`);
        // Remove old lines between header and next section
        lines.splice(headerIndex + 1, sectionEndIndex - (headerIndex + 1), ...newSectionLines);
        return lines.join('\n');
    } else {
        // APPEND MODE: Only add unique items
        const existingContent = lines.slice(headerIndex + 1, sectionEndIndex).join('\n');
        
        const itemsToAdd: string[] = [];
        for (const item of newItems) {
            if (!existingContent.includes(item.trim())) {
                itemsToAdd.push(`- ${item}`);
            }
        }

        if (itemsToAdd.length === 0) {
            return content;
        }

        lines.splice(sectionEndIndex, 0, ...itemsToAdd);
        return lines.join('\n');
    }
}

export function getDateFromFile(file: TFile, app: App): Date | null {
    interface DailyNotesPlugin {
        instance: {
            options: {
                format: string;
            }
        }
    }
    
    const internalPlugins = (app as unknown as { internalPlugins: { getPluginById: (id: string) => DailyNotesPlugin } }).internalPlugins;
    const dailyNotesPlugin = internalPlugins?.getPluginById('daily-notes');
    let format = "YYYY-MM-DD"; 
    
    if (dailyNotesPlugin && dailyNotesPlugin.instance && dailyNotesPlugin.instance.options) {
        format = dailyNotesPlugin.instance.options.format || format;
    }

    const name = file.basename;
    // eslint-disable-next-line no-undef
    const date = window.moment(name, format, true);
    
    if (date.isValid()) {
        return date.toDate();
    }
    
    return null;
}

// --- DYNAMIC LOCATION RESOLVER ---
export interface ResolvedLocation {
    lat: number;
    lng: number;
    name: string;
}

// Reverse Geocoding (Lat/Long -> Name)
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
        // Use Nominatim (OpenStreetMap) for high-precision reverse geocoding.
        // It handles townships and smaller municipalities much better than BigDataCloud.
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
        const res = await requestUrl({ 
            url,
            headers: { 'User-Agent': 'DaySpark-Obsidian-Plugin/1.0' }
        });
        
        if (res.status === 200) {
            const data = JSON.parse(res.text) as NominatimResult;
            const addr = data.address;
            
            if (addr) {
                // Find the most specific locality available
                const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || addr.suburb || "";
                // Fallback to county/state if city is empty
                const region = addr.state || addr.country || "";
                
                if (city) {
                    return `${city}${region ? ', ' + region : ''}`;
                }
            }
        }
    } catch (e) {
        // eslint-disable-next-line no-undef
        console.error("DaySpark: Reverse geocoding failed", e);
    }
    return null;
}

export async function resolveLocation(settings: DaySparkSettings, content?: string): Promise<ResolvedLocation> {
    // 1. Check for Manual Override in "## My Location"
    if (content) {
        // Matches "## My Location" followed by optional newlines
        // Then looks for optional bullet point ([-*]) and space
        // Captures the rest of the line
        const match = content.match(/## My Location\s*\n[\s\-*]*([^\n]+)/i);
        
        if (match && match[1]) {
            let query = match[1].trim();
            // Remove any markdown links if user put [[Las Vegas]]
            query = query.replace(/[[\]]/g, '');
            
            // eslint-disable-next-line no-undef
            console.debug(`DaySpark: Found custom location "${query}", geocoding...`);
            
            // STRATEGY A: Open-Meteo Search (Forward Geocoding)
            try {
                const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
                const res = await requestUrl({ url });
                
                if (res.status === 200) {
                    const data = JSON.parse(res.text) as { results?: OpenMeteoResult[] };
                    
                    if (data && data.results && data.results.length > 0) {
                        const loc = data.results[0];
                        const region = loc.admin1 || loc.country || "";
                        return {
                            lat: loc.latitude,
                            lng: loc.longitude,
                            name: `${loc.name}${region ? ', ' + region : ''}`
                        };
                    }
                }
            } catch (e) {
                // eslint-disable-next-line no-undef
                console.warn("DaySpark: Open-Meteo Geocoding failed, trying fallback...", e);
            }

            // STRATEGY B: Nominatim (OpenStreetMap) Fallback
            try {
                const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
                const res = await requestUrl({ 
                    url,
                    headers: { 'User-Agent': 'DaySpark-Obsidian-Plugin/1.0' }
                });
                
                if (res.status === 200) {
                    const data = JSON.parse(res.text) as NominatimResult[];
                    
                    if (data && data.length > 0) {
                        const loc = data[0];
                        return {
                            lat: parseFloat(loc.lat),
                            lng: parseFloat(loc.lon),
                            name: loc.display_name.split(',')[0]
                        };
                    }
                }
            } catch (e) {
                // eslint-disable-next-line no-undef
                console.error("DaySpark: All geocoding strategies failed", e);
            }
        }
    }

    // 2. Fallback to Settings
    // Default to raw coordinates initially
    let fallbackName = `${settings.latitude.toFixed(4)}, ${settings.longitude.toFixed(4)}`;
    
    // FIX: Attempt to Reverse Geocode the default coordinates so we get a name like "Waterford, MI"
    try {
        const friendlyName = await reverseGeocode(settings.latitude, settings.longitude);
        if (friendlyName) {
            fallbackName = friendlyName;
        }
    } catch (e) {
        // eslint-disable-next-line no-undef
        console.error("DaySpark: Default location reverse geocode failed", e);
    }

    return {
        lat: settings.latitude,
        lng: settings.longitude,
        name: fallbackName
    };
}