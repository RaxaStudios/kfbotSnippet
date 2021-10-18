const main = require('../main');
var request = require('request');


        function checkLink(msg, dbo){
          if(msg.includes("youtube.com")){
            //key exists in discord for the youtube feed channel 
            dbo.collection("discord").find().toArray(function(err, res){
              if(err) throw err;
              var key = res[0].youtubeKey;
              var req =  msg.substring(msg.indexOf("?v=")+3);
              getTitle(req, key);
            });
          } else if (msg.includes("youtu.be")){
            dbo.collection("discord").find().toArray(function(err, res){
              if(err) throw err;
              var key = res[0].youtubeKey;
              var req = msg.substring(msg.indexOf("be/") +3);
              getTitle(req, key);
            });
          }
        }



        function getTitle(req, key){
          var url = "https://www.googleapis.com/youtube/v3/videos?part=snippet#id#key";
          url = url.replace("#key", "&key=" + key);
          url = url.replace("#id", "&id="+req);
          var options = {
            url: url,
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            }
          }

          request(options, function(error, response){
            if(response &&response.statusCode == 200){
              //send json body back to the endpoint
              const j = JSON.parse(response.body);
              console.log(j.items.length);
              var empty = j.items.length;
              if(empty != 0){
                var title = j.items[0].snippet.title;
                main.sendMessage(title, true);
              }

            } else {
              //possible handle of errors here
              console.log('error in youtube request');
              console.log(response.body);
            }
          });
        }



module.exports.checkLink = checkLink;
