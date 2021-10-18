const main = require('../main');

function initModeration(dbo){
  dbo.collection("moderation").find().toArray(function(err, res){
    if(err) throw err;
    setRegexArray(res[0].regexes);
  });
}


var regexes = new Array();

function setRegexArray(arr){
  regexes = arr;
}



//moderate messages
//return true if flag is tripped to prevent bot replying in chat
function checkMessage(username, msg, msgID){
  regexes.forEach((reg) => {
    var re = new RegExp(reg.pattern);
    var check = re.exec(msg);
    if(check != null){
      console.log('message matched filter');
      console.log('user: ' +user + ' message: ' + msg + ' regex: ' + reg.name);
      var mod = 'bot'
      if(reg.timeout === "999"){
        main.sendDiscord(mod, username, msg, "message deleted", reg.name);
        main.sendDelete(msdID);
        return true;
      } else{
        main.sendDiscord(mod, username, msg, reg.timeout, reg.name);
        main.sendTimeout(username, reg.timeout, "regex tripped");
        return true;
      }
    } else {
      return false;
    }
  });
}


//
//


module.exports.initModeration = initModeration;
module.exports.checkMessage = checkMessage;
