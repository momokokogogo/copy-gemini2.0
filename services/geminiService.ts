import { GoogleGenAI, GenerateContentResponse, Modality, Type, Part, LiveServerMessage, Blob } from "@google/genai";
import { ChatMode } from "../types";
import { fileToBase64, encode, decode, decodeAudioData } from "../utils";

// Fix: Define LiveSession interface locally as it's not exported from @google/genai.
interface LiveSession {
  sendRealtimeInput(input: { media: Blob }): void;
  close(): void;
}

let ai: GoogleGenAI;
let liveSession: LiveSession | null = null;
let inputAudioContext: AudioContext;
let outputAudioContext: AudioContext;
let mediaStream: MediaStream;
let scriptProcessor: ScriptProcessorNode;


const getAi = () => {
    if (!ai) {
        // IMPORTANT: The API key is sourced from an environment variable.
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error("API_KEY environment variable not set.");
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
};

const getModelForChatMode = (mode: ChatMode): string => {
    switch (mode) {
        case 'flash-lite': return 'gemini-flash-lite-latest';
        case 'pro': return 'gemini-2.5-pro';
        case 'search':
        case 'maps':
        case 'flash':
        default: return 'gemini-2.5-flash';
    }
};

const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64Data = await fileToBase64(file);
    return {
        inlineData: {
            mimeType: file.type,
            data: base64Data,
        },
    };
};

export const generateTextStream = async (prompt: string, mode: ChatMode) => {
    const ai = getAi();
    const modelName = getModelForChatMode(mode);
    const config: any = {};
    const contents = { parts: [{ text: prompt }] };

    if (mode === 'pro') {
        config.thinkingConfig = { thinkingBudget: 32768 };
    }
    if (mode === 'search') {
        config.tools = [{ googleSearch: {} }];
    }
    if (mode === 'maps') {
        config.tools = [{ googleMaps: {} }];
        // In a real app, you would get user's location
        // navigator.geolocation.getCurrentPosition(...)
        config.toolConfig = {
            retrievalConfig: {
                latLng: { latitude: 37.78193, longitude: -122.40476 }
            }
        };
    }

    return ai.models.generateContentStream({
        model: modelName,
        contents,
        config,
    });
};

export const analyzeContent = async (prompt: string, files: File[]) => {
    const ai = getAi();
    const fileParts = await Promise.all(files.map(fileToGenerativePart));
    const model = files.some(f => f.type.startsWith('video/')) ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    
    const response = await ai.models.generateContent({
        model,
        contents: { parts: [...fileParts, { text: prompt }] },
    });
    return response;
};

export const generateImage = async (prompt: string, aspectRatio: string) => {
    const ai = getAi();
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: {
            numberOfImages: 1,
            outputMimeType: 'image/png',
            aspectRatio,
        },
    });
    return { base64Image: response.generatedImages[0].image.imageBytes };
};

export const editImage = async (prompt: string, imageFile: File) => {
    const ai = getAi();
    const imagePart = await fileToGenerativePart(imageFile);
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, { text: prompt }] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });
    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData) {
        return { base64Image: part.inlineData.data };
    }
    throw new Error("No image generated");
};


export const generateVideo = async (prompt: string, imageFile?: File) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY }); // Re-init to get latest key
    const image = imageFile ? await fileToGenerativePart(imageFile) : undefined;
    
    const request: any = {
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
        }
    };
    if (image && image.inlineData) {
        request.image = { imageBytes: image.inlineData.data, mimeType: image.inlineData.mimeType };
    }

    return ai.models.generateVideos(request);
};

export const pollVideoOperation = async (operation: any, onProgress: (status: string) => void): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    let currentOperation = operation;
    
    while (!currentOperation.done) {
        onProgress(`Video generation in progress... State: ${currentOperation.metadata?.state || 'PROCESSING'}`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });
    }

    onProgress('Video processing complete! Fetching video...');

    if (currentOperation.response?.generatedVideos?.[0]?.video?.uri) {
        const downloadLink = currentOperation.response.generatedVideos[0].video.uri;
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    }
    throw new Error('Video generation failed or URI not found.');
};

// --- Live API ---

let nextStartTime = 0;
const sources = new Set<AudioBufferSourceNode>();

export const connectLive = async (callbacks: { onOpen: () => void, onMessage: (msg: LiveServerMessage) => void, onClose: () => void, onError: (e: any) => void }) => {
    const ai = getAi();
    
    // Fix: Use a cross-browser compatible way to instantiate AudioContext.
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    inputAudioContext = new AudioContext({ sampleRate: 16000 });
    outputAudioContext = new AudioContext({ sampleRate: 24000 });

    const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
            onopen: () => {
                sessionPromise.then(async (session) => {
                    liveSession = session;
                    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const source = inputAudioContext.createMediaStreamSource(mediaStream);
                    scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const l = inputData.length;
                        const int16 = new Int16Array(l);
                        for (let i = 0; i < l; i++) {
                            int16[i] = inputData[i] * 32768;
                        }
                        const pcmBlob = {
                            data: encode(new Uint8Array(int16.buffer)),
                            mimeType: 'audio/pcm;rate=16000',
                        };
                        liveSession?.sendRealtimeInput({ media: pcmBlob });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                    callbacks.onOpen();
                });
            },
            onmessage: async (message: LiveServerMessage) => {
                 callbacks.onMessage(message);
                 const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                 if (base64Audio) {
                    nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                    const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                    const sourceNode = outputAudioContext.createBufferSource();
                    sourceNode.buffer = audioBuffer;
                    sourceNode.connect(outputAudioContext.destination);
                    sourceNode.addEventListener('ended', () => { sources.delete(sourceNode) });
                    sourceNode.start(nextStartTime);
                    nextStartTime += audioBuffer.duration;
                    sources.add(sourceNode);
                 }
            },
            onclose: callbacks.onClose,
            onerror: callbacks.onError,
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        }
    });
};

export const closeLiveSession = () => {
    liveSession?.close();
    liveSession = null;
    mediaStream?.getTracks().forEach(track => track.stop());
    scriptProcessor?.disconnect();
    inputAudioContext?.close();
    outputAudioContext?.close();
    sources.forEach(source => source.stop());
    sources.clear();
    nextStartTime = 0;
};