const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });
const request = require('request-promise-native');
const rp = require('request-promise');
const google = require('googleapis');

// Add your Firebase project ID here
const PROJECT_ID = 'xxxx-xxxxx';
const HOST = 'https://firebaseremoteconfig.googleapis.com';
const PATH = '/v1/projects/' + PROJECT_ID + '/remoteConfig';
const SCOPES = ['https://www.googleapis.com/auth/firebase.remoteconfig'];

admin.initializeApp(functions.config().firebase);

// This function will be triggered whenever you update Remote Config in Firebase console
exports.pushConfig = functions.remoteConfig.onUpdate(versionMetadata => {
  var promises = [];
  
  /** Create FCM payload to send data message to PUSH_RC topic.
   * This will be a silent notification from the app side.
   * The goal is to let the apps know when to retrieve the latest RC value.
   */
  const payload = {
    topic: "PUSH_RC",
    data: {
      click_action: "FLUTTER_NOTIFICATION_CLICK",
      "CONFIG_STATE": "STALE"
    }
  };
  promises.push(admin.messaging().send(payload));

  /**
   * Retrieve the current Firebase Remote Config template from the server. Once
   * retrieved the template, `noorThker` value is pushed as a notification if user turns on notifications.
   */
  getAccessToken().then(function(accessToken) {
    var options = {
      uri: HOST + PATH,
      method: 'GET',
      gzip: true,
      resolveWithFullResponse: true,
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Accept-Encoding': 'gzip',
      }
    };

    rp(options)
        .then(function(resp) {
          console.log(JSON.parse(resp.body)['parameters']['noorThker']['defaultValue']['value']);
          const payload2 = {
            notification: {
                 title: '',
                 body: JSON.parse(resp.body)['parameters']['noorThker']['defaultValue']['value']
               },
            data: {
              click_action: "FLUTTER_NOTIFICATION_CLICK"
            }
          };

          promises.push(admin.messaging().sendToTopic("general_notifications", payload2));
        })
        .catch(function(err) {
          console.error('Unable to get fetch data');
          console.error(err);
        });
  });
  return Promise.all(promises)
  .then(response => console.log(response)) // Promise.all cannot be resolved, as one of the promises passed got rejected.
  .catch(error => console.log(`Error in executing ${error}`)) // Promise.all throws an error.
});

/**
 * Get a valid access token.
 */
function getAccessToken() {
  return new Promise(function(resolve, reject) {
    var key = require('./service-account.json');
    var jwtClient = new google.auth.JWT(
      key.client_email,
      null,
      key.private_key,
      SCOPES,
      null
    );
    jwtClient.authorize(function(err, tokens) {
      if (err) {
        reject(err);
        return;
      }
      resolve(tokens.access_token);
    });
  });
}
