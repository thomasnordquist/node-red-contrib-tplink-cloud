process.on('unhandledRejection', function(err, promise) {
    console.error('Unhandled rejection (promise: ', promise, ', reason: ', err, ').');
});

const tplink = require('tplink-cloud-api')

module.exports = function helloWorldNode(RED) {
  function HelloWorldNode(config) {
    RED.nodes.createNode(this, config);
    let cloud = RED.nodes.getNode(config.cloud);
    let device;

    tplink.login(cloud.credentials.user, cloud.credentials.password).then((tplinkConnection) => {
      tplinkConnection.getDeviceList().then(() => {
        device = tplinkConnection.getHS100(config.device)
      })
    }).catch((err) => {
      console.error(err)
    })

    this.on('input', (msg) => {
      if (!msg.payload) {
        return
      }

      if (!device) {
        this.send({payload:{success: false, error: 'device is not ready'}})
        return
      }

      if (msg.payload.power) {
        let power = msg.payload.power;
        if (typeof power === "string") {
          power = power.toLowerCase()
        }
        let promise;
        if (power === 'toggle') {
          promise = device.toggle()
        } else if (power === 'on' || power === 1 || power === true) {
          promise = device.powerOn()
        } else if (power === 'off' || power === 0 || power === false) {
          promise = device.powerOff()
        } else {
          this.send({payload:{success: false, error: 'unexpected argument'}})
        }

        promise.then(() => {
          this.send({payload:{success: true}})
        }).catch((error) => {
          this.send({payload:{success: false, error}})
        })
      } else {
        this.send({payload:{success: false, error: 'unexpected argument'}})
      }
    });
  }

  function tplinkCloudCredentials(config) {
    RED.nodes.createNode(this, config);
  }

  RED.httpAdmin.post('/tplink-cloud/devices', function(req, res) {
    new Promise((resolve, reject) => {
      let cloud = RED.nodes.getNode(req.body.cloud);
      var credentials = (req.body ? req.body.credentials : undefined)
              || (cloud ? cloud.credentials : undefined)

      if (!credentials) {
        reject({error: 'login failed'});
        return
      }

      return tplink.login(credentials.user, credentials.password).then((tplinkConnection) => {
        resolve(tplinkConnection.getDeviceList())
      }).catch(() => reject({error: 'login failed'}))
    }).then((devices) => {
      res.send(devices);
    }).catch((err) => {
      if(err.error) {
        res.send(err);
      } else {
        res.send({error: 'No device found'});
      }
    })
  })

  RED.nodes.registerType('tplink-cloud-device', HelloWorldNode);
  RED.nodes.registerType('tplink-cloud', tplinkCloudCredentials, {
      credentials: {
          user: {type:"text"},
          action: function() { return "bier" },
          password: {type: "password"}
      }
  });
};
