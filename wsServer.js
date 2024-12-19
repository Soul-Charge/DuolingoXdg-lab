/**
 * 参考内容：
 * https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE/blob/main/socket/BackEnd(Node)/websocketNode.js
 * https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE/blob/main/image/socket_bind.png
 * 没官方这俩和主机app的通信流程图和实现我根本搞不懂
 */
const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");
const os = require('os');

// 储存已连接的用户及其标识
const clients = new Map();
// 存储消息关系
const relations = new Map();
// 本机局域网ipv4地址
const localIp = returnLocalLANIp();
// 开启WebSocket服务，省略ip则为localhost
const wss = new WebSocket.Server({ host: localIp, port: 8080 })

// 注册相应连接到wss服务的事件
// on()方法为注册,"connection"为注册事件名，ws形参是连接到服务器的ws客户端对象
wss.on("connection", (ws) => {

  const clientId = uuidv4();
  console.log("Websocket连接已建立，标识符id：" + clientId);
  // 将id与ws对象绑定
  clients.set(clientId, ws);

  // 发送标识符给客户端（格式固定，双方都必须获取才可以进行后续通信：比如浏览器和APP）
  ws.send(JSON.stringify({
    type: 'bind',
    clientId: clientId, // 这里会感觉有点怪怪的但是应该没问题
    message: 'targetId',
    targetId: ''
  }));

  ws.on("error", (error) => {
    console.error(error);
  })

  /**
   * 监听客户端(DGLabApp)的消息
   * 就是接受APP的绑定请求然后把终端ID和APP ID进行绑定这一步
   * 这一段是直接复制的（目前是，因为都还没搞懂）
   */
  ws.on('message', function incoming(message) {
    console.log("收到消息：" + message)
    let data = null;
    try {
      data = JSON.parse(message);
    }
    catch (e) {
      // 非JSON数据处理
      ws.send(JSON.stringify({ type: 'msg', clientId: "", targetId: "", message: '403' }))
      return;
    }

    // 非法消息来源拒绝
    // 因为clients是map对象，里面是ws对象和id的键值对，get()的得到的是ws对象
    if (clients.get(data.clientId) !== ws && clients.get(data.targetId) !== ws) {
      ws.send(JSON.stringify({ type: 'msg', clientId: "", targetId: "", message: '404' }))
      return;
    }

    if (data.type && data.clientId && data.message && data.targetId) {
      // 优先处理绑定关系
      const { clientId, targetId, message, type } = data;
      switch (data.type) {
        case "bind":
          // 服务器下发绑定关系
          if (clients.has(clientId) && clients.has(targetId)) {
            // relations的双方都不存在这俩id
            if (![clientId, targetId].some(id => relations.has(id) || [...relations.values()].includes(id))) {
              relations.set(clientId, targetId)
              const client = clients.get(clientId);
              const sendData = { clientId, targetId, message: "200", type: "bind" }
              ws.send(JSON.stringify(sendData));
              client.send(JSON.stringify(sendData));
            }
            else {
              const data = { type: "bind", clientId, targetId, message: "400" }
              ws.send(JSON.stringify(data))
              return;
            }
          } else {
            const sendData = { clientId, targetId, message: "401", type: "bind" }
            ws.send(JSON.stringify(sendData));
            return;
          }
          break;
        case 1:
        case 2:
        case 3:
          // 服务器下发APP强度调节
          if (relations.get(clientId) !== targetId) {
            const data = { type: "bind", clientId, targetId, message: "402" }
            ws.send(JSON.stringify(data))
            return;
          }
          if (clients.has(targetId)) {
            const client = clients.get(targetId);
            const sendType = data.type - 1;
            const sendChannel = data.channel ? data.channel : 1;
            const sendStrength = data.type >= 3 ? data.strength : 1 //增加模式强度改成1
            const msg = "strength-" + sendChannel + "+" + sendType + "+" + sendStrength;
            const sendData = { type: "msg", clientId, targetId, message: msg }
            client.send(JSON.stringify(sendData));
          }
          break;
        case 4:
          // 服务器下发指定APP强度
          if (relations.get(clientId) !== targetId) {
            const data = { type: "bind", clientId, targetId, message: "402" }
            ws.send(JSON.stringify(data))
            return;
          }
          if (clients.has(targetId)) {
            const client = clients.get(targetId);
            const sendData = { type: "msg", clientId, targetId, message }
            client.send(JSON.stringify(sendData));
          }
          break;
        case "clientMsg":
          // 服务端下发给客户端的消息
          if (relations.get(clientId) !== targetId) {
            const data = { type: "bind", clientId, targetId, message: "402" }
            ws.send(JSON.stringify(data))
            return;
          }
          if (!data.channel) {
            // 240531.现在必须指定通道(允许一次只覆盖一个正在播放的波形)
            const data = { type: "error", clientId, targetId, message: "406-channel is empty" }
            ws.send(JSON.stringify(data))
            return;
          }
          if (clients.has(targetId)) {
            //消息体 默认最少一个消息
            let sendtime = data.time ? data.time : punishmentDuration; // AB通道的执行时间
            const target = clients.get(targetId); //发送目标
            const sendData = { type: "msg", clientId, targetId, message: "pulse-" + data.message }
            let totalSends = punishmentTime * sendtime;
            const timeSpace = 1000 / punishmentTime;

            if (clientTimers.has(clientId + "-" + data.channel)) {
              // A通道计时器尚未工作完毕, 清除计时器且发送清除APP队列消息，延迟150ms重新发送新数据
              // 新消息覆盖旧消息逻辑
              console.log("通道" + data.channel + "覆盖消息发送中，总消息数：" + totalSends + "持续时间A：" + sendtime)
              ws.send("当前通道" + data.channel + "有正在发送的消息，覆盖之前的消息")

              const timerId = clientTimers.get(clientId + "-" + data.channel);
              clearInterval(timerId); // 清除定时器
              clientTimers.delete(clientId + "-" + data.channel); // 清除 Map 中的对应项

              // 发送APP波形队列清除指令
              switch (data.channel) {
                case "A":
                  const clearDataA = { clientId, targetId, message: "clear-1", type: "msg" }
                  target.send(JSON.stringify(clearDataA));
                  break;

                case "B":
                  const clearDataB = { clientId, targetId, message: "clear-2", type: "msg" }
                  target.send(JSON.stringify(clearDataB));
                  break;
                default:
                  break;
              }

              setTimeout(() => {
                delaySendMsg(clientId, ws, target, sendData, totalSends, timeSpace, data.channel);
              }, 150);
            }
            else {
              // 不存在未发完的消息 直接发送
              delaySendMsg(clientId, ws, target, sendData, totalSends, timeSpace, data.channel);
              console.log("通道" + data.channel + "消息发送中，总消息数：" + totalSends + "持续时间：" + sendtime)
            }
          } else {
            console.log(`未找到匹配的客户端，clientId: ${clientId}`);
            const sendData = { clientId, targetId, message: "404", type: "msg" }
            ws.send(JSON.stringify(sendData));
          }
          break;
        default:
          // 未定义的普通消息
          if (relations.get(clientId) !== targetId) {
            const data = { type: "bind", clientId, targetId, message: "402" }
            ws.send(JSON.stringify(data))
            return;
          }
          if (clients.has(clientId)) {
            const client = clients.get(clientId);
            const sendData = { type, clientId, targetId, message }
            client.send(JSON.stringify(sendData));
          } else {
            // 未找到匹配的客户端
            const sendData = { clientId, targetId, message: "404", type: "msg" }
            ws.send(JSON.stringify(sendData));
          }
          break;
      }
    }
  });







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