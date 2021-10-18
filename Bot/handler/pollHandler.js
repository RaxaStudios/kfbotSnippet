const main = require('../main');
var ObjectID = require('mongodb').ObjectID;
var currentStatus = "off";
var currentOptions = new Array();
var collectionID = "";

function handleIncoming(data){

}


//update our variables
function updateSettings(status, options, id){
  collectionID = id;
  if(currentStatus === "off" && status === "on"){
    openPoll(status, options);
  } else if (currentStatus === "on" && status === "off") {
    closePoll();
  }
}



function checkPoll(userstate, msg, DATABASE){
  if(currentStatus === "on"){
    currentOptions.forEach((option) => {
      //console.log(option);
      if(msg === option.name){
        option.count++;
        var name = option.name;
        //console.log('adding to option: ' + option.name);
        //console.log('count after add: ' + option.count);
        //update database count value
        var dbo = DATABASE.db("kffbot");
        dbo.collection("poll").updateOne(
          { "options.name": name },
          {
            $set: { "options.$.count" : option.count }
          },
          function(err, doc){
            if(err) throw err;
            //console.log(doc);
          });
      }
    });

  }
}

//replace options array in database
function openPoll(status, options){
  currentStatus = status;
  currentOptions = options;

}

module.exports.updateSettings = updateSettings;
module.exports.checkPoll = checkPoll;
module.exports.handleIncoming = handleIncoming;
