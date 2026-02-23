import { useEffect, useState, useCallback, useRef } from "react";
import { Volume2, Square, Pause, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/use-settings";

export function ReadAloudProvider() {
  const { readAloudEnabled, readAloudVoice, readAloudSpeed } = useSettings();
  const [isReading, setIsReading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const stopReading = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsReading(false);
    setIsPaused(false);
    setCurrentText("");
    utteranceRef.current = null;
  }, []);

  const speakText = useCallback((text: string) => {
    if (!text || !window.speechSynthesis) return;

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
      setCurrentText("");
      utteranceRef.current = null;
    };

    utterance.onerror = () => {
      setIsReading(false);
      setIsPaused(false);
      setCurrentText("");
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    setCurrentText(text.length > 80 ? text.slice(0, 80) + "..." : text);
    setIsReading(true);
    setIsPaused(false);
    window.speechSynthesis.speak(utterance);
  }, [readAloudVoice, readAloudSpeed]);

  useEffect(() => {
    if (!readAloudEnabled) {
      stopReading();
      return;
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.closest("[data-read-aloud-controls]")) return;
      if (target.closest("button, a, input, textarea, select, nav, [role='navigation'], [role='button'], [role='link'], [contenteditable]")) return;

      const readable = target.closest("p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, figcaption, [data-read-aloud], .card-content, article") as HTMLElement | null;

      let textEl = readable || target;
      const text = (textEl.textContent || "").replace(/\s+/g, " ").trim();

      if (!text || text.length < 3) return;

      textEl.style.outline = "2px solid hsl(var(--primary))";
      textEl.style.outlineOffset = "2px";
      textEl.style.borderRadius = "4px";
      setTimeout(() => {
        textEl.style.outline = "";
        textEl.style.outlineOffset = "";
        textEl.style.borderRadius = "";
      }, 1500);

      speakText(text);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [readAloudEnabled, speakText, stopReading]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  if (!readAloudEnabled || typeof window === "undefined" || !window.speechSynthesis) {
    return null;
  }

  const togglePause = () => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  return (
    <>
      {!isReading && (
        <div
          data-read-aloud-controls
          className="fixed bottom-4 left-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium"
          data-testid="read-aloud-indicator"
        >
          <Volume2 className="w-4 h-4" />
          <span>Click any text to hear it</span>
        </div>
      )}
      {isReading && (
        <div
          data-read-aloud-controls
          className="fixed bottom-4 left-4 z-50 bg-card border border-border rounded-xl shadow-xl p-3 flex items-center gap-3 max-w-sm"
          data-testid="read-aloud-controls"
        >
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={togglePause}
              data-testid="button-read-aloud-pause"
              aria-label={isPaused ? "Resume reading" : "Pause reading"}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={stopReading}
              data-testid="button-read-aloud-stop"
              aria-label="Stop reading"
            >
              <Square className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              {isPaused ? "Paused" : "Reading..."}
            </p>
            <p className="text-sm truncate font-medium">{currentText}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={stopReading}
            data-testid="button-read-aloud-dismiss"
            aria-label="Dismiss"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </>
  );
}
