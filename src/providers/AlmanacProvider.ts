import { SparkProvider, ProviderResult, DaySparkSettings } from '../interfaces';

export class AlmanacProvider implements SparkProvider {
    id = 'almanac-lore';
    displayName = 'Almanac Lore';
    targetHeader = '## Almanac';
    settings: DaySparkSettings;

    constructor(settings: DaySparkSettings) {
        this.settings = settings;
        // Use user preference if set
        if (this.settings.almanacHeader) this.targetHeader = this.settings.almanacHeader;
    }

    async getDataForDate(targetDate: Date): Promise<ProviderResult> {
        // 1. Check Toggle
        if (!this.settings.enableAlmanac) {
            return { items: [] };
        }

        // Randomly select a weather rhyme or lore for the specific month
        const lore = this.getDailyLore(targetDate);
        
        return {
            items: [`📜 **Lore:** _"${lore}"_`]
        };
    }

    private getDailyLore(date: Date): string {
        const month = date.getMonth(); // 0 = January, 11 = December
        
        const loreDatabase: { [key: number]: string[] } = {
            0: [ // January
                "In January if the Sun appear, March and April pay full dear.",
                "A summerish January, a winterish spring.",
                "A warm January, a cold May."
            ],
            1: [ // February
                "There is always one fine week in February.",
                "Fogs in February mean frosts in May.",
                "When it rains in February, all the year suffers."
            ],
            2: [ // March
                "When March has April weather, April will have March weather.",
                "March damp and warm; Will do farmer much harm.",
                "In March much snow; To plants and trees much woe."
            ],
            3: [ // April
                "If it thunders on All Fools’ Day; It brings good crops of corn and hay.",
                "April weather; Rain and sunshine, both together.",
                "After a wet April, a dry June."
            ],
            4: [ // May
                "In the middle of May comes the tail of winter.",
                "The more thunder in May, the less in August and September.",
                "A leaking May and a warm June; Bring on the harvest very soon."
            ],
            5: [ // June
                "A cold a wet June spoils the rest of the year.",
                "When it is hottest in June, it will be the coldest in the corresponding days of the next February.",
                "A good leak in June; Sets all in tune."
            ],
            6: [ // July
                "As July, so the next January.",
                "Whatever July and August do not boil, September cannot fry.",
                "If it rains on July 10th, it will rain for seven weeks."
            ],
            7: [ // August
                "When the dew is heavy in August, the weather generally remains fair.",
                "If the first week in August is unusually warm, the winter will be white and long.",
                "A fog in August indicates a severe winter and plenty of snow."
            ],
            8: [ // September
                "Heavy September rains bring drought.",
                "If the storms in September clear off warm, all the storms of the following winter will be warm.",
                "Fair on September 1st, fair for the month."
            ],
            9: [ // October
                "There are always ninteen fine days in October.",
                "Much rain in October, much wind in December.",
                "Full Moon in October without frost, no frost till full Moon in November."
            ],
            10: [ // November
                "As November, so the following March.",
                "When in November the water rises, it will show itself the whole winter.",
                "A heavy November snow will last till April."
            ],
            11: [ // December
                "Thunder in December presages fine weather.",
                "So far as the Sun shines on Christmas Day; So far will the snow blow in May."
            ]
        };

        const monthLore = loreDatabase[month] || [];
        
        // Fallback just in case
        if (monthLore.length === 0) {
            return "Red sky at night, sailors delight."; 
        }

        // Pick a random one from the month's list
        return monthLore[Math.floor(Math.random() * monthLore.length)];
    }
}