import * as React from 'react';
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Palette, Settings, Monitor, Sun, Moon } from 'lucide-react';
import { useSettingsStore, type Theme } from '@/stores/settings';

type SettingsCategory = 'appearance';

const categories: Array<{ id: SettingsCategory; icon: React.ElementType; label: string }> = [
  { id: 'appearance', icon: Palette, label: '外观' },
];

interface SettingsDialogProps {
  trigger?: React.ReactElement;
}

export function SettingsDialog({ trigger }: SettingsDialogProps) {
  const [activeCategory, setActiveCategory] = React.useState<SettingsCategory>('appearance');

  return (
    <Dialog>
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
          )
        }
      />
      <DialogPopup className="sm:max-w-2xl" showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>设置</DialogTitle>
          <DialogDescription>自定义你的应用体验</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[400px] border-t">
          {/* Left: Category List */}
          <nav className="w-48 shrink-0 border-r p-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                  activeCategory === category.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                )}
              >
                <category.icon className="h-4 w-4" />
                {category.label}
              </button>
            ))}
          </nav>

          {/* Right: Settings Panel */}
          <div className="flex-1 p-6">
            {activeCategory === 'appearance' && <AppearanceSettings />}
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useSettingsStore();

  const themeOptions: Array<{ value: Theme; icon: React.ElementType; label: string; description: string }> = [
    { value: 'light', icon: Sun, label: '浅色', description: '明亮的界面主题' },
    { value: 'dark', icon: Moon, label: '深色', description: '护眼的暗色主题' },
    { value: 'system', icon: Monitor, label: '跟随系统', description: '自动适配系统主题' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">主题</h3>
        <p className="text-sm text-muted-foreground">选择你喜欢的界面主题</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {themeOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
              theme === option.value
                ? 'border-primary bg-accent'
                : 'border-transparent bg-muted/50 hover:bg-muted'
            )}
          >
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full',
                theme === option.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}
            >
              <option.icon className="h-6 w-6" />
            </div>
            <span className="font-medium">{option.label}</span>
            <span className="text-xs text-muted-foreground text-center">{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
