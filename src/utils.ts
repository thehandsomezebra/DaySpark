import { TFile, App, requestUrl } from 'obsidian';
import { DaySparkSettings } from './interfaces';

declare global {
    interface Window {
        app: App;
    }
}

export function insertOrUpdateSection(content: string, header: string, newItems: string[]): string {
    const lines = content.split('\n');
    const headerIndex = lines.findIndex(line => line.trim() === header.trim());

    if (headerIndex === -1) {
        const sectionToAdd = `\n${header}\n` + newItems.map(item => `- ${item}`).join('\n');
        return content + sectionToAdd;
    }

    let sectionEndIndex = lines.findIndex((line, index) => index > headerIndex && line.startsWith('#'));
    if (sectionEndIndex === -1) sectionEndIndex = lines.length;

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

export function getDateFromFile(file: TFile, app: App): Date | null {
    // @ts-ignore
    const dailyNotesPlugin = app.internalPlugins?.getPluginById('daily-notes');
    let format = "YYYY-MM-DD"; 
    
    if (dailyNotesPlugin && dailyNotesPlugin.instance && dailyNotesPlugin.instance.options) {
        format = dailyNotesPlugin.instance.options.format || format;
    }

    const name = file.basename;
    // @ts-ignore
    const date = window.moment(name, format, true);
    
    if (date.isValid()) {
        return date.toDate();
    }
    
    return null;
}

// NEW: Dynamic Location Resolver
export interface ResolvedLocation {
    lat: number;
    lng: number;
    name: string;
}

export async function resolveLocation(settings: DaySparkSettings, content?: string): Promise<ResolvedLocation> {
    // 1. Check for Manual Override in "## My Location"
    if (content) {
        // Look for: ## My Location (newline) - City, State
        const match = content.match(/## My Location\s*\n\s*-\s*(.+)/i);
        if (match && match[1]) {
            const query = match[1].trim();
            console.log(`DaySpark: Found custom location "${query}", geocoding...`);
            
            try {
                // Free Geocoding API from Open-Meteo
                const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
                const res = await requestUrl({ url });
                
                if (res.json && res.json.results && res.json.results.length > 0) {
                    const loc = res.json.results[0];
                    // Construct a nice name (e.g. "Detroit, MI" or "Paris, France")
                    const region = loc.admin1 || loc.country;
                    const displayName = `${loc.name}, ${region}`;
                    
                    return {
                        lat: loc.latitude,
                        lng: loc.longitude,
                        name: displayName
                    };
                }
            } catch (e) {
                console.error("DaySpark: Geocoding failed", e);
            }
        }
    }

    // 2. Fallback to Settings
    return {
        lat: settings.latitude,
        lng: settings.longitude,
        name: settings.defaultLocationName || "Local Coordinates"
    };
}