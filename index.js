
var startBridge = function(config) {

    var Bridge = require('./lib/Bridge');
    (new Bridge(config)).start(function() {
        console.info("So bridge started");
    });

};


var startStreamBridge = function(config) {

    var Bridge = require('./lib/StreamBridge');

    (new Bridge(config)).start(function() {
        console.info("Stream bridge started");
    });
};

var startActionsBridge = function(config) {

    var Bridge = require('./lib/ActionBridge');

    (new Bridge(config)).start(function() {
        console.info("Action bridge started");
    });
};


var start = function() {
    startBridge();
//    startStreamBridge();
//    startActionsBridge();
};

start();

process.on('uncaughtException', function (err) {

    console.error("Uncaught exception detected, exit bridge")
    console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
    console.error(err.stack);

    process.exit(1);
});