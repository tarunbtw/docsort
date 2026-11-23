import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Laptop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground ${className ?? ''}`}
      >
        <Moon className="size-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ${className ?? ''}`}
            aria-label="Toggle theme"
          />
        }
      >
        {isDark ? (
          <Moon className="size-4 text-foreground transition-transform duration-200" />
        ) : (
          <Sun className="size-4 text-foreground transition-transform duration-200" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className={`flex items-center gap-2 cursor-pointer ${theme === 'light' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
        >
          <Sun className="size-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-2 cursor-pointer ${theme === 'dark' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
        >
          <Moon className="size-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('system')}
          className={`flex items-center gap-2 cursor-pointer ${theme === 'system' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
        >
          <Laptop className="size-4" />
          <span>System</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ThemeSegmentedToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="h-8 w-24 bg-muted/40 rounded-lg animate-pulse" />;
  }

  return (
    <div className={`inline-flex items-center p-0.5 rounded-lg bg-muted border border-border text-xs ${className ?? ''}`}>
      <button
        onClick={() => setTheme('light')}
        className={`px-2 py-1 rounded-md flex items-center gap-1.5 transition-all ${
          theme === 'light'
            ? 'bg-background text-foreground shadow-xs font-medium'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Light theme"
      >
        <Sun className="size-3.5" />
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`px-2 py-1 rounded-md flex items-center gap-1.5 transition-all ${
          theme === 'dark'
            ? 'bg-background text-foreground shadow-xs font-medium'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Dark theme"
      >
        <Moon className="size-3.5" />
        <span className="hidden sm:inline">Dark</span>
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`px-2 py-1 rounded-md flex items-center gap-1.5 transition-all ${
          theme === 'system'
            ? 'bg-background text-foreground shadow-xs font-medium'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="System theme"
      >
        <Laptop className="size-3.5" />
        <span className="hidden sm:inline">Auto</span>
      </button>
    </div>
  );
}
