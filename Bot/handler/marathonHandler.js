//for auto adding time only, sending message handled elsewhere
//already checked for on/off status prior to landing here

var mongo = require('./mongoUtil');

//convert subPoints to added time if applicable
function intakeSub(subPoints){
  var dbo = mongo.getDb();
  dbo.collection("features").find().toArray(function(err, result){
    if (err) throw err;
    var subValue = result[0].marathonSubValue; //1 sub point = $5 = 500 points
    var addedPoints = subPoints * subValue;
    dbo.collection("features").updateOne(
      { "_id" : ObjectID("5f9a7a9d4acd644478d42d0c")},
      {$inc: {
        "marathonTotalPoints": addedPoints
      }}
    );
  });

}

//convert bits to added time if applicable
function intakeBits(amt){
  var dbo = mongo.getDb();
  dbo.collection("features").updateOne(
    { "_id" : ObjectID("5f9a7a9d4acd644478d42d0c")},
    {$inc: {
      "marathonTotalPoints": amt //bits come in as cents
    }}
  );
}

//convert tip to added time if applicable
function intakeTip(amt){
  var addedPoints = amt * 100; //convert to match bits i.e. $2.50 = 250 points
  var dbo = mongo.getDb();
  dbo.collection("features").updateOne(
    { "_id" : ObjectID("5f9a7a9d4acd644478d42d0c")},
    {$inc: {
      "marathonTotalPoints": addedPoints
    }}
  );
}

module.exports.intakeTip = intakeTip;
module.exports.intakeBits = intakeBits;
module.exports.intakeSub = intakeSub;
