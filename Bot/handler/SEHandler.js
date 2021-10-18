
var request = require('request');

const main = require('../main');
const spoopH = require('./spoopathonHandler');
const marathonH = require('./marathonHandler');
const tipFeatureH = require('./tipFeatureHandler');


var transactionList = new Array();

async function runSE(seChannelID, seToken, seOverlayToken, configData) {
    if(configData[0].streamIsLive){
      var options = {
          url: 'https://api.streamelements.com/kappa/v2/tips/'+seChannelID+'?sort=-createdAt&limit=1',
          method: 'GET',
          headers: {
            "Accept": 'application/vnd.twitchtv.v5+json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.85 Safari/537.36',
            'Authorization': 'Bearer ' + seToken
          }
      };

      request(options, function(error, response, body){
        if(response &&response.statusCode == 200){
          const j = JSON.parse(body);
          var d = j.docs;
          //console.log(d);
          var arr = d[0];//d variable is an array, first index is most recent donation
          //todo add ability for last 3 or so tips
          var transactionId = arr.transactionId;
          if(transactionList.indexOf(`${transactionId}`) < 0 && transactionId != configData[0].SEtransactionID){
            // id not found in our collection or our latest id in DB, assume new donation
            var amt = arr.donation.amount;
            var username = arr.donation.user.username;
            var msg = arr.donation.message;
            console.log('tID: ' + transactionId + ' amt: ' + amt + ' username: ' + username + ' msg: ' + msg);
            //send to handler
            handleTip(amt, username, msg, configData);
            //append this id to our collection
            transactionList.push(transactionId);
            //append most recent to database to handle restarts without dupes
            main.seUpdateTransactionID(transactionId);
              }

          //done(null, JSON.parse(body));
        } else {
          //console.log('1 ' + body);
          //done(JSON.parse(body));
        }
      });
    }
}


function handleTip(amt, username, msg, configData){
  //get statuses from database
    spoopathonStatus = configData[0].spoopathonStatus;
    marathonStatus = configData[0].marathonStatus;
    tipFeatureStatus = configData[0].tipFeatureStatus;
    sendTipToChatStatus = configData[0].sendTipToChatStatus;
  //data to spoopathon, marathon, tip feature
    if(spoopathonStatus){
      //send amount and message so we can look for #gameID, otherwise ignore
      spoopH.intakeTip(amt, msg);
    }
    if(marathonStatus){
      marathonH.intakeTip(amt);
    }
    if(tipFeatureStatus){
      tipFeatureH.intakeTip(amt);
    }
    if(sendTipToChatStatus){
      main.sendMessage('Thank you ' + username + ' for the $' + amt + ' tip! kffcHug', true);
    }
  }


module.exports.runSE = runSE;
