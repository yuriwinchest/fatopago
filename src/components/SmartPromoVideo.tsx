import { useLayoutEffect, useRef } from 'react';

type SmartPromoVideoProps = {
    src: string;
    className?: string;
};

export const SmartPromoVideo = ({ src, className }: SmartPromoVideoProps) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    useLayoutEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        let cancelled = false;
        let userMuted = false;
        let userPaused = false;
        let ignoreManualEventsUntil = 0;
        const timeouts: number[] = [];
        let frameId = 0;
        let retryIntervalId = 0;
        let retryCount = 0;
        const MAX_RETRIES = 18;

        const markProgrammaticChange = (delayMs = 220) => {
            ignoreManualEventsUntil = Date.now() + delayMs;
        };

        const isProgrammaticChange = () => Date.now() <= ignoreManualEventsUntil;

        const applyPlaybackHints = () => {
            video.autoplay = true;
            video.playsInline = true;
            video.setAttribute('autoplay', 'autoplay');
            video.setAttribute('playsinline', 'true');
            video.setAttribute('webkit-playsinline', 'true');
        };

        const syncAudioState = (muted: boolean) => {
            markProgrammaticChange();
            video.muted = muted;
            video.defaultMuted = muted;
            video.volume = muted ? 0 : 1;

            if (muted) {
                video.setAttribute('muted', 'muted');
                return;
            }

            video.removeAttribute('muted');
        };

        const tryDirectAutoplay = async () => {
            applyPlaybackHints();
            syncAudioState(userMuted);
            markProgrammaticChange();
            await video.play();
        };

        const tryMutedBootstrap = async () => {
            applyPlaybackHints();
            syncAudioState(true);
            await video.play();
            await new Promise<void>((resolve) => window.setTimeout(() => resolve(), 80));
            syncAudioState(false);
            await video.play();
        };

        const tryPlayWithSound = async () => {
            if (cancelled || userPaused) return;

            if (userMuted) {
                try {
                    await tryDirectAutoplay();
                } catch {
                    // Respeita o mute manual e só tenta manter o vídeo rodando sem som.
                }
                return;
            }

            try {
                await tryDirectAutoplay();
            } catch {
                try {
                    await tryMutedBootstrap();
                } catch {
                    // Best effort: insistimos em autoplay com som, mas sem alterar o layout.
                }
            }
        };

        const scheduleRetry = (delayMs: number) => {
            const id = window.setTimeout(() => {
                void tryPlayWithSound();
            }, delayMs);
            timeouts.push(id);
        };

        const handleCanPlay = () => {
            void tryPlayWithSound();
        };

        const handleLoadedData = () => {
            void tryPlayWithSound();
        };

        const handleLoadedMetadata = () => {
            syncAudioState(userMuted);
            void tryPlayWithSound();
        };

        const handleCanPlayThrough = () => {
            void tryPlayWithSound();
        };

        const handleVolumeChange = () => {
            if (isProgrammaticChange()) return;
            userMuted = video.muted || video.volume === 0;
        };

        const handlePause = () => {
            if (isProgrammaticChange()) return;
            userPaused = true;
            handlePlaying();
        };

        const handlePlay = () => {
            if (isProgrammaticChange()) return;
            userPaused = false;
        };

        const handlePlaying = () => {
            if (retryIntervalId) {
                window.clearInterval(retryIntervalId);
                retryIntervalId = 0;
            }
        };

        const handlePageShow = () => {
            void tryPlayWithSound();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void tryPlayWithSound();
            }
        };

        const handleFocus = () => {
            void tryPlayWithSound();
        };

        applyPlaybackHints();
        syncAudioState(false);
        video.load();
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('canplaythrough', handleCanPlayThrough);
        video.addEventListener('loadeddata', handleLoadedData);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('volumechange', handleVolumeChange);
        video.addEventListener('pause', handlePause);
        video.addEventListener('play', handlePlay);
        video.addEventListener('playing', handlePlaying);
        window.addEventListener('pageshow', handlePageShow);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('orientationchange', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        void tryPlayWithSound();
        frameId = window.requestAnimationFrame(() => {
            void tryPlayWithSound();
        });
        scheduleRetry(250);
        scheduleRetry(1200);
        scheduleRetry(2600);
        retryIntervalId = window.setInterval(() => {
            if (video.paused && retryCount < MAX_RETRIES) {
                retryCount += 1;
                void tryPlayWithSound();
                return;
            }

            handlePlaying();
        }, 450);

        return () => {
            cancelled = true;
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('canplaythrough', handleCanPlayThrough);
            video.removeEventListener('loadeddata', handleLoadedData);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('volumechange', handleVolumeChange);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('playing', handlePlaying);
            window.removeEventListener('pageshow', handlePageShow);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('orientationchange', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.cancelAnimationFrame(frameId);
            if (retryIntervalId) window.clearInterval(retryIntervalId);
            timeouts.forEach((id) => window.clearTimeout(id));
        };
    }, [src]);

    return (
        <video
            ref={videoRef}
            src={src}
            autoPlay
            loop
            controls
            muted={false}
            playsInline
            preload="auto"
            className={className}
        />
    );
};
