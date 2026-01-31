import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface CycleInfo {
    cycleStartAt: string;
    cycleEndAt: string;
    timeRemaining: number;
    currentCycleNumber: number;
}

export function useCycleTimer() {
    const [cycleInfo, setCycleInfo] = useState<CycleInfo | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCycleInfo();
        const interval = setInterval(fetchCycleInfo, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!cycleInfo) return;

        const countdownInterval = setInterval(() => {
            const now = new Date().getTime();
            const end = new Date(cycleInfo.cycleEndAt).getTime();
            const remaining = Math.max(0, end - now);

            if (remaining <= 0) {
                 // 1. Update state to 0 to show "Waiting..." message
                 setCycleInfo(prev => prev ? { ...prev, timeRemaining: 0 } : null);
                 
                 // 2. Clear this specific countdown interval since we are done counting down
                 clearInterval(countdownInterval);

                 // 3. Optional: Trigger a single immediate refresh to see if new cycle exists
                 // But we rely mainly on the 60s poller to avoid loop. 
                 // We can do a "once" check if we want, but safely.
                 // For now, let's just let the 60s poller handle it to be safe against loops.
            } else {
                setCycleInfo(prev => prev ? { ...prev, timeRemaining: remaining } : null);
            }
        }, 1000);

        return () => clearInterval(countdownInterval);
    }, [cycleInfo?.cycleEndAt]);

    const fetchCycleInfo = async () => {
        try {
            const { data, error } = await supabase
                .from('news_tasks')
                .select('cycle_start_at, cycle_number, created_at')
                .order('cycle_start_at', { ascending: false })
                .limit(1)
                .single();

            if (error) throw error;

            if (data) {
                const startAt = new Date(data.cycle_start_at || data.created_at);
                const endAt = new Date(startAt.getTime() + 24 * 60 * 60 * 1000);
                const now = new Date();
                const remaining = Math.max(0, endAt.getTime() - now.getTime());

                setCycleInfo({
                    cycleStartAt: startAt.toISOString(),
                    cycleEndAt: endAt.toISOString(),
                    timeRemaining: remaining,
                    currentCycleNumber: data.cycle_number || 1
                });
            }
        } catch (error) {
            console.error('Error fetching cycle info:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (milliseconds: number) => {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return {
            hours: String(hours).padStart(2, '0'),
            minutes: String(minutes).padStart(2, '0'),
            seconds: String(seconds).padStart(2, '0'),
            formatted: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        };
    };

    return {
        cycleInfo,
        loading,
        formatTime,
        timeRemaining: cycleInfo?.timeRemaining || 0,
        refetch: fetchCycleInfo
    };
}
