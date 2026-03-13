"use client";
import { useState, useEffect } from 'react';

const DEFAULT_STEPS = [
    "Confirm Daily Bias (HTF)",
    "Check News Calendar",
    "Identify Key S/R Zones",
    "Wait for Session Open",
    "Verify Risk/Reward > 1:2",
    "Set SL before Entry"
];

export default function SetupChecklist() {
    const [steps, setSteps] = useState<{ text: string, completed: boolean }[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('terminal_checklist');
        if (saved) {
            setSteps(JSON.parse(saved));
        } else {
            setSteps(DEFAULT_STEPS.map(s => ({ text: s, completed: false })));
        }
    }, []);

    const toggleStep = (idx: number) => {
        const newSteps = [...steps];
        newSteps[idx].completed = !newSteps[idx].completed;
        setSteps(newSteps);
        localStorage.setItem('terminal_checklist', JSON.stringify(newSteps));
    };

    const reset = () => {
        const newSteps = steps.map(s => ({ ...s, completed: false }));
        setSteps(newSteps);
        localStorage.setItem('terminal_checklist', JSON.stringify(newSteps));
    };

    return (
        <div className="flex flex-col bg-surface border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 border-b border-border bg-surface2 flex justify-between items-center shrink-0">
                <div className="font-bold text-[12px] text-text uppercase tracking-wider">Setup Checklist</div>
                <button onClick={reset} className="text-[9px] font-black text-text3 hover:text-red transition-colors border border-border px-1.5 py-0.5 rounded-md hover:bg-surface2">RESET</button>
            </div>
            <div className="p-3 flex flex-col gap-0.5">
                {steps.map((step, i) => (
                    <label key={i} className="flex items-center gap-2.5 p-1.5 cursor-pointer group">
                        <div className="relative flex items-center justify-center">
                            <input
                                type="checkbox"
                                checked={step.completed}
                                onChange={() => toggleStep(i)}
                                className="peer w-4 h-4 appearance-none rounded border-2 border-border checked:bg-text checked:border-text transition-all cursor-pointer"
                            />
                            <svg className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <span className={`text-[12.5px] font-semibold tracking-tight transition-all ${step.completed ? 'text-text3 line-through opacity-50' : 'text-text group-hover:translate-x-0.5'}`}>
                            {step.text}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    );
}
