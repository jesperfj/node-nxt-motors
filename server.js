var Nxt = require('mindstorms_bluetooth').Nxt;

var REMOTE_DEBUG=false

// This is acquired experimentally
var MOTOR_B_RANGE=12500

if(!process.env.NXT_PORT) {
  // default
  var NXT_PORT = '/dev/tty.NXT-DevB'

  console.log("NXT_PORT environment variable not set. Using "+NXT_PORT)
} else {
  var NXT_PORT = process.env.NXT_PORT
}

// create the connection to NXT before setting up the http / websocket server
var nxt = new Nxt(NXT_PORT, function() {
  console.log('serial port opened')

  // set up an http server with web sockets
  var app = require('http').createServer(handler)
    , io = require('socket.io').listen(app)
    , fs = require('fs')

  app.listen(8080);

  // handler to serve the basic index.html
  function handler (req, res) {
    fs.readFile(__dirname + '/index.html',
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading index.html');
      }

      res.writeHead(200);
      res.end(data);
    });
  }

  // comment out this line for more verbose logging:
  io.set('log level', 1)


  // register web socket handlers

  io.sockets.on('connection', function (socket) {
    // pos -> get output state

    socket.on('pos', function(data) {
      nxt.get_output_state(data.motor)
    });

    nxt.register_callback('getoutputstate', function(data) {
      socket.emit('pos', 
        { 
          motor: data[3], 
          tacholimit: hex2int(data,9), 
          tachocount: hex2int(data,13), 
          blocktachocount: hex2int(data,17), 
          rotationcount: hex2int(data,21)
        })
    });

    // mov -> move it!

    socket.on('mov', function(data) {
      console.log('Moving: %j',data)

      // expects a data hash like this:

      // {
      //   motor: 1
      //   power: 50
      //   delta: -1000
      //   mode: 5
      // }


      var bytes = []

      // Build the motorcontrol program message one char at a time...
      // See http://www.mindstorms.rwth-aachen.de/trac/wiki/MotorControl

      // controlled motorcmd code
      bytes.push("1".toString().charCodeAt(0))

      // motor number 0,1,2 = individual motors
      // 3 = 0 & 1
      // 4 = 0 & 2
      // 5 = 1 & 2
      bytes.push(data.motor.toString().charCodeAt(0))


      // power is a 3 char value from 0 to 100. First we ensure min/max
      var pint = (data.power > 100 ? 100 : data.power)
      pint = pint < 0 ? 0 : pint

      if(data.delta < 0) {
        // if we move in 'negative' direction, the power value we send to NXT
        // must be from 101-200
        var pstr = (pint+100).toString()
      } else {
        // if we move in 'positive' direction, power value is 0-100, so we do
        // nothing.
        var pstr = pint.toString()
      }
      for(var i=0;i<3;i++) {
        bytes.push(pstr.charCodeAt(i))
      }

      // delta is the distance and direction of the movement
      // ensure that delta is within limit
      if(data.delta) {
        var limit = Math.abs(data.delta) > 999999 ? 999999 : Math.abs(data.delta)
      } else { // data.absolute
        var limit = (data.absolute < 0 ? 0 : (data.absolute > 100 ? 100 : data.absolute) )
      }
      var limitstr = limit.toString()
      console.log(limitstr)
      console.log(bytes)
      for(var i=0;i<6-limitstr.length;i++) {
        bytes.push("0".toString().charCodeAt(0))
      }
      console.log(bytes)
      for(var i=0;i<limitstr.length;i++) {
        bytes.push(limitstr.charCodeAt(i))
      }
      console.log(bytes)

      // Mode: 1 char, bitfield. Compose bits to integer (by OR or +), convert to char
      // Start with 0x00 (000)
      // Set 0x01 (001) / add 1: Set for HoldBrake (keeps active brake on after end of movement)
      // Set 0x02 (010) / add 2: Set to enable SpeedRegulation
      // Set 0x04 (100) / add 4: Set to enable SmoothStart
      // Example: "5" means 0x05 (101) = HoldBrake and SmoothStart ar enabled, no SpeedRegulation
      bytes.push((data.mode || 0).toString().charCodeAt(0))

      // absolute positioning?
      bytes.push((data.absolute ? "1" : "0").toString().charCodeAt(0))

      console.log(bytes)

      // NXT messages always end with \0
      bytes.push('\0')
      nxt.message_write(1,bytes)

    });


    socket.on('abs', function(data) {
      console.log('Moving: %j',data)

      // expects a data hash like this:

      // {
      //   motor: 1
      //   pos: 50
      //   power: 100 (optional)
      // }


      var bytes = []

      bytes.push("7".toString().charCodeAt(0))

      // motor number 0,1,2 = individual motors
      // 3 = 0 & 1
      // 4 = 0 & 2
      // 5 = 1 & 2
      bytes.push(data.motor.toString().charCodeAt(0))


      // power is a 3 char value from 0 to 100. First we ensure min/max
      var power = (data.power ? 
                    (data.power > 100 ? 100 : 
                    (data.power < 0 ? 0 : data.power)) : 100).toString();

      for(var i=0;i<3-power.length;i++) {
        bytes.push("0".charCodeAt(0))
      }


      for(var i=0;i<power.length;i++) {
        bytes.push(power.charCodeAt(i))
      }

      // pos is a 3 char value from 0 to 100. First we ensure min/max
      var pos = (data.pos > 100 ? 100 : (data.pos < 0 ? 0 : data.pos)).toString();

      for(var i=0;i<3-pos.length;i++) {
        bytes.push("0".charCodeAt(0))
      }


      for(var i=0;i<pos.length;i++) {
        bytes.push(pos.charCodeAt(i))
      }

      // Mode: 1 char, bitfield. Compose bits to integer (by OR or +), convert to char
      // Start with 0x00 (000)
      // Set 0x01 (001) / add 1: Set for HoldBrake (keeps active brake on after end of movement)
      // Set 0x02 (010) / add 2: Set to enable SpeedRegulation
      // Set 0x04 (100) / add 4: Set to enable SmoothStart
      // Example: "5" means 0x05 (101) = HoldBrake and SmoothStart ar enabled, no SpeedRegulation
      bytes.push((data.mode || 0x05).toString().charCodeAt(0))

      console.log(bytes)

      // NXT messages always end with \0
      bytes.push('\0')
      nxt.message_write(1,bytes)

    });

    socket.on('set', function(data) {

      // expects a data hash like this:

      // {
      //   motor: 1
      //   edge: 0
      // }


      var bytes = []

      // Build the motorcontrol program message one char at a time...
      // See http://www.mindstorms.rwth-aachen.de/trac/wiki/MotorControl

      // set limit command
      bytes.push("6".toString().charCodeAt(0))

      // motor number 0,1,2 = individual motors
      // 3 = 0 & 1
      // 4 = 0 & 2
      // 5 = 1 & 2
      bytes.push(data.motor.toString().charCodeAt(0))

      // edge is a number
      // 0 = min
      // 1 = max
      bytes.push(data.edge.toString().charCodeAt(0))

      // NXT messages always end with \0
      bytes.push('\0')
      nxt.message_write(1,bytes)

    });

    // If MotorControl is compiled with debugging enabled, messages will come back here.
    if(REMOTE_DEBUG) {
      nxt.register_callback('messageread', function(data) {
        socket.emit('msg', 'msg: '+String.fromCharCode.apply(String, data.slice(5,5+data[4]-1)))
      })
    }

  });

  // Now socket.io and handlers have been set up.

  // At this point we can set up things like repeated calls to the NXT  

  // Poll for debug messages every second. We need a way to turn this on/off

  if(REMOTE_DEBUG) {
    setInterval(function() {
      nxt.message_read(2,0,true)
    }, 50)
  }

});


// Convenience function. May not be used yet...
function hex2int(arr, offset) {
     return arr[offset] + (arr[offset+1] << 8) + (arr[offset+2] << 16) + (arr[offset+3] << 24)

}

