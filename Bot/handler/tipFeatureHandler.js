//pretty much everything handled in UI, auto update stuff in here only
var mongo = require('./mongoUtil');
var ObjectID = require('mongodb').ObjectID;

//handle subs to tracker if applicable
function intakeSub(points){

}

//add bits to tracker if applicable
function intakeBits(amt){

}

//add tip to tracker if applicable
function intakeTip(amt){
  var dbo = mongo.getDb();
  dbo.collection("features").updateOne(
    { "_id" : ObjectID(" ")},
    {$inc: {
      "tipCurrentAmt": amt
    }}
  );
}


module.exports.intakeTip = intakeTip;
