
var Bridge = require('./Bridge');

var ActionBridge = function() {
    Bridge.apply(this, arguments);
    this.name = "action-bridge";
};

require('util').inherits(ActionBridge, Bridge);


ActionBridge.prototype.getFromTopic = function() {
    return this.config.stomp.topicActionFrom;
};

ActionBridge.prototype.handleResponse = function(attr) {

    this.logger.debug("Sending action updates");

    var urlparts = attr.request.meta.url.split("/");

    var soId = urlparts[1];
//    var authToken = attr.request.meta.authorization.replace("Bearer ", "");

    var data = JSON.stringify(attr.data);
    var headers = attr.headers;
    var headers = {};

    var topic = '/topic/' + soId + ".actions";
    this.logger.debug("Publish to action topic: " + topic);
    this.publish(topic, data, headers);

};

module.exports = ActionBridge;