/**
 * OpenWeatherMap API Client
 * 
 * Provides additional weather and marine data
 */

export interface OpenWeatherMarineData {
    weather: {
        temperature: number;
        feelsLike: number;
        humidity: number;
        pressure: number;
        visibility: number;
        windSpeed: number;
        windDirection: number;
        windGust?: number;
        clouds: number;
        description: string;
    };
    marine?: {
        waveHeight: number;
        wavePeriod: number;
        waveDirection: number;
        swellHeight: number;
        swellPeriod: number;
        swellDirection: number;
    };
    forecast: Array<{
        time: string;
        temperature: number;
        windSpeed: number;
        waveHeight?: number;
        precipitation: number;
    }>;
    timestamp: string;
}

class OpenWeatherClient {
    private apiKey: string;
    private baseUrl = 'https://api.openweathermap.org/data/2.5';

    constructor() {
        this.apiKey = process.env.OPENWEATHER_API_KEY || '';
    }

    /**
     * Get current weather and marine data
     */
    async getCurrentWeather(lat: number, lng: number): Promise<OpenWeatherMarineData> {
        try {
            const [current, forecast] = await Promise.all([
                this.fetchCurrent(lat, lng),
                this.fetchForecast(lat, lng)
            ]);

            return {
                weather: current.weather,
                marine: current.marine,
                forecast: forecast,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('OpenWeather API error:', error);
            throw error;
        }
    }

    /**
     * Fetch current weather
     */
    private async fetchCurrent(lat: number, lng: number) {
        const response = await fetch(
            `${this.baseUrl}/weather?lat=${lat}&lon=${lng}&appid=${this.apiKey}&units=metric`,
            {
                next: { revalidate: 1800 } // Cache for 30 minutes
            }
        );

        if (!response.ok) {
            throw new Error(`OpenWeather API error: ${response.status}`);
        }

        const data = await response.json();

        return {
            weather: {
                temperature: data.main.temp,
                feelsLike: data.main.feels_like,
                humidity: data.main.humidity,
                pressure: data.main.pressure,
                visibility: data.visibility / 1000, // Convert to km
                windSpeed: data.wind.speed * 3.6, // Convert m/s to km/h
                windDirection: data.wind.deg,
                windGust: data.wind.gust ? data.wind.gust * 3.6 : undefined,
                clouds: data.clouds.all,
                description: data.weather[0].description
            },
            marine: undefined // Marine data requires separate API call
        };
    }

    /**
     * Fetch forecast data
     */
    private async fetchForecast(lat: number, lng: number) {
        const response = await fetch(
            `${this.baseUrl}/forecast?lat=${lat}&lon=${lng}&appid=${this.apiKey}&units=metric&cnt=8`,
            {
                next: { revalidate: 3600 } // Cache for 1 hour
            }
        );

        if (!response.ok) {
            throw new Error(`OpenWeather Forecast API error: ${response.status}`);
        }

        const data = await response.json();

        return data.list.map((item: any) => ({
            time: item.dt_txt,
            temperature: item.main.temp,
            windSpeed: item.wind.speed * 3.6,
            precipitation: item.rain ? item.rain['3h'] || 0 : 0
        }));
    }

    /**
     * Get marine/ocean data (requires Marine Weather API subscription)
     */
    async getMarineData(lat: number, lng: number) {
        // Note: This requires OpenWeatherMap Marine Weather API subscription
        // Keeping as placeholder for when subscription is available
        try {
            const response = await fetch(
                `https://api.openweathermap.org/data/2.5/marine?lat=${lat}&lon=${lng}&appid=${this.apiKey}`,
                {
                    next: { revalidate: 3600 }
                }
            );

            if (!response.ok) {
                return null; // Marine API not available
            }

            const data = await response.json();

            return {
                waveHeight: data.wave_height || 0,
                wavePeriod: data.wave_period || 0,
                waveDirection: data.wave_direction || 0,
                swellHeight: data.swell_height || 0,
                swellPeriod: data.swell_period || 0,
                swellDirection: data.swell_direction || 0
            };
        } catch (error) {
            console.warn('OpenWeather Marine data not available:', error);
            return null;
        }
    }
}

// Singleton instance
export const openWeatherClient = new OpenWeatherClient();
