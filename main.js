const labelMap = {
    1:{name:'অ', color:'red'},
    2:{name:'র', color:'yellow'},
    3:{name:'I Love You', color:'lime'},
    4:{name:'Yes', color:'blue'},
    5:{name:'No', color:'purple'},
}

// Define a drawing function
const drawRect = (boxes, classes, scores, threshold, imgWidth, imgHeight, ctx)=>{
    
    for(let i=0; i<=boxes.length; i++){
        if(boxes[i] && classes[i] && scores[i]>threshold){
            // Extract variables
            const [y,x,height,width] = boxes[i]
            const text = classes[i]
       
            // DRAW!!
            // labelMap[text]['name'];
            document.querySelector('.text-output').textContent = labelMap[text]['name'];
            
        }
    }
}

let APP_ID = "1e0aa8471294484bba1dea05f6254511";
let token = null;
let uid = String(Math.floor(Math.random()*10000));

let client;
let channel;
let localStream;
let remoteStream;
let peerConnection;
let queryString = window.location.search
let urlParams = new URLSearchParams(queryString);
let roomid =urlParams.get('room')
const servers = {
    iceServers: [{
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    }]
}
let constraints = {
    video:{
        widith:{min:640,ideal:1920,max:1920},
        height:{min:480,ideal:1080,max:1080}
    },
    audio:true
}
let init = async () =>{
    client =  await AgoraRTM.createInstance(APP_ID);
    await client.login({uid,token});
    //channel id
    channel = client.createChannel(roomid);
    await channel.join()
    channel.on("MemberJoined",handleUserJoined)
    channel.on("MemberLeft", handleUserLeft)
    client.on('MessageFromPeer',handleMessageFromPeer)
    
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
   
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');
    audioTrack.enabled = false;
    document.getElementById('user-1').srcObject=localStream;
    await runCoco();
    
    
}
const runCoco = async () => {
    // 3. TODO - Load network 
    // e.g. const net = await cocossd.load();
    const net = await tf.loadGraphModel('https://raw.githubusercontent.com/Ismail-Mirza/Object_Detection/master/Tensorflow/workspace/models/my_ssd_mobnet/v1/converted/model.json');
    //const net = await tf.loadGraphModel('https://raw.githubusercontent.com/nicknochnack/RealTimeSignLanguageDetectionwithTFJS/main/Tensorflow/workspace/models/my_ssd_mobnet/converted/model.json');
    //  Loop and detect hands
    setInterval(() => {
        detect(net);
    }, 1000);
};
const remote = document.getElementById('user-2');
const canvas =  document.getElementById('user-2-canvas');
const detect = async (net)=>{
    
        const videoWidth=remote.videoWidth;
        const videoHeight = remote.videoHeight;
        canvas.width =  videoWidth;
        canvas.height =  videoHeight;

        const img = tf.browser.fromPixels(remote);
        const resized = tf.image.resizeBilinear(img,[640,480]);
        const casted = resized.cast("int32");
        const expanded = casted.expandDims(0);
        const obj = await net.executeAsync(expanded);

        const boxes = await obj[1].array();
        const classes = await obj[0].array();
        const scores = await obj[6].array();
        const ctx = canvas.getContext("2d");
        requestAnimationFrame(() => {
            drawRect(boxes[0], classes[0], scores[0], 0.55, videoWidth, videoHeight, ctx)
        });

        tf.dispose(img);
        tf.dispose(resized);
        tf.dispose(casted);
        tf.dispose(expanded);
        tf.dispose(obj)

    
}


let handleMessageFromPeer = async (message,MemberId) =>{
    message = JSON.parse(message.text);
    if(message.type === "offer")
    {
        createAnswer(MemberId,message.offer);
    }
    if(message.type ==="answer" )
    {
        addAnswer(message.answer);
    }
    if(message.type === 'candidate')
    {
        if(peerConnection)
        {
            peerConnection.addIceCandidate(message.candidate);
        }
    }
}
let handleUserLeft =async (MemberId)=>{
    document.getElementById('user-2-canvas').style.display ='none';
    document.getElementById('user-2').style.display ='none';
    document.getElementById('user-1').classList.remove('smallFrame');
}
let handleUserJoined = async (MemberId)=>{
    console.log("new user is joined",MemberId)
    createOffer(MemberId);
}

let createPeerConnection = async (MemberId)=>{
        peerConnection = new RTCPeerConnection(servers);
        remoteStream = new MediaStream();
        document.getElementById('user-2').srcObject = remoteStream;
        document.getElementById('user-2-canvas').style.display='block';
        document.getElementById('user-2').style.display='block';
        document.querySelector('.text-output').style.display = "block";
        document.getElementById('user-1').classList.add('smallFrame');
        if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
            document.getElementById('user-1').srcObject = localStream;

        }
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        })
        peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach(track => {
                remoteStream.addTrack(track);
            })
        }
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                client.sendMessageToPeer({
                    text: JSON.stringify({
                        'type': 'candidate',
                        'candidate': event.candidate
                    })
                }, MemberId);
            }
        }
}
let createOffer = async (MemberId)=>{
    await createPeerConnection(MemberId);
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    client.sendMessageToPeer({text:JSON.stringify({'type':'offer','offer':offer})},MemberId);

}
let createAnswer = async (MemberId,offer)=>{
    await createPeerConnection(MemberId);
    await peerConnection.setRemoteDescription(offer);
    let answer =  await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    client.sendMessageToPeer({
        text: JSON.stringify({
            'type': 'answer',
            'answer': answer
        })
    }, MemberId);

}
let addAnswer = async (answer)=>{
    if(!peerConnection.currentRemoteDescription)
    {
        peerConnection.setRemoteDescription(answer)
    }
}
let leaveChannel = async ()=>{
    await channel.leave()
    await client.logout()
}
let toggleCamera = async ()=>{
    let videoTrack = localStream.getTracks().find(track=>track.kind==="video")
    if(videoTrack.enabled)
    {
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor='rgb(255,80,80)'
    }
    else
    {
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179,102,249)'
    }
}
let toggleAudio = async ()=>{
    let audioTrack = localStream.getTracks().find(track=>track.kind==='audio')
    if(audioTrack.enabled)
    {
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor='rgb(255,80,80)'
    }
    else
    {
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179,102,249)'
    }
}

window.addEventListener('beforeunload',leaveChannel);
document.getElementById('camera-btn').addEventListener('click',toggleCamera);
document.getElementById('mic-btn').addEventListener('click',toggleAudio);
init();