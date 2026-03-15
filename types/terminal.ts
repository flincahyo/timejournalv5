
export type WidgetType =
    | "chart"
    | "market_hours"
    | "news_economic"
    | "news_timeline"
    | "live_trades"
    | "account_summary"
    | "trading_ritual"
    | "price_alerts"
    | "custom_html";

export interface TerminalWidget {
    id: string;
    type: WidgetType;
    title?: string;
    content?: string; // For custom_html content
    layout: {
        x: number;
        y: number;
        w: number;
        h: number;
        minW?: number;
        minH?: number;
    };
    isVisible: boolean;
}

export interface TerminalLayout {
    widgets: TerminalWidget[];
    isEditMode: boolean;
}
