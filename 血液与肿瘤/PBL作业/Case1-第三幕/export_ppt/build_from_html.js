/**
 * 文件作用：
 * 1. 打开同目录上层的 `ppt.html` 本地页面。
 * 2. 逐页切换 4 个 slide，并只对当前激活的 `.slide` 元素截图。
 * 3. 将 4 张 PNG 逐页铺满写入一个 16:9 的 PPTX 文件。
 *
 * 设计取舍：
 * - 用户明确要求“直接截图转成 PPT”，因此这里不做任何 PPT 原生重排。
 * - 截图目标选用 `.slide.active`，而不是整个浏览器窗口。
 *   这样可以天然避开黑色背景、外层阴影和底部翻页控件。
 * - PPTX 采用宽屏 `LAYOUT_WIDE`，每页只放 1 张图片并铺满整页。
 */

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const PptxGenJS = require("pptxgenjs");
const { chromium } = require("playwright");

// 这里统一维护所有路径，避免后续写死路径后难以调整。
const ROOT_DIR = path.resolve(__dirname, "..");
const HTML_PATH = path.join(ROOT_DIR, "ppt.html");
const OUTPUT_DIR = path.join(__dirname, "output");
const IMAGE_DIR = path.join(OUTPUT_DIR, "slides");
const PPTX_PATH = path.join(ROOT_DIR, "Case1-第三幕-截图版.pptx");

// 原始 HTML 的逻辑尺寸就是 1600x900，因此截图和 PPT 都按这个比例走。
const SLIDE_WIDTH_PX = 1600;
const SLIDE_HEIGHT_PX = 900;
const TOTAL_SLIDES = 4;

/**
 * 确保目录存在。
 * 输入：目录绝对路径。
 * 输出：无，若目录不存在则创建。
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 把本地 Windows 路径转成 `file:///` URL。
 * 输入：本地文件路径。
 * 输出：浏览器可直接访问的本地文件 URL。
 */
function toFileUrl(filePath) {
  return pathToFileURL(filePath).href;
}

/**
 * 在页面里隐藏翻页控件，并把外层阴影去掉。
 * 输入：Playwright page 对象。
 * 输出：无。该函数只修改当前页面的运行时样式，不改源文件。
 */
async function preparePageForCapture(page) {
  await page.evaluate(() => {
    const controls = document.getElementById("controls");
    const screen = document.getElementById("screen");

    // 隐藏“上一页 / 下一页”控件，避免被截图。
    if (controls) {
      controls.style.display = "none";
    }

    // 外层阴影原本是给浏览器预览看的，导出截图时去掉更干净。
    if (screen) {
      screen.style.boxShadow = "none";
    }
  });
}

/**
 * 切换到指定页。
 * 输入：
 * - page: Playwright page 对象。
 * - slideNumber: 目标页码，从 1 开始。
 * 输出：无。页面会显示对应的 slide。
 */
async function switchToSlide(page, slideNumber) {
  await page.evaluate((targetSlideNumber) => {
    // 复用页面原有的全局状态和更新函数，避免自己重写切页逻辑。
    window.currentSlide = targetSlideNumber;

    if (typeof window.updateSlides === "function") {
      window.updateSlides();
      return;
    }

    // 兜底逻辑：如果未来页面脚本改了名字，仍然能按 class 切换显示状态。
    document.querySelectorAll(".slide").forEach((element, index) => {
      const isActive = index + 1 === targetSlideNumber;
      element.classList.toggle("active", isActive);
      element.classList.toggle("hidden", !isActive);
    });
  }, slideNumber);

  // 等一帧，确保 CSS 过渡状态已经稳定。
  await page.waitForTimeout(80);
}

/**
 * 截取所有幻灯片，并把 PNG 路径列表返回给后续 PPTX 构建流程。
 * 输入：无。
 * 输出：按页码顺序排列的 PNG 绝对路径数组。
 */
async function captureSlides() {
  ensureDir(OUTPUT_DIR);
  ensureDir(IMAGE_DIR);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: {
      width: SLIDE_WIDTH_PX,
      height: SLIDE_HEIGHT_PX
    },
    deviceScaleFactor: 1
  });

  const htmlUrl = toFileUrl(HTML_PATH);
  const imagePaths = [];

  await page.goto(htmlUrl, { waitUntil: "load" });
  await preparePageForCapture(page);

  for (let slideNumber = 1; slideNumber <= TOTAL_SLIDES; slideNumber += 1) {
    const outputImagePath = path.join(IMAGE_DIR, `slide-${slideNumber}.png`);

    await switchToSlide(page, slideNumber);

    // 只截当前激活页的元素边界，这样不会把外层黑边和控件带进来。
    const activeSlide = page.locator(".slide.active");
    await activeSlide.screenshot({
      path: outputImagePath,
      type: "png"
    });

    imagePaths.push(outputImagePath);
  }

  await browser.close();
  return imagePaths;
}

/**
 * 用截图结果生成 16:9 PPTX。
 * 输入：PNG 路径数组，顺序即最终页顺序。
 * 输出：无。函数会直接写出 `.pptx` 文件。
 */
async function buildPptx(imagePaths) {
  const pptx = new PptxGenJS();

  // `LAYOUT_WIDE` 是 PowerPoint 常用的宽屏 16:9 尺寸。
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "OpenAI Codex";
  pptx.company = "OpenAI";
  pptx.subject = "Case1 第三幕截图版汇报";
  pptx.title = "Case1-第三幕-截图版";
  pptx.lang = "zh-CN";

  // 为了避免页面默认边距干扰，这里把整页边距清零。
  pptx.theme = {
    headFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei",
    lang: "zh-CN"
  };

  for (const imagePath of imagePaths) {
    const slide = pptx.addSlide();

    // 整页铺满：宽屏布局固定为 13.333 x 7.5 英寸。
    slide.addImage({
      path: imagePath,
      x: 0,
      y: 0,
      w: 13.333,
      h: 7.5
    });
  }

  await pptx.writeFile({ fileName: PPTX_PATH });
}

/**
 * 主流程：
 * 1. 校验关键输入文件是否存在；
 * 2. 先截图；
 * 3. 再写 PPTX；
 * 4. 控制台输出最终产物路径，方便脚本联调用。
 */
async function main() {
  if (!fs.existsSync(HTML_PATH)) {
    throw new Error(`未找到源 HTML：${HTML_PATH}`);
  }

  const imagePaths = await captureSlides();
  await buildPptx(imagePaths);

  console.log(`截图目录：${IMAGE_DIR}`);
  console.log(`PPT 输出：${PPTX_PATH}`);
}

main().catch((error) => {
  console.error("导出失败：", error);
  process.exitCode = 1;
});
