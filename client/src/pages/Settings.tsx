import { useSettings } from "@/hooks/use-settings";
import { Switch } from "@/components/ui/switch"; // Assuming standard Shadcn switch or we build one. Let's build a simple custom toggle for independence.
import { Moon, Sun, Type, Eye, Zap } from "lucide-react";

export default function Settings() {
  const { 
    theme, setTheme, 
    highContrast, toggleHighContrast,
    textSize, setTextSize,
    reducedMotion, toggleReducedMotion
  } = useSettings();

  return (
    <div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-display font-bold text-4xl mb-2">Accessibility Settings</h1>
        <p className="text-muted-foreground mb-10 text-lg">Customize your viewing experience.</p>

        <div className="space-y-6">
          
          {/* Theme */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary rounded-xl">
                {theme === 'light' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-bold text-lg">Theme</h3>
                <p className="text-sm text-muted-foreground">Toggle dark mode</p>
              </div>
            </div>
            <div className="flex bg-secondary rounded-lg p-1">
              <button 
                onClick={() => setTheme('light')}
                className={`px-4 py-2 rounded-md font-medium transition-all ${theme === 'light' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
              >
                Light
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`px-4 py-2 rounded-md font-medium transition-all ${theme === 'dark' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
              >
                Dark
              </button>
            </div>
          </div>

          {/* High Contrast */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary rounded-xl">
                <Eye className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">High Contrast</h3>
                <p className="text-sm text-muted-foreground">Increase visual distinction</p>
              </div>
            </div>
            <button 
              onClick={toggleHighContrast}
              className={`
                w-14 h-8 rounded-full transition-colors relative
                ${highContrast ? 'bg-primary' : 'bg-input'}
              `}
            >
              <div className={`
                w-6 h-6 rounded-full bg-white shadow-sm absolute top-1 transition-transform
                ${highContrast ? 'left-7' : 'left-1'}
              `} />
            </button>
          </div>

          {/* Text Size */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-secondary rounded-xl">
                <Type className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Text Size</h3>
                <p className="text-sm text-muted-foreground">Adjust reading size</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {([
                { value: 'sm', label: 'Small' },
                { value: 'base', label: 'Medium' },
                { value: 'lg', label: 'Large' },
                { value: 'xl', label: 'Extra Large' }
              ] as const).map((size) => (
                <button
                  key={size.value}
                  onClick={() => setTextSize(size.value)}
                  data-testid={`button-textsize-${size.value}`}
                  className={`
                    py-3 rounded-xl border-2 font-bold transition-all
                    ${textSize === size.value 
                      ? 'border-primary bg-primary/5 text-primary' 
                      : 'border-border hover:border-primary/30'}
                  `}
                >
                  <span className={`text-${size.value}`}>
                    Aa
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Reduced Motion */}
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary rounded-xl">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Reduced Motion</h3>
                <p className="text-sm text-muted-foreground">Minimize animations</p>
              </div>
            </div>
            <button 
              onClick={toggleReducedMotion}
              className={`
                w-14 h-8 rounded-full transition-colors relative
                ${reducedMotion ? 'bg-primary' : 'bg-input'}
              `}
            >
              <div className={`
                w-6 h-6 rounded-full bg-white shadow-sm absolute top-1 transition-transform
                ${reducedMotion ? 'left-7' : 'left-1'}
              `} />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
