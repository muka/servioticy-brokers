
var host = 'localhost';
var http_port = '8080';


var Stomp = require('stompjs');
var api = require('restler');

// Use raw TCP sockets
var client = Stomp.overTCP(host, 1883);
// uncomment to print out the STOMP frames
//client.debug = console.log;

client.connect('compose', 'shines', function(frame) {
    client.subscribe('/topic/*.from', function(message) {

        var request = JSON.parse(message.body);
        console.log("Going for a " + request.meta.method);
        console.log("Posted data " + JSON.stringify(request.body));
        api.json("http://" + localhost + ( http_port ? ':'+http_port : '' ) + request.meta.url,
                request.body,
                {headers: {'Content-Type': 'application/json', 'Authorization': request.meta.authorization}},
                request.meta.method
        ).on('complete', function(data, response) {

            var headers = {};

            // send back the identifier if any, allowing the requesting client to match the response
            // keep in header to not pollute the response body
            if(typeof request.meta.messageId !== 'undefined') {
              headers.messageId = request.meta.messageId
            }

            var urlparts = request.meta.url.split("/");
            client.send('/topic/' + request.meta.authorization + ".to", headers, JSON.stringify(data));
            client.send('/topic/' + request.meta.authorization + ".to." + urlparts[urlparts.length-3], headers, JSON.stringify(data));
            client.send('/topic/' + request.meta.authorization + ".to." + urlparts[urlparts.length-3] + "." + urlparts[urlparts.length-1], headers, JSON.stringify(data));
            console.log("result: " + JSON.stringify(data));
        });
    });
});
