var Stomp = require('stompjs');
var api = require('restler');
 
// Use raw TCP sockets
var client = Stomp.overTCP('api.servioticy.com', 1883);
// uncomment to print out the STOMP frames
//client.debug = console.log;
 
client.connect('compose', 'shines', function(frame) {
    client.subscribe('/topic/*.from', function(message) {
 
        var request = JSON.parse(message.body);
        console.log("Going for a " + request.meta.method);
        console.log("Posted data " + JSON.stringify(request.body));
        api.json("http://api.servioticy.com" + request.meta.url,
                request.body,
                {headers: {'Content-Type': 'application/json', 'Authorization': request.meta.authorization}},
                request.meta.method
        ).on('complete', function(data, response) {
             // send back the identifier if any, allowing the requesting client to match the response        
           console.log("input message id: "+request.meta.messageId);
           response={meta: {}, body:{}};
           response.meta.messageId = request.meta.messageId || null;
           response.body = data;
           console.log("sending: "+JSON.stringify(response));
           client.send('/topic/'+request.meta.authorization+".to",{},JSON.stringify(response));
        });
    });
});

process.on('uncaughtException', function (err) {
    console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
    console.error(err.stack)
    process.exit(1)
})
