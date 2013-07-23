Based on [node-nxt-seed](https://github.com/jesperfj/node-nxt-seed).

This repo is a baseline for controlling the motors of an NXT1 Lego controller via JavaScript in a modern browser through a websockets connection to a Node.js intermediary.

The goal is to build some reusable bits that makes it easy to

1. Build all sorts of fun physical things in Lego
2. Quickly build an HTML UI that can be used from a smart phone by a 3 year old to control the Lego contraption

When you build programs for the NXT you always face the decision of what part of the program logic should reside inside the NXT brick and what part can run on a remote computer.

The NXT brick has a pretty comprehensive bluetooth protocol that can be used to control almost all parts of it. But as you dive in, the limitations of doing everything "over the wire" will quickly become obvious.

Extensive reseach (well, a [Google search](https://www.google.com/search?q=nxt+motor+control)) shows that it's pretty hard to precisely control the NXT motors over the Bluetooth protocol. Some [German folks](http://www.mindstorms.rwth-aachen.de/trac/wiki/MotorControl) (who else?) built an NXT program that gives you a nice little [PID controller](http://en.wikipedia.org/wiki/PID_controller) for the motors.

The data flow used by this project looks roughly like this:

```
    Browser

       ^
       |
      web sockets
       |
       v

    Node.js server

       ^
       |
      MotorControl messages over BT serial port
       |
       v

    NXT brick running MotorControl program
```

