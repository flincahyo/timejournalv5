
"use client";
import React, { useEffect, useRef } from "react";

interface CustomHtmlWidgetProps {
    content: string;
}

export default function CustomHtmlWidget({ content }: CustomHtmlWidgetProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        if (!iframeRef.current) return;
        const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
        if (!doc) return;

        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body { margin: 0; padding: 0; overflow: hidden; background: transparent; color: white; font-family: sans-serif; }
                        * { box-sizing: border-box; }
                    </style>
                </head>
                <body>
                    ${content}
                </body>
            </html>
        `);
        doc.close();
    }, [content]);

    return (
        <iframe
            ref={iframeRef}
            className="w-full h-full border-0 bg-transparent"
            title="Custom Widget"
            sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
        />
    );
}
