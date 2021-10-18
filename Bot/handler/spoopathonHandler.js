//incoming assumes system is enabled
//check happens at point of data, i.e. within SEHandler
//status is found in the features collection
const main = require('../main');
var ObjectID = require('mongodb').ObjectID;
var mongo = require('./mongoUtil');

//store user array in DB as username:votes
//store games list the same way -> game:points

//add votes to user to be able to vote for a game
//needs to be auto for subs/bits and manual for tips
//(tips circumvented by using #gameID in the tip message)
function addVotes(user, amt){
  //check for username first
  var dbo = mongo.getDb();
  dbo.collection('features').find().toArray(function(err, res){
    var spoopArray = res[0].spoopathonUserVotes;
    spoopArray.forEach((element) => {
      if(element.name.toUpperCase() === user.toUpperCase()){
        //update votes here
        var currVotes = element.votes + amt;
        dbo.collection("features").updateOne(
          { "spoopathonUserVotes.name": user },
          {
            $set: {"spoopathonUserVotes.$.votes" : currVotes }
        },
        function(err, doc){
          if(err) throw err;
          //console.log(doc);
        });
      }
    });
  });
}

//remove votes after they've voted
function remVotes(user, amt){

}

//use votes, add to game, then remove from user
function vote(user, gameID, amt){

}

//return number of votes user has
function getVotes(user){
  //check for username first
  var dbo = mongo.getDb();
  dbo.collection('features').find().toArray(function(err, res){
    var spoopArray = res[0].spoopathonUserVotes;
    spoopArray.forEach((element) => {
      if(element.name.toUpperCase() === user.toUpperCase()){
        console.log('match found: ' + element.name + " votes: " + element.votes);
        main.sendMessage(user + ' has ' + element.votes + ' votes', true);
      }
    });
  });
}

//return points with game IDs
function getPoints(){
  var dbo = mongo.getDb();
  dbo.collection("features").find().toArray(function(err, result){
    if(err) throw err;
    var outputString = [];
    outputString.push("Current point totals: ")
    var gameArray = result[0].spoopathonGames;
    gameArray.forEach((id) => {
      outputString.push("[" + id.gameID + ": " + id.points + "] ");
    });
    main.sendMessage(outputString.join(""), true);
  });
}

//convert subPoints to votes to add to user
function intakeSub(user, subPoints){

}

//convert bits to votes, add to user
function intakeBits(user, bits){

}

//convert tips to points towards a game
// IFF #gameID is used
function intakeTip(amt, msg){
  if(msg.includes("#")){
    var dbo = mongo.getDb();
    dbo.collection("features").find().toArray(function(err, result){
      if(err) throw err;
      var gameArray = result[0].spoopathonGames;
      var msgID = msg.substring(msg.indexOf("#") + 1, msg.indexOf(" ", msg.indexOf("#")));
      gameArray.forEach((id) => {
        if(id.gameID === msgID.toUpperCase()){
          //update points for this id
          dbo.collection("features").updateOne(
            { "spoopathonGames.gameID": msgID.toUpperCase() },
            {
              $inc: {"spoopathonGames.$.points" : amt }
              },
          function(err, doc){
            if(err) throw err;
            //console.log(doc);
          });
        }
      });
    });
  }
}


module.exports.intakeTip = intakeTip;
module.exports.getVotes = getVotes;
module.exports.addVotes = addVotes;
module.exports.getPoints = getPoints;
