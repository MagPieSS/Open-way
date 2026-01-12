import { useSettings, type FontFamily, type LineSpacing } from "@/hooks/use-settings";
import { Moon, Sun, Type, Eye, Zap, BookOpen, AlignJustify, Link2, Focus } from "lucide-react";

export default function Settings() {
  const { 
    theme, setTheme, 
    highContrast, toggleHighContrast,
    textSize, setTextSize,
    reducedMotion, toggleReducedMotion,
    fontFamily, setFontFamily,
    lineSpacing, setLineSpacing,
    linkUnderlines, toggleLinkUnderlines,
    enhancedFocus, toggleEnhancedFocus
  } = useSettings();

  const ToggleSwitch = ({ checked, onToggle, testId }: { checked: boolean; onToggle: () => void; testId: string }) => (
    <button 
      onClick={onToggle}
      data-testid={testId}
      className={`
        w-14 h-8 rounded-full transition-colors relative
        ${checked ? 'bg-primary' : 'bg-input'}
      `}
      aria-pressed={checked}
    >
      <div className={`
        w-6 h-6 rounded-full bg-white shadow-sm absolute top-1 transition-transform
        ${checked ? 'left-7' : 'left-1'}
      `} />
    </button>
  );

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
                  data-testid="button-theme-light"
                  className={`px-4 py-2 rounded-md font-medium transition-all ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                >
                  Light
                </button>
                <button 
                  onClick={() => setTheme('dark')}
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
            <ToggleSwitch checked={highContrast} onToggle={toggleHighContrast} testId="toggle-high-contrast" />
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
            <ToggleSwitch checked={linkUnderlines} onToggle={toggleLinkUnderlines} testId="toggle-link-underlines" />
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
            <ToggleSwitch checked={enhancedFocus} onToggle={toggleEnhancedFocus} testId="toggle-enhanced-focus" />
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
            <ToggleSwitch checked={reducedMotion} onToggle={toggleReducedMotion} testId="toggle-reduced-motion" />
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
