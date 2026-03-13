"use client";

import { useState, useCallback, useEffect } from 'react';

// Declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported, setSupported] = useState(true);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSupported(false);
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
              currentTranscript += event.results[i][0].transcript + " ";
          }
        }
        if (currentTranscript) {
          setTranscript((prev) => prev + currentTranscript);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          alert('Microphone permission is required.');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      setRecognitionInstance(recognition);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!supported || !recognitionInstance) return;
    setTranscript('');
    try {
      recognitionInstance.start();
      setIsListening(true);
    } catch (e) {
      console.error(e);
      setIsListening(false);
    }
  }, [recognitionInstance, supported]);

  const stopListening = useCallback(() => {
    if (!supported || !recognitionInstance) return;
    try {
      recognitionInstance.stop();
      setIsListening(false);
    } catch (e) {
      console.error(e);
    }
  }, [recognitionInstance, supported]);

  const appendTranscript = useCallback((text: string) => {
    setTranscript(prev => prev + text);
  }, []);
  
  const resetTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  return {
    isListening,
    transcript,
    setTranscript,
    supported,
    startListening,
    stopListening,
    appendTranscript,
    resetTranscript 
  };
}
