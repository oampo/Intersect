// Shim for requestAnimationFrame
window.requestAnimationFrame = (function() {
    return window.requestAnimationFrame ||
           window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame ||
           window.oRequestAnimationFrame ||
           window.msRequestAnimationFrame ||
           function(/* function */ callback, /* DOMElement */ element) {
               window.setTimeout(callback, 1000 / 60);
           };
})();

window.Colors = {
    white: '#EEEEEC',
    black: '#2E3436',
    red: '#CC0000',
    orange: '#F57900'
};

var PentatonicScale = function() {
    Scale.call(this, [0, 2, 4, 7, 9]);
};
extend(PentatonicScale, Scale);

var KarplusStrong = function(audiolet, frequency) {
    AudioletNode.call(this, audiolet, 0, 1);
    this.frequency = frequency;
    this.lastValue = 0;
    var sampleRate = this.audiolet.device.sampleRate;
    this.buffer = new Float32Array(Math.floor(sampleRate / this.frequency));
    for (var i=0; i<this.buffer.length; i++) {
        this.buffer[i] = Math.random() * 2 - 1;
    }
    this.index = 0;
};
extend(KarplusStrong, AudioletNode);

KarplusStrong.prototype.generate = function(inputBuffers, outputBuffers) {
    var buffer = outputBuffers[0];
    var channel = buffer.getChannelData(0);

    var delayBuffer = this.buffer;
    var delayLength = delayBuffer.length;
    var index = this.index;

    // Processing loop
    var bufferLength = buffer.length;
    for (var i = 0; i < bufferLength; i++) {
        var value = delayBuffer[index];
        channel[i] = value;

        var newIndex = index + 1;
        if (newIndex == delayLength) {
            newIndex = 0;
        }

        // 0.4975 = 0.995 * 0.5
        var average = 0.4975 * (value + delayBuffer[newIndex]);
        delayBuffer[newIndex] = average;
        index = newIndex;
    }
    this.index = index;
};


var Synth = function(audiolet, frequency, pan) {
    AudioletGroup.call(this, audiolet, 0, 1);
    var ks = new KarplusStrong(audiolet, frequency);

    var env = new PercussiveEnvelope(audiolet, 1, 0.2, 0.5, function() {
        this.audiolet.scheduler.addRelative(0, this.remove.bind(this));
    }.bind(this));

    var mul = new Multiply(audiolet, 1);
    var gain = new Gain(audiolet);

    env.connect(mul);
    mul.connect(gain, 0, 1);
    ks.connect(gain);
    gain.connect(this.outputs[0]);
};
extend(Synth, AudioletGroup);

var Intersect = function() { 
    this.bpm = 240;

    this.audiolet = new Audiolet();
    this.audiolet.scheduler.setTempo(this.bpm);
    this.reverb = new Reverb(this.audiolet);
    this.limiter = new Limiter(this.audiolet);
    this.reverb.connect(this.limiter);
    this.limiter.connect(this.audiolet.output);

    this.width = 450;
    this.height = 450;
    this.canvasWidth = this.width;
    this.canvasHeight = this.height;
    this.canvasCenterX = this.canvasWidth / 2;
    this.canvasCenterY = this.canvasHeight / 2;

    this.socket = io.connect('http://localhost');
    this.socket.on('connect', this.onConnect.bind(this));
    this.socket.on('disconnect', this.onDisconnect.bind(this));
    this.socket.on('addPoint', this.onAddPoint.bind(this));

    this.gridSize = 16;
    this.gridDiagonal = Math.ceil(Math.sqrt(2 * Math.pow(this.gridSize, 2)));
    this.buttonWidth = this.width / this.gridSize;
    this.buttonHeight = this.height / this.gridSize;

    this.points = [];
    this.grid = [];
    for (var i=0; i<this.gridSize; i++) {
        this.grid.push([]);
        for (var j=0; j<this.gridSize; j++) {
            this.grid[i].push(null);
        }
    };

    this.canvas = document.getElementById('canvas');
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.context = this.canvas.getContext('2d');
    this.context.strokeStyle = "#000000";

    this.scale = new PentatonicScale();
    this.baseFrequency = 16.352;

    this.color = {h: Math.random(), s: 1, l: 0.5};

    var links = ['about-link', 'tips-link'];
    for (var i=0; i<links.length; i++) {
        var link = links[i];
        var linkElement = document.getElementById(link);
        linkElement.onmouseover = function() {
            var name = this.id.split("-link")[0];
            var infoElement = document.getElementById(name);
            infoElement.style.display = 'inline';
        }

        linkElement.onmouseout = function() {
            var name = this.id.split("-link")[0];
            var infoElement = document.getElementById(name);
            infoElement.style.display = 'none';
        }
    }
};

Intersect.prototype.onConnect = function(data) {
    this.canvas.onmousedown = this.onMouseDown.bind(this);
    setInterval(this.update.bind(this), 60000 / this.bpm);
    requestAnimationFrame(this.draw.bind(this));
};

Intersect.prototype.onDisconnect = function(data) {
};

Intersect.prototype.onAddPoint = function(data) {
    this.addPoint(data.position.x, data.position.y, data.color);
};

Intersect.prototype.onMouseDown = function(event) {
    var left = 0;
    var element = this.canvas;
    if (element.offsetParent) {
        while (1) {
            left += element.offsetLeft;
            if (!element.offsetParent) {
                break;
            }
            element = element.offsetParent;
        }
    }
    else if (element.x) {
        left += element.x;
    }

    var top = 0;
    var element = this.canvas;
    if(element.offsetParent) {
        while(1) {
            top += element.offsetTop;
            if (!element.offsetParent) {
                break;
            }
            element = element.offsetParent;
        }
    }
    else if (element.y) {
        top += element.y;
    }

    var left = event.pageX - left;
    var top = event.pageY - top;

    this.color.h = Math.random();
    
    this.addPoint(Math.floor(left * this.gridSize / this.width),
                  Math.floor(top * this.gridSize / this.height),
                  {h: this.color.h, s: this.color.s, l: this.color.l}, true);
};

Intersect.prototype.update = function() {
    for (var i=0; i<this.gridSize; i++) {   
        for (var j=0; j<this.gridSize; j++) {
            this.setOff(i, j);
        }
    }

    for (var i=0; i<this.points.length; i++) {
        // Count backwards as we are removing points
        var index = this.points.length - i - 1;
        var point = this.points[index];
        point.radius += 1;

        if (point.radius == this.gridDiagonal) {
            this.points.splice(index, 1);
            continue;
        }
        
        // Midpoint circle algorithm from
        // http://en.wikipedia.org/wiki/Midpoint_circle_algorithm
        var radius = point.radius;
        var f = 1 - radius;
        var ddF_x = 1;
        var ddF_y = -2 * radius;
        var x = 0;
        var y = radius;
        var x0 = point.center.x;
        var y0 = point.center.y;
 
        this.setOn(x0, y0 + radius, point.color);
        this.setOn(x0, y0 - radius, point.color);
        this.setOn(x0 + radius, y0, point.color);
        this.setOn(x0 - radius, y0, point.color);
 
        while (x < y) {
            if (f >= 0) {
                y--;
                ddF_y += 2;
                f += ddF_y;
            }
            x++;
            ddF_x += 2;
            f += ddF_x;    
            this.setOn(x0 + x, y0 + y, point.color);
            this.setOn(x0 - x, y0 + y, point.color);
            this.setOn(x0 + x, y0 - y, point.color);
            this.setOn(x0 - x, y0 - y, point.color);
            this.setOn(x0 + y, y0 + x, point.color);
            this.setOn(x0 - y, y0 + x, point.color);
            this.setOn(x0 + y, y0 - x, point.color);
            this.setOn(x0 - y, y0 - x, point.color);
        }
    }
};

Intersect.prototype.draw = function() {
    this.context.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
    for (var i=0; i<this.gridSize; i++) {   
        for (var j=0; j<this.gridSize; j++) {
            var color = this.grid[i][j];
            this.roundedRect(i * this.buttonWidth,
                             j * this.buttonHeight,
                             this.buttonWidth,
                             this.buttonHeight, 10);
            if (color) {
                this.context.fillStyle = "hsl(" + color.h * 360 + ", " +
                                                  color.s * 100 + "%, " +
                                                  color.l * 100 + "%)";
                this.context.fill();
            }
            this.context.stroke();
        }
    }
    requestAnimationFrame(this.draw.bind(this));
};

Intersect.prototype.setOn = function(i, j, color) {
    if (i >= 0 && i < this.gridSize &&
        j >= 0 && j < this.gridSize) {
        var currentColor = this.grid[i][j];
        if (currentColor != null && (currentColor.h != color.h ||
                                     currentColor.s != color.s ||
                                     currentColor.l != color.l)) {
            this.grid[i][j].h = (color.h + currentColor.h) / 2;
            this.grid[i][j].s = (color.s + currentColor.s) / 2;
            this.grid[i][j].l = (color.l + currentColor.l) / 2;
            this.playNote(i, j);
        }
        else {
            this.grid[i][j] = {h: color.h, s: color.s, l: color.l};
        }
    }
};

Intersect.prototype.setOff = function(i, j) {
    if (i >= 0 && i < this.gridSize &&
        j >= 0 && j < this.gridSize) {
        this.grid[i][j] = null;
    }
};

Intersect.prototype.addPoint = function(x, y, color, emit) {
    this.points.push({center: {x: x, y: y}, radius: -1,
                      color: color});
    this.setOn(x, y, color);
    this.playNote(x, y);
    if (emit) {
        this.socket.emit('addPoint', {position: {x: x, y: y}, color: color});
    }
};

Intersect.prototype.roundedRect = function(x, y, w, h, r) {
  this.context.beginPath();
  this.context.moveTo(x + r, y);
  this.context.arcTo(x + w, y, x + w, y + h, r);
  this.context.arcTo(x + w, y + h, x, y + h, r);
  this.context.arcTo(x, y + h, x, y, r);
  this.context.arcTo(x, y, x + w, y, r);
  this.context.closePath();
};

Intersect.prototype.playNote = function(x, y) {
    var frequency = this.scale.getFrequency(this.gridSize - y - 1,
                                            this.baseFrequency, 3);
    var pan = x / (this.gridSize - 1);
    this.audiolet.scheduler.addAbsolute(this.audiolet.scheduler.beat + 1,
        function(frequency, pan) {
            var synth = new Synth(this.audiolet, frequency, pan);
            synth.connect(this.reverb);
        }.bind(this, frequency, pan)
    );
};

window.onload = function() {
    this.intersect = new Intersect();
};
