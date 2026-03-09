class GraphView {
  constructor(containerId, graphData, options = {}) {
    this.container = d3.select(`#${containerId}`);
    this.graphData = graphData;
    this.filteredData = {
      nodes: [...graphData.nodes],
      edges: [...graphData.edges]
    };

    this.options = {
      width: options.width || window.innerWidth,
      height: options.height || 600,
      nodeRadius: options.nodeRadius || 5,
      linkDistance: options.linkDistance || 80,
      charge: options.charge || -300,
      ...options
    };

    this.svg = null;
    this.simulation = null;
    this.g = null;
    this.tooltip = null;
  }

  initialize() {
    this.createSVG();
    this.createTooltip();
    this.createSimulation();
    this.render();
    this.setupZoom();
    this.createLegend();
  }

  createSVG() {
    this.svg = this.container
      .append('svg')
      .attr('width', this.options.width)
      .attr('height', this.options.height)
      .attr('viewBox', `0 0 ${this.options.width} ${this.options.height}`)
      .style('width', '100%')
      .style('height', '100%');

    this.g = this.svg.append('g');
  }

  createTooltip() {
    this.tooltip = d3.select('body')
      .append('div')
      .attr('class', 'graph-tooltip')
      .style('position', 'absolute')
      .style('opacity', 0);
  }

  createSimulation() {
    this.simulation = d3.forceSimulation(this.filteredData.nodes)
      .force('link', d3.forceLink(this.filteredData.edges)
        .id(d => d.id)
        .distance(this.options.linkDistance))
      .force('charge', d3.forceManyBody()
        .strength(this.options.charge))
      .force('center', d3.forceCenter(
        this.options.width / 2,
        this.options.height / 2
      ))
      .force('collision', d3.forceCollide()
        .radius(d => d.size + 2));
  }

  render() {
    this.g.selectAll('*').remove();

    const link = this.g.append('g')
      .selectAll('line')
      .data(this.filteredData.edges)
      .join('line')
      .attr('class', d => `graph-link ${d.type}`)
      .attr('stroke-width', 1.5);

    const node = this.g.append('g')
      .selectAll('circle')
      .data(this.filteredData.nodes)
      .join('circle')
      .attr('class', d => `graph-node ${d.isOrphan ? 'orphan' : ''}`)
      .attr('r', d => d.size)
      .attr('fill', d => this.graphData.tagColors[d.group] || '#6b7280')
      .call(this.drag(this.simulation))
      .on('click', (event, d) => {
        window.location.href = d.url;
      })
      .on('mouseover', (event, d) => this.showTooltip(event, d))
      .on('mouseout', () => this.hideTooltip());

    this.simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
    });
  }

  drag(simulation) {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }

  setupZoom() {
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        this.g.attr('transform', event.transform);
      });

    this.svg.call(zoom);
  }

  showTooltip(event, d) {
    const tagsHtml = d.tags.length > 0
      ? d.tags.map(tag => `<span class="tooltip-tag">${tag}</span>`).join(' ')
      : '<span class="tooltip-tag">no tags</span>';

    this.tooltip
      .style('opacity', 1)
      .html(`
        <h4>${d.title}</h4>
        <div class="tooltip-tags">${tagsHtml}</div>
        <div style="margin-top: 4px; font-size: 10px; color: var(--color-text-secondary);">
          ${d.isOrphan ? 'Orphan node (no links)' : 'Click to open'}
        </div>
      `)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 10) + 'px');

    this.tooltip.classed('visible', true);
  }

  hideTooltip() {
    this.tooltip
      .style('opacity', 0)
      .classed('visible', false);
  }

  filter(searchTerm = '', tagFilter = '', showOrphansOnly = false) {
    let filtered = [...this.graphData.nodes];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(node =>
        node.title.toLowerCase().includes(term) ||
        node.tags.some(tag => tag.toLowerCase().includes(term))
      );
    }

    if (tagFilter) {
      filtered = filtered.filter(node => node.tags.includes(tagFilter));
    }

    if (showOrphansOnly) {
      filtered = filtered.filter(node => node.isOrphan);
    }

    const nodeIds = new Set(filtered.map(n => n.id));
    const filteredEdges = this.graphData.edges.filter(edge =>
      nodeIds.has(edge.source.id || edge.source) &&
      nodeIds.has(edge.target.id || edge.target)
    );

    this.filteredData = {
      nodes: filtered,
      edges: filteredEdges
    };

    this.simulation.nodes(this.filteredData.nodes);
    this.simulation.force('link').links(this.filteredData.edges);
    this.simulation.alpha(1).restart();

    this.render();
  }

  reset() {
    this.filter('', '', false);

    const transform = d3.zoomIdentity;
    this.svg.transition().duration(750).call(
      d3.zoom().transform,
      transform
    );
  }

  createLegend() {
    const legend = d3.select('#graph-legend');
    legend.html('');

    legend.append('h4')
      .style('margin', '0 0 8px 0')
      .style('font-size', '14px')
      .text('Tags');

    const items = Object.entries(this.graphData.tagColors);

    items.forEach(([tag, color]) => {
      const item = legend.append('div')
        .attr('class', 'legend-item');

      item.append('div')
        .attr('class', 'legend-color')
        .style('background-color', color);

      item.append('span').text(tag);
    });
  }

  populateTagFilter() {
    const tagFilter = document.getElementById('tag-filter');
    const tags = Object.keys(this.graphData.tagColors)
      .filter(tag => tag !== 'untagged')
      .sort();

    tags.forEach(tag => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      tagFilter.appendChild(option);
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const graphDataElement = document.getElementById('graph-data');
  if (!graphDataElement) {
    console.error('Graph data not found');
    return;
  }

  const graphData = JSON.parse(graphDataElement.textContent);

  const containerEl = document.getElementById('graph-container');
  const containerWidth = containerEl ? (containerEl.clientWidth || containerEl.offsetWidth) : window.innerWidth;

  const graphView = new GraphView('graph-container', graphData, {
    width: containerWidth,
    height: Math.max(600, window.innerHeight * 0.7)
  });

  graphView.initialize();
  graphView.populateTagFilter();

  window.graphView = graphView;

  const searchInput = document.getElementById('search-input');
  const tagFilter = document.getElementById('tag-filter');
  const showOrphansCheckbox = document.getElementById('show-orphans-only');
  const resetButton = document.getElementById('reset-graph');

  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      graphView.filter(
        e.target.value,
        tagFilter.value,
        showOrphansCheckbox.checked
      );
    }, 300);
  });

  tagFilter.addEventListener('change', (e) => {
    graphView.filter(
      searchInput.value,
      e.target.value,
      showOrphansCheckbox.checked
    );
  });

  showOrphansCheckbox.addEventListener('change', (e) => {
    graphView.filter(
      searchInput.value,
      tagFilter.value,
      e.target.checked
    );
  });

  resetButton.addEventListener('click', () => {
    searchInput.value = '';
    tagFilter.value = '';
    showOrphansCheckbox.checked = false;
    graphView.reset();
  });

  window.addEventListener('resize', () => {
    const resizeContainer = document.getElementById('graph-container');
    const newWidth = resizeContainer ? (resizeContainer.clientWidth || resizeContainer.offsetWidth) : window.innerWidth;
    const newHeight = Math.max(600, window.innerHeight * 0.7);

    graphView.options.width = newWidth;
    graphView.options.height = newHeight;

    graphView.svg
      .attr('width', newWidth)
      .attr('height', newHeight)
      .attr('viewBox', `0 0 ${newWidth} ${newHeight}`);

    graphView.simulation
      .force('center', d3.forceCenter(newWidth / 2, newHeight / 2))
      .alpha(0.3)
      .restart();
  });
});
