var static = require('node-static');
var http = require('http');
var socket = require('socket.io');

var port = process.env.PORT || 3000;

var file = new static.Server('./public');

var userCount = 0;

var app = http.createServer(function (request, response) {
    request.addListener('end', function () {
        file.serve(request, response);
    });
});

var io = socket.listen(app);
app.listen(port);

io.sockets.on('connection', function (socket) {
    userCount += 1;
    socket.emit('userCount', {'count': userCount});
    socket.broadcast.emit('userCount', {'count': userCount});
    socket.on('addPoint', function(data) {
        socket.broadcast.emit('addPoint', {'position': data.position,
                                           'color': data.color});
    });

    socket.on('disconnect', function(data) {
        userCount -= 1;
        socket.broadcast.emit('userCount', {'count': userCount});
    });
});
