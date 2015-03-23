
var Bridge = require('./Bridge');

var StreamBridge = function() {
    Bridge.apply(this, arguments);
    this.name = "stream-bridge";
};

require('util').inherits(StreamBridge, Bridge);

StreamBridge.prototype.handleResponse = function(attr) {

    this.logger.debug("Sending stream updates");

    var urlparts = attr.request.meta.url.split("/");

    var soId = urlparts[1];
    var streamName = urlparts[3] || null;

    var authToken = attr.request.meta.authorization;

    var data = JSON.stringify(attr.data);
    var headers = attr.headers;
    var headers = {};

    var topic = '/topic/' + authToken + ".to";
    this.logger.debug("Publish to " + topic);
    this.publish(topic, data, headers);

    topic += "." + soId;
    this.logger.debug("Publish to " + topic);
    this.publish(topic, data, headers);

    if(streamName) {

        topic += "." + streamName;
        this.logger.debug("Publish to " + topic);
        this.publish(topic, data, headers);
    }

};

module.exports = StreamBridge;