var Nxt = require('mindstorms_bluetooth').Nxt;

var REMOTE_DEBUG=false

if(!process.env.NXT_PORT) {
  // default
  var NXT_PORT = '/dev/tty.NXT-DevB'

  console.log("NXT_PORT environment variable not set. Using "+NXT_PORT)
} else {
  var NXT_PORT = process.env.NXT_PORT
}

var nxt_state = 'disconnected'
var nxt

// intervalId for interval function that sends heartbeat requests
var heartbeat

// process.on('SIGINT', function () {
//   console.log('Got SIGINT. Closing NXT connection and exiting...');
//   if(nxt) {
//     try {
//       nxt.close_connection();
//     } catch(err) {
//       console.log('Failed closing connection: '+err)
//     }
//   }
//   process.exit(0);
// });


// set up an http server with web sockets
var app = require('http').createServer(handler)
, io = require('socket.io').listen(app)
, fs = require('fs')

app.listen(8080);

// handler to serve the basic index.html
function handler (req, res) {
  var url = require('url').parse(req.url)
  console.log('Loading file '+req.url)
  fs.readFile(__dirname + url.pathname,
    function (err, data) {
      if (err) {
        res.writeHead(500);
        return res.end('Error loading '+url.pathname);
      }

      res.writeHead(200);
      res.end(data);
    });
}

// comment out this line for more verbose logging:
io.set('log level', 1)


// register web socket handlers

io.sockets.on('connection', function (socket) {

  socket.emit('nxtstate', nxt_state)

  socket.on('connect', function(data) {
    connect_to_nxt();
  });

  // pos -> get output state
  socket.on('pos', function(data) {
    if(nxt) {
      nxt.get_output_state(data.motor)
    }
  });

  // mov -> move it!

  socket.on('mov', function(data) {
    if(!nxt) {
      console.log('Received command while disconnected')
      return;
    }
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
    var pint = data.power ? (data.power > 100 ? 100 : data.power) : 100
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
    if(!nxt) {
      console.log('Received command while disconnected')
      return;
    }

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
    if(!nxt) {
      console.log('Received command while disconnected')
      return;
    }


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

  socket.on('go', function(data) {
    if(!nxt) {
      console.log('Received command while disconnected')
      return;
    }

    if(data.p) {
      nxt.set_output_state(data.p[0], data.p[1], data.p[2], data.p[3], data.p[4], data.p[5], data.p[6])
    } else if(data.dir) {

      if(data.dir == 'fwd') {
        nxt.set_output_state(0xff, 100, 1, 0, 0, 32, 0)
      } else if(data.dir=='rev') {
        nxt.set_output_state(0xff, -100, 1, 0, 0, 32, 0)
      } else if(data.dir=='left') {
        nxt.set_output_state(0, 0, 1, 0, 0, 0)
        nxt.set_output_state(1,100, 1, 0, 0, 32, 0)
      } else if(data.dir=='right') {
        nxt.set_output_state(1, 0, 1, 0, 0, 0)
        nxt.set_output_state(0,100, 1, 0, 0, 32, 0)
      }
    }



    
  });

  socket.on('reset', function(data) {
    if(!nxt) {
      console.log('Received command while disconnected')
      return;
    }

    nxt.reset_motor_position(0,false)
    nxt.reset_motor_position(1,false)
    
  });

  socket.on('stop', function(data) {
    if(!nxt) {
      console.log('Received command while disconnected')
      return;
    }

    // 

    nxt.set_output_state(0xFF, 0x00, 0x01, 0x00, 0x00, 0x00)
    
  });
  

});


function hex2int(arr, offset) {
 return arr[offset] + (arr[offset+1] << 8) + (arr[offset+2] << 16) + (arr[offset+3] << 24)

}

function connect_to_nxt() {
  if(!nxt_state == 'disconnected') {
    console.log('Attempting to connect to NXT while not disconnected. Ignoring.')
    return
  }
  set_nxt_state('connecting');
  nxt = new Nxt(NXT_PORT, function() {
    console.log('serial port to NXT opened')
    set_nxt_state('connected');

    nxt.register_callback('getoutputstate', function(data) {
      io.sockets.emit('pos', 
      { 
        motor: data[3], 
        tacholimit: hex2int(data,9), 
        tachocount: hex2int(data,13), 
        blocktachocount: hex2int(data,17), 
        rotationcount: hex2int(data,21)
      }
      );
    });


    nxt.register_callback('keepalive', function(data) {
      console.log('received heartbeat response')
      last_seen = (new Date()).getTime();
    });

    nxt.register_callback('resetmotorposition', function(data) {
      console.log('reset motor position: '+data)
    });

    heartbeat = setInterval(function() {
        // before we send keep-alive, schedule a result check 10s later
        console.log('sending heartbeat request')
        setTimeout(function() {
          if(last_seen < (new Date()).getTime()-30000) {
            // robot is gone. Try to close connection
            // delete reference to nxt and stop the heart beats.
            try {
              console.log('Lost contact with robot. Closing connection...')
              nxt.close_connection();
            } catch(err) {
              console.log('Error closing connection: '+err)
            }
            delete nxt;
            set_nxt_state('disconnected');
            clearInterval(heartbeat);
          }
        }, 10000);

        nxt.keep_alive();

      }, 30000);


  });

}

function set_nxt_state(state) {
  nxt_state = state;
  io.sockets.emit('nxtstate', nxt_state)
}