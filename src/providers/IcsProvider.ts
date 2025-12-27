import { SparkProvider, ProviderResult, CalendarGroup } from '../interfaces';
import { requestUrl, Notice, App, TFile } from 'obsidian';
import * as ICAL from 'ical.js';

interface IcalTime {
    toJSDate(): Date;
    isDate: boolean;
}

interface IcalEvent {
    startDate: IcalTime;
    endDate: IcalTime;
    summary: string;
    description?: string;
}

interface IcalComponent {
    getAllSubcomponents(name: string): unknown[];
}

interface IcalLibrary {
    parse(data: string): unknown;
    Component: new (data: unknown) => IcalComponent;
    Event: new (data: unknown) => IcalEvent;
}

export class IcsProvider implements SparkProvider {
    id: string;
    displayName: string;
    targetHeader: string;
    app: App;
    group: CalendarGroup;

    constructor(app: App, group: CalendarGroup) {
        this.app = app;
        this.group = group;
        this.id = `ics-${group.id}`;
        this.displayName = group.name || 'Calendar Group';
        this.targetHeader = group.header;
    }

    async getDataForDate(targetDate: Date): Promise<ProviderResult> {
        if (!this.group.enabled) return { items: [] };
        
        const results: string[] = [];
        
        const targetDayStart = new Date(targetDate);
        targetDayStart.setHours(0,0,0,0);
        const targetDayEnd = new Date(targetDayStart);
        targetDayEnd.setHours(23,59,59,999);

        for (const rawUrl of this.group.urls) {
            let url = rawUrl.trim();
            if (!url) continue;

            let icsData = '';

            if (url.includes('calendar.google.com') && url.includes('/embed')) {
                 const srcMatch = url.match(/src=([^&]+)/);
                 if (srcMatch && srcMatch[1]) {
                     url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(decodeURIComponent(srcMatch[1]))}/public/basic.ics`;
                 }
            } else if (!url.startsWith('http') && (url.includes('@') || (url.includes('google') && !url.endsWith('.ics')))) {
                 url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(url)}/public/basic.ics`;
            }

            try {
                if (url.startsWith('http')) {
                    // eslint-disable-next-line no-undef
                    console.debug(`DaySpark [${this.group.name}]: Fetching Web ICS from: ${url}`);
                    const response = await requestUrl({ url: url });
                    icsData = response.text;
                } else {
                    // eslint-disable-next-line no-undef
                    console.debug(`DaySpark [${this.group.name}]: Looking for local file: ${url}`);
                    const file = this.app.vault.getAbstractFileByPath(url);
                    
                    if (file instanceof TFile) {
                        icsData = await this.app.vault.read(file);
                    } else {
                        const fileWithExt = this.app.vault.getAbstractFileByPath(url + ".ics");
                        if (fileWithExt instanceof TFile) {
                             icsData = await this.app.vault.read(fileWithExt);
                        } else {
                            // eslint-disable-next-line no-undef
                            console.warn(`DaySpark: Local file not found: ${url}`);
                            continue;
                        }
                    }
                }

                const ical = ICAL as unknown as IcalLibrary;
                const jcalData = ical.parse(icsData);
                const comp = new ical.Component(jcalData);
                const vevents = comp.getAllSubcomponents('vevent');

                for (const vevent of vevents) {
                    const event = new ical.Event(vevent);
                    const startDate = event.startDate.toJSDate();
                    const endDate = event.endDate.toJSDate();

                    const isSameDay = startDate.getDate() === targetDayStart.getDate() &&
                                      startDate.getMonth() === targetDayStart.getMonth() &&
                                      startDate.getFullYear() === targetDayStart.getFullYear();

                    const startsBefore = startDate < targetDayEnd;
                    const endsAfter = endDate > targetDayStart;
                    const isMultiDay = startsBefore && endsAfter;

                    if (isSameDay || isMultiDay) {
                         let displayText = `[ ] ${event.summary}`;

                         const durationMs = endDate.getTime() - startDate.getTime();
                         const durationDays = Math.ceil(durationMs / (1000 * 60 * 60 * 24));

                         if (durationDays > 1) {
                             const diffTime = targetDayStart.getTime() - startDate.getTime();
                             const currentDayNum = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                             if(currentDayNum > 0 && currentDayNum <= durationDays) {
                                 displayText += ` (Day ${currentDayNum}/${durationDays})`;
                             }
                         } else {
                             if (!event.startDate.isDate) {
                                 const timeStr = event.startDate.toJSDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                                 displayText = `[ ] ${timeStr} ${event.summary}`;
                             }
                         }

                         // --- Added Description Logic ---
                         // UPDATED: Check if the group allows descriptions
                         if (this.group.showDescription && event.description) {
                             const cleanDesc = event.description.trim();
                             if (cleanDesc.length > 0) {
                                 displayText += `\n\t${cleanDesc.replace(/\n/g, '\n\t')}`;
                             }
                         }
                         results.push(displayText);
                    }
                }

            } catch (err) {
                // eslint-disable-next-line no-undef
                console.error(`DaySpark: Error processing ${url}`, err);
                if (url.includes('google')) {
                     // eslint-disable-next-line obsidianmd/ui/sentence-case
                     new Notice(`DaySpark: Google error. If private, please use a local .ics file or the secret address.`);
                }
            }
        }

        return { items: results };
    }
}