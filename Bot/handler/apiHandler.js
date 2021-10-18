const main = require('../main');

const { ApiClient } = require('twitch');
const { RefreshableAuthProvider, StaticAuthProvider } = require('twitch-auth');
var client = null;

function start(clientID, clientSecret, accessToken, refreshToken){

  const authProvider = new RefreshableAuthProvider(new StaticAuthProvider(clientID, accessToken), {
      clientSecret,
      refreshToken,
      onRefresh: (token) => {
          // do things with the new token data, e.g. save them in your database
          accessToken = token;
          console.log("Setting new access token");
          console.log(token);
      }
  });

  client = new ApiClient({ authProvider });

}


async function isLive(username){
  const user = await client.helix.streams.getStreamByUserName(username);
  if(user === null){
    return false;
  }
  return true;
}

module.exports.start = start;
