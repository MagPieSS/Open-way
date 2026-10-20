import { useSettings, type FontFamily, type LineSpacing } from "@/hooks/use-settings";
import { Moon, Sun, Type, Eye, Zap, BookOpen, AlignJustify, Link2, Focus, Volume2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/use-page-meta";

// Defined outside Settings so it isn't a new component type on every render; when it was inside,
// React remounted the button after each toggle and keyboard focus fell back to the page.
function ToggleSwitch({ checked, onToggle, label, testId }: { checked: boolean; onToggle: () => void; label: string; testId: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      data-testid={testId}
      className={`
        w-14 h-8 rounded-full transition-colors relative flex-shrink-0
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        ${checked ? 'bg-primary' : 'bg-input'}
      `}
    >
      <span
        aria-hidden="true"
        className={`
          w-6 h-6 rounded-full bg-white shadow-sm absolute top-1 transition-transform
          ${checked ? 'left-7' : 'left-1'}
        `}
      />
    </button>
  );
}

export default function Settings() {
  usePageMeta({ title: "Accessibility Settings" });
  const { 
    theme, setTheme, 
    highContrast, toggleHighContrast,
    textSize, setTextSize,
    reducedMotion, toggleReducedMotion,
    fontFamily, setFontFamily,
    lineSpacing, setLineSpacing,
    linkUnderlines, toggleLinkUnderlines,
    enhancedFocus, toggleEnhancedFocus,
    readAloudEnabled, toggleReadAloud,
    readAloudVoice, setReadAloudVoice,
    readAloudSpeed, setReadAloudSpeed
  } = useSettings();
  
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      setAvailableVoices(voices);
    };
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  const previewVoice = () => {
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance("This is how the read aloud feature will sound.");
    utterance.rate = readAloudSpeed;
    if (readAloudVoice) {
      const voice = availableVoices.find((v) => v.name === readAloudVoice);
      if (voice) utterance.voice = voice;
    }
    window.speechSynthesis?.speak(utterance);
  };

  const speedLabels: Record<string, string> = {
    "0.5": "Very Slow",
    "0.75": "Slow",
    "1": "Normal",
    "1.25": "Fast",
    "1.5": "Very Fast",
    "2": "Maximum",
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10">
          <h1 className="font-display font-bold text-4xl mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Accessibility Settings
          </h1>
          <p className="text-muted-foreground text-lg">Customize your viewing experience for maximum comfort.</p>
        </div>

        <div className="space-y-6">
          
          {/* Theme */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm card-hover-glow">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 icon-bg-primary rounded-xl">
                  {theme === 'light' ? <Sun className="w-6 h-6 text-primary" /> : <Moon className="w-6 h-6 text-primary" />}
                </div>
                <div>
                  <h3 className="font-bold text-lg">Theme</h3>
                  <p className="text-sm text-muted-foreground">Toggle dark mode</p>
                </div>
              </div>
              <div className="flex bg-secondary rounded-lg p-1">
                <button 
                  onClick={() => setTheme('light')}
                  aria-pressed={theme === 'light'}
                  data-testid="button-theme-light"
                  className={`px-4 py-2 rounded-md font-medium transition-all ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                >
                  Light
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                  data-testid="button-theme-dark"
                  className={`px-4 py-2 rounded-md font-medium transition-all ${theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                >
                  Dark
                </button>
              </div>
            </div>
          </div>

          {/* Font Family */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm card-hover-glow">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 icon-bg-accent rounded-xl">
                <BookOpen className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Font Family</h3>
                <p className="text-sm text-muted-foreground">Choose your preferred reading font</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { value: 'atkinson' as FontFamily, label: 'Atkinson', desc: 'Designed for readability' },
                { value: 'opendyslexic' as FontFamily, label: 'OpenDyslexic', desc: 'Helps with dyslexia' },
                { value: 'system' as FontFamily, label: 'System', desc: 'Your device default' }
              ]).map((font) => (
                <button
                  key={font.value}
                  onClick={() => setFontFamily(font.value)}
                  aria-pressed={fontFamily === font.value}
                  data-testid={`button-font-${font.value}`}
                  className={`
                    p-4 rounded-xl border-2 text-left transition-all
                    ${fontFamily === font.value 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/30'}
                  `}
                >
                  <span className="font-bold block">{font.label}</span>
                  <span className="text-xs text-muted-foreground">{font.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Text Size */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm card-hover-glow">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 icon-bg-success rounded-xl">
                <Type className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Text Size</h3>
                <p className="text-sm text-muted-foreground">Adjust reading size</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([
                { value: 'sm', label: 'S', fullLabel: 'Small' },
                { value: 'base', label: 'M', fullLabel: 'Medium' },
                { value: 'lg', label: 'L', fullLabel: 'Large' },
                { value: 'xl', label: 'XL', fullLabel: 'Extra Large' }
              ] as const).map((size) => (
                <button
                  key={size.value}
                  onClick={() => setTextSize(size.value)}
                  aria-pressed={textSize === size.value}
                  data-testid={`button-textsize-${size.value}`}
                  className={`
                    py-3 rounded-xl border-2 font-bold transition-all flex flex-col items-center
                    ${textSize === size.value 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-border hover:border-primary/30'}
                  `}
                >
                  <span className={`text-${size.value} text-2xl`}>Aa</span>
                  <span className="text-xs mt-1 text-muted-foreground">{size.fullLabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Line Spacing */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm card-hover-glow">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30 rounded-xl">
                <AlignJustify className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Line Spacing</h3>
                <p className="text-sm text-muted-foreground">Space between lines of text</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                { value: 'compact' as LineSpacing, label: 'Compact', icon: '≡' },
                { value: 'normal' as LineSpacing, label: 'Normal', icon: '☰' },
                { value: 'relaxed' as LineSpacing, label: 'Relaxed', icon: '≋' }
              ]).map((spacing) => (
                <button
                  key={spacing.value}
                  onClick={() => setLineSpacing(spacing.value)}
                  aria-pressed={lineSpacing === spacing.value}
                  data-testid={`button-spacing-${spacing.value}`}
                  className={`
                    py-4 rounded-xl border-2 font-bold transition-all flex flex-col items-center
                    ${lineSpacing === spacing.value 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-border hover:border-primary/30'}
                  `}
                >
                  <span className="text-2xl">{spacing.icon}</span>
                  <span className="text-sm mt-1">{spacing.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* High Contrast */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm card-hover-glow flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30 rounded-xl">
                <Eye className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">High Contrast</h3>
                <p className="text-sm text-muted-foreground">Increase visual distinction</p>
              </div>
            </div>
            <ToggleSwitch checked={highContrast} onToggle={toggleHighContrast} label="High contrast" testId="toggle-high-contrast" />
          </div>

          {/* Link Underlines */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm card-hover-glow flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30 rounded-xl">
                <Link2 className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Always Show Link Underlines</h3>
                <p className="text-sm text-muted-foreground">Make all links clearly visible</p>
              </div>
            </div>
            <ToggleSwitch checked={linkUnderlines} onToggle={toggleLinkUnderlines} label="Always show link underlines" testId="toggle-link-underlines" />
          </div>

          {/* Enhanced Focus */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm card-hover-glow flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/30 dark:to-indigo-800/30 rounded-xl">
                <Focus className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Enhanced Focus Indicators</h3>
                <p className="text-sm text-muted-foreground">Larger, more visible focus outlines</p>
              </div>
            </div>
            <ToggleSwitch checked={enhancedFocus} onToggle={toggleEnhancedFocus} label="Enhanced focus indicators" testId="toggle-enhanced-focus" />
          </div>

          {/* Read Aloud */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm card-hover-glow">
            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-900/30 dark:to-teal-800/30 rounded-xl">
                  <Volume2 className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Read Aloud</h3>
                  <p className="text-sm text-muted-foreground">Have page content read to you</p>
                </div>
              </div>
              <ToggleSwitch checked={readAloudEnabled} onToggle={toggleReadAloud} label="Read aloud" testId="toggle-read-aloud" />
            </div>

            {readAloudEnabled && (
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="mt-4">
                  <label htmlFor="read-aloud-voice" className="block text-sm font-medium mb-2">Voice</label>
                  <select
                    id="read-aloud-voice"
                    value={readAloudVoice}
                    onChange={(e) => setReadAloudVoice(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
                    data-testid="select-read-aloud-voice"
                  >
                    <option value="">Default Voice</option>
                    {availableVoices.map((voice) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="read-aloud-speed" className="block text-sm font-medium mb-2">
                    Speed: {speedLabels[String(readAloudSpeed)] || `${readAloudSpeed}x`}
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">0.5x</span>
                    <input
                      id="read-aloud-speed"
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.25"
                      value={readAloudSpeed}
                      onChange={(e) => setReadAloudSpeed(parseFloat(e.target.value))}
                      className="flex-1 accent-primary"
                      data-testid="slider-read-aloud-speed"
                      aria-valuetext={`${readAloudSpeed}x`}
                    />
                    <span className="text-xs text-muted-foreground">2x</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={previewVoice}
                  className="gap-2"
                  data-testid="button-preview-voice"
                >
                  <Volume2 className="w-4 h-4" />
                  Preview Voice
                </Button>
              </div>
            )}
          </div>

          {/* Reduced Motion */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm card-hover-glow flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 rounded-xl">
                <Zap className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Reduced Motion</h3>
                <p className="text-sm text-muted-foreground">Minimize animations</p>
              </div>
            </div>
            <ToggleSwitch checked={reducedMotion} onToggle={toggleReducedMotion} label="Reduced motion" testId="toggle-reduced-motion" />
          </div>

          {/* Preview Section */}
          <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-purple-500/10 p-6 rounded-2xl border border-border">
            <h3 className="font-bold text-lg mb-3">Preview Your Settings</h3>
            <p className="text-muted-foreground mb-4">
              This is sample text showing your current font family, size, and line spacing preferences. 
              The quick brown fox jumps over the lazy dog. Accessibility matters because everyone deserves 
              equal access to information and services.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="#" className="text-primary font-semibold">Sample Link</a>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-semibold">
                Sample Button
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
