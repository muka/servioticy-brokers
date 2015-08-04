
var Bridge = require('./lib/Bridge');

var instance;

module.exports.start = function(config, then) {

    if(instance) {
        then && then(instance)
        return
    }

    instance = new Bridge(config || {})
    instance.start(function() {
        then && then(instance)
    });
}

module.exports.stop = function() {
    if(!instance) return
    instance.stop();
    instance = null
}
