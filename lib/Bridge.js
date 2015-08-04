var mqtt = require('mqtt');
var api = require('restler');
var url = require('url');
var winston = require('winston');
var _ = require('lodash');

var Bridge = function (config) {

    if(!config) {
        try {
            config = require('../config.json');
        } catch(e) {
            console.error(e);
            throw new Error("Ensure config.json exists and is parsable");
        }
    }

    this.name = "bridge";

    this.config = config;
    this.client = null;

    this.setup();
};

Bridge.prototype.setup = function () {

    this.config.debug = this.config.debug || process.env.DEBUG ? true : false;

    this.config.logFile = this.config.logFile || 'logs/' + this.name + '.log';
    this.config.logLevel = this.config.logLevel || "info";
    this.config.consoleLogLevel = this.config.consoleLogLevel || "debug";

    this.config.mqtt.user = this.config.mqtt.user || 'compose';
    this.config.mqtt.password = this.config.mqtt.password || 'shines';

    this.config.mqtt.topicFrom = this.config.mqtt.topicFrom || '#/from';

    this.logger = new(winston.Logger)();
    this.logger.cli();

    this.logger.add(winston.transports.File, {
        filename: this.config.logFile,
        level: this.config.logLevel
    });

    if(this.config.debug) {
        this.logger.add(winston.transports.Console, {
            level: this.config.consoleLogLevel
        });
    }

    this.logger.debug("Setup completed");
};

Bridge.prototype.stop = function (then) {
    this.disconnect(function () {
        then && then();
    });
};

Bridge.prototype.start = function (then) {
    var me = this;
    this.connect(function () {
        me.subscribe(then);
    });
};

Bridge.prototype.restart = function (then) {

    var me = this;

    this.restartCounter = this.restartCounter || 0;

    // if restart happens before timeout clear the counter
    // quit the program
    if(this.restartCounter > 5) {
        this.logger.error("Restarting too fast, stopping process");
        process.exit(1);
    }

    // reset counter
    setTimeout(function () {
        me.restartCounter = 0;
    }, 1000);

    // delay restart of some seconds in case of multiple failure
    setTimeout(function () {
        me.stop(function () {
            me.start(then);
        });
    }, (1500 * me.restartCounter));

    this.restartCounter++;
};

Bridge.prototype.disconnect = function (then) {

    var me = this;

    var _then = function () {

        me.logger.debug("Stomp disconnected");

        me.client = null;
        then && then();
    };

    try {

        try {
            this.client.unsubscribe(this.config.mqtt.topicFrom);
        } catch(e) {

            me.logger.warn("Error unsubscribing from topic " + this.config.mqtt.topicFrom);
            me.logger.warn(e);
        }

        this.client.end()
        _then && _then()

    } catch(e) {

        me.logger.error("Error on disconnection");
        me.logger.error(e);

        _then();
    }

};

Bridge.prototype.connect = function (then) {

    var me = this;


    var _restart = function (e) {
        me.logger.error(e);
        me.restart();
    }

    try {

        this.logger.debug("Setup mqtt connection");
        this.client = mqtt.connect(this.config.mqtt.url)

        // if(this.config.debug) {
        //     this.client.debug = this.logger.silly;
        // }

        this.client.on('connect', function () {
            me.logger.debug("Connected");
            then && then();
        });

    } catch(e) {
        _restart(e);
    }

};


Bridge.prototype.request = function (attr, then) {
    var me = this;

    var options = _.merge({
        followRedirects: false
    }, attr.options || {}, attr);
    var url = attr.url;

    if(this.config.debug) {
        this.logger.silly("HTTP request", url, attr.data ? JSON.stringify(attr.data) : "");
    }

    options.data = typeof options.data === 'string' ? options.data : JSON.stringify(options.data);

    api.request(url, options).on('complete', function (data, response) {

        if(data instanceof Error) {

            me.logger.error("Error occured during HTTP request");
            me.logger.error(data);

            then && then(data, null);

            return;
        }

        if(me.config.debug) {
            me.logger.silly("HTTP response", data ? data : '[empty]');
        }

        then && then(false, data, response);

    });
};

Bridge.prototype.publish = function (url, data, headers) {

    try {
        this.client.publish(url, JSON.stringify(data));
    } catch(e) {
        this.logger.error("Error sending Stomp message");
        this.logger.error(e);
    }

};

Bridge.prototype.handleResponse = function (attr) {

    var topic = this.getToTopic(attr.authorization.replace('Bearer ', ''));

    //    this.logger.debug("response topic: %s", topic);
    //    this.logger.debug("sending: " + JSON.stringify(attr.message));

    this.publish(topic, attr.message, attr.headers);
};

Bridge.prototype.subscribe = function (then) {

    var me = this;
    var topicFrom = this.getFromTopic();

    // this.client.subscribe('/topic/*', function () {
    //     me.logger.warn("catch all");
    //     me.logger.warn(arguments);
    // });

    this.logger.debug("Subscribing to %s", topicFrom);
    this.client.subscribe(topicFrom);

    this.client.on('message', function (topic, message) {

        var request = JSON.parse(message);

        var isActuation = request.meta.url.match(/.*\/actuations\/.*/);
        isActuation && me.logger.debug("Actuation detected");

        me.logger.silly("Handling request");
        me.logger.silly("Requesting " + request.meta.method + " " + request.meta.url);
        request.body && me.logger.debug("Recieved data " + JSON.stringify(request.body));

        var token = 'Bearer ';
        token = (request.meta.authorization.substr(0, token.length) !== token) ? token + request.meta.authorization : request.meta.authorization;

        var req = {
            method: request.meta.method,
            url: me.config.api + request.meta.url,
            data: request.body,
            options: {
                headers: {
                    'Authorization': token
                }
            }
        };

        if(!isActuation) {
            req.options.headers['Content-Type'] = 'application/json';
        }

        me.request(req, function (err, data, response) {

            if(err) {
                me.logger.warn("Skipped subscription publishing due to HTTP error");
                return;
            }

            // send back the identifier if any, allowing the requesting client to match the response
            me.logger.silly("input messageId: " + request.meta.messageId);

            var messageId = request.meta.messageId || null

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

    })

    then && then();

};

Bridge.prototype.getFromTopic = function () {
    return this.config.mqtt.topicFrom;
};

Bridge.prototype.getToTopic = function (token) {
    return token + '/to';
};

module.exports = Bridge;
