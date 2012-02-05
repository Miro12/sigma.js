function Sigma(root, id) {
  sigma.classes.Cascade.call(this);
  this.id = id;

  this.p = {
    auto: true,
    displayEdges: true,
    displayNodes: true,
    displayLabels: true,
    font: 'Calibri,Geneva,Arial'
  };

  this.dom = root;
  this.width = this.dom.offsetWidth;
  this.height = this.dom.offsetHeight;

  this.canvas = {};
  this.initCanvas('edges');
  this.initCanvas('nodes');
  this.initCanvas('labels');
  this.initCanvas('mouse');

  // Intern classes:
  this.graph = new sigma.classes.Graph();
  this.plotter = new Plotter(
    this.canvas.nodes.getContext('2d'),
    this.canvas.edges.getContext('2d'),
    this.canvas.labels.getContext('2d'),
    this.graph,
    this.width,
    this.height
  );
  this.mousecaptor = new MouseCaptor(
    this.canvas.mouse,
    this.graph,
    this.id
  );
  this.forceatlas2 = new forceatlas2.ForceAtlas2(
    this.graph
  );

  // Interaction listeners:
  var self = this;
  this.mousecaptor.addListener('drag zooming', function(e) {
    self.draw(2, 0, 2);
  }).addListener('stopdrag stopzooming', function(e) {
    self.draw(2, 1, 2);
  });

  // Specific methods:
  this.onWorkerKilled = function(e) {
    if (e.content.name == 'draw_' + self.id) {
      sigma.scheduler.removeListener('killed', self.onWorkerKilled);
      self.computeOneStep();
    }
  };

  this.computeOneStep = function() {
    sigma.scheduler.addWorker(
      self.forceatlas2.atomicGo,
      'layout_' + self.id,
      false
    ).queueWorker(
      function() {
        self.draw(2, 0, 2);
        return false;
      },
      'draw_' + self.id,
      'layout_' + self.id
    ).addListener(
      'killed',
      self.onWorkerKilled
    ).start();
  };
}

Sigma.prototype.resize = function() {
  this.width = this.dom.offsetWidth;
  this.height = this.dom.offsetHeight;

  for (var k in this.canvas) {
    this.canvas[k].setAttribute('width', this.width + 'px');
    this.canvas[k].setAttribute('height', this.height + 'px');
  }

  this.draw(2, 1, 2);
};

Sigma.prototype.clearSchedule = function() {
  var self = this;
  sigma.scheduler.removeWorker(
    'node_' + self.id, 2
  ).removeWorker(
    'edge_' + self.id, 2
  ).removeWorker(
    'label_' + self.id, 2
  ).stop();
};

Sigma.prototype.initCanvas = function(type) {
  this.canvas[type] = document.createElement('canvas');
  this.canvas[type].style.position = 'absolute';
  this.canvas[type].setAttribute('id', 'sigma_' + type + '_' + this.id);
  this.canvas[type].setAttribute('class', 'sigma_' + type + '_canvas');
  this.canvas[type].setAttribute('width', this.width + 'px');
  this.canvas[type].setAttribute('height', this.height + 'px');

  this.dom.appendChild(this.canvas[type]);
};

Sigma.prototype.startLayout = function() {
  this.stopLayout();
  this.forceatlas2.init();
  this.computeOneStep();
};

Sigma.prototype.stopLayout = function() {
  sigma.scheduler.removeWorker(
    'draw_' + this.id, 2
  ).removeWorker(
    'layout_' + this.id, 2
  ).addListener(
    'killed',
    this.onWorkerKilled
  );
};

// nodes, edges, labels:
// - 0: Don't display them
// - 1: Display them (asynchronous)
// - 2: Display them (synchronous)
Sigma.prototype.draw = function(nodes, edges, labels) {
  var self = this;

  // Remove workers:
  this.clearSchedule();

  // Rescale graph:
  this.graph.rescale(this.width, this.height);
  this.graph.translate(
    this.mousecaptor.stageX,
    this.mousecaptor.stageY,
    this.mousecaptor.ratio
  );

  // Clear scene:
  for (var k in this.canvas) {
    this.canvas[k].width = this.canvas[k].width;
  }

  this.plotter.currentEdgeIndex = 0;
  this.plotter.currentNodeIndex = 0;
  this.plotter.currentLabelIndex = 0;

  var previous = null;
  var start = false;

  if(nodes){
    if(nodes>1){
      // TODO: Make this better
      while (this.plotter.worker_drawNode()) {}
    }else{
      sigma.scheduler.addWorker(
        this.plotter.worker_drawNode,
        'node_' + self.id,
        false
      );

      start = true;
      previous = 'node_' + self.id;
    }
  }

  if(labels){
    if(labels>1){
      // TODO: Make this better
      while (this.plotter.worker_drawLabel()) {}
    }else{
      if(previous){
        sigma.scheduler.queueWorker(
          this.plotter.worker_drawLabel,
          'label_' + self.id,
          previous
        );
      }else{
        sigma.scheduler.addWorker(
          this.plotter.worker_drawLabel,
          'label_' + self.id,
          false
        );
      }

      start = true;
      previous = 'label_' + self.id;
    }
  }

  if(edges){
    if(edges>1){
      // TODO: Make this better
      while (this.plotter.worker_drawEdge()) {}
    }else{
      if(previous){
        sigma.scheduler.queueWorker(
          this.plotter.worker_drawEdge,
          'edge_' + self.id,
          previous
        );
      }else{
        sigma.scheduler.addWorker(
          this.plotter.worker_drawEdge,
          'edge_' + self.id,
          false
        );
      }

      start = true;
      previous = 'edge_' + self.id;
    }
  }

  start && sigma.scheduler.start();
};

Sigma.prototype.getGraph = function() {
  return this.graph;
};
