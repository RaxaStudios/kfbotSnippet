const main = require('../main');
var mongo = require('./mongoUtil');
//handler vars here
const mH = require('./messageHandler');
const lH = require('./lotteryHandler');
const pH = require('./pollHandler');
const pubH = require('./pubSubHandler');
const apiH = require('./apiHandler');
const spoopH = require('./spoopathonHandler');
const yt = require('./ytHandler');

const cooldownArray = new Array();


async function handleIncoming(msg, client, DATABASE){
  if(msg.command != "PART" || msg.command != "JOIN" || msg.command != "PING" || msg.command != "PONG"){
    //console.log(msg);
  }
  if(msg.command === "PRIVMSG"){
    if(msg.isSelf){
      return;
    }

    //console.log(userstate);
    //if moderation returns true flag exit out
    if((`#${msg.username}`) === msg.channel && !msg.tags.mod){
      if(mH.checkMessage(msg.username, msg.message, msg.tags.id)) {
        return;
      }
    }

    if(msg.message === "!followage"){
      followage(msg.tags.displayName, msg.tags.userID, client);
      return;
    }
    if(msg.message === "!uptime"){
      uptime(client);
      return;
    }
    if(msg.message.startsWith("!follow") && (`#${msg.username}` === msg.channel || msg.tags.mod)){
      var params = msg.message.split(" ");
      followCommand(params[1], client, mongo.getDb());
      return;
    }

    //special game related info command mod only command
    if(msg.message === "!game" && (`#${msg.username}` === msg.channel || msg.tags.mod)){
      gameCommand();
      return;
    }



    //check for keyword to enter lottery
    lH.checkLottery(msg.tags.displayName, msg.message, mongo.getDb());
    /*if(msg.message.includes('!draw')){
      lH.drawLotto(DATABASE);
      return;
    }*/

    //check for poll related stuff
    pH.checkPoll(msg.username, msg.message, mongo.getDb());

    try{
    yt.checkLink(msg.message, mongo.getDb());
  } catch(e) {
    console.log('error in yt checker');
  }

    if(msg.message.includes('!')){
      handleCommand(msg.username, msg.message, mongo.getDb());
    } else {
      //ignore for now
      //mH.handleMessage(userstate, message, DATABASE);
    }

  //possible todo - event sub once in use
  } else if(msg.command === "USERNOTICE"){
    //implement instead of pubsub
    pubH.handleRaw(msg);
  }
}

function handleCommand(username, msg, DATABASE){

  //check out database for matching commands
  //convert msg to command for paramaters and usage like !youtube @person
  var commandName = getCommand(msg);
  var dbo = mongo.getDb();
  dbo.collection("commands").find().toArray(function(err, result) {
    if (err) throw err;
    var data = JSON.parse(JSON.stringify(result[0]));
    var commandArray = data.data;
    commandArray.forEach((command)=>{
      if(command.name === commandName){
        if(cooldownArray.indexOf(`${command.name}`) < 0){
          //get parameters if needed
          var text = `${command.text}`;
          if(text.includes("%param%")){
            var params = msg.substring(msg.indexOf(" "));
            text =  text.replace("%param%", params);
            main.sendMessage(text, true);
          } else{
          console.log(command.text);
          main.sendMessage(`${command.text}`, true);
        }
          cooldownArray.push(command.name);
          setTimeout(() => {

            const index = cooldownArray.indexOf(`${command.name}`);
            if (index >= 0){
              cooldownArray.splice(index, 1);
            }
          }, command.cooldownInSec * 1000); //database has cooldown in seconds, convert to ms
        } else {
          //console.log(command.name + ' on cooldown');
        }

      }
    });
  });
};

//function to get the command portion of text
function getCommand(msg){
  if(msg.includes(" ")){
    return msg.substring(0, msg.indexOf(" "));
  } else {
  return msg;
  }
}

//repeating commands
var repeatArray = new Array();
function startRepeats(DATABASE){
  var dbo = mongo.getDb();
  dbo.collection("commands").find().toArray(function(err, result) {
    if (err) throw err;
    var data = JSON.parse(JSON.stringify(result[0]));
    var commandArray = data.data;
    commandArray.forEach((command)=>{
      if(command.repeating === "true"){
        setStartRepeat(command);
      }
    });
  });
}

function setStartRepeat(command){
  console.log('starting repeating command: ' + command.name);
  //set name of index to commandName to find easily
  //setTimeout sets the initial delay
  //nested setInterval runs the interval setting
  var element = setInterval(() =>{
  //  console.log(command.text);
  }, command.interval * 1000);
  //id is how we read the setInterval to stop it running
  repeatArray[command.name] = {'func': (setTimeout(function(){element}, command.initialDelay * 1000)), 'id': element};
}

//todo try to convert json file for commands without the data tag, may be causing the updateOne issue

function stopRepeating(command, DATABASE){
  clearInterval(repeatArray[command].id);
  delete repeatArray[command];
  console.log(command + ' repeating stopped');
  //update db to reflect stop
  //console.log(repeatArray);
  var dbo = mongo.getDb();
  dbo.collection("commands").find({name:"!turtle"});
  dbo.collection("commands").updateOne(
    { name : "!turtle" },
    {
      $set: { repeating : "false"}
    },
    function(err, doc){
      if(err) throw err;
      //console.log(doc);
    }
);
}

//built in commands
async function followage(username, userID, client){
  var userJson = await client.kraken.users.getUserByName(username);
  var userID = JSON.parse(JSON.stringify(userJson._data))._id;
  var channelJson = await client.kraken.users.getUserByName('kungfufruitcup');
  var channelID = JSON.parse(JSON.stringify(channelJson._data))._id

  var t = await client.kraken.users.getFollowedChannel(userID, channelID);

  var beginDate = t.followDate;
  var today = new Date();
  var diff = today-beginDate; // in ms
  var seconds = diff/1000;
  var minutes = seconds/60;
  var hours = minutes/60;
  var days = parseInt(hours/24);
  minutes = parseInt(minutes % 60);
  hours = parseInt(hours % 24);

  var startingOn = new Date(beginDate);
  var dateFormat = require('dateformat');
  var startingOnText = dateFormat(startingOn, "mmmm dS, yyyy");
  var output = username + ' has been following for ' + days + ' days, ' + hours + ' hours, ' + minutes + ' minutes. Starting on ' + startingOnText;
  main.sendMessage(output, true);
}

async function uptime(client){
  var stream = await client.helix.streams.getStreamByUserName("kungfufruitcup");
  var start = stream.startDate;
  console.log(start);
  var today = new Date();
  var diff = today-start; // in ms
  var seconds = diff/1000;
  var minutes = seconds/60;
  var hours = minutes/60;
  seconds = parseInt(seconds%60);
  minutes = parseInt(minutes % 60);
  hours = parseInt(hours);
  var output = 'Stream has been live for ' + hours + ' hours, ' + minutes +' minutes, ' + seconds + ' seconds';
  main.sendMessage(output, true);
}

async function isLive(client){
  var user = await client.kraken.streams.getStreamByUserName("kungfufruitcup");
  if(user === null){
    return false;
  }
  return true;
}


//todo reserved commands separate from user commands
async function followCommand(username, client, DATABASE){

  var channelJson = await client.helix.users.getUserByName(username);
  var channelID = JSON.parse(JSON.stringify(channelJson._data)).id;
  var user = await client.kraken.channels.getChannel(channelID);
  var game = JSON.parse(JSON.stringify(user._data)).game;
  var output = null;

  //grab follow wording form database
  var dbo = mongo.getDb();
  dbo.collection("commands").find().toArray(function(err, result) {
    if (err) throw err;
    var data = JSON.parse(JSON.stringify(result[0]));
    var commandArray = data.data;
    commandArray.forEach((command)=>{
      if(command.name === "!follow"){
        output = command.text;
      }
    });
    output = output.replace("%param%", username).replace("%param%", username).replace("%game%", game);
    main.sendMessage(output, true);
  });
}

//special command that changes depending on the game being played 
async function gameCommand(){
  var channelJson = await client.helix.users.getUserByName("kungfufruitcup");
  var channelID = JSON.parse(JSON.stringify(channelJson._data)).id;
  var user = await client.kraken.channels.getChannel(channelID);
  var game = JSON.parse(JSON.stringify(user._data)).game;
  var output = null;

  var dbo = mongo.getDb();
  dbo.collection("commands").find().toArray(function(err, result) {
    if (err) throw err;
    var data = JSON.parse(JSON.stringify(result[0]));
    var gameInfoArray = data.gameInfo;
    gameInfoArray.forEach((gameItem)=>{
      if(gameItem.game === game){
        output = game.text;
      }
    });
    if(output){
      main.sendMessage(output, true);
    } else {
      console.log('error occured with game command');
    }
  });
}



module.exports.handleIncoming = handleIncoming;
module.exports.stopRepeating = stopRepeating;
module.exports.handleCommand = handleCommand;
module.exports.startRepeats = startRepeats;
module.exports.followage = followage;
module.exports.uptime = uptime;
module.exports.followCommand = followCommand;
