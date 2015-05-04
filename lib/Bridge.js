
var Stomp = require('stompjs');
var api = require('restler');
var url = require('url');
var winston = require('winston');

var Bridge = function(config) {

    if(!config) {
        try {
            config = require('../config.json');
        }
        catch(e) {
            console.error(e);
            throw new Error("Ensure config.json exists and is parsable");
        }
    }

    this.name = "bridge";

    this.config = config;
    this.client = null;

    this.setup();
};

Bridge.prototype.setup = function() {

    this.config.debug = process.env.DEBUG ? true : false;

    this.config.logFile = this.config.logFile || 'logs/'+this.name+'.log';
    this.config.logLevel = this.config.logLevel || "info";
    this.config.consoleLogLevel = this.config.consoleLogLevel || "debug";

    this.config.stomp.user = this.config.stomp.user || 'compose';
    this.config.stomp.password = this.config.stomp.password || 'shines';

    this.config.stomp.topicFrom = this.config.stomp.topicFrom || '/topic/*.from';

    this.logger = new (winston.Logger)();
    this.logger.cli();

    this.logger.add(winston.transports.File, {
        filename: this.config.logFile,
        level: this.config.logLevel
    });

    if (this.config.debug) {
        this.logger.add(winston.transports.Console, {
            level: this.config.consoleLogLevel
        });
    }

    this.logger.debug("Setup completed");
};

Bridge.prototype.stop = function(then) {
    this.disconnect(function() {
        then && then();
    });
};

Bridge.prototype.start = function(then) {
    var me = this;
    this.connect(function() {
        me.subscribe(then);
    });
};

Bridge.prototype.restart = function(then) {

    var me = this;

    this.restartCounter = this.restartCounter || 0;

    // if restart happens before timeout clear the counter
    // quit the program
    if(this.restartCounter > 5) {
        this.logger.error("Restarting too fast, stopping process");
        process.exit(1);
    }

    // reset counter
    setTimeout(function() {
        me.restartCounter = 0;
    }, 1000);

    // delay restart of some seconds in case of multiple failure
    setTimeout(function() {
        me.stop(function() {
            me.start(then);
        });
    }, (1500 * me.restartCounter));

    this.restartCounter++;
};

Bridge.prototype.disconnect = function(then) {

    var me = this;

    var _then = function() {

        me.logger.debug("Stomp disconnected");

        me.client = null;
        then && then();
    };

    try {

        try {
            this.client.unsubscribe(this.config.stomp.topicFrom);
        }
        catch(e) {
            me.logger.warn("Error unsubscribing from topic " + this.config.stomp.topicFrom);
            me.logger.warn(e);
        }

        this.client.disconnect(_then);
    }
    catch(e) {

        me.logger.error("Error on disconnection");
        me.logger.error(e);

        _then();
    }

};

Bridge.prototype.connect = function(then) {

    var me = this;

    this.logger.debug("Setup stomp connection");

    var urlInfo = url.parse(this.config.stomp.url);
    this.client = Stomp.overTCP(urlInfo.hostname, urlInfo.port);

    if(this.config.debug) {
        this.client.debug = this.logger.silly;
    }

    var _restart = function(e) {
        me.logger.error(e);
        me.restart();
    };

    try {
        this.client.connect('compose', 'shines', function (frame) {
            me.logger.debug("Connected");
            then && then();
        }, _restart);
    }
    catch(e) {
        _restart(e);
    }

};


Bridge.prototype.request = function(attr, then) {
    var me = this;

    api.json(attr.url, attr.body || null, attr.options || {}, attr.method || 'GET').on('complete', function (data, response) {

        if(data instanceof Error) {

            me.logger.error("Error occured during HTTP request");
            me.logger.error(data);

            then && then(data, null);

            return;
        }

        then && then(false, data, response);

    });
};

Bridge.prototype.publish = function(url, data, headers) {

    try {
        this.client.send(url, headers, JSON.stringify(data));
    }
    catch(e) {
        this.logger.error("Error sending Stomp message");
        this.logger.error(e);
    }

};

Bridge.prototype.handleResponse = function(attr) {

    var topic = '/topic/' + attr.authorization.replace('Bearer ') + ".to";

    this.logger.debug("response topic: %s", topic);
    this.logger.debug("sending: " + JSON.stringify(attr.message));

    this.publish(topic, attr.message, attr.headers);
};

Bridge.prototype.subscribe = function(then) {

    var me = this;

    this.logger.debug("Subscribing to %s", this.config.stomp.topicFrom);
    this.client.subscribe(this.config.stomp.topicFrom, function (message) {

        var request = JSON.parse(message.body);

        me.logger.silly("Handling request");
        me.logger.silly("Going for a " + request.meta.method);
        request.body && me.logger.debug("Posted data " + JSON.stringify(request.body));

        var token = 'Bearer ';
        token = (request.meta.authorization.substr(0, token.length) !== token)
                    ? token+request.meta.authorization : request.meta.authorization;

        var req = {
            method: request.meta.method,
            url: me.config.api + request.meta.url,
            body: request.body,
            options: {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                }
            }
        };

        me.request(req, function(err, data, response) {

            if(err) {
                me.logger.warn("Skipped subscription publishing due to HTTP error");
                return;
            }

            // send back the identifier if any, allowing the requesting client to match the response
            me.logger.silly("input messageId: " + request.meta.messageId);

            var messageId = request.meta.messageId  || null

            var headers = {
                messageId: messageId
            };

            var message = {
                meta: {
                    messageId: messageId
                },
                body: data
            };

            var attr = {

                authorization: request.meta.authorization,
                headers: headers,
                message: message,

                request: request,
                response: response,
                data: data
            };

            me.handleResponse(attr);
        });

    });

    then && then();

};

module.exports = Bridge;