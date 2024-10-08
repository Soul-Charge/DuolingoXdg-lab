const puppeteer = require('puppeteer');
const fs = require('fs').promises;

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--window-size=1920,1080'],
  }); // 启动浏览器
  const page = await browser.newPage();

  // 暴露 OnWrongAnswer 函数到页面上下文
  await page.exposeFunction('OnWrongAnswer', async () => {
    console.log('回答错误');
  });

  // 从文件中读取cookie并设置，注意使用await等待该函数执行完成
  const cookies = await readCookiesFromFile('./cookies.txt');
  await setCookies(page, cookies);

  // 关闭第一个默认打开的空白页面
  const pages = await browser.pages();
  if (pages.length > 0) {
    await pages[0].close();
  }

  //调整页面大小
  await page.setViewport({ width: 1920, height: 960 });
  // 打开多邻国页面
  await page.goto('https://www.duolingo.com/');

  // 检测错误图片的函数
  await detectErrorImage(page, OnWrongAnswer);

})();



// 从文件中读取cookies的函数
async function readCookiesFromFile(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    // 确保数据按行分割，并解析成对象数组
    const cookies = data.split('\n').map(line => {
      const [name, value] = line.trim().split('=');
      return { name, value, domain: '.duolingo.com' }; // 确保domain属性与目标网站匹配
    }).filter(cookie => cookie.name && cookie.value);

    console.log('解析的cookies:', cookies); // 调试输出，查看解析结果
    return cookies;
  } catch (error) {
    console.error('从文件中读取cookies失败！', error);
    return [];
  }
}

// 设置一个page变量的cookies的函数
async function setCookies(page, cookies) {
  for (const cookie of cookies) {
    await page.setCookie(cookie);
  }
}

async function detectErrorImage(page, OnWrongAnswer) {
  // 创建一个 MutationObserver 实例
  await page.evaluate((OnWrongAnswer) => {
    const observer = new MutationObserver((mutations) => {
      // 遍历变更记录
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // 查找错误提示图片
          const errorImage = document.querySelector('img._1gpzD[src="https://d35aaqx5ub95lt.cloudfront.net/images/9a4bf74a74e801ca35402f2c2837e24c.svg"]');
          if (errorImage) {
            window.OnWrongAnswer();
            break;
          }
        }
      }
    });

    // 配置观察者的选项
    observer.observe(document.body, {
      childList: true,
      subtree: true, // 观察所有子节点的变化
    });
  }, OnWrongAnswer); // 在 Promise 解析后回调 resolve
}

async function OnWrongAnswer() {
  console.log('回答错误');
}