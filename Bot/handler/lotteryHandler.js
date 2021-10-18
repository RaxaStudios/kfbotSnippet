const main = require('../main');
var mongo = require('./mongoUtil');
var ObjectID = require('mongodb').ObjectID;
var currentStatus = "off";
var currentKeyword = "keyword";

function handleIncoming(data){

}



//update our variables
function updateSettings(status, keyword){
  console.log("print in lotto update settings");
  console.log(status);
  console.log(keyword);
  if(currentStatus === "off" && status === "on"){
    openLottery(status, keyword);
  } else if (currentStatus === "on" && status === "off") {
    closeLottery();
  }

}

function openLottery(status, keyword){
  currentStatus = status;
  currentKeyword = keyword;
  main.sendMessage('A lottery has started, type ' + keyword + " to join!", true);
}

function closeLottery(){
  currentStatus = "off";
  console.log("Lottery closed");
}

function checkLottery(username, msg, DATABASE){
  console.log(currentStatus);
  if(currentStatus === "on"){
    if(msg.includes(currentKeyword)){
      addToLotto(username, DATABASE);
    } else if(msg.includes("!unlotto")){
      removeLotto(username, mongo.getDb());
    }
  }
}


async function addToLotto(username, DATABASE){
  var userToAdd =  { username: username, tickets: 1};
  var lottoDB = mongo.getDb();

  var checkForUser = { username: username };

  const user = await lottoDB.collection('lottery').find(checkForUser).toArray(function(err, res) {
    if(err) throw err;
    //if the array is empty, user is not already entered
if(res.length === 0){
  lottoDB.collection('lottery').insertOne(userToAdd, function(err, res) {
    if(err) throw err;
    main.sendMessage('added ' + username + ' to the lottery', true);
    //console.log('added ' + userToAdd + ' to the lottery collection');
  });
  } else {
    main.sendMessage(username + " already entered into the lottery", true);
    console.log('match found in db for lotto');
  }
});
}

//TODO implement previous winners array in DB


async function drawLotto(DATABASE){
  var lottoDB = DATABASE.db('kffbot');
  lottoDB.collection('lottery').find().toArray(function(err, res){
    res.shift(); //remove settings portion of the lottery array
    console.log(res);
    if(res.length < 1){
      main.sendActionMessage('lottery is empty');
    } else {
      var rng = Math.floor(Math.random()* res.length);
      var winner = (rng, res[rng]);
      console.log(winner);

      //TODO implement ticket system for increased luck

      //remove winner from DATABASE
      removeLotto(winner, lottoDB);
      main.sendMessage('winner: ' + winner.username, true);
    }
  });
}

function removeLotto(user, lottoDB){

  //remove user from lottery completely
  lottoDB.collection('lottery').deleteOne( {"username":  user} );
  //TODO ticket system, add 1 tickt to remaining entries
}

module.exports.handleIncoming = handleIncoming;
module.exports.drawLotto = drawLotto;
module.exports.checkLottery = checkLottery;
module.exports.updateSettings = updateSettings;
