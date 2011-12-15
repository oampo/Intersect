var static = require('node-static');
var http = require('http');
var socket = require('socket.io');

var port = 80;

var file = new static.Server('./public');

var app = http.createServer(function (request, response) {
    request.addListener('end', function () {
        file.serve(request, response);
    });
});

var io = socket.listen(app);
app.listen(port);

io.sockets.on('connection', function (socket) {
    socket.on('newUser', function (data) {
        socket.broadcast.emit('newUser', data);
    });
    socket.on('userDisconnected', function(data) {
        socket.broadcast.emit('userDisconnected', data);
    });
    socket.on('addPoint', function(data) {
        socket.broadcast.emit('addPoint', {'position': data.position,
                                           'color': data.color});
    });
});

