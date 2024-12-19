const WebSocket = require("ws");
const QRCode = require("qrcode");
const os = require("os");

// 本机局域网ipv4地址
const localIp = returnLocalLANIp();

const wsUrl = "ws://" + localIp + ":8080" + "/";
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

/**
 * 返回本机的局域网ipv4地址字符串
 * 使用os模块
 * 找不到时返回-1
 * gpt帮我写的
 */
function returnLocalLANIp() {
  // 获取网络接口信息
  const networkInterfaces = os.networkInterfaces();

  // 判断一个 IP 地址是否是局域网地址
  function isLAN(ip) {
    const parts = ip.split('.').map(Number);

    // 判断是否是 192.168.x.x、10.x.x.x、172.x.x.x (172.16.x.x 到 172.31.x.x)
    return (
      (parts[0] === 192 && parts[1] === 168) ||
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    );
  }

  let lanIpAddress = '';

  // 遍历所有网络接口
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const interfaceDetails of interfaces) {
      // 筛选出 IPv4 地址并且排除内部地址
      if (interfaceDetails.family === 'IPv4' && !interfaceDetails.internal) {
        const ip = interfaceDetails.address;
        if (isLAN(ip)) {
          lanIpAddress = ip;
          break;
        }
      }
    }
    if (lanIpAddress) break;
  }

  if (lanIpAddress) {
    return lanIpAddress;
  } else {
    console.err('未找到局域网 IPv4 地址');
    return -1;
  }
}