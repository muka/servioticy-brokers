
var start = function(config) {

    var Bridge = require('./lib/Bridge');
    (new Bridge(config)).start(function() {
        console.info("Bridge started");
    });

};

start();

process.on('uncaughtException', function (err) {

    console.error("Uncaught exception detected, exit bridge")
    console.error((new Date).toUTCString() + ' uncaughtException:', err.message)
    console.error(err.stack);

    process.exit(1);
});