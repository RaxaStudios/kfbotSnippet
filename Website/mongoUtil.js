const MongoClient = require( 'mongodb' ).MongoClient;
const url = "mongodb://localhost:27017";
//single event system
const eventStream = require('./public/events/eventStream');
const birdStream = require('./public/events/birdStream');
const server = require.main.require('./server.js');
var _db;

module.exports = {

  connectToServer: function( callback ) {
    MongoClient.connect( url,  { useNewUrlParser: true }, function( err, client ) {
      _db  = client.db('kffbot');
      return callback( err );
    } );
  },

  getDb: function() {
    return _db;
  },

  /*
  list of services
  dashboard
  lottery
  subCount
  poll
  marathon
  spoopathon
  tipfeature

  */
  setupListeners: function(){
    //listener for feature changes
    const featureChangeStream = _db.collection("features");
    const featureStream = featureChangeStream.watch();
    featureStream.on("change", function(event){
      _db.collection("features").find().toArray(function(err, result) {
        if (err) throw err;
        var data = result[0];
        console.log(data); //TODO split up by figuring out what's changed first
        //send update to dashboard event stream
        var dashOut = { system: "dashboard"};
        eventStream.array.push(dashOut);
        var subCountOut = { system: "subCount", count: data.subcount};
        eventStream.array.push(subCountOut);
        var countOut = { system: "counter", count: data.counterValue, text: data.counterText};
        eventStream.array.push(countOut);
        var marathonOut = { system: "marathon", method: "setup", status: data.marathonStatus,
            subValue: data.marathonSubValue, points: data.marathonTotalPoints, startHour: data.marathonStartHour};
        eventStream.array.push(marathonOut);
        var spoopathonOut = { system: "spoopathon", method: "setup", status: data.spoopathonStatus,
            subValue: data.spoopathonSubValue, games: data.spoopathonGames, votes: data.spoopathonUserVotes};
        eventStream.array.push(spoopathonOut);
        var tipOut = { system: "tipFeature", method: "setup", sendToChat: data.sendTipToChatStatus,
            status: data.tipFeatureStatus, bgColor: data.tipBGColor, progressColor: data.tipPColor, textColor: data.tipTColor,
            text: data.tipText, currAmt: data.tipCurrentAmt, goalAmt: data.tipGoalAmt,
            bitsEnabled: data.tipBitsEnabled, subsEnabled: data.tipSubsEnabled, tipsEnabled: data.tipTipsEnabled};
        eventStream.array.push(tipOut);
      });
    });

    //listener for lottery changes
    const lottoChangeStream = _db.collection("lottery");
      const lottoStream = lottoChangeStream.watch();
      lottoStream.on("change", function(event){
        _db.collection("lottery").find().toArray(function(err, result) {
          if (err) throw err;
          console.log(result);

          var status = result[0].lottoStatus;
          var keyword = result[0].lottoKeyword;
          console.log(status);
          console.log(keyword);
          //send update to
          var jsonOut = { system: "lottery", topic:"status", status: status, keyword: keyword}
          eventStream.array.push(jsonOut);
        });
      });

      //listener for poll changes
      const pollChangeStream = _db.collection("poll");
        const pollStream = pollChangeStream.watch();
        pollStream.on("change", function(event){
          _db.collection("poll").find().toArray(function(err, result) {
            if (err) throw err;
            console.log(result);
            //send update to
            try{
            var jsonOut = { system: "poll", topic:"update", options: result[0].options}
            eventStream.array.push(JSON.stringify(jsonOut));
          } catch(e){
            console.log(e);
          }
          });
        });

        //bird stream
        const birdChangeStream = _db.collection("bird");
          const birdStream = birdChangeStream.watch();
          birdStream.on("change", function(event){
            _db.collection("bird").find().toArray(function(err, result) {
              if (err) throw err;
              console.log(result);
              //send update to
              try{
                var countOut = { system: "counter", count: result[0].counterValue, text: result[0].counterText};

                console.log(birdStream.birdArray);
                var arr = birdStream.birdArray;
                if(typeof arr == "undefined"){
                  server.birdStreamSource.emit("push", "message", { msg: countOut });
                } else {
                  birdStream.birdArray.push(countOut);
                }

            } catch(e){
              console.log(e);
            }
            });
          });


      return true;
  }
};
