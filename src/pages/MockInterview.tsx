import React, { useState, useEffect, useRef, useCallback } from 'react';

declare global {
    interface Window {
        webkitSpeechRecognition: any;
        SpeechRecognition: any;
    }
}

const API_KEY = "AIzaSyBiFK1ZKiiWJpjvC7ZiO4nm1AiOvFwSCZg"
const TEXT_GENERATION_MODEL = "gemini-2.5-flash-preview-05-20";
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

const interviewQuestions = [
    "Tell me about yourself.",
    "Why are you interested in this internship?",
    "What are your strengths and weaknesses?",
    "Describe a challenging situation you faced and how you overcame it.",
    "Where do you see yourself in five years?",
    "Do you have any questions for me?"
];

// Utility function to convert base64 to ArrayBuffer
const base64ToArrayBuffer = (base64) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

// Utility function to convert PCM data to WAV Blob
const pcmToWav = (pcm16, sampleRate) => {
    const numChannels = 1; // Mono audio
    const bytesPerSample = 2; // 16-bit PCM

    const wavBuffer = new ArrayBuffer(44 + pcm16.length * bytesPerSample);
    const view = new DataView(wavBuffer);

    const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcm16.length * bytesPerSample, true); // ChunkSize
    writeString(view, 8, 'WAVE');

    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, numChannels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * numChannels * bytesPerSample, true); // ByteRate
    view.setUint16(32, numChannels * bytesPerSample, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // DATA sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, pcm16.length * bytesPerSample, true); // Subchunk2Size

    // Write the PCM data
    for (let i = 0; i < pcm16.length; i++) {
        view.setInt16(44 + i * bytesPerSample, pcm16[i], true);
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
};

// Exponential backoff for API calls
const fetchWithBackoff = async (url, options, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            } else if (response.status === 429) { // Too Many Requests
                await new Promise(resolve => setTimeout(resolve, delay * (2 ** i)));
            } else {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, delay * (2 ** i)));
        }
    }
    throw new Error("Max retries reached.");
};

const MockInterview = () => {
    const webcamVideoRef = useRef(null);
    const speechRecognitionRef = useRef<any>(null);
    const latestTranscriptRef = useRef<string>("");
    const streamRef = useRef(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const micGainRef = useRef<GainNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const questionAudioRef = useRef<HTMLAudioElement | null>(null);
    const questionAudioUrlRef = useRef<string | null>(null);
    const isQuestionTTSPlayingRef = useRef<boolean>(false);
    const ttsResolveRef = useRef<(() => void) | null>(null);
    const bargedInRef = useRef<boolean>(false);
    const voiceActiveFramesRef = useRef<number>(0);
    const autoAdvanceTimerRef = useRef<number | null>(null);

    const [isInterviewActive, setIsInterviewActive] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [questionDisplay, setQuestionDisplay] = useState("Click 'Start Interview' to begin.");
    const [userResponse, setUserResponse] = useState("(Your spoken answer will appear here)");
    const [aiFeedback, setAiFeedback] = useState("(Feedback on your answer will appear here)");
    const [bodyLanguageFeedback, setBodyLanguageFeedback] = useState("(Simulated feedback on body language will appear here)");
    const [statusMessage, setStatusMessage] = useState("");
    const [showNoCameraMessage, setShowNoCameraMessage] = useState(false);
    const [hasLiveVideo, setHasLiveVideo] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [micMonitorOn, setMicMonitorOn] = useState(false);
    const [micGain, setMicGain] = useState(0.6); // playback volume when monitoring
    const [inputLevel, setInputLevel] = useState(0); // 0-100 VU level
    const [autoStopOnSilence, setAutoStopOnSilence] = useState(true);
    const autoStopRef = useRef<boolean>(true);
    const answerLockedRef = useRef<boolean>(false); // lock answer after stop to avoid accidental overwrite

    // Siri-like auto stop on silence config/refs
    const recActiveRef = useRef(false);
    const lastVoiceTsRef = useRef<number>(Date.now());
    const SILENCE_MS = 1200; // 1.2s of silence ends recording
    // Adaptive thresholds (updated via rolling noise floor)
    const noiseFloorRef = useRef<number>(0.015);
    const silenceThresholdRef = useRef<number>(0.02); // dynamic
    const bargeInRmsRef = useRef<number>(0.04); // dynamic
    const BARGE_IN_CONSEC_FRAMES = 3; // consecutive frames above threshold

    const stopQuestionTTS = useCallback(() => {
        try {
            if (questionAudioRef.current) {
                questionAudioRef.current.pause();
                questionAudioRef.current.src = "";
                questionAudioRef.current = null;
            }
            if (questionAudioUrlRef.current) {
                URL.revokeObjectURL(questionAudioUrlRef.current);
                questionAudioUrlRef.current = null;
            }
        } catch {}
        isQuestionTTSPlayingRef.current = false;
        // If a speakQuestion call is awaiting playback end, resolve it so we don't hang on barge-in
        if (ttsResolveRef.current) {
            const resolve = ttsResolveRef.current;
            ttsResolveRef.current = null;
            try { resolve(); } catch {}
        }
    }, []);

    const scheduleAutoAdvance = useCallback((ms: number) => {
        try {
            if (autoAdvanceTimerRef.current) {
                window.clearTimeout(autoAdvanceTimerRef.current);
                autoAdvanceTimerRef.current = null;
            }
            autoAdvanceTimerRef.current = window.setTimeout(() => {
                setCurrentQuestionIndex(prev => prev + 1);
            }, ms);
        } catch {}
    }, []);

    // Function to speak the question using Gemini TTS
    const speakQuestion = useCallback(async (questionText) => {
        setStatusMessage("Interviewer speaking...");
        // Slight variety in prosody: optional preface and small pre-silence
        const prefaces = ["Okay.", "Alright.", "Got it.", "Thanks."];
        const pre = Math.random() < 0.5 ? (prefaces[Math.floor(Math.random() * prefaces.length)] + " ") : "";
        const voices = ["Rasalgethi", "Pavo", "Kore"];
        const voiceName = voices[Math.floor(Math.random() * voices.length)];
        const payload = {
            contents: [{
                parts: [{ text: `Say clearly and professionally: ${pre}${questionText}` }]
            }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName }
                    }
                }
            },
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${API_KEY}`;

        try {
            const response = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            const part = result?.candidates?.[0]?.content?.parts?.[0];
            const audioData = part?.inlineData?.data;
            const mimeType = part?.inlineData?.mimeType;

            if (audioData && mimeType && mimeType.startsWith("audio/")) {
                const sampleRateMatch = mimeType.match(/rate=(\d+)/);
                const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 16000; // Default to 16kHz if not found
                const pcmData = base64ToArrayBuffer(audioData);
                const pcm16 = new Int16Array(pcmData);
                const wavBlob = pcmToWav(pcm16, sampleRate);
                const audioUrl = URL.createObjectURL(wavBlob);
                // Setup audio element for TTS with barge-in control
                const audio = new Audio(audioUrl);
                questionAudioRef.current = audio;
                questionAudioUrlRef.current = audioUrl;
                bargedInRef.current = false;
                isQuestionTTSPlayingRef.current = true;
                // Small pre-silence (150-300ms)
                await new Promise(r => setTimeout(r, 150 + Math.floor(Math.random() * 150)));
                await new Promise<void>((resolve) => {
                    ttsResolveRef.current = () => {
                        isQuestionTTSPlayingRef.current = false;
                        resolve();
                    };
                    audio.onended = () => {
                        isQuestionTTSPlayingRef.current = false;
                        if (ttsResolveRef.current) ttsResolveRef.current = null;
                        resolve();
                    };
                    // Play TTS
                    audio.play().catch(e => {
                        console.error("Error playing audio:", e);
                        isQuestionTTSPlayingRef.current = false;
                        if (ttsResolveRef.current) ttsResolveRef.current = null;
                        resolve();
                    });
                });
                // Cleanup created URL
                stopQuestionTTS();
            } else {
                console.error("No audio data received or unexpected mime type:", result);
                // Fallback to text display and proceed without audio if TTS fails
                setQuestionDisplay(questionText);
            }
        } catch (error) {
            console.error("Error with TTS API:", error);
            setStatusMessage("Error speaking question. Displaying text instead.");
            setQuestionDisplay(questionText);
        }
    }, []);

    // Function to get AI feedback on user's response
    const getAIResponse = useCallback(async (question, userAnswer) => {
        setIsProcessing(true);
        const chatHistory = [];
        chatHistory.push({
            role: "user",
            parts: [{
                text: `You are an experienced interviewer providing constructive feedback. The question asked was: "${question}". The user's answer was: "${userAnswer}". Please provide feedback focusing on:
                1. Relevance to the question.
                2. Clarity and conciseness.
                3. Confidence and professionalism (based on word choice/structure).
                4. Suggest specific ways to improve the answer.
                Keep the feedback to around 3-5 sentences.`
            }]
        });

        const payload = { contents: chatHistory };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_GENERATION_MODEL}:generateContent?key=${API_KEY}`;

        try {
            const response = await fetchWithBackoff(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                setAiFeedback(text);
            } else {
                setAiFeedback("Could not get AI feedback. Please try again.");
                console.error("Unexpected AI response structure:", result);
            }
        } catch (error) {
            console.error("Error getting AI response:", error);
            setAiFeedback("Error getting AI feedback. Please check your internet connection or try again later.");
        } finally {
            setIsProcessing(false);
        }
    }, []);

    // Simulated body language feedback (placeholder)
    const getSimulatedBodyLanguageFeedback = useCallback(() => {
        const feedbacks = [
            "Maintain eye contact and an open posture.",
            "Try to project more confidence through your stance.",
            "Your gestures seem natural and engaged.",
            "Remember to smile occasionally to convey approachability.",
            "Avoid fidgeting to show focus and composure."
        ];
        return feedbacks[Math.floor(Math.random() * feedbacks.length)];
    }, []);

    // Initialize speech recognition
    const initializeSpeechRecognition = useCallback(() => {
        if (typeof window === 'undefined') return;
        const RecognitionCtor: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (typeof RecognitionCtor !== 'function') {
            setStatusMessage("Speech Recognition not supported in this browser. Please use Chrome or Edge.");
            return;
        }

        const recognition = new RecognitionCtor();
        recognition.continuous = true; // capture longer answers more reliably
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        try { (recognition as any).maxAlternatives = 1; } catch {}

        recognition.onstart = () => {
            setIsRecording(true);
            setStatusMessage("Listening for your answer...");
            latestTranscriptRef.current = "";
            recActiveRef.current = true;
            lastVoiceTsRef.current = Date.now();
            answerLockedRef.current = false;
        };

    recognition.onresult = (event: any) => {
            // If answer is locked (post-stop), ignore stray results
            if (answerLockedRef.current || !recActiveRef.current) return;
            let interimTranscript = '';
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const transcript = event.results[i][0]?.transcript ?? '';
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript + ' ';
                }
            }
            const combined = (finalTranscript || interimTranscript).trim();
            latestTranscriptRef.current = combined;
            setUserResponse(combined || "(listening…)");
            // Update voice activity timestamp on any new tokens
            if ((finalTranscript || interimTranscript).trim().length > 0) {
                lastVoiceTsRef.current = Date.now();
            }
    };

    recognition.onend = async () => {
            setIsRecording(false);
            setStatusMessage("Processing your answer...");
            recActiveRef.current = false;
            answerLockedRef.current = true; // freeze displayed answer for this question
            const finalAnswer = (latestTranscriptRef.current || '').trim();
            if (finalAnswer) {
                await getAIResponse(interviewQuestions[currentQuestionIndex], finalAnswer);
                setBodyLanguageFeedback(getSimulatedBodyLanguageFeedback());
        // Auto-advance to next question after a 2-minute pause
        setTimeout(() => { try { (document.activeElement as HTMLElement)?.blur?.(); } catch {}; }, 100);
        setTimeout(() => { try { (document.documentElement as any).scrollTop = 0; } catch {}; }, 150);
        setTimeout(() => { try { (speechRecognitionRef.current as any)?.abort?.(); } catch {} }, 200);
        setStatusMessage("Take your time to review the feedback. Auto‑advancing in about 2 minutes…");
        scheduleAutoAdvance(120000);
            } else {
                setAiFeedback("No answer detected. Please try again.");
                setBodyLanguageFeedback("");
                setStatusMessage("No speech detected. Click Next to try again or End Interview.");
            }
        };

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error:', event?.error);
            setIsRecording(false);
            const msg = event?.error === 'no-speech'
                ? 'No speech detected. Please speak closer to the mic and try again.'
                : `Speech recognition error: ${event?.error || 'unknown'}.`;
            setStatusMessage(msg);
        };

        speechRecognitionRef.current = recognition;
    }, [currentQuestionIndex, getAIResponse, getSimulatedBodyLanguageFeedback]);

    // End the interview (Moved before askQuestion)
    const endInterview = useCallback(() => {
        if (autoAdvanceTimerRef.current) {
            window.clearTimeout(autoAdvanceTimerRef.current);
            autoAdvanceTimerRef.current = null;
        }
        setIsInterviewActive(false);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        if (speechRecognitionRef.current) {
            speechRecognitionRef.current.stop();
        }
        if (webcamVideoRef.current) {
            webcamVideoRef.current.srcObject = null;
        }
        setQuestionDisplay("Interview finished! Thank you for participating.");
        setUserResponse("");
        setAiFeedback("Review your feedback above. Click 'Start Interview' to practice again!");
        setBodyLanguageFeedback("");
        setStatusMessage("Interview ended.");
        setIsRecording(false);
        setIsProcessing(false);
    }, []); // Empty dependency array means it's stable

    // Ask the current question (Now `endInterview` is defined)
    const askQuestion = useCallback(async () => {
        if (currentQuestionIndex < interviewQuestions.length) {
            setQuestionDisplay("Interviewer is thinking...");
            setUserResponse("");
            setAiFeedback("");
            setBodyLanguageFeedback("");

        const question = interviewQuestions[currentQuestionIndex];
            setQuestionDisplay(question); // Display text immediately as fallback
        await speakQuestion(question);
            if (speechRecognitionRef.current) {
                try {
        latestTranscriptRef.current = "";
            answerLockedRef.current = false; // unlock for new answer
                    speechRecognitionRef.current.start();
                } catch (e) {
                    console.warn("Speech recognition already active, restarting.", e);
                    speechRecognitionRef.current.stop(); // Stop if already active
                    speechRecognitionRef.current.start();
                }
            }
        } else {
            endInterview();
        }
    }, [currentQuestionIndex, speakQuestion, endInterview]); // endInterview is now correctly defined


    // Start the interview process
    const startInterview = useCallback(async () => {
        if (isInterviewActive) return;

        // Reset previous state
        setCurrentQuestionIndex(0);
        setQuestionDisplay("Click 'Start Interview' to begin.");
        setUserResponse("(Your spoken answer will appear here)");
        setAiFeedback("(Feedback on your answer will appear here)");
        setBodyLanguageFeedback("(Simulated feedback on body language will appear here)");
        setStatusMessage("");
        setShowNoCameraMessage(false);

        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                } as MediaTrackConstraints,
            });
            streamRef.current = mediaStream;
            if (webcamVideoRef.current) {
                webcamVideoRef.current.srcObject = mediaStream;
                // Ensure play; hide overlay on success
                try {
                    await webcamVideoRef.current.play();
                    setHasLiveVideo(true);
                    setShowNoCameraMessage(false);
                } catch {}
            }
            // Setup audio graph for metering and optional monitoring
            const ensureAudio = () => {
                if (!audioContextRef.current) {
                    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                }
                const ctx = audioContextRef.current!;
                // Create or reuse nodes
                if (!micSourceRef.current) {
                    micSourceRef.current = ctx.createMediaStreamSource(mediaStream);
                }
                if (!micGainRef.current) {
                    micGainRef.current = ctx.createGain();
                    micGainRef.current.gain.value = micGain;
                }
                if (!analyserRef.current) {
                    analyserRef.current = ctx.createAnalyser();
                    analyserRef.current.fftSize = 2048;
                }
                // Connections: source -> analyser (for level meter)
                // and source -> gain -> (destination if monitoring)
                try {
                    micSourceRef.current.connect(analyserRef.current);
                } catch {}
                try {
                    micSourceRef.current.connect(micGainRef.current!);
                } catch {}
                if (micMonitorOn) {
                    try { micGainRef.current!.connect(ctx.destination); } catch {}
                }

                // Start meter loop
                const data = new Uint8Array(analyserRef.current.frequencyBinCount);
                const tick = () => {
                    if (!analyserRef.current) return;
                    analyserRef.current.getByteTimeDomainData(data);
                    // Compute RMS around 128
                    let sum = 0;
                    for (let i = 0; i < data.length; i++) {
                        const v = (data[i] - 128) / 128;
                        sum += v * v;
                    }
                    const rms = Math.sqrt(sum / data.length); // 0..~1
                    const level = Math.min(100, Math.max(0, Math.round(rms * 140)));
                    setInputLevel(level);
                    const now = Date.now();
                    // Update rolling noise floor when below likely speech level (EMA)
                    if (rms < bargeInRmsRef.current) {
                        noiseFloorRef.current = noiseFloorRef.current * 0.98 + rms * 0.02;
                        // Update dynamic thresholds based on new noise floor
                        const nf = Math.max(0.001, Math.min(0.05, noiseFloorRef.current));
                        silenceThresholdRef.current = Math.min(0.08, Math.max(0.015, nf * 2.2));
                        bargeInRmsRef.current = Math.min(0.15, Math.max(0.03, nf * 3.5));
                    }
                    // Track voice activity frames for barge-in
                    if (rms > bargeInRmsRef.current) {
                        voiceActiveFramesRef.current += 1;
                    } else {
                        voiceActiveFramesRef.current = 0;
                    }

                    // Update last voice time for auto-stop
                    if (rms > silenceThresholdRef.current * 1.2) {
                        lastVoiceTsRef.current = now;
                    }
                    if (isRecording && autoStopRef.current && recActiveRef.current) {
                        if (now - lastVoiceTsRef.current > SILENCE_MS) {
                            try { speechRecognitionRef.current?.stop?.(); } catch {}
                        }
                    }

                    // Barge-in: cut interviewer TTS when user speaks clearly for a few frames
                    if (isQuestionTTSPlayingRef.current && voiceActiveFramesRef.current >= BARGE_IN_CONSEC_FRAMES) {
                        stopQuestionTTS();
                        setStatusMessage("Detected your voice — listening now...");
                    }
                    rafIdRef.current = requestAnimationFrame(tick);
                };
                if (!rafIdRef.current) {
                    rafIdRef.current = requestAnimationFrame(tick);
                }
            };
            ensureAudio();
            setIsInterviewActive(true);
            // Initialize adaptive thresholds to defaults at start
            noiseFloorRef.current = 0.015;
            silenceThresholdRef.current = 0.02;
            bargeInRmsRef.current = 0.04;
            initializeSpeechRecognition();
            await askQuestion();

        } catch (err) {
            console.error("Error accessing media devices:", err);
            setStatusMessage("Could not access webcam/microphone. Please ensure permissions are granted.");
            setShowNoCameraMessage(true);
        }
    }, [isInterviewActive, initializeSpeechRecognition, askQuestion]);

    // Move to the next question
    const nextQuestion = useCallback(async () => {
        if (autoAdvanceTimerRef.current) {
            window.clearTimeout(autoAdvanceTimerRef.current);
            autoAdvanceTimerRef.current = null;
        }
        setCurrentQuestionIndex(prevIndex => prevIndex + 1);
    }, []);

    // Mic calibration: estimate ambient noise and update dynamic thresholds
    const calibrateMic = useCallback(async () => {
        try {
            if (!streamRef.current) {
                const mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } as MediaTrackConstraints,
                    video: false,
                });
                streamRef.current = mediaStream;
            }
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (!micSourceRef.current) {
                micSourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
            }
            if (!analyserRef.current) {
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 2048;
            }
            try { micSourceRef.current.connect(analyserRef.current); } catch {}
            const data = new Uint8Array(analyserRef.current.frequencyBinCount);
            const start = performance.now();
            let acc = 0, n = 0;
            while (performance.now() - start < 1200) {
                analyserRef.current.getByteTimeDomainData(data);
                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    const v = (data[i] - 128) / 128;
                    sum += v * v;
                }
                const rms = Math.sqrt(sum / data.length);
                acc += rms; n += 1;
                await new Promise(r => setTimeout(r, 50));
            }
            const avg = acc / Math.max(1, n);
            noiseFloorRef.current = Math.min(0.05, Math.max(0.001, avg));
            // Recompute thresholds
            const nf = noiseFloorRef.current;
            silenceThresholdRef.current = Math.min(0.08, Math.max(0.015, nf * 2.2));
            bargeInRmsRef.current = Math.min(0.15, Math.max(0.03, nf * 3.5));
            setStatusMessage(`Mic calibrated. Noise floor ${(nf*100).toFixed(1)}%.`);
        } catch (e) {
            console.warn('Mic calibration failed:', e);
            setStatusMessage('Mic calibration failed. Using default thresholds.');
        }
    }, []);


    // Effect for handling question progression
    useEffect(() => {
        if (isInterviewActive && currentQuestionIndex > 0) {
            askQuestion();
        }
    }, [currentQuestionIndex, isInterviewActive, askQuestion]);

    // Cleanup effect
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (speechRecognitionRef.current) {
                speechRecognitionRef.current.stop();
            }
            if (autoAdvanceTimerRef.current) {
                window.clearTimeout(autoAdvanceTimerRef.current);
                autoAdvanceTimerRef.current = null;
            }
        };
    }, []);

    // Ensure audio context is created on user gesture and track live video state reliably
    useEffect(() => {
        const handleUserGesture = () => {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
        };
        document.body.addEventListener('click', handleUserGesture, { once: true });
        // Video playing/loaded => hide overlay
        const v = webcamVideoRef.current as HTMLVideoElement | null;
        const onPlaying = () => { setHasLiveVideo(true); setShowNoCameraMessage(false); };
        const onLoaded = () => { setHasLiveVideo(true); setShowNoCameraMessage(false); };
        if (v) {
            v.addEventListener('playing', onPlaying);
            v.addEventListener('loadeddata', onLoaded);
        }
        // Periodic check for active track
        const poll = window.setInterval(() => {
            const stream = streamRef.current;
            const active = !!stream && stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled);
            setHasLiveVideo(active);
            if (active) setShowNoCameraMessage(false);
        }, 800);
        return () => {
            document.body.removeEventListener('click', handleUserGesture);
            if (v) {
                v.removeEventListener('playing', onPlaying);
                v.removeEventListener('loadeddata', onLoaded);
            }
            window.clearInterval(poll);
        };
    }, []);

    // React to monitor toggle / gain changes
    useEffect(() => {
        const ctx = audioContextRef.current;
        if (!ctx || !micGainRef.current) return;
        micGainRef.current.gain.value = micGain;
        try {
            if (micMonitorOn) {
                micGainRef.current.connect(ctx.destination);
            } else {
                micGainRef.current.disconnect();
            }
        } catch {}
    }, [micMonitorOn, micGain]);

    return (
        <div className="bg-gray-900 min-h-screen flex items-center justify-center p-4">
            <div className="flex flex-col md:flex-row gap-8 w-full max-w-6xl mx-auto p-6 md:p-10 rounded-3xl bg-gray-700/30 backdrop-blur-xl border border-white/20 shadow-lg shadow-black/20">
                <div className="w-full md:w-1/2 flex flex-col gap-6">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-white text-center mb-4 leading-tight">Mock Interview AI 🗣️</h1>
                    <div className="relative w-full aspect-video rounded-3xl overflow-hidden border border-white/20 shadow-xl">
                        <video ref={webcamVideoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>
                        {showNoCameraMessage && !hasLiveVideo && (
                            <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center text-white text-lg font-medium p-4 text-center">
                                Webcam access denied or not available. Please allow camera access to start the interview.
                            </div>
                        )}
                    </div>

            <div className="flex flex-col md:flex-row gap-3 md:gap-4 justify-center items-center w-full">
                        {!isInterviewActive && (
                <button onClick={startInterview} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-6 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105 w-full md:w-auto">
                                Start Interview
                            </button>
                        )}
                        {isInterviewActive && !isProcessing && (
                <button onClick={nextQuestion} className="bg-green-600 hover:bg-green-500 text-white font-semibold py-3 px-6 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105 w-full md:w-auto">
                                Next Question
                            </button>
                        )}
                        {isInterviewActive && isRecording && (
                            <button onClick={() => { try { speechRecognitionRef.current?.stop?.(); } catch {} }} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105 w-full md:w-auto">
                                Complete Answer
                            </button>
                        )}
                        {isInterviewActive && (
                <button onClick={endInterview} className="bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-6 rounded-full shadow-md transition duration-300 ease-in-out transform hover:scale-105 w-full md:w-auto">
                                End Interview
                            </button>
                        )}
                        {isInterviewActive && (
                            <div className="flex flex-wrap items-center gap-3 text-white text-sm mt-2 w-full md:w-auto justify-center">
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={micMonitorOn} onChange={(e) => setMicMonitorOn(e.target.checked)} />
                                    Mic monitor
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="opacity-70">Vol</span>
                    <input className="w-28" type="range" min={0} max={1} step={0.05} value={micGain} onChange={(e) => setMicGain(parseFloat(e.target.value))} />
                                </div>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={autoStopOnSilence} onChange={(e) => { setAutoStopOnSilence(e.target.checked); autoStopRef.current = e.target.checked; }} />
                                    Auto‑stop on silence
                                </label>
                <div className="w-24 h-2 bg-white/20 rounded overflow-hidden">
                                    <div className="h-2 bg-emerald-400 rounded" style={{ width: `${inputLevel}%` }} />
                                </div>
                                <button onClick={calibrateMic} className="ml-2 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full border border-white/20">Calibrate mic</button>
                            </div>
                        )}
                    </div>
                    <div className="text-center text-gray-300 text-sm mt-2">{statusMessage}</div>
                </div>

                <div className="w-full md:w-1/2 flex flex-col gap-6">
                    <div className="p-6 rounded-3xl bg-gray-700/30 backdrop-blur-lg border border-white/20 shadow-lg">
                        <h2 className="text-xl font-semibold text-white mb-3">Interviewer's Question:</h2>
                        <div className="text-white text-lg min-h-[100px] overflow-y-auto">
                            {questionDisplay}
                        </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-gray-700/30 backdrop-blur-lg border border-white/20 shadow-lg">
                        <h2 className="text-xl font-semibold text-white mb-3">Your Response:</h2>
                        <div className="text-gray-300 italic min-h-[100px] overflow-y-auto">
                            {userResponse}
                        </div>
                        {isRecording && (
                            <div className="text-blue-400 text-sm mt-3 font-medium flex items-center gap-2">
                                <span className="animate-pulse">●</span> Recording...
                            </div>
                        )}
                        {isProcessing && (
                            <div className="flex items-center gap-2 text-gray-400 text-sm mt-3">
                                <div className="loading-spinner"></div>
                                <span>Processing your answer...</span>
                            </div>
                        )}
                    </div>

                    <div className="p-6 rounded-3xl bg-gray-700/30 backdrop-blur-lg border border-white/20 shadow-lg">
                        <h2 className="text-xl font-semibold text-white mb-3">AI Feedback:</h2>
                        <div className="text-gray-200 min-h-[100px] overflow-y-auto">
                            {aiFeedback}
                        </div>
                    </div>

                    <div className="p-6 rounded-3xl bg-gray-700/30 backdrop-blur-lg border border-white/20 shadow-lg">
                        <h2 className="text-xl font-semibold text-white mb-3">Body Language Feedback (Simulated):</h2>
                        <div className="text-gray-200 min-h-[100px] overflow-y-auto">
                            {bodyLanguageFeedback}
                        </div>
                    </div>
                </div>
            </div>
            {/* Additional CSS for the spinner can be added in your global CSS file */}
        </div>
    );
};

export default MockInterview;