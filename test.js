var Nxt = require('mindstorms_bluetooth').Nxt;

if(!process.env.NXT_PORT) {
  console.log("NXT_PORT environment variable not set. Using /dev/tty.NXT-DevB")
  var NXT_PORT = '/dev/tty.NXT-DevB'
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

      if(data.delta > 0) {
        // if we move in 'positive' direction, the power value we send to NXT
        // must be from 101-200
        var pstr = (pint+100).toString()
      } else {
        // if we move in 'negative' direction, power value is 0-100, so we do
        // nothing.
        var pstr = pint.toString()
      }
      for(var i=0;i<3;i++) {
        bytes.push(pstr.charCodeAt(i))
      }

      // delta is the distance and direction of the movement
      // ensure that delta is within limit
      var dint = Math.abs(data.delta) > 999999 ? 999999 : Math.abs(data.delta)
      var dstr = dint.toString()
      console.log(dstr)
      for(var i=0;i<6;i++) {
        bytes.push(dstr.charCodeAt(i))
      }

      // Mode: 1 char, bitfield. Compose bits to integer (by OR or +), convert to char
      // Start with 0x00 (000)
      // Set 0x01 (001) / add 1: Set for HoldBrake (keeps active brake on after end of movement)
      // Set 0x02 (010) / add 2: Set to enable SpeedRegulation
      // Set 0x04 (100) / add 4: Set to enable SmoothStart
      // Example: "5" means 0x05 (101) = HoldBrake and SmoothStart ar enabled, no SpeedRegulation
      bytes.push((data.mode || 0).toString().charCodeAt(0))
      console.log(bytes)

      // NXT messages always end with \0
      bytes.push('\0')
      nxt.message_write(1,bytes)

    });

    // If MotorControl is compiled with debugging enabled, messages will come back here.
    // nxt.register_callback('messageread', function(data) {
    //   socket.emit('msg', 'msg: '+String.fromCharCode.apply(String, data.slice(5,5+data[4]-1)))
    // })


  });

  // Now socket.io and handlers have been set up.

  // At this point we can set up things like repeated calls to the NXT  

  // Poll for debug messages every second. We need a way to turn this on/off
  // setInterval(function() {
  //   nxt.message_read(2,0,true)
  // }, 1000)

});


// Convenience function. May not be used yet...
function hex2int(arr, offset) {
     return arr[offset] + (arr[offset+1] << 8) + (arr[offset+2] << 16) + (arr[offset+3] << 24)

}

