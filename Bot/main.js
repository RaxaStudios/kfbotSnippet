const TwitchJs = require('twitch-js').default;
const { ApiClient } = require('twitch');
const { RefreshableAuthProvider, StaticAuthProvider } = require('twitch-auth');
const { BasicPubSubClient } = require('twitch-pubsub-client');

var mongo = require('./handlers/mongoUtil');
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27018";
var ObjectID = require('mongodb').ObjectID;


const express = require('express');
const app = express();
var request = require('request');
const bodyParser = require('body-parser');
var cors = require('cors');

//handler vars here
const mH = require('./handlers/messageHandler');
const cH = require('./handlers/commandHandler');
const lH = require('./handlers/lotteryHandler');
const pH = require('./handlers/pollHandler');
const pubH = require('./handlers/pubSubHandler');
const apiH = require('./handlers/apiHandler');
const spoopH = require('./handlers/spoopathonHandler');
const marathonH = require('./handlers/marathonHandler');
const tipFeatureH = require('./handlers/tipFeatureHandler');
const sEH = require('./handlers/SEHandler');

//global variables here
var client = null;
var authProvider = null;
var CHAT = null;
var API = null;
var CHANNEL = "";
var DATABASE =  null;
//var DBNAME = "raxabot";//test db
var DBNAME = "kffbot";

//setup mongoUtil
mongo.connectToServer( function( err, client ) {
  if (err) console.log(err);

  var dbo = mongo.getDb();
  setupServices(dbo);
});

function setupServices(dbo){
  dbo.collection("config").find().toArray(function(err, result) {
    if (err) throw err;
    handleStartup(result[0]); //start rest of systems now that we have data
  });
  dbo.collection("lottery").find().toArray(function(err, result) {
    if(err) throw err;
    console.log(result);
    lH.updateSettings(result[0].lottoStatus, result[0].lottoKeyword);
  });
  dbo.collection("poll").find().toArray(function(err, result) {
    if(err) throw err;
    pH.updateSettings(result[0].pollStatus, result[0].options, result[0]._id);
  });

  //initialize mod info
  mH.initModeration(dbo);

  //setup changestreams
  const configChangeStream = dbo.collection("config");
  const configStream = configChangeStream.watch();
  configStream.on("change", function(event){
    //console.log('change found in local DB');
    //console.log(event);
  });

  const modChangeStream = dbo.collection("moderation");
  const modStream = modChangeStream.watch();
  modStream.on("change", function(event){
    //update our moderation stuff
    mH.initModeration(dbo);
  });

  const commandChangeStream = dbo.collection("commands");
  const commandStream = commandChangeStream.watch();
  commandStream.on("change", function(event){
    console.log('change found in local DB');
  //  var eJ = JSON.parse(JSON.stringify(event));
    //console.log(eJ.fullDocument);
  });

  const lottoChangeStream = dbo.collection("lottery");
  const lottoStream = lottoChangeStream.watch();
  lottoStream.on("change", function(event){
    console.log(event);
    var type = event.operationType;
    if(type != 'insert' || type != 'delete'){ //ignore people being added/removed
    var dbo = mongo.getDb();
    dbo.collection("lottery").find().toArray(function(err, result) {
      if (err) throw err;
      var status = result[0].lottoStatus;
      var keyword = result[0].lottoKeyword;
      console.log(status);
      console.log(keyword);
      //set lottery status
      lH.updateSettings(status, keyword);
    });
}
  });

  const pollChangeStream = dbo.collection("poll");
  const pollStream = pollChangeStream.watch();
  pollStream.on("change", function(event){
    try{
    var isCount = JSON.stringify(event.updateDescription.updatedFields).includes("count");
    if(!isCount){ //ignore change in count
    var dbo =  mongo.getDb();
      dbo.collection("poll").find().toArray(function(err, result) {
        if (err) throw err;
        var status = result[0].pollStatus;
        var options = result[0].options;

        pH.updateSettings(status, options);
      });
    }
  } catch(e){
    console.log(e);
  }
  });

  //set db as global
  DATABASE = dbo;
  console.log('connected to mongodb');
}


//setup for systems now that we have database info
async function handleStartup(res){
  const clientID = res.client_id;
  const clientSecret = res.client_secret;
  var accessToken = res.accessToken;
  const refreshToken = res.refreshToken;
  const user = res.user;
  const pw = res.pw;
  const seChannelID = res.seChannelID;
  const seToken = res.seToken;
  const seOverlayToken = res.seOverlayToken;

var options = { token: pw, username: user, clientId: clientID};
const { api, chat }  = new TwitchJs(options);

  API = api;
  CHAT = chat;
  // Listen for all events.
  chat.on(TwitchJs.Chat.Events.ALL, handleMessage);

//TODO try to fix access token not working on restarts (according to debug info)

authProvider = await new RefreshableAuthProvider(new StaticAuthProvider(clientID, accessToken), {
    clientSecret,
    refreshToken,
    onRefresh: (token) => {
        // save new token to db
        accessToken = token._data.access_token;
        //console.log("Setting new access token to: " + accessToken);
         mongo.getDb().collection("config").updateOne(
          { "_id" : ObjectID("  ")},
          {$set: {
              "accessToken": token._data.access_token
            }});
    }
});

client = await new ApiClient({ authProvider });

  //CHANNEL = res.joinedChannel;//temp fix for getting around database restart/issues
  CHANNEL = "kungfufruitcup";
    // connect to chat and join channel
    chat.connect().then(() => {
      chat.join(CHANNEL);
      //open pubsub connection now that vars are set
      startPubSub();
      //begin checking for stream going live notifs to send to discord
      //startLiveChecks(CHANNEL);
      startLiveChecks("kungfufruitcup"); //test

      //start checking for tips
      startStreamElements(seChannelID, seToken, seOverlayToken);

      //begin subcount checking
      startSubCounter();

      //setup webhook for eventsub
      setupWebhook();
    });
};

function failed(f){
  console.log(f);
}

//init pubsub
function startPubSub(){

//not in use until pubsub either includes more data or is needed
//todo review need/use and cleanup database variable in favor of mongoUtil
const pubsub = new BasicPubSubClient();


pubsub.onMessage((topic, message) =>{
  console.log(topic);
  //console.log(message);
  if(topic === "channel-bits-events-v2.  "){
    pubH.handleBit(message, DATABASE);
  } else if( topic === "chat_moderator_actions.  "){
    pubH.handleMod(message, DATABASE);
  } else if( topic === "channel-points-channel-v1.  "){
    pubH.handleRedeem(message, DATABASE);
  } else if( topic === "channel-subscribe-events-v1.  "){
    //pubH.handleSub(message, DATABASE);
    //ignoring until mass gifts fixed
  }
});

pubsub.onConnect(()=>{
console.log("connected to pubsub");
});

pubsub.onDisconnect((isErr, reason)=>{
  if(isErr){
    console.log('error');
    console.log(reason);
  } else {
    console.log('disconnected');
    console.log(reason);
  }
});
var topicsArray = [
  "channel-bits-events-v2.  ",
  "chat_moderator_actions.  ",
  "channel-points-channel-v1.  ",
  "channel-subscribe-events-v1.  "];

var scopes = "bits:read,channel:read:redemptions,channel_subscriptions,channel:moderate";

pubsub.listen(topicsArray, authProvider, scopes);

pubsub.connect();
}

//todo not in use yet
//webhook twitch stuff post
async function setupWebhook(){
  const user = await client.helix.users.getUserByName("");
  console.log(user._data.id);
  var json = {
    "type": "channel.follow",
    "version": "1",
    "condition": {
      "broadcaster_user_id": user._data.id
    },
    "transport": {
      "method": "webhook",
      "callback": "",
      "secret": ""
    }
  }
  var options = {
    url: 'https://api.twitch.tv/helix/eventsub/subscriptions',
    body: JSON.stringify(json),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-ID' : "",
      'Authorization': ""
    }
  }

  request(options, function(error, response){
    if(response &&response.statusCode == 200){
      //send json body back to the endpoint
      const j = JSON.parse(response.body);
      console.log(j);

    } else {
      //possible handle of errors here
      console.log('error in setting up webhook')
      console.log(response.body)
    }
  });
}


function startStreamElements(seChannelID, seToken, seOverlayToken){
  setTimeout(()=> runSE(seChannelID, seToken, seOverlayToken), 5000); //start after 5 seconds
  setInterval(()=> { runSE(seChannelID, seToken, seOverlayToken) }, 1000 * 60); //repeat every 60seconds
}

async function runSE(seChannelID, seToken, seOverlayToken) {
  var dbo =  mongo.getDb();
  dbo.collection("features").find().toArray(function(err, result) {
    if (err) throw err;
    sEH.runSE(seChannelID, seToken, seOverlayToken, result);
  });
}

//function to update database for SE transationId
function seUpdateTransactionID(id){
   mongo.getDb().collection("features").updateOne(
    { "_id" : ObjectID("  ")},
    {$set: {
        "SEtransactionID": id
      }});
}



function startLiveChecks(channel){
  setInterval(()=>{ isLive(channel)}, 1000*60);
}

async function isLive(username){

  const user = await client.helix.streams.getStreamByUserName(username);

  var dbo =  mongo.getDb();
  var status = null;
  dbo.collection("features").find().toArray(function(err, result) {
    if (err) throw err;
    status = result[0].streamIsLive;

  if(user === null && status){
    console.log("isLive attempting to change to offline");
    //if stream is offline AND db is set to stream is online change it
      mongo.getDb().collection("features").updateOne(
      { "_id" : ObjectID("  ")},
      {$set: {
          "streamIsLive": false
        }});

  } else if(!status && user != null) {
    console.log("isLive attempting to change to online");
    //if stream is online and database is set to stream is offline, change it and send to discord
     mongo.getDb().collection("features").updateOne(
      { "_id" : ObjectID("  ")},
      {$set: {
          "streamIsLive": true
        }});
        var json = JSON.parse(JSON.stringify(user._data));
        console.log(json);
        var game = json.game_name;
        var thumbnail = json.thumbnail_url;
        thumbnail = thumbnail.replace("{width}", "320").replace("{height}", "180");//embed resolution
        sendDiscordGoingLive(game, thumbnail);
  }
});
}


function startSubCounter(){
  setInterval(()=>{ getSubs()}, 1000*35);
}

async function getSubs(){
  var subs;
  var subCount = 0;
  var page = 0;
  var dupeArray = new Array();
  do {
    const user = await client.helix.users.getUserByName("kungfufruitcup");
    //console.log(user);

    subs = await client.kraken.channels.getChannelSubscriptions(user, page, 100, "asc");
    //console.log(subs);
    subs.forEach((sub)=>{
      var subPlan = parseInt(sub._data.sub_plan);
      var subPoints = 0;
      if(subPlan === 1000){
          subPoints = 1;
      } else if(subPlan === 2000){
        subPoints = 2;
      } else if(subPlan === 3000){
        subPoints = 6;
      } else {
          console.log('unknown plan found: ')
          console.log(subPlan);
      }
      var user = sub._data.user.name
      if(dupeArray.indexOf(`${user}`) < 0){
        subCount =  subCount + subPoints;
        dupeArray.push(user);
        //console.log(dupeArray)
      } else {
        //console.log('Duplicate found');
      }
      //console.log(subCount);
      //console.log(sub._data.sub_plan);
      //console.log(sub._data.user);}
    });
    page++;
  } while(subs.length != 0);
//todo test sub count offset once in place on dashboard
  var dbo = mongo.getDb();
  var offset = 7; //default
  dbo.collection("features").find().toArray(function(err, res){
    if(err) throw err;
    offset = res[0].subCountOffset;
  });
   mongo.getDb().collection("features").updateOne(
    { "_id" : ObjectID("  ")},
    {$set: {
        "subcount": (subCount-offset)
      }});
}


//functions below here
const handleMessage = async msg => {
  cH.handleIncoming(msg, client, DATABASE);
}

function sendTimeout(user, length, reason){
//  CHAT.timeout(user + " " + length + " " + reason);
  CHAT.say(CHANNEL, '.timeout ' + user + ' ' + length + ' ' + reason);
}

function sendBan(user, reason){
  CHAT.ban(CHANNEL, user + " " + reason);
}

function sendDelete(msgID){
  CHAT.say(CHANNEL, '.delete ' + msgID);
}

function sendMessage(msg, action){
  console.log("message to chat:");
  console.log(msg);
  if(action){
    CHAT.say(CHANNEL, '/me ' + msg);
  } else {
    CHAT.say(CHANNEL,  msg);
  }
}

//sending to websocket systems
//discord
function sendDiscordBan(mod, user, reason){
  //send to websocket to discord bot for embed
  var json = { target: 'discord', system: 'moderation', type: 'ban', mod: mod, user: user, reason: reason};
  sendDiscord(json);
}

function sendDiscordUnban(mod, user){
  //send to websocket to discord bot for embed
  var json = { target: 'discord', system: 'moderation', type: 'unban', mod: mod, user: user};
  sendDiscord(json);
}

function sendDiscordTimeout(mod, user, length, reason){
  //send to websocket to discord bot for embed
  var json = { target: 'discord', system: 'moderation', type: 'timeout', mod: mod, user: user, length: length, reason: reason};
  sendDiscord(json);
}

function sendDiscordDelete(mod, user, msg){
  //send to websocket to discord bot for embed
  var json = { target: 'discord', system: 'moderation', type: 'delete', mod: mod, user: user, message: msg};
  sendDiscord(json);
}


function sendDiscordGoingLive(game, thumbnail){
  //send to websocket to discord bot for embed
  var json = { target: 'discord', system: 'goingLive', game: game, image: thumbnail};
  sendDiscord(json);
}

//frontend
function sendFrontEnd(json){
  var options = {
    url: 'https://kf.raxa.dev/api',
    body: JSON.stringify(json),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }

  request(options, function(error, response){
    if(response &&response.statusCode == 200){
      //send json body back to the endpoint
      const j = JSON.parse(response.body);
      console.log(j);

    } else {
      //possible handle of errors here
      console.log('error in sending to front end api')
      console.log(response.body)
    }
  });
}

//send to discord api
function sendDiscord(json){
  var options = {
    url: 'https://kf.raxa.dev/api/discord',
    body: JSON.stringify(json),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }

  request(options, function(error, response){
    if(response &&response.statusCode == 200){
      //send json body back to the endpoint
      const j = JSON.parse(response.body);
      console.log(j);

    } else {
      //possible handle of errors here
      console.log('error in sending to discord api')
      console.log(response.body)
    }
  });
}


//express app for rest endpoint stuff
app.use(express.static("./EventServer/public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('trust proxy', true);
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());

app.get('/api/bot', function(req, res){
  console.log("Bot endpoint reached");
  console.log(req.body);
  res.send("bot test print");
});

app.listen(8084);



//exports
module.exports.sendMessage = sendMessage;
module.exports.sendTimeout = sendTimeout;
module.exports.sendDelete = sendDelete;
module.exports.sendDiscordBan = sendDiscordBan;
module.exports.sendDiscordUnban = sendDiscordUnban;
module.exports.sendDiscordTimeout = sendDiscordTimeout;
module.exports.sendDiscordDelete = sendDiscordDelete;
module.exports.sendDiscordGoingLive = sendDiscordGoingLive;
module.exports.seUpdateTransactionID = seUpdateTransactionID;
