"use strict";

var Client = require('node-xmpp-client');
var HttpsProxyAgent = require('https-proxy-agent');

var XMPPUtils = require('../common/XMPPUtils');

const LOG_ID = 'XMPP - ';

const ONLINE_EVENT = 'online';
const OFFLINE_EVENT = 'offline';
const CONNECT_EVENT = 'connect';
const RECONNECT_EVENT = 'reconnect';
const DISCONNECT_EVENT = 'disconnect';
const CLOSE_EVENT = 'close';
const END_EVENT = 'end';
const ERROR_EVENT = 'error';
const STANZA_EVENT = 'stanza';

var handleXMPPConnection;

class XMPPService {

    constructor(_xmpp, _im, _eventEmitter, _logger, _proxy) {
        this.serverURL = _xmpp.protocol + "://" + _xmpp.host + ":" + _xmpp.port + "/websocket";
        this.host = _xmpp.host
        this.eventEmitter = _eventEmitter;
        this.version = "0.1";
        this.jid_im = "";
        this.jid_tel = "";
        this.jid_password = "";
        this.fullJid = "";
        this.xmppClient = null;
        this.logger = _logger;
        this.proxy = _proxy;
        this.shouldSendReadReceipt = _im.sendReadReceipt;
        var messageId = 0;
        this.useXMPP = true;

        handleXMPPConnection = () => {

            var that = this;

            var options = {};
            if(this.proxy.isProxyConfigured) {
                options.agent = new HttpsProxyAgent(this.proxy.proxyURL);
            }

            this.xmppClient = new Client({
                'jid': this.fullJid,
                'password': this.jid_password,
                'host': this.host,
                'websocket': {
                    'url': this.serverURL,
                    'options': options
                }
            });

            this.xmppClient.on(ONLINE_EVENT, function(msg) {
                that.logger.log("info", LOG_ID + "(handleXMPPConnection) event - " + ONLINE_EVENT);
                that.logger.log("debug", LOG_ID + "(handleXMPPConnection) received", msg);
                that.logger.log("info", LOG_ID + "(handleXMPPConnection) connected as " + msg.jid);
                that.eventEmitter.emit("rainbow_xmppconnected");
            });

            this.xmppClient.on(STANZA_EVENT, function(stanza) {
                that.logger.log("info", LOG_ID + "(handleXMPPConnection) event - " + STANZA_EVENT);
                that.logger.log("info", LOG_ID + "(handleXMPPConnection) received", stanza.toString());
                
                switch(stanza.getName()) {
                    case "iq":
                        var children = stanza.children;
                        children.forEach(function(node) {
                            switch(node.getName()) {
                                case "ping":
                                    var stanzaResponse = new Client.Stanza('iq', {'to': stanza.attrs.from, 'id': stanza.attrs.id, 'xmlns':stanza.getNS(), 'type': 'result' });
                                    that.logger.log("info", LOG_ID + "(handleXMPPConnection) answered - 'stanza'", stanzaResponse.toString());
                                    that.xmppClient.send(stanzaResponse);
                                    break;
                                case "query":
                                    if(stanza.attrs.type === "result") {
                                        if(node.attrs.xmlns === "jabber:iq:roster") {
                                            var contacts = [];
                                            var subchildren = node.children;
                                            subchildren.forEach(function(item) {
                                                if(item.attrs.jid.substr(0, 3) !==  "tel") {
                                                    contacts.push({
                                                        jid: item.attrs.jid,
                                                        subscription: item.attrs.subscription,
                                                        ask: item.attrs.ask || ""
                                                    });
                                                }
                                            });
                                            that.logger.log("info", LOG_ID + "(handleXMPPConnection) XMPP Rosters received", contacts.length);
                                            that.eventEmitter.emit('rainbow_onrosters', contacts);
                                        }
                                    }
                                    break;
                                case "default":
                                    that.logger.log("warn", LOG_ID + "(handleXMPPConnection) not managed - 'stanza'", node.getName());
                                    break;
                                default: 
                                    that.logger.log("warn", LOG_ID + "(handleXMPPConnection) child not managed for iq - 'stanza'", node.getName());
                                    break;
                            }
                        });
                        if(stanza.attrs.type && stanza.attrs.type === "result") {
                            if(stanza.attrs.id === "enable_xmpp_carbon") {
                                that.eventEmitter.emit('rainbow_oncarbonactivated');
                            }
                        }
                        break;
                    case "message":
                        var content = "";
                        var subject = "";
                        var event = "";
                        var eventJid = "";
                        var hasATextMessage = false;
                        if(stanza.attrs.type === "chat" || stanza.attrs.type === "groupchat") {
                            var children =stanza.children;
                            children.forEach(function(node) {
                                switch (node.getName()) {
                                    case "active":
                                        that.logger.log("info", LOG_ID + "(handleXMPPConnection) message - someone is active");
                                        break;
                                    case "inactive":
                                        that.logger.log("info", LOG_ID + "(handleXMPPConnection) message - someone is inactive");
                                        break;
                                    case "composing":
                                        that.logger.log("info", LOG_ID + "(handleXMPPConnection) message - someone is writing");
                                        break;
                                    case "received":
                                        var receipt = {
                                            event: node.attrs.event,
                                            entity :node.attrs.entity,
                                            type: node.attrs.type,
                                            id: node.attrs.id
                                        };
                                        that.logger.log("info", LOG_ID + "(handleXMPPConnection) message - receipt received");
                                        that.eventEmitter.emit('rainbow_onreceipt', receipt);
                                        break;
                                    case "archived":
                                        break;
                                    case "stanza-id":
                                        break;
                                    case "subject":
                                        subject = node.getText();
                                        break;
                                    case "event":
                                        event = node.attrs.name;
                                        eventJid = node.attrs.jid;
                                        break;
                                    case "body":
                                        content = node.getText();
                                        that.logger.log("info", LOG_ID + "(handleXMPPConnection) message - content", "***");
                                        hasATextMessage = true;
                                        break;
                                    case "request":
                                            // Acknowledge 'received'
                                            var stanzaReceived = new Client.Stanza('message', { "to": stanza.attrs.from, "from": stanza.attrs.to, "type": stanza.attrs.type }).c("received", {"xmlns": "urn:xmpp:receipts", "event": "received", "entity": "client", "id": stanza.attrs.id});
                                            that.logger.log("info", LOG_ID + "(handleXMPPConnection) answered - send receipt 'received'", stanzaReceived.root().toString());
                                            that.xmppClient.send(stanzaReceived);
                                            //Acknowledge 'read'
                                            if(that.shouldSendReadReceipt || (stanza.attrs.type === "groupchat" && XMPPUtils.getResourceFromFullJID(stanza.attrs.from) === that.fullJid)) {
                                                var stanzaRead = new Client.Stanza('message', { "to": stanza.attrs.from, "from": stanza.attrs.to, "type": stanza.attrs.type }).c("received", {"xmlns": "urn:xmpp:receipts", "event": "read", "entity": "client", "id": stanza.attrs.id});
                                                that.logger.log("info", LOG_ID + "(handleXMPPConnection) answered - send receipt 'read'", stanzaRead.root().toString());
                                                that.xmppClient.send(stanzaRead);
                                            }
                                        break;
                                    default:
                                        break;
                                }
                            });

                            var fromJid = stanza.attrs.from;
                            var resource = XMPPUtils.getResourceFromFullJID(stanza.attrs.from);
                            var fromBubbleJid = "";
                            var fromBubbleUserJid = "";
                            if(stanza.attrs.type === "groupchat") {
                                fromBubbleJid = XMPPUtils.getBareJIDFromFullJID(stanza.attrs.from);
                                fromBubbleUserJid = XMPPUtils.getResourceFromFullJID(stanza.attrs.from);
                                resource = XMPPUtils.getResourceFromFullJID(fromBubbleUserJid);
                            }

                            if(hasATextMessage && ((stanza.attrs.type === "groupchat" && fromBubbleUserJid !== that.fullJid) || (stanza.attrs.type === "chat" && fromJid !== that.fullJid))) {
                                that.logger.log("info", LOG_ID + "(handleXMPPConnection) message - chat message received");
                                
                                var data = {
                                    'fromJid': fromJid,
                                    'resource': resource,
                                    'toJid': stanza.attrs.to,
                                    'type': stanza.attrs.type,
                                    'content': content,
                                    'id': stanza.attrs.id,
                                    'isEvent': false
                                };
                                
                                if(stanza.attrs.type === "groupchat") {
                                    data.fromBubbleJid = fromBubbleJid;
                                    data.fromBubbleUserJid = fromBubbleUserJid;

                                    if(subject.length > 0) {
                                        data.subject = subject;
                                        data.event = event;
                                        data.eventJid = eventJid;
                                        data.isEvent = true;
                                    }
                                }
                                
                                that.eventEmitter.emit('rainbow_onmessagereceived', data);
                            }
                        }
                        else if(stanza.attrs.type === "management") {
                            var children =stanza.children;
                            children.forEach(function(node) {
                                switch (node.getName()) {
                                    case "room":
                                        if(node.attrs.userjid === XMPPUtils.getBareJIDFromFullJID(that.fullJid)) {
                                            that.logger.log("debug", LOG_ID + "(handleXMPPConnection) bubble management received for own. Do not publish event.");
                                        }
                                        else {
                                            that.logger.log("debug", LOG_ID + "(handleXMPPConnection) bubble affiliation received");
                                            that.eventEmitter.emit('rainbow_invitationchanged', {
                                                'bubbleId': node.attrs.roomid,
                                                'bubbleJid': node.attrs.roomjid,
                                                'userJid': node.attrs.userjid,
                                                'status': node.attrs.status
                                            });
                                        }
                                        break;
                                    default:
                                        break;
                                }
                            });
                        }
                        else {
                            var children =stanza.children;
                            children.forEach(function(node) {
                                switch (node.getName()) {
                                    case "received":
                                        var receipt = {
                                            event: node.attrs.event,
                                            entity :node.attrs.entity,
                                            type: null,
                                            id: node.attrs.id
                                        };
                                        that.logger.log("info", LOG_ID + "(handleXMPPConnection) server receipt received");
                                        that.eventEmitter.emit('rainbow_onreceipt', receipt);
                                        break;
                                    default:
                                        break;
                                }
                            });
                        }
                        break;
                    case "presence":
                        var from = stanza.attrs.from;
                        if (from === that.fullJid || XMPPUtils.getBareJIDFromFullJID(from) === XMPPUtils.getBareJIDFromFullJID(that.fullJid)) {
                            // My presence changes (coming from me or another resource)
                            that.eventEmitter.emit("rainbow_onpresencechanged", {
                                fulljid: from,
                                jid : XMPPUtils.getBareJIDFromFullJID(from),
                                resource: XMPPUtils.getResourceFromFullJID(from),
                                show: stanza.attrs.show || 'online',
                                status: stanza.attrs.status || "",
                                type: XMPPUtils.isFromTelJid(from) ? "phone" : XMPPUtils.isFromMobile(from) ? "mobile" : XMPPUtils.isFromNode(from) ? "node" : "desktopOrWeb"
                            });
                        }
                        else if(from.includes("room_")) {

                            var children = stanza.children;
                            children.forEach(function(node) {
                                switch (node.getName()) {
                                    case "x":
                                        var items = node.children;
                                        items.forEach(function(item) {
                                            switch (item.getName()) {
                                                case "item":
                                                    break;
                                                case "status":
                                                    break;
                                                default:
                                                    break;
                                            }
                                        });
                                        break;
                                    default:
                                        break;
                                }
                            });

                            // A presence in a room changes
                            var fullJid = XMPPUtils.getResourceFromFullJID(from);
                            if(XMPPUtils.getBareJIDFromFullJID(fullJid) === XMPPUtils.getBareJIDFromFullJID(that.fullJid)) {
                                // My presence (node or other resources) in the room changes
                                that.eventEmitter.emit("rainbow_onbubblepresencechanged", {
                                    fulljid: from,
                                    jid : XMPPUtils.getBareJIDFromFullJID(from),
                                    resource: XMPPUtils.getResourceFromFullJID(from),
                                });
                            }
                            else {
                                // Presence of a participants of the room changes
                                that.eventEmitter.emit("rainbow_onbubblerosterpresencechanged", {
                                    fulljid: from,
                                    jid : XMPPUtils.getBareJIDFromFullJID(from),
                                    resource: XMPPUtils.getResourceFromFullJID(from),
                                });
                            }

                        }
                        else {
                            // Presence of a contact changes
                            var priority = 5;
                            var show = "";
                            var delay = "";
                            var status = "";
                            if(stanza.attrs.type === "unavailable") {
                                show = "unavailable";
                            }
                            else {
                                var children = stanza.children;
                                children.forEach(function(node) {
                                    if(node && typeof node !== "string") {
                                        switch (node.getName()) {
                                            case "priority":
                                                priority = node.getText() || 5;
                                                break;
                                            case "show":
                                                show = node.getText() || "online";
                                                break;
                                            case "delay":
                                                delay = node.attrs.stamp || "";
                                                break;
                                            case "status":
                                                status = node.getText() || "";
                                            default:
                                                break;
                                        }
                                    }
                                });
                            }
                            
                            that.eventEmitter.emit("rainbow_onrosterpresence", {
                                fulljid: from,
                                jid : XMPPUtils.getBareJIDFromFullJID(from),
                                resource: XMPPUtils.getResourceFromFullJID(from),
                                value: {
                                    priority: priority,
                                    show: show || "",
                                    delay: delay,
                                    status: status || "",
                                    type: XMPPUtils.isFromTelJid(from) ? "phone" : XMPPUtils.isFromMobile(from) ? "mobile" : XMPPUtils.isFromNode(from) ? "node" : "desktopOrWeb",
                                }
                            });
                        }
                        break;
                    case "close":
                        break;
                    default:
                        that.logger.log("warn", LOG_ID + "(handleXMPPConnection) not managed - 'stanza'", node.getName());
                        break;
                }
            });

            this.xmppClient.on(ERROR_EVENT, function (err) {
                that.logger.log("debug", LOG_ID + "(handleXMPPConnection) event - " + ERROR_EVENT);
                that.logger.log("error", LOG_ID + "(handleXMPPConnection) received", err);
                that.xmppClient.end();
                that.eventEmitter.emit('rainbow_onxmpperror', err);
            });

            this.xmppClient.on(OFFLINE_EVENT, function (msg) {
                that.logger.log("debug", LOG_ID + "(handleXMPPConnection) event - " + OFFLINE_EVENT);
                that.logger.log("warn", LOG_ID + "(handleXMPPConnection) received", msg);
            });

            this.xmppClient.on(CONNECT_EVENT, function (msg) {
                that.logger.log("debug", LOG_ID + "(handleXMPPConnection) event - " + CONNECT_EVENT);
                that.logger.log("info", LOG_ID + "(handleXMPPConnection) received", msg);
            });

            this.xmppClient.on(RECONNECT_EVENT, function (msg) {
                that.logger.log("debug", LOG_ID + "(handleXMPPConnection) event - " + RECONNECT_EVENT);
                that.logger.log("info", LOG_ID + "(handleXMPPConnection) received", msg);
            })

            this.xmppClient.on(DISCONNECT_EVENT, function (msg) {
                that.logger.log("debug", LOG_ID + "(handleXMPPConnection) event - " + DISCONNECT_EVENT);
                that.logger.log("warn", LOG_ID + "(handleXMPPConnection) received", msg);
            });

            this.xmppClient.on(CLOSE_EVENT, function (msg) {
                that.logger.log("debug", LOG_ID + "(handleXMPPConnection) event - " + CLOSE_EVENT);
                that.logger.log("info", LOG_ID + "(handleXMPPConnection) received", msg);
            });

            this.xmppClient.on(END_EVENT, function (msg) {
                that.logger.log("debug", LOG_ID + "(handleXMPPConnection) event - " + END_EVENT);
                that.logger.log("info", LOG_ID + "(handleXMPPConnection) received", msg);
            });
        }
    };

    start(withXMPP) {
        var that = this;
        this.logger.log("debug", LOG_ID + "(start) _entering_");

        return new Promise(function(resolve, reject) {
            try {
                if(withXMPP) {
                    that.logger.log("debug", LOG_ID + "(start) host used", that.host);
                    that.logger.log("info", LOG_ID + "(start) XMPP URL", that.serverUR);
                }
                else {
                    that.logger.log("info", LOG_ID + "(start) XMPP connection blocked by configuration");
                }
                that.useXMPP = withXMPP;
                that.logger.log("debug", LOG_ID + "(start) _exiting_");
                resolve();
            }
            catch(err) {
                that.logger.log("debug", LOG_ID + "(start) _exiting_");
                reject(err);
            }
        });
    };

    signin(account) {
        var that = this;

        return new Promise(function(resolve, reject) {
            if(that.useXMPP) {
                that.logger.log("debug", LOG_ID + "(signin) _entering_");
                that.jid_im = account.jid_im;
                that.jid_tel = account.jid_tel;
                that.jid_password = account.jid_password
                that.fullJid = XMPPUtils.generateRandomFullJidForNode(that.jid_im);

                that.logger.log("info", LOG_ID + "(signin) account used", that.jid_im);
            
                handleXMPPConnection();
                that.logger.log("debug", LOG_ID + "(signin) _exiting_");
            }
            else {
                that.eventEmitter.emit("rainbow_xmppfakeconnected");
            }
            resolve();
        });
    };
            
    stop() {
        this.logger.log("debug", LOG_ID + "(stop) _entering_");
        if(this.xmppClient) {
            this.xmppClient.end();
        }
        this.jid_im = "";
        this.jid_tel = "";
        this.jid_password = "";
        this.fullJid = "";
        this.xmppClient = null;
        this.logger.log("debug", LOG_ID + "(stop) _exiting_");
    };

    setPresence(show, status) {
        this.logger.log("debug", LOG_ID + "(setPresence) _entering_");
        if(this.useXMPP) {
            var stanza = new Client.Stanza('presence', {});
            stanza.c("priority").t("5");
            stanza.up();

            if (show && show !== "online") {
                stanza.c("show").t(show);
            }

            if (status && (!show || show === "online")) {
                stanza.c("status").t(status);
            }
            else if (status) {
                stanza.up().c("status").t(status);
            }
            stanza.up();
            
            this.logger.log("info", LOG_ID + "(setPresence) send - 'stanza'", stanza.toString());
            this.xmppClient.send(stanza);
        }
        else {
            this.logger.log("warn", LOG_ID + "(setPresence) No XMPP connection...");
        }
        this.logger.log("debug", LOG_ID + "(setPresence) _exiting_");
    };

    //Message Carbon XEP-0280 
    enableCarbon() {
        this.logger.log("debug", LOG_ID + "(enableCarbon) _entering_");
        if(this.useXMPP) {
            var stanza = new Client.Stanza('iq', { 'type': 'set', id: 'enable_xmpp_carbon'}).c("enable", { xmlns: "urn:xmpp:carbons:2" }).up();
            this.logger.log("info", LOG_ID + "(enableCarbon) send - 'stanza'", stanza.toString());
            this.xmppClient.send(stanza);
        }
        else {
            this.logger.log("warn", LOG_ID + "(enableCarbon) No XMPP connection...");
        }
        this.logger.log("debug", LOG_ID + "(enableCarbon) _exiting_");
	};

    sendChatMessage(message, jid) {
        this.logger.log("debug", LOG_ID + "(sendChatMessage) _entering_");
        if(this.useXMPP) {
            var id = XMPPUtils.getUniqueMessageId();

            var stanza = new Client.Stanza('message', {"from": this.fullJid, 'to': jid, 'xmlns': "jabber:client", 'type': 'chat', 'id':id}).c('body').t(message).up().c("request", { "xmlns": "urn:xmpp:receipts" }).up();
            this.logger.log("info", LOG_ID + "(sendChatMessage) send - 'message'", stanza.toString());
            this.xmppClient.send(stanza);
            this.logger.log("debug", LOG_ID + "(sendChatMessage) _exiting_");
            return {
                to: jid,
                type: 'chat',
                id: id,
                content: message
            };
        }
        else {
            this.logger.log("warn", LOG_ID + "(sendChatMessage) No XMPP connection...");
            this.logger.log("debug", LOG_ID + "(sendChatMessage) _exiting_");
            return null;
        }
    }

    sendChatMessageToBubble(message, jid) {
        this.logger.log("debug", LOG_ID + "(sendChatMessageToBubble) _entering_");
        if(this.useXMPP) {
            var id = XMPPUtils.getUniqueMessageId();

            var stanza = new Client.Stanza('message', {'to': jid, 'type': 'groupchat', 'id':id}).c('body').t(message).up().c("request", { "xmlns": "urn:xmpp:receipts" }).up();
            this.logger.log("info", LOG_ID + "(sendChatMessageToBubble) send - 'message'", stanza.toString());
            this.xmppClient.send(stanza);
            this.logger.log("debug", LOG_ID + "(sendChatMessageToBubble) _exiting_");
            return {
                to: jid,
                type: 'groupchat',
                id: id,
                content: message
            };
        }
        else {
            this.logger.log("warn", LOG_ID + "(sendChatMessageToBubble) No XMPP connection...");
            this.logger.log("debug", LOG_ID + "(sendChatMessageToBubble) _exiting_");
            return null;
        }
    }

    markMessageAsRead(message) {
        this.logger.log("debug", LOG_ID + "(markMessageAsRead) _entering_");
        if(this.useXMPP) {
            var stanzaRead = new Client.Stanza('message', { "to": message.fromJid, "from": message.toJid, "type": "chat" }).c("received", {"xmlns": "urn:xmpp:receipts", "event": "read", "entity": "client", "id": message.id});
            this.logger.log("info", LOG_ID + "(markMessageAsRead) send - 'message'", stanzaRead.root().toString());
            this.xmppClient.send(stanzaRead);
        }
        else {
            this.logger.log("warn", LOG_ID + "(markMessageAsRead) No XMPP connection...");
        }
        this.logger.log("debug", LOG_ID + "(markMessageAsRead) _exiting_");
    };

    getRosters() {
        this.logger.log("debug", LOG_ID + "(start) getRosters");
        if(this.useXMPP) {
            var stanza = new Client.Stanza('iq', {"type": "get"}).c('query', { xmlns: "jabber:iq:roster"}).up();
            this.logger.log("info", LOG_ID + "(getRosters) send - 'iq/rosters'", stanza.toString());
            this.xmppClient.send(stanza);
        }
        else {
            this.logger.log("warn", LOG_ID + "(getRosters) No XMPP connection...");
        }
        this.logger.log("debug", LOG_ID + "(getRosters) _exiting_");
    };

    sendInitialBubblePresence(jid) {
        this.logger.log("debug", LOG_ID + "(sendInitialBubblePresence) _entering_");
        if(this.useXMPP) {
            var stanza = new Client.Stanza('presence', { to: jid + "/" + this.fullJid });
            stanza.c("x", { "xmlns": "http://jabber.org/protocol/muc" }).c("history", { maxchars: "0" });
            this.logger.log("info", LOG_ID + "(sendInitialBubblePresence) send - 'message'", stanza.root().toString());
            this.xmppClient.send(stanza);
        }
        else {
            this.logger.log("warn", LOG_ID + "(sendInitialBubblePresence) No XMPP connection...");
        }
        this.logger.log("debug", LOG_ID + "(sendInitialBubblePresence) _exiting_");
    }

    sendUnavailableBubblePresence(jid) {
        this.logger.log("debug", LOG_ID + "(sendUnavailableBubblePresence) _entering_");
        if(this.useXMPP) {
            var stanza = new Client.Stanza('presence', { to: jid + "/" + this.fullJid, type: 'unavailable' });
            stanza.c("x", { "xmlns": "http://jabber.org/protocol/muc" });
            this.logger.log("info", LOG_ID + "(sendUnavailableBubblePresence) send - 'message'", stanza.root().toString());
            this.xmppClient.send(stanza);
        }
        else {
            this.logger.log("warn", LOG_ID + "(sendUnavailableBubblePresence) No XMPP connection...");
        }
        this.logger.log("debug", LOG_ID + "(sendUnavailableBubblePresence) _exiting_");
    }
};

module.exports = XMPPService;