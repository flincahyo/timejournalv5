"use client";
import { useEffect, useRef } from "react";
import { useNewsStore } from "@/store";

interface FFEvent {
    title: string;
    country: string;
    date: string;
    impact: string;
    forecast: string;
    previous: string;
}

export function NewsWatcher() {
    const { settings, notifiedIds, markNotified, clearOldNotified } = useNewsStore();
    const eventsRef = useRef<FFEvent[]>([]);

    // Fetch events periodically (every hour)
    useEffect(() => {
        if (!settings.enabled) return;

        const fetchNews = async () => {
            try {
                const res = await fetch("/api/news");
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        eventsRef.current = data;
                    }
                }
            } catch (err) {
                console.error("NewsWatcher fetch err:", err);
            }
        };

        fetchNews();
        const interval = setInterval(fetchNews, 60 * 60 * 1000); // every 1 hour
        return () => clearInterval(interval);
    }, [settings.enabled]);

    // Check events against time continuously (every 1 minute)
    useEffect(() => {
        if (!settings.enabled) return;

        const checkEvents = () => {
            const now = new Date();
            const thresholdTime = new Date(now.getTime() + settings.minutesBefore * 60000);

            eventsRef.current.forEach(ev => {
                // Only check matched impact & currency
                if (!settings.impacts.includes(ev.impact) || !settings.currencies.includes(ev.country)) return;

                const evDate = new Date(ev.date);

                // If event is exactly within the notification timeframe (e.g. 5 mins away) and not in the past
                if (evDate > now && evDate <= thresholdTime) {
                    const evId = `${ev.title}-${ev.date}`;
                    if (!notifiedIds.includes(evId)) {
                        // Trigger browser notification
                        if (Notification.permission === "granted") {
                            new Notification(`Berita Ekonomi: ${ev.country} - ${ev.impact}`, {
                                body: `${ev.title} rilis dalam ${settings.minutesBefore} menit.\nForecast: ${ev.forecast || '-'} | Prev: ${ev.previous || '-'}`,
                                icon: "/favicon.ico" // optional if exists
                            });
                            markNotified(evId);
                        }
                    }
                }
            });

            // Maintenance: occasionally clear old notified IDs to prevent localStorage bloat
            if (Math.random() < 0.01) { // 1% chance every minute = approx once every 100 minutes
                // We actually just keep the limit built into the store's slice(-200) so it's fine
            }
        };

        checkEvents();
        const interval = setInterval(checkEvents, 60 * 1000); // check every minute
        return () => clearInterval(interval);
    }, [settings, notifiedIds, markNotified]);

    return null; // pure headless component
}
