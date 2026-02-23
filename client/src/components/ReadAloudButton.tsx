import { useState, useEffect, useCallback, useRef } from "react";
import { Volume2, Square, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/use-settings";

interface ReadAloudButtonProps {
  contentRef: React.RefObject<HTMLElement | null>;
  label?: string;
}

export function ReadAloudButton({ contentRef, label = "Read Aloud" }: ReadAloudButtonProps) {
  const { readAloudEnabled, readAloudVoice, readAloudSpeed } = useSettings();
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopReading = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsReading(false);
    setIsPaused(false);
    utteranceRef.current = null;
  }, []);

  useEffect(() => {
    if (!readAloudEnabled) {
      stopReading();
    }
  }, [readAloudEnabled, stopReading]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (!readAloudEnabled || typeof window === "undefined" || !window.speechSynthesis) {
    return null;
  }

  const getTextContent = () => {
    if (!contentRef.current) return "";
    const clone = contentRef.current.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("button, nav, [role='navigation'], script, style, [aria-hidden='true']").forEach((el) => el.remove());
    return (clone.textContent || "").replace(/\s+/g, " ").trim();
  };

  const startReading = () => {
    const text = getTextContent();
    if (!text) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = readAloudSpeed;

    if (readAloudVoice) {
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice = voices.find((v) => v.name === readAloudVoice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onend = () => {
      setIsReading(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setIsReading(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsReading(true);
    setIsPaused(false);
  };

  const togglePause = () => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  if (!isReading) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={startReading}
        className="gap-2"
        data-testid="button-read-aloud"
        aria-label={label}
      >
        <Volume2 className="w-4 h-4" />
        {label}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="read-aloud-controls">
      <Button
        variant="outline"
        size="sm"
        onClick={togglePause}
        data-testid="button-read-aloud-pause"
        aria-label={isPaused ? "Resume reading" : "Pause reading"}
      >
        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={stopReading}
        data-testid="button-read-aloud-stop"
        aria-label="Stop reading"
      >
        <Square className="w-4 h-4" />
      </Button>
      <span className="text-xs text-muted-foreground ml-1">
        {isPaused ? "Paused" : "Reading..."}
      </span>
    </div>
  );
}
