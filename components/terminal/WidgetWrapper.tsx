
"use client";
import React, { forwardRef } from "react";
import { useTerminalStore } from "@/store/terminalStore";
import { X, GripVertical } from "lucide-react";

interface WidgetWrapperProps {
    id?: string;
    title?: string;
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    onMouseDown?: React.MouseEventHandler;
    onMouseUp?: React.MouseEventHandler;
    onTouchEnd?: React.TouchEventHandler;
}

const WidgetWrapper = forwardRef<HTMLDivElement, WidgetWrapperProps>(({
    id,
    title,
    children,
    className = "",
    style,
    onMouseDown,
    onMouseUp,
    onTouchEnd,
    ...props
}, ref) => {
    const { isEditMode, removeWidget } = useTerminalStore();

    // Separate the actual widget content from RGL injected children (handles)
    const childrenArray = React.Children.toArray(children);
    const widgetContent = childrenArray[0];
    const gridHandles = childrenArray.slice(1);

    return (
        <div
            ref={ref}
            style={style}
            className={`flex flex-col bg-transparent group overflow-hidden ${className} ${isEditMode ? "ring-1 ring-blue/20 bg-surface/40 border border-border rounded-2xl" : "rounded-2xl"}`}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onTouchEnd={onTouchEnd}
            {...props}
        >
            {/* Header - Subtle and only visible on hover or edit mode */}
            <div className={`px-2 py-1.5 border-b border-transparent flex justify-between items-center shrink-0 cursor-default z-20 transition-all ${isEditMode ? "bg-surface/80 border-border" : "opacity-0 group-hover:opacity-100"}`}>
                <div className="flex items-center gap-2 min-w-0">
                    {isEditMode && (
                        <div className="cursor-grab active:cursor-grabbing text-text3 hover:text-text transition-colors shrink-0">
                            <GripVertical size={13} />
                        </div>
                    )}
                    <span className="font-semibold text-[10px] text-text3 uppercase tracking-wider truncate opacity-70 group-hover:opacity-100 transition-opacity">
                        {title}
                    </span>
                </div>

                {isEditMode && id && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            removeWidget(id);
                        }}
                        className="p-1 rounded-full hover:bg-red/10 text-text3 hover:text-red transition-all"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>

            {/* Widget Content Area */}
            <div className="flex-1 relative min-h-0 w-full overflow-hidden z-10">
                <div className="h-full w-full overflow-hidden">
                    {widgetContent}
                </div>

                {/* Overlay in edit mode */}
                {isEditMode && (
                    <div className="absolute inset-0 bg-blue/5 pointer-events-none border-2 border-transparent group-hover:border-blue/20 transition-all z-30 rounded-2xl" />
                )}
            </div>

            {/* Render Grid Handles (Injected by RGL) outside the clipped content area */}
            {gridHandles}
        </div>
    );
});

WidgetWrapper.displayName = "WidgetWrapper";
export default WidgetWrapper;
