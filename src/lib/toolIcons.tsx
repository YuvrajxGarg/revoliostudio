import {
  Activity,
  AudioLines,
  Bot,
  Box,
  Camera,
  Clapperboard,
  Contact,
  Crop,
  FolderKanban,
  Grid3x3,
  Home,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Library,
  Maximize2,
  Package,
  PenTool,
  SlidersHorizontal,
  Sticker,
  Sun,
  Type,
  UserRound,
  Wand2,
  SquarePlay,
  Workflow,
  Zap,
} from "lucide-react";

/**
 * Single source of truth mapping the `icon` string on a `ToolEntry` (see
 * lib/tools.ts) to its actual lucide-react component. Shared by every place
 * that renders a tool from the registry (sidebar, tool drawer, command
 * palette) so a newly added tool's icon only ever needs registering once.
 */
export const TOOL_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Image: ImageIcon,
  Images,
  Clapperboard,
  AudioLines,
  Box,
  Type,
  LayoutTemplate,
  Home,
  Library,
  FolderKanban,
  LayoutGrid,
  Activity,
  UserRound,
  Contact,
  PenTool,
  Wand2,
  Package,
  Crop,
  Maximize2,
  Sticker,
  Sun,
  Camera,
  Zap,
  Bot,
  SquarePlay,
  Workflow,
  SlidersHorizontal,
};

export function resolveToolIcon(name: string): React.ComponentType<{ className?: string }> {
  return TOOL_ICON_MAP[name] ?? Grid3x3;
}
