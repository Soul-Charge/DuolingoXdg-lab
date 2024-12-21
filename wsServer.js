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
// 开启WebSocket服务
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

  // 处理错误消息
  ws.on("error", (error) => {
    console.error(error);
  })

  /**
   * 监听客户端的消息，既有APP的也有自己的客户端的消息
   */
  ws.on('message', function incoming(message) {
    console.log("收到消息：" + message)
    /**
     * 客户端发来的消息，格式为JSON
     * @type {JSON}
     * @description json 格式: {"type":"xxx","clientId":"xxx","targetId":"xxx","message":"xxx"}
     * type 指令:
     * heartbeat -> 心跳包数据
     * bind -> ID 关系绑定
     * msg -> 波形下发/强度变化/队列清空等数据指令
     * break -> 连接断开
     * error -> 服务错误
     * clientID: 第三方终端 ID
     * targetId: APP ID
     * message: 消息/指令
     */
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

    // 接受APP的绑定请求然后把终端ID和APP ID进行绑定
    if (data.type && data.clientId && data.message && data.targetId) {
      // 优先处理绑定关系
      const { clientId, targetId, message, type } = data;
      switch (data.type) {
        case "bind":
          // 服务器下发绑定关系
          if (clients.has(clientId) && clients.has(targetId)) {
            // relations的双方都不存在这俩id
            // TODO: [...relations.values()]这个[]内的展开表达式搞不懂，relations.values()是一个迭代器对象，展开是什么情况
            // 但是整体含义只是检查是否没有绑定，如果没有则进行绑定
            if (![clientId, targetId].some(id => relations.has(id) || [...relations.values()].includes(id))) {
              relations.set(clientId, targetId)
              const client = clients.get(clientId);
              const sendData = { clientId, targetId, message: "200", type: "bind" } // 绑定成功
              ws.send(JSON.stringify(sendData));
              client.send(JSON.stringify(sendData));
            }
            else {
              const data = { type: "bind", clientId, targetId, message: "400" } // 此id已被其他客户端绑定关系400表示绑定失败
              ws.send(JSON.stringify(data))
              return;
            }
          } else {
            const sendData = { clientId, targetId, message: "401", type: "bind" } // 要绑定的目标客户端不存在
            ws.send(JSON.stringify(sendData));
            return;
          }
          break;
        case "msg": 
          break;
        default:
          // 未定义的普通消息
          if (relations.get(clientId) !== targetId) {
            const data = { type: "bind", clientId, targetId, message: "402" } // 收信方和寄信方不是绑定关系
            ws.send(JSON.stringify(data))
            return;
          }
          if (clients.has(clientId)) {
            const client = clients.get(clientId);
            const sendData = { type, clientId, targetId, message }
            client.send(JSON.stringify(sendData));
          } else {
            // 未找到匹配的客户端
            const sendData = { clientId, targetId, message: "404", type: "msg" } // 未找到收信人（离线）
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