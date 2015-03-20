
var Bridge = require('./Bridge');

var StreamBridge = function() {
    Bridge.apply(this, arguments);
    this.name = "stream-bridge";
};

require('util').inherits(StreamBridge, Bridge);

StreamBridge.prototype.handleResponse = function(attr) {

    this.logger.debug("Sending stream updates");

    var urlparts = attr.request.meta.url.split("/");

    var soId = urlparts[urlparts.length-3];
    var streamName = urlparts[urlparts.length-1];

    var authToken = attr.request.meta.authorization;

    var data = JSON.stringify(attr.data);

    var topic = '/topic/' + authToken + ".to";
    this.logger.debug("Publish to " + topic);
    this.publish(topic, data, attr.headers);

    topic += "." + soId;
    this.logger.debug("Publish to " + topic);
    this.publish(topic, data, attr.headers);

    topic += "." + streamName;
    this.logger.debug("Publish to " + topic);
    this.publish(topic, data, attr.headers);

};

module.exports = StreamBridge;