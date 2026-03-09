export interface GraphNode {
  id: string;
  title: string;
  url: string;
  tags: string[];
  group: string;
  size: number;
  isOrphan: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'link' | 'embed';
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  tagColors: Record<string, string>;
}
