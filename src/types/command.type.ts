export interface CommandPaletteAction {
  id: string;
  title: string;
  description: string;
  shortcut?: string;
  keywords: string[];
  run: () => void;
}
