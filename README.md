ALE Rainbow SDK for Node.js
===========================

Welcome to the Alcatel-Lucent Enterprise **Rainbow Software Development Kit for Node.js**!

The Alcatel-Lucent Enterprise (ALE) Rainbow Software Development Kit (SDK) is an npm package for connecting your Node.js application to Rainbow.


## Preamble

This SDK is a pure JavaScript library dedicated to the Node.js platform. 

Its powerfull APIs enable you to create the best Node.js applications that connect to Alcatel-Lucent Enterprise [Rainbow](https://www.openrainbow.com).

This documentation will help you to use it.


## Rainbow developper account

Your need a Rainbow **developer** account in order to use the Rainbow SDK for Node.js.

Please contact the Rainbow [support](mailto:support@openrainbow.com) team if you need one.

Notice: This is not a SDK for Bot as this SDK needs a Rainbow developer account. Nevertheless, once started, the connection to Rainbow is never broken so it can be seen as a **"always on"** user (a user that is always connected and 'online'). 


## Beta disclaimer

Please note that this is a Beta version of the Rainbow SDK for Node.js which is still undergoing final testing before its official release. The SDK for Node.js and the documentation are provided on a "as is" and "as available" basis. Before releasing the official release, all these content can change depending on the feedback we receive in one hand and the developpement of the Rainbow official product in the other hand.

Alcatel-Lucent Enterprise will not be liable for any loss, whether such loss is direct, indirect, special or consequential, suffered by any party as a result of their use of the Rainbow SDK for Node.js, the application sample software or the documentation content.

If you encounter any bugs, lack of functionality or other problems regarding the Rainbow SDK for Node.js, the application samples or the documentation, please let us know immediately so we can rectify these accordingly. Your help in this regard is greatly appreciated. 


## Install

```bash
$ npm install --save rainbow-node-sdk
```


## Usage

```js
var RainbowSDK = require('rainbow-node-sdk');

// instantiate the SDK
var rainbowSDK = new RainbowSDK(options);

// start the SDK
rainbowSDK.start();
```

That's all! Your application should be connected to Rainbow, congratulation!


## Configuration

The **options** parameter allows to enter your credentials and to target the Rainbow Cloud Services server to use.

```js
// Define your configuration
var options = {
    rainbow: {
        host: "sandbox",  // can be "sandbox" (developer platform) or "official"
    },
    credentials: {
        login: "<your_rainbow_login_email>",  // Your Rainbow email account
        password: "<your_rainbow_password>"   // Your Rainbow password
    },
    // Logs options
    logs: {
        enableConsoleLogs: true,            // Default: true
        enableFileLogs: false,              // Default: false
        file: {
            path: '/var/tmp/rainbowsdk/',   // Default path used
            level: 'debug'                  // Default log level used
        }
    },
    // Proxy configuration
    proxy: {
        host: '<proxy_host>',
        port: <proxy_port>,
        protocol: '<proxy_protocol>'
    },
    // IM options
    im: {
        sendReadReceipt: true   // True to send the the 'read' receipt automatically
    }
};
```


## Events

### Listen to events

Once you have called the **start()** method, you will begin receiving events from the SDK. If you want to catch them, you have simply to add the following lines to your code:

```js
...
rainbowSDK.events.on(<name_of_the_event_to_listen>, callback);
```

Here is an example for listening when the SDK is ready to be used (once the connection is successfull to Rainbow):

```js
...
rainbowSDK.events.on('rainbow_onready', function() {
    // do something
    ...
});
```


### List of events

Here is the complete list of the events that you can subscribe on:

| Name | Description |
|------|------------|
| **rainbow_onstarted** | Fired when the SDK has successfully started (not yet signed in) |
| **rainbow_onconnectionok** | Fired when the connection is successfull with Rainbow (signin complete) |
| **rainbow_onconnectionerror** | Fired when the connection can't be done with Rainbow (ie. issue on sign-in) |
| **rainbow_onerror** | Fired when something goes wrong (ie: bad 'configurations' parameter...) |
| **rainbow_onready** | Fired when the SDK is connected to Rainbow and ready to be used |
| **rainbow_onmessagereceived** | Fired when a one-to-one message is received |
| **rainbow_onmessageserverreceiptreceived** | Fired when the message has been received by the server |
| **rainbow_onmessagereceiptreceived** | Fired when the message has been received by the recipient |
| **rainbow_onmessagereceiptreadreceived** | Fired when the message has been read by the recipient |
| **rainbow_oncontactpresencechanged** | Fired when the presence of a contact changes |
| **rainbow_onbubbleaffiliationchanged** | Fired when the presence of a contact changes |


## Instant Messaging

### Listen to incoming messages and answer to them

Listening to instant messages that come from other users is very easy. You just have to use the **'events'** public property and to subscribe to the **'rainbow_onmessagereceived'** event:

```js
...
rainbowSDK.events.on('rainbow_onmessagereceived', function(message) {
    // test if the message comes from a bubble of from a conversation with one participant
    if(message.type == "groupchat") {
        // Send the answer to the bubble
        messageSent = nodeSDK.im.sendMessageToBubbleJid('The message answer', message.fromBubbleJid);
    }
    else {
        // send the answer to the user directly otherwise
        messageSent = nodeSDK.im.sendMessageToJid('The message answer', jsonMessage.fromJid);
    }
});
```


### Manually send a 'read' receipt

By default or if the **sendReadReceipt** property is not set, the 'read' receipt is sent automatically to the sender when the message is received so than the sender knows that the message as been read.

If you want to send it manually  when you want, you have to set this parameter to false and use the method **markMessageAsRead()** 

```js
...
rainbowSDK.events.on('rainbow_onmessagereceived', function(message) {
    // do something with the message received 
    ...
    // send manually a 'read' receipt to the sender
    rainbowSDK.im.markMessageAsRead(message);
});
```

Notice: You not have to send receipt for message having the property **isEvent** equals to true. This is specific Bubble messages indicating that someone entered the bubble or juste leaved it.



### Listen to receipts

Receipts allow to know if the message has been successfully delivered to your recipient. Use the ID of your originated message to be able to link with the receipt received.

When the server receives the message you just sent, a receipt is sent to you:

```js
...
rainbowSDK.events.on('rainbow_onmessageserverreceiptreceived', function(receipt) {
    // do something when the message has been received by the Rainbow server
    ...
});
```

Then, when the recipient receives the message, the following receipt is sent to you:

```js
...
rainbowSDK.events.on('rainbow_onmessagereceiptreceived', function(receipt) {
    // do something when the message has been received by the recipient
    ...
});
```

Finally, when the recipient read the message, the following receipt is sent to you:

```js
...
rainbowSDK.events.on('rainbow_onmessagereceiptreadreceived', function(receipt) {
    // do something when the message has been read by the recipient
    ...
});
```


## Contacts

### Retrieve the list of contacts

Once connected, the Rainbow SDK will automatically retrieve the list of contacts from the server. You can access to them by using the following API:

```js
...
rainbowSDK.events.on('rainbow_onconnectionok', function() {
    // do something when the connection to Rainbow is up
    var contacts = rainbowSDK.contacts.getAll();
});
```


### Retrieve a contact information

Accessing individually an existing contact can be done using the API **getContactByJid()** or **getContactById()**

```js
    ...
    // Retrieve the contact information when receiving a message from him
    var contact = rainbowSDK.contacts.getContactByJid(message.fromJid);
});
```


### Listen to contact presence change

When the presence of a contact changes, the following event is fired:

```js
...
rainbowSDK.events.on('rainbow_oncontactpresencechanged', function(contact) {
    // do something when the presence of a contact changes
    var presence = contact.presence;    // Presence information
    var status = contact.status;        // Additionnal information if exists
});
```

The presence and status of a Rainbow user can take several values as described in the following table:

| Presence | Status | Meaning |
|----------------|--------------|---------|
| **online** | | The contact is connected to Rainbow through a desktop application and is available |
| **online** | **mobile** | The contact is connected to Rainbow through a mobile application and is available |
| **away** | | The contact is connected to Rainbow but hasn't have any activity for several minutes |
| **busy** | | The contact is connected to Rainbow and doesn't want to be disturbed at this time |
| **busy** | **presentation** | The contact is connected to Rainbow and uses an application in full screen (presentation mode) |
| **busy** | **phone** | The contact is connected to Rainbow and currently engaged in an audio call (PBX) |
| **busy** | **audio** | The contact is connected to Rainbow and currently engaged in an audio call (WebRTC) |
| **busy** | **video** | The contact is connected to Rainbow and currently engaged in a video call (WebRTC) |
| **busy** | **sharing** | The contact is connected to Rainbow and currently engaged in a screen sharing presentation (WebRTC) |
| **offline** | | The contact is not connected to Rainbow |
| **unknown** | | The presence of the Rainbow user is not known (not shared with the connected user) |

Notice: With this SDK version, if the contact uses several devices at the same time, only the latest presence information is taken into account.


## Presence

### Change presence manually

The SDK for Node.js allows to change the presence of the connected user by calling the following api:

```js
...
rainbowSDK.presence.setPresenceTo(rainbowSDK.presence.RAINBOW_PRESENCE_DONOTDISTURB).then(function() {
    // do something when the presence has been changed
    ...
}).catch(function(err) {
    // do something if the presence has not been changed
    ...
});
```

The following values are accepted:

| Presence constant | value | Meaning |
|------------------ | ----- | ------- |
| **RAINBOW_PRESENCE_ONLINE** | "online" | The connected user is seen as **available** |
| **RAINBOW_PRESENCE_DONOTDISTURB** | "dnd" | The connected user is seen as **do not disturb** |
| **RAINBOW_PRESENCE_AWAY** | "away" | The connected user is seen as **away** |
| **RAINBOW_PRESENCE_INVISIBLE** | "invisible" | The connected user is connected but **seen as offline** |

Notice: Values other than the ones listed will not be taken into account.


## Bubbles

### Retrieve the list of existing bubbles

Once connected, the Rainbow SDK will automatically retrieve the list of bubbles from the server. You can access to them by using the following API:

```js
...
rainbowSDK.events.on('rainbow_onconnectionok', function() {
    // do something when the connection to Rainbow is up
    var bubbles = rainbowSDK.bubbles.getAll();
});
```

Each new bubble created will then be added to that list automatically.


### Retrieve a bubble information

Accessing individually an existing bubble can be done using the API **getBubbleByJid()** or **getBubbleById()**

```js
    ...
    // Retrieve the bubble information when receiving a message in that bubble
    var bubble = rainbowSDK.bubbles.getBubbleByJid(message.fromBubbleJid);
});
```


### Create a new Bubble

A new bubble can be created by calling the following API

```js
...
rainbowSDK.bubbles.createBubble("My new Bubble", "A little description of my bubble").then(function(bubble) {
    // do something with the bubble created
    ...
}).catch(function(err) {
    // do something if the creation of the bubble failed (eg. providing the same name as an existing bubble)
    ...
});
```


### Add a contact to a bubble

Once you have created a bubble, you can invite a contact. Insert the following code

```js
...

var invitedAsModerator = false;     // To set to true if you want to invite someone as a moderator
var sendAnInvite = true;            // To set to false if you want to add someone to a bubble without having to invite him first
var inviteReason = "bot-invite";    // Define a reason for the invite (part of the invite received by the recipient)

rainbowSDK.bubbles.inviteContactToBubble(aContact, aBubble, invitedAsModerator, sendAnInvite, inviteReason).then(function(inviteSent) {
    // do something with the invite sent
    ...
}).catch(function(err) {
    // do something if the invitation failed (eg. bad reference to a buble)
    ...
});
```


### Be notified when a contact changes his affiliation with a bubble 

When a recipient accepts or decline your invite or when he leaves the bubble, you can receive a notification of his affiliation change by listening to the following event:

```js
...
rainbowSDK.events.on('rainbow_onbubbleaffiliationchanged', function(affiliation) {
    // do something with the notification
    ...
});
```

This affiliation will contain 3 information:

```js
...
affiliation: {
    bubble: {...},          // The bulle where the action takes place
    contact: {...},         // The contact that changes his affiliation
    status: 'accepted',     // The status of the affiliation (ie: accepted, declined, unsubscribed)
}
```


### Leave a bubble

You can only leave a owned bubble if you have invited someone with a role of **moderator**. If it is the case, you can leave a owned bubble by calling the following API:

```js
...
rainbowSDK.bubbles.leaveBubble(aBubble).then(function() {
    // do something once leaved the bubble
    ...
}).catch(function(err) {
    // do something if you can't leave the bubble
    ...
});
```


## Proxy management

### Configuration

If you need to access to Rainbow through an HTTP proxy, you have to add the following part to your 'options' parameter:

```js
...
proxy: {
    host: '192.168.0.254',
    port: 8080,             // Default to 80 if not provided
    protocol: 'http'       // Default to 'http' if not provided
}
```


## Serviceability

### Logging to the console

By default, the Rainbow SDK for Node.js logs to the shell console used (ie. that starts the Node.js process).

You can disable it by setting the parameter **enableConsoleLogs** to false

```js
...
logs: {
    enableConsoleLogs: false
    ...
}
```


### Logging to files

By default, the SDK logs information in the shell console that starts the Node.js process.

You can save these logs into a file by setting the parameter **enableFileLogs** to true. (False by default).

```js
...
logs: {
    enableFileLogs: true
    ...
}
```

You can modify the path where the logs are saved and the log level by modifying the paramter **file** like the following:

```js
...
logs: {
    file: {
        path: '/var/tmp/mypath/',
        level: 'error'
    }
}
```

The available log levels are: 'error', 'warn', 'info' and 'debug'

Notice: Each day a new file is created.


### API Return codes

Here is the table and description of the API return codes:

| Return code | Label | Message | Meaning |
|------------------ | ----- | ------ | ------ |
| 1 | **"SUCCESSFULL"** | "" | The request has been successfully executed |
| -1 | **"INTERNALERROR"** | "An error occured. See details for more information" | A error occurs. Check the details property for more information on this issue |
| -2 | **"UNAUTHORIZED"** | "The email or the password is not correct" | Either the login or the password is not correct. Check your Rainbow account |
| -4 | **"XMPPERROR"** | "An error occured. See details for more information" | An error occurs regarding XMPP. Check the details property for more information on this issue |
| -16 | **"BADREQUEST"** | "One or several parameters are not valid for that request." | You entered bad parameters for that request. Check this documentation for the list of correct values |

When there is an issue calling an API, an error object is returned like in the following example:

```js
{
    code: -1                // The error code
    label: "INTERNALERROR"  // The error label
    msg: "..."              // The error message
    details: ...            // The JS error
}
```

Notice: In case of successfull request, this object is returned only when there is no other information returned.


## Features provided

Here is the list of features supported by the Rainbow-Node-SDK


### Instant Messaging

 - Send and receive One-to-One messages

 - XEP-0045: Multi-user Chat: Send and receive messages in Bubbles

 - XEP-0184: Message Delivery Receipts (received and read)

 - XEP-0280: Message Carbon


### Contacts

 - Get the list of contacts

 - Get contact individually


### Bubbles

 - Get the list of bubbles

 - Get bubble individually

 - Invite contact to a bubble

 - Leave a bubble


### Presence

- Get the presence of contacts

- Set the user connected presence


### Serviciability

 - Support of connection through an HTTP Proxy 

 - Logs into file & console

 - XEP-0199: XMPP Ping

 - REST token automatic renewal and auto-relogin
