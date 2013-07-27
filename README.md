Based on [node-nxt-seed](https://github.com/jesperfj/node-nxt-seed).

This repo is a baseline for controlling the motors of an NXT1 Lego controller via JavaScript in a modern browser through a websockets connection to a Node.js intermediary.

The goal is to build some reusable bits that makes it easy to

1. Build all sorts of fun physical things in Lego
2. Quickly build an HTML UI that can be used from a smart phone by a 3 year old to control the Lego contraption

When you build programs for the NXT you always face the decision of what part of the program logic should reside inside the NXT brick and what part can run on a remote computer.

The NXT brick has a pretty comprehensive bluetooth protocol that can be used to control almost all parts of it. But as you dive in, the limitations of doing everything "over the wire" will quickly become obvious.

Extensive reseach (well, a [Google search](https://www.google.com/search?q=nxt+motor+control)) shows that it's pretty hard to precisely control the NXT motors over the [Bluetooth protocol](http://mindstorms.lego.com/en-us/support/files/default.aspx). Some [German folks](http://www.mindstorms.rwth-aachen.de/trac/wiki/MotorControl) built an NXT program that gives you a nice little [PID controller](http://en.wikipedia.org/wiki/PID_controller) for the motors.

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

The repo is structured as a classic Node.js project with additional parts for developing and deploying the MotorControl NXT program.

The setup has only been tested on Mac OS X Mountain Lion. Good luck with other systems. Please report your experience!

## Getting Going


### Clone repo

The usual:

    $ git clone https://github.com/jesperfj/node-nxt-motors.git
    ...
    $ cd node-nxt-motors

### Set up NBC compiler

NXC is a nice little C-like language designed specifically for the NXT. The [MotorControl program](http://www.mindstorms.rwth-aachen.de/trac/wiki/MotorControl) is licensed under GPLv3 and the source code has been included in this repo for convenience in the `nxc` directory. The origin is [here](http://www.mindstorms.rwth-aachen.de/trac/browser/trunk/tools/MotorControl).

To compile the source you'll need the nbc compiler. From the root of this repo, run

    $ . install_nbc.sh

(Note that it's always a good idea to inspect shell scripts like this before running it). The shell script will download the Mac OS X nbc tar ball, unpack it in `./nbc`, and add it to `PATH`. Test by running `nbc`:

    $ nbc
    Next Byte Codes Compiler version 1.2 (1.2.1.r4, built Tue Mar 15 15:56:24 CDT 2011)
    Copyright (c) 2006-2010, John Hansen
    Use "nbc -help" for more information.
    $ 

### Compile and download MotorControl to NXT

Connect the NXT with a USB cable. I've not been able to download code via Bluetooth. To compile and immediately download the MotorControl program to the NXT do:

    $ cd nxc
    $ nbc -d -S=usb -O=MotorControl22.rxe MotorControl22.nxc
    # Status: Current file = "/Users/jesper/nxt/node/node-nxt-motors/nxc/MotorControl22.nxc"
    # Status: NXC compilation begins
    # Status: Compiling for firmware version 128, NBC/NXC enhanced = FALSE
    # Status: Running NXC preprocessor
    ...
    # Status: Write optimized source to compiler output
    # Status: Finished

The code should now be on the NXT.

