const WebSocket = require("ws");
const { v4:uuidv4 } = require("uuid");

// 储存已连接的用户及其标识
const clients = new Map();
// 开启WebSocket服务，省略ip则为localhost
const wss = new WebSocket.Server({port:8080})

// 注册相应连接到wss服务的事件
// on()方法为注册,"connection"为注册事件名，ws形参是连接到服务器的ws客户端对象
wss.on("connection", (ws) => {

  const clientId = uuidv4();
  console.log("Websocket连接已建立，标识符id：" + clientId);
  // 将id与ws对象绑定
  clients.set(clientId, ws);

  // 发送标识符给客户端（格式固定，双方都必须获取才可以进行后续通信：比如浏览器和APP）
  ws.send(JSON.stringify({ type: 'bind', clientId, message: 'targetId', targetId: '' }));

  ws.on("error", (error) => {
    console.error(error);
  })


  //客户端消息事件
  ws.on("message", (msg) => {
  })
});
