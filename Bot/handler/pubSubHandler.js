const main = require('../main');
var mongo = require('./mongoUtil');


//todo implement bot's quick moderation logging as well
//send to discord bot
function handleMod(msg, DATABASE){
  //console.log(msg);
  var mod = msg.data.created_by;
  var user = msg.data.args[0];
  var modAction = msg.data.moderation_action;
  if(modAction === "ban"){
    //todo may need to cache messages to get last message before ban
    //alternative: send link to user popout - https://www.twitch.tv/popout/kungfufruitcup/viewercard/notraxa?popout=
    var reason = msg.data.args[1];
    main.sendDiscordBan(mod, user, reason)
  } else if(modAction === 'unban'){
    main.sendDiscordUnban(mod, user);
  }else if(modAction === 'timeout'){
    var length = msg.data.args[1];
    var reason = msg.data.args[2];
    main.sendDiscordTimeout(mod, user, length, reason);
  } else if(modAction ==="delete"){
    var messageItem = msg.data.args[1];
    main.sendDiscordDelete(mod, user, messageItem);
  }else {
    console.log('unknown mod action found:');
    console.log(msg);
  }
}


function handleBit(msg, DATABASE){
  //handle systems integration(spoopathon/marathon)
  console.log(msg);
  var isAnon = msg.data.is_anonymous;
  if(!isAnon){
    var user = msg.data.user_name;
  } else {
    var user = "Anonymous";
  }
  var bits = msg.data.bits_used;
}



function handleSub(msg, DATABASE){
  //handle sub replies and systems integration
  var dbo = mongo.getDb();
  var responseArray = new Array();
  dbo.collection("pubsub").find().toArray(function(err, result){
    if(err) throw err;
    responseArray = result[0].sub;
  })
  console.log(msg);
  if(msg.context === "anonsubgift"){

  }
  var subName = msg.display_name;
  var isGift = msg.is_gift;
  var subPlan = msg.sub_plan;
  var months = msg.cumulative_months;
  var message = msg.sub_message.message;
  var context = msg.context;
  if(isGift){
    var gifter = msg.display_name;

    var giftAmount = msg.gift_count;
      var multiAmount = msg.multi_month_duration;
    if(giftAmount === 1){
      var reply = responseArray.massGiftSingle;
    } else {
      var reply = responseArray.massGift;
    }
  } else {
    if(msg.includes('msg-id=extendsub')){
      //ignore for now
    } else {
      var multiAmount = msg.multi_month_duration;
      if(multiAmount === 0){
        if(months < 2){//new sub
          if(subPlan === '1000' || subPlan ==='2000' || subPlan === '3000'){
            //vars: user todo: tiers
            var reply = responseArray.normalNew;
          } else if(subPlan === 'Prime'){
          //vars: user
          var reply = responseArray.primeNew;
          }
        } else{//resub
          if(subPlan === '1000' || subPlan ==='2000' || subPlan === '3000'){
            //vars: user, months
            var reply = responseArray.normalResub;
          } else if(subPlan === 'Prime'){
            //vars: user, months
            var reply = responseArray.primeResub;
          }
        }
      }
    }
  }
}

function isOnGiftCooldown(user){
      if(subCooldownArray.indexOf(`${user}`) < 0){
        //sub gifter not found, add to array
        subCooldownArray.push(command.name);
        setTimeout(() => {
          const index = subCooldownArray.indexOf(`${user}`);
          if (index >= 0){
            subCooldownArray.splice(index, 1);
          }
        }, 5000); //5 second delay to avoid spamming reply
        return false;
      } else {
        return true;
      }
}


function handleRedeem(msg, DATABASE){
  var user = msg.data.redemption.user.display_name;
  var rewardID = msg.data.redemption.id;
  var rewardTitle = msg.data.redemption.reward.title;
  var isInput = msg.data.redemption.reward.is_user_input_required;
  if(isInput){
    var text = msg.data.user_input;
  }
  //send to front end as needed for sounds/etc
  console.log(msg);
  console.log(rewardTitle);
}

function handleRaw(msg){
  console.log('usernotice print:');
  console.log(msg._raw);
  if(msg._raw.includes("sub-plan")){
    handleRawSub(msg._raw);
  } else if(msg._raw.includes("msg-param-viewerCount")){
    handleRawRaid(msg._raw);
  } else if(msg._raw.includes("bits=")){
    handleRawBits(msg._raw);
  }
}

//global vars to help prevent spam
var tempName = "";
var tempGiftAmount = 0;
//TODO implement for marathon/spooptahon/tiptracker
function handleRawSub(msg){
  var dbo = mongo.getDb();
  dbo.collection("pubsub").find().toArray(function(err, res){
  var name = parseMessageTag(msg, "display-name=");
  //mass gift
  if(msg.includes('msg-id=submysterygift')){ //mass gift notification
      tempGiftAmount = parseInt(parseMessageTag(msg, "gift-count="));
      tempName = name;
      var reply = "";
      if(tempGiftAmount === 1){
        reply = res[0].sub[0].massGiftSingle;
        reply = reply.replace("%user", name);
      } else {
        reply = res[0].sub[0].massGift;
        reply = reply.replace("%user", name);
        reply = reply.replace("%gifts", tempGiftAmount);
      }
      main.sendMessage(reply, true);
  } else if (msg.includes("msg-id=subgift")){
    console.log('msg subgift print');
    console.log(msg); //normal gifted sub notification
      var giftRecipient = parseMessageTag(msg, "recipient-display-name=");
      //ignore spam here
      if(tempName === name){
        tempGiftAmount--;
      } else {
        tempGiftAmount = 1;
        var reply = res[0].sub[0].giftSingle;
        reply = reply.replace("%user", name);
        reply = reply.replace("%recipient", giftRecipient);
        main.sendMessage(reply, true);
      }
      if(tempGiftAmount < 0){
        tempName = "";
      }
    } else {
      console.log('non-gift sub print');
      console.log(msg); //non-gifted sub
      var subMonths = parseMessageTag(msg, "msg-param-cumulative-months=");
      var tier = parseMessageTag(msg, "msg-param-sub-plan=");
      var points = 1; //for marathon/tips/spoop
      var reply = "";
      var eventInfo = "";
      if(tier === "Prime"){
          if(subMonths < 2){
          reply = res[0].sub[0].primeNew;
          reply = reply.replace("%user", name);
          eventInfo  = "New prime sub from: " + name;
        } else {
          reply = res[0].sub[0].primeResub;
          reply = reply.replace("%user", name);
          reply = reply.replace("%months", subMonths);
          eventInfo = "Resub with prime from: " + name + "  for " + subMonths + " months";
        }
      } else {
        if(subMonths < 2){
          reply = res[0].sub[0].normalNew;
          reply = reply.replace("%user", name);
          var eventTier = "1";
          if(tier === "2000"){
            eventTier =  "2";
          } else if(tier === "3000"){
            eventTier = "3";
          }
          eventInfo = "New tier " + eventTier + " sub from: " + name;
        } else {
          reply =  res[0].sub[0].normalResub;
          reply = reply.replace("%user", name);
          reply = reply.replace("%months", subMonths);
          var eventTier = "1";
          if(tier === "2000"){
            eventTier =  "2";
          } else if(tier === "3000"){
            eventTier = "3";
          }
          eventInfo = "Resub at tier " + eventTier + " sub from: " + name + " for " + subMonths + " months";
        }
        //tier check
        if(tier === "2000"){
          points = 2;
        } else if(tier === "3000"){
          points = 5;
        }
      }
      main.sendMessage(reply, true);
      sendToDash("sub", eventInfo);
    }
  });
}

function handleRawRaid(msg){
  var dbo = mongo.getDb();
  dbo.collection("pubsub").find().toArray(function(err, res){
    var raider = parseMessageTag(msg, "msg-param-displayName=");
    var viewers = parseMessageTag(msg, "msg-param-viewerCount=");
    var reply = res[0].raid.raidReply;
    reply = reply.replace('%user', raider);
    //replace %user with raider variable
    main.sendMessage(reply, true);
  });
}

function handleRawBits(msg){
  var amt = parseMessageTag(msg, "bits=");
  var user = parseMessageTag(msg, "display-name=");
  //TODO implement for tip handler, marathon, and spoopathon
}

//usage: String subDisplayName = messageTagValue(msg, "display-name=");
function parseMessageTag(message, tag){
  var startIndex = message.indexOf(tag) + tag.length;
  var endIndex = message.indexOf(";", startIndex);
  var tagValue = message.substring(startIndex, endIndex);
  return tagValue;
}

function sendToDash(system, message){
  var json = { type: "eventList", system: system, message: message};
  //main.sendToDash(json);
}

module.exports.handleMod = handleMod;
module.exports.handleBit = handleBit;
module.exports.handleSub = handleSub;
module.exports.handleRedeem = handleRedeem;

module.exports.handleRaw = handleRaw;
