var dgram = require('dgram');
const Parser = require("binary-parser").Parser;
const express = require('express');
const SSEChannel = require('sse-pubsub');
const crypto = require('crypto');

var forza = new Parser().endianess("little")
    .int32('IsRaceOn') 
    .uint32('TimestampMS') 
    .floatle('EngineMaxRpm')
    .floatle('EngineIdleRpm')
    .floatle('CurrentEngineRpm')
    .floatle('AccelerationX') 
    .floatle('AccelerationY')
    .floatle('AccelerationZ')
    .floatle('VelocityX') 
    .floatle('VelocityY')
    .floatle('VelocityZ')
    .floatle('AngularVelocityX') 
    .floatle('AngularVelocityY')
    .floatle('AngularVelocityZ')
    .floatle('Yaw')
    .floatle('Pitch')
    .floatle('Roll')
    .floatle('NormalizedSuspensionTravelFrontLeft') 
    .floatle('NormalizedSuspensionTravelFrontRight')
    .floatle('NormalizedSuspensionTravelRearLeft')
    .floatle('NormalizedSuspensionTravelRearRight')
    .floatle('TireSlipRatioFrontLeft') 
    .floatle('TireSlipRatioFrontRight')
    .floatle('TireSlipRatioRearLeft')
    .floatle('TireSlipRatioRearRight')
    .floatle('WheelRotationSpeedFrontLeft') 
    .floatle('WheelRotationSpeedFrontRight')
    .floatle('WheelRotationSpeedRearLeft')
    .floatle('WheelRotationSpeedRearRight')
    .int32('WheelOnRumbleStripFrontLeft') 
    .int32('WheelOnRumbleStripFrontRight')
    .int32('WheelOnRumbleStripRearLeft')
    .int32('WheelOnRumbleStripRearRight')
    .floatle('WheelInPuddleDepthFrontLeft') 
    .floatle('WheelInPuddleDepthFrontRight')
    .floatle('WheelInPuddleDepthRearLeft')
    .floatle('WheelInPuddleDepthRearRight')
    .floatle('SurfaceRumbleFrontLeft') 
    .floatle('SurfaceRumbleFrontRight')
    .floatle('SurfaceRumbleRearLeft')
    .floatle('SurfaceRumbleRearRight')
    .floatle('TireSlipAngleFrontLeft') 
    .floatle('TireSlipAngleFrontRight')
    .floatle('TireSlipAngleRearLeft')
    .floatle('TireSlipAngleRearRight')
    .floatle('TireCombinedSlipFrontLeft') 
    .floatle('TireCombinedSlipFrontRight')
    .floatle('TireCombinedSlipRearLeft')
    .floatle('TireCombinedSlipRearRight')
    .floatle('SuspensionTravelMetersFrontLeft') 
    .floatle('SuspensionTravelMetersFrontRight')
    .floatle('SuspensionTravelMetersRearLeft')
    .floatle('SuspensionTravelMetersRearRight')
    .int32('CarOrdinal') 
    .int32('CarClass') 
    .int32('CarPerformanceIndex') 
    .int32('DrivetrainType') 
    .int32('NumCylinders') 
    // --- TUTAJ ZMIANA DLA FH6 ---
    .uint32('CarGroup')          
    .floatle('SmashableVelDiff') 
    .floatle('SmashableMass')    
    // ----------------------------
    .floatle('PositionX')
    .floatle('PositionY')
    .floatle('PositionZ')
    .floatle('Speed') 
    .floatle('Power') 
    .floatle('Torque') 
    .floatle('TireTempFrontLeft')
    .floatle('TireTempFrontRight')
    .floatle('TireTempRearLeft')
    .floatle('TireTempRearRight')
    .floatle('Boost')
    .floatle('Fuel')
    .floatle('DistanceTraveled')
    .floatle('BestLap')
    .floatle('LastLap')
    .floatle('CurrentLap')
    .floatle('CurrentRaceTime')
    .uint16('LapNumber')
    .uint8('RacePosition')
    .uint8('Accel')
    .uint8('Brake')
    .uint8('Clutch')
    .uint8('HandBrake')
    .uint8('Gear')
    .int8('Steer')
    // --- DOPEŁNIENIE DO 324 BAJTÓW ---
    .seek(3);

let updates = {}

// Hash IP for privacy
const salt = "forzaisafunvideogame"

function haship(ip) {
    d = crypto.createHash('md5').update(salt + ip).digest("base64");
    return d
}

// Setup webserver
const app = express();
const channel = new SSEChannel();
const channel2 = new SSEChannel();
app.get('/data', (req, res) => channel.subscribe(req, res));
app.get('/data2', (req, res) => channel2.subscribe(req, res));
app.get('/uid.js', (req, res) => {
    var ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    res.type('.js');
    res.send(`const uid = "${haship(ip)}";`);
})
app.use(express.static(__dirname + '/public', { index: 'index.htm' }))

// Handle Forza payloads
const server = dgram.createSocket('udp4');
server.on('message', (msg, rinfo) => {
    // Validate Length
    if (rinfo.size !== 324) {
        console.warn(`Invalid package size ${rinfo.size} from ${rinfo.address}`)
        return
    }

    // Parse Data
    try {
        data = forza.parse(msg)
        if (data.IsRaceOn) {
            updates[rinfo.address] = data
            //server.send(msg, 5000)
            //sender = dgram.createSocket('udp4');
            //sender.bind(null, rinfo.address)
            //sender.send(msg, 5606)
            /*if(rinfo.address == "192.168.1.3"){
                server.sendto(msg, 30500, "192.168.1.3")
                
            }*/
        }
    } catch (e) {
        console.warn(e)
    }

    if (rinfo.address.startsWith("192.168.1.")) {
        server.send(msg, ("127.0.0.1", 5000))
    }
});

server.on('listening', () => {
    const address = server.address();
    console.log(`server listening ${address.address}:${address.port}`);
});

//Start servers
server.bind(5555);
app.listen(5555);

// Record data in Splunk
const options = {
    headers: { "Authorization": "Splunk forzamaphectoken" },
    rejectUnauthorized: false
}

// Sent data on regular interval
setInterval(() => {
    let payload = {}
    let payload2 = {}
    let n = Date.now() / 1000
    if (updates) {
        for (let u in updates) {
            let hash = haship(u)
            payload[hash] = [
                Math.round(updates[u].PositionY),
                updates[u].PositionX,
                updates[u].PositionZ,
                Math.round(updates[u].Yaw * 100) / 100,
                Math.round(updates[u].Speed * 100) / 100
            ]
            payload2[hash] = updates[u]
        }
        channel.publish(payload);
        channel2.publish(payload2);
        updates = {}
    }
}, 50)
