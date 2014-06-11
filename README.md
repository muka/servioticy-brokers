servioticy-brokers
==================

Brokers for interacting with servioticy REST API (MQTT, WS+STOMP, TCP+STOMP...)
- Online MQTT broker can be reached at <code>api.servioticy.com:1833</code>
- Online STOMP/TCP broker can be reached at <code>api.servioticy.com:1833</code>
- Online STOMP/WS broker can be reached at <code>api.servioticy.com:61623</code>

In all cases: 
- User: compose
- Password: shines

**Payload structure example**:

```json
{
   "meta": {
     "authorization": "API_TOKEN HERE",
     "method": "PUT",
     "url": "/13944639303973f5530eab507412d88bef305089a7720/streams/weather",
     "messageId": 17772
   },
   "body": {
     "lastUpdate": 1199192932,
     "channels": {
       "location": {
         "current-value": "40.12,-71.34",
         "unit": "degrees"
       },
       "temperature": {
         "current-value": 33,
         "unit": "degrees"
       }
     }
   }
}
```

**For MQTT, the topic structure is**:

- <code>“API_TOKEN/from”</code> to send requests to the API
- <code>“API_TOKEN/to”</code> to receive responses to the API

- Updates produced by subscriptions: <code>“API_TOKEN/SOid/updates”</code>


**For STOMP (either over TCP or WS), the topic structure is**:

- <code>“/topic/API_TOKEN.from”</code> to send requests to the API
- <code>“/topic/API_TOKEN.to”</code> to receive responses to the API

- Updates produced by subscriptions: <code>“/topic/API_TOKEN.SOid.updates”</code>
