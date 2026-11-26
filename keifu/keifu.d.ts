/* keifu （系譜） — type definitions for keifu.js / keifu.mjs (v0.5) */

export interface KeifuNode {
  id: string;
  label: string;
  kind?: string;
  group?: string;
  /** Day index for the lineage timeline (0-based). */
  day?: number;
  meta?: { role?: string; note?: string; [key: string]: unknown };
  /** Rendered as a ghost (kept in the lineage, not deleted). */
  superseded?: boolean;
}

export interface KeifuEdge {
  from: string;
  to: string;
  qty?: number;
  label?: string;
  /** "derive" renders dashed (lineage derivation). */
  type?: string;
  day?: number;
}

export interface KeifuEvent {
  day: number;
  text: string;
  node?: string;
}

export interface KeifuData {
  nodes: KeifuNode[];
  edges: KeifuEdge[];
  events?: KeifuEvent[];
  /** Labels for day indices, used by the timeline. */
  dates?: string[];
}

export interface KeifuNodeStyle {
  color?: string;
  radius?: number;
  shape?: "circle" | "rect" | "diamond";
}

export interface KeifuDerivedItem {
  node: KeifuNode;
  qty?: number;
  edge: KeifuEdge;
}

export interface KeifuDerived {
  children: KeifuDerivedItem[];
  parents: KeifuDerivedItem[];
}

export interface KeifuRenderHelpers {
  color: string;
  radius: number;
  svgNS: string;
}

export type KeifuView = "graph" | "cards" | "tree";
export type KeifuLayout = "force" | "hierarchy" | "timeline";
export type KeifuTone = "std" | "dark" | "mono";

export interface KeifuOptions {
  view?: KeifuView;
  layout?: KeifuLayout;
  tone?: KeifuTone;
  strings?: Partial<{
    graph: string; cards: string; tree: string; fit: string;
    composition: string; whereUsed: string;
    shared: string; superseded: string; play: string; pause: string;
  }>;
  colors?: Record<string, string>;
  nodeStyle?: Record<string, KeifuNodeStyle>;
  renderNode?: (node: KeifuNode, helpers: KeifuRenderHelpers) => SVGElement | null;
  renderDetail?: (node: KeifuNode, derived: KeifuDerived) => string | Element | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  onDragEnd?: (id: string) => void;
  onViewChange?: (view: KeifuView) => void;
  onDayChange?: (day: number) => void;
}

export interface KeifuHandle {
  /** Replace the data; positions of surviving nodes are kept. */
  setData(data: KeifuData): void;
  select(id: string): void;
  /** Select and centre the view on the node, expanding collapsed ancestors. */
  focus(id: string): void;
  /** Neighbour emphasis for a node (null clears). */
  highlight(id: string | null): void;
  /** Show only nodes passing the predicate (null clears). */
  filter(fn: ((node: KeifuNode) => boolean) | null): void;
  expand(id: string): void;
  collapse(id: string): void;
  /** Reset the viewport to show the whole graph. */
  fit(): void;
  setLayout(name: KeifuLayout): void;
  setTone(name: KeifuTone): void;
  /** Serialized SVG of the current graph view, or null outside the graph view. */
  exportSVG(): string | null;
  destroy(): void;
}

export declare function mount(el: HTMLElement, data: KeifuData, opts?: KeifuOptions): KeifuHandle;
export declare const version: string;
