const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const app = express();

const keys = require('../../config/keys.json');
const chat = require('../../files/chat');
const restaurants = require('../../files/restaurants');

handleError = function(err) {
  console.log ("Got an error", err);
}

var usersState = {};

const weatherQueryStart = 'https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22';
const weatherQueryEnd = '%22)&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys';

callSendAPI = function(senderID, messageData) {
  request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:keys.fb_token},
        method: 'POST',
        json: {
            recipient: {id:senderID},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    });  
}

sendGenericMessage = function (sender) {
    let messageData = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": [{
                    "title": "First card",
                    "subtitle": "Element #1 of an hscroll",
                    "image_url": "http://messengerdemo.parseapp.com/img/rift.png",
                    "buttons": [{
                        "type": "web_url",
                        "url": "https://www.messenger.com",
                        "title": "web url"
                    }, {
                        "type": "postback",
                        "title": "Postback",
                        "payload": "Payload for first element in a generic bubble"
                    }]
                }, {
                    "title": "Second card",
                    "subtitle": "Element #2 of an hscroll",
                    "image_url": "http://messengerdemo.parseapp.com/img/gearvr.png",
                    "buttons": [{
                        "type": "postback",
                        "title": "Postback",
                        "payload": "Payload for second element in a generic bubble"
                    }]
                }]
            }
        }
    }
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:keys.fb_token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Error sending messages: ', error)
        } else if (response.body.error) {
            console.log('Error: ', response.body.error)
        }
    })
}

/*
sendTextMessage = function (sender, text) {
    let messageData = { text:text };
    request({
        url: 'https://graph.facebook.com/v2.6/me/messages',
        qs: {access_token:keys.fb_token},
        method: 'POST',
        json: {
            recipient: {id:sender},
            message: messageData,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('sendTextMessage | Error sending messages: ', error);
        } else if (response.body.error) {
            console.log('sendTextMessage | Error: ', response.body.error);
        }
    });
}
*/

sendMessage = function (sender, text) {
    let messageData = { text: 'Please choose an activity from the side menu! :)'};
    chat.chat.forEach(function(element) {
        element.keywords.forEach(function(keyword) {
            if(text.toLowerCase().includes(keyword.toLowerCase())){
                messageData = element.response;
            }
            if(text.toLowerCase().includes('weather')){
                console.log('setting state to weather...');
                usersState[sender] = 'STATE_WEATHER';
            }
            
            if(text.toLowerCase().includes('restaurant')){
                console.log('setting state to restaurant...');
                usersState[sender] = 'STATE_RESTAURANT';
            }
        }, this);
    }, this);
    callSendAPI(sender, messageData);
}

receivedMessage = function (event, res) {
    //console.log('incoming event', event);
    var senderID = event.sender.id;
    var recipientID = event.recipient.id;
    var timeOfMessage = event.timestamp;
    var text = null;
    var coordinates = null;
    if (event.message && event.message.text && !event.message.is_echo) {
        var message = event.message;
        console.log('event.message = ' + JSON.stringify(message));
        var messageId = message.mid;
        text = message.text;
    }
    else if (event.message && event.message.attachments && event.message.attachments[0].payload && event.message.attachments[0].payload.coordinates && !event.message.is_echo) {
        console.log('event.message = ' + JSON.stringify(message));
        var messageAttachment = event.message.attachments[0];
        coordinates = messageAttachment.payload.coordinates;
        text = coordinates.lat + ',' + coordinates.long;
    }
    else if (event.postback) {
        text = JSON.stringify(event.postback)
        console.log('postback received: ' + text);
    }
    else{
        // it was probably some other info that we have nothing to do at this point
        if(event.message && event.message.is_echo){
            console.log('it is a echo! Returning without doing anything...');
        }
        else{
            console.log('returning without doing anything...');
        }
    }  
    if(text){
        if(usersState[senderID] === 'STATE_WEATHER'){
            getWeather( senderID, 
                        text, 
                        function(message) {
                            callSendAPI(senderID, {text: message});
                        }
            );

        }
        else if(usersState[senderID] === 'STATE_RESTAURANT'){
            getRestaurant( senderID, 
                        text, 
                        function(message) {
                            callSendAPI(senderID, message);
                        }
            );
        }
        else{
            if (text === 'Generic') {
                sendGenericMessage(senderID);
            }
            else{
                sendMessage(senderID, text);
            }
        }
    }
}

getWeather = function (senderID, location, callback) {
    var weatherEndpoint = 'https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20weather.forecast%20where%20woeid%20in%20(select%20woeid%20from%20geo.places(1)%20where%20text%3D%22' + location + '%22)&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys';
    var currentWeatherEndPoint = 'https://api.apixu.com/v1/current.json?key=96d9ed80ad7f44b386a152505172201&q=' + location;

    console.log(currentWeatherEndPoint);
    request(
        {
            url: currentWeatherEndPoint,
            json: true
        },
        function(error, response, body) {
            try {
                if(body.current && body.location){
                    //var condition = body.query.results.channel.item.condition;
                    //var result = body.current;
                    usersState[senderID] = null;
                    callback("Today is " + body.current.temp_c + " °C (" + body.current.temp_f + " °F) and condition is " + body.current.condition.text + " in " + body.location.name);
                    
                    setTimeout(function() {
                        sendMessage(senderID, 'welcome'); 
                    }, 1500);
                       
                }
                else{
                    console.error('There was an error calling Weather API');
                    callback("There was an error getting Weather. Try again writing location e.g. Paris");
                }
            } catch(err) {
                console.error('error caught', err);
                callback("There was an error");
            }
        }
    );
}

distance = function(position1,position2){
    var lat1=position1.lat;
    var lat2=position2.lat;
    var lon1=position1.long;
    var lon2=position2.long;
    var R = 6371000; // metres
    var φ1 = lat1 * Math.PI / 180;
    var φ2 = lat2 * Math.PI / 180;
    var Δφ = (lat2-lat1) * Math.PI / 180;
    var Δλ = (lon2-lon1) * Math.PI / 180;

    var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ/2) * Math.sin(Δλ/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    var d = R * c;
    //console.log('distance: ' + d + 'R: ' + R + ' c: ' + c + ' a: ' + a);
    return d;
}

getRestaurant = function (senderID, location, callback) {
    var output = '';
    
    var loc_temp = location.split(',');
    var loc = {"long": 2.5082287999999835, "lat": 48.927868};
    
    if(loc_temp.length > 1){
        loc = {"lat": parseFloat(loc_temp[0]), "long": parseFloat(loc_temp[1])};
        console.log('input location: ' + JSON.stringify(loc));
        var closest = restaurants.restaurants[0].coordinates;
        var closest_name = restaurants.restaurants[0].name;
        var closest_distance = distance(closest, loc);
        
        restaurants.restaurants.forEach(function(entry) {
            if(distance(entry.coordinates, loc) < closest_distance){
                closest_distance = distance(entry.coordinates, loc);
                closest_name = entry.name;
                closest = entry.coordinates;
            }
            //callback('Closest Restaurant: ' + entry.name + ' coordinates: ' + entry.coordinates.lat + ', ' + entry.coordinates.long);
            //output = output + 'Restaurant: ' + entry.name + '\n';
        });

        var result = {
            attachment: {
                "type": "template",
                "payload": {
                    "template_type": "generic",
                    "elements": {
                        "element": {
                            "title": closest_name,
                            "image_url": "https:\/\/maps.googleapis.com\/maps\/api\/staticmap?size=764x400&center=" + closest.lat + "," + closest.long + "&zoom=15&markers=" + closest.lat + "," + closest.long,
                            "item_url": "http:\/\/maps.apple.com\/maps?q=" + closest.lat + "," + closest.long + "&z=16"
                        }
                    }
                }
            }
        };
        
        usersState[senderID] = null;
        callback(result);
        
        setTimeout(function() {
            sendMessage(senderID, 'welcome'); 
        }, 1500);
    }
    else{
        usersState[senderID] = null;
        callback({text: "Address incorrect!"});
        
        setTimeout(function() {
            sendMessage(senderID, 'welcome'); 
        }, 1500);
    }
}

module.exports = function(app){

  // for Facebook verification
    console.log('adding webhook API');
    app.get('/webhook/', function (req, res) {
        if (req.query['hub.verify_token'] === keys.verify_token) {
            res.send(req.query['hub.challenge']);
        }
        res.send('Error, wrong token');
    });

    app.post('/webhook/', function (req, res) {
        

        var data = req.body;
        // Make sure this is a page subscription
        if (data.object === 'page') {
        // Iterate over each entry - there may be multiple if batched
            data.entry.forEach(function(entry) {
                var pageID = entry.id;
                var timeOfEvent = entry.time;
                // Iterate over each messaging event
                entry.messaging.forEach(function(event) {
                    console.log('got another entry!');
                    receivedMessage(event, res);
                });
            });
        }
        // Assume all went well.
        //
        // You must send back a 200, within 20 seconds, to let us know
        // you've successfully received the callback. Otherwise, the request
        // will time out and we will keep trying to resend.
        res.sendStatus(200);
    });
}