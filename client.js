const WebSocket = require("ws");
const QRCode = require("qrcode");

const wsUrl = "ws://localhost:8080";
const ws = new WebSocket(wsUrl);

ws.on("open", () => {

});

ws.on("message", (msg) => {

  const QRCodeUrlPrefix = "https://www.dungeon-lab.com/app-download.php#DGLAB-SOCKET#";
  const msgObj = JSON.parse(msg);
  const uuid = msgObj.clientId;
  const QRCodeUrl = QRCodeUrlPrefix + wsUrl + uuid;

  console.log( "二维码文本："+ QRCodeUrl);

  QRCode.toString(QRCodeUrl,
    {
      type:'terminal'
    },
    function (err, url) {
      if (err) {
        console.error(err);
        return;
      }
      console.log(url)
  })

  

});