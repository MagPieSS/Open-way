import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FontFamily = 'atkinson' | 'opendyslexic' | 'system';
export type LineSpacing = 'compact' | 'normal' | 'relaxed';

interface SettingsState {
  theme: 'light' | 'dark';
  highContrast: boolean;
  textSize: 'sm' | 'base' | 'lg' | 'xl';
  reducedMotion: boolean;
  fontFamily: FontFamily;
  lineSpacing: LineSpacing;
  linkUnderlines: boolean;
  enhancedFocus: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleHighContrast: () => void;
  setTextSize: (size: 'sm' | 'base' | 'lg' | 'xl') => void;
  toggleReducedMotion: () => void;
  setFontFamily: (font: FontFamily) => void;
  setLineSpacing: (spacing: LineSpacing) => void;
  toggleLinkUnderlines: () => void;
  toggleEnhancedFocus: () => void;
}

const applyTextSize = (size: 'sm' | 'base' | 'lg' | 'xl') => {
  document.documentElement.classList.remove('text-size-sm', 'text-size-md', 'text-size-lg', 'text-size-xl');
  // Map 'base' to 'md' for CSS class naming
  const sizeClass = size === 'base' ? 'text-size-md' : `text-size-${size}`;
  document.documentElement.classList.add(sizeClass);
};

const applyFontFamily = (font: FontFamily) => {
  document.documentElement.classList.remove('font-atkinson', 'font-opendyslexic', 'font-system');
  document.documentElement.classList.add(`font-${font}`);
};

const applyLineSpacing = (spacing: LineSpacing) => {
  document.documentElement.classList.remove('leading-compact', 'leading-normal', 'leading-relaxed');
  document.documentElement.classList.add(`leading-${spacing}`);
};

const applyLinkUnderlines = (enabled: boolean) => {
  if (enabled) document.documentElement.classList.add('link-underlines');
  else document.documentElement.classList.remove('link-underlines');
};

const applyEnhancedFocus = (enabled: boolean) => {
  if (enabled) document.documentElement.classList.add('enhanced-focus');
  else document.documentElement.classList.remove('enhanced-focus');
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      highContrast: false,
      textSize: 'base',
      reducedMotion: false,
      fontFamily: 'atkinson',
      lineSpacing: 'normal',
      linkUnderlines: false,
      enhancedFocus: false,
      
      setTheme: (theme) => {
        set({ theme });
        if (theme === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      },
      
      toggleHighContrast: () => set((state) => {
        const newValue = !state.highContrast;
        if (newValue) document.documentElement.classList.add('high-contrast');
        else document.documentElement.classList.remove('high-contrast');
        return { highContrast: newValue };
      }),
      
      setTextSize: (textSize) => {
        applyTextSize(textSize);
        set({ textSize });
      },
      
      toggleReducedMotion: () => set((state) => ({ reducedMotion: !state.reducedMotion })),
      
      setFontFamily: (fontFamily) => {
        applyFontFamily(fontFamily);
        set({ fontFamily });
      },
      
      setLineSpacing: (lineSpacing) => {
        applyLineSpacing(lineSpacing);
        set({ lineSpacing });
      },
      
      toggleLinkUnderlines: () => set((state) => {
        const newValue = !state.linkUnderlines;
        applyLinkUnderlines(newValue);
        return { linkUnderlines: newValue };
      }),
      
      toggleEnhancedFocus: () => set((state) => {
        const newValue = !state.enhancedFocus;
        applyEnhancedFocus(newValue);
        return { enhancedFocus: newValue };
      }),
    }),
    {
      name: 'open-way-settings',
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (state.theme === 'dark') document.documentElement.classList.add('dark');
          if (state.highContrast) document.documentElement.classList.add('high-contrast');
          applyTextSize(state.textSize || 'base');
          applyFontFamily(state.fontFamily || 'atkinson');
          applyLineSpacing(state.lineSpacing || 'normal');
          applyLinkUnderlines(state.linkUnderlines || false);
          applyEnhancedFocus(state.enhancedFocus || false);
        }
      }
    }
  )
);
