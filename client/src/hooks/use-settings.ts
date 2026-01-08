import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  theme: 'light' | 'dark';
  highContrast: boolean;
  textSize: 'sm' | 'base' | 'lg' | 'xl';
  reducedMotion: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleHighContrast: () => void;
  setTextSize: (size: 'sm' | 'base' | 'lg' | 'xl') => void;
  toggleReducedMotion: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'light',
      highContrast: false,
      textSize: 'base',
      reducedMotion: false,
      
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
      
      setTextSize: (textSize) => set({ textSize }),
      
      toggleReducedMotion: () => set((state) => ({ reducedMotion: !state.reducedMotion })),
    }),
    {
      name: 'open-way-settings',
      onRehydrateStorage: () => (state) => {
        // Apply settings on load
        if (state) {
            if (state.theme === 'dark') document.documentElement.classList.add('dark');
            if (state.highContrast) document.documentElement.classList.add('high-contrast');
        }
      }
    }
  )
);
