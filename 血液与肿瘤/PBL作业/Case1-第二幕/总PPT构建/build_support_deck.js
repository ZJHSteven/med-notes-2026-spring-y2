/**
 * 文件作用：
 * 1. 生成“第二幕总汇报”中的自制支持页，包括封面页、目录页、问题过渡页和我们自己制作的截图页。
 * 2. 输出一个 support deck（支持页母版），后续再由 PowerPoint COM 把同学原始 pptx 页插入进来。
 * 3. 额外输出一个 manifest，记录每张支持页在 support deck 中的页码，方便合并脚本精准引用。
 *
 * 为什么这样拆：
 * - 同学原始页需要尽量保留动画和原始版式，这部分更适合用 PowerPoint 自己去“插入现有幻灯片”。
 * - 我们新增的封面、过渡页、自制截图页不需要动画，适合用 PptxGenJS 稳定生成。
 * - 把两部分拆开以后，既能保住同学原稿，又能让自动化构建足够清晰。
 */

const fs = require("fs");
const path = require("path");
const PptxGenJS = require("pptxgenjs");

/**
 * 统一路径根目录。
 * 这里用当前脚本目录做基准，避免从不同终端目录执行时相对路径错位。
 */
const ROOT_DIR = __dirname;
const OUTPUT_DIR = path.join(ROOT_DIR, "output");
const SUPPORT_DECK_PATH = path.join(OUTPUT_DIR, "第二幕总汇报-支持页.pptx");
const MANIFEST_PATH = path.join(OUTPUT_DIR, "support_manifest.json");

/**
 * 自制截图页资源。
 * 这些 PNG 是从已经调好的 HTML 页面导出的静态终态图，直接整页铺入即可。
 */
const SELF_SLIDE_IMAGES = {
  q2: path.resolve(ROOT_DIR, "../../../..", "output", "playwright", "PPT-问题2.png"),
  q3: path.resolve(ROOT_DIR, "../../../..", "output", "playwright", "PPT-问题3.png"),
  q4_1: path.resolve(ROOT_DIR, "../../../..", "output", "playwright", "PPT-问题4.png"),
  q4_2: path.resolve(ROOT_DIR, "../../../..", "output", "playwright", "PPT-问题4-2.png"),
  q4_3: path.resolve(ROOT_DIR, "../../../..", "output", "playwright", "PPT-问题4-3.png"),
  q5: path.resolve(ROOT_DIR, "../../../..", "output", "playwright", "PPT-问题5.png"),
};

/**
 * 组员名单。
 * 封面页只做两件事：交代“这是哪一幕”，以及“谁来汇报”。
 */
const GROUP_MEMBERS = [
  "张家赫",
  "戴思如",
  "樊滨瑞",
  "李宗垚",
  "乔智",
  "善玥",
  "王语萱",
  "叶潇潇",
  "钟琬毓",
  "仇维健",
];

/**
 * 题目原文必须与报告保持一致，不能在总稿里再次自行概括。
 */
const QUESTION_TITLES = {
  q1: "诊断性胸腔穿刺后常做哪些实验室检查？赵阿姨现有胸水结果说明了什么？",
  q2: "白血病如何分类？CML 在白血病与骨髓增殖性肿瘤谱系中处于什么位置？",
  q3: "CML 的诊断标准与分期标准是什么？本病例目前符合哪些条目，还缺哪些确诊信息？",
  q4: "为什么 CML 会出现幼稚白细胞、核左移以及嗜酸/嗜碱粒细胞增多？",
  q5: "CML 的外周血涂片和骨髓象有哪些典型形态学特征？赵阿姨的检查结果是否匹配？",
  q6: "CML 的病因、诱因和高危因素有哪些？本病例哪些暴露史值得追问，并如何落实一级、二级预防？",
};

/**
 * 支持页顺序表。
 * id 用于后续 merge 脚本精确引用；title/subtitle/content 只服务于本次生成。
 */
const SUPPORT_SLIDES = [
  {
    id: "cover",
    type: "cover",
    title: "PBL Case 1 第二幕",
    members: GROUP_MEMBERS,
  },
  {
    id: "section_q1",
    type: "section",
    indexLabel: "问题 1",
    title: QUESTION_TITLES.q1,
  },
  {
    id: "section_q2",
    type: "section",
    indexLabel: "问题 2",
    title: QUESTION_TITLES.q2,
  },
  {
    id: "image_q2",
    type: "image",
    imagePath: SELF_SLIDE_IMAGES.q2,
  },
  {
    id: "section_q3",
    type: "section",
    indexLabel: "问题 3",
    title: QUESTION_TITLES.q3,
  },
  {
    id: "image_q3",
    type: "image",
    imagePath: SELF_SLIDE_IMAGES.q3,
  },
  {
    id: "section_q4",
    type: "section",
    indexLabel: "问题 4",
    title: QUESTION_TITLES.q4,
  },
  {
    id: "image_q4_1",
    type: "image",
    imagePath: SELF_SLIDE_IMAGES.q4_1,
  },
  {
    id: "image_q4_2",
    type: "image",
    imagePath: SELF_SLIDE_IMAGES.q4_2,
  },
  {
    id: "image_q4_3",
    type: "image",
    imagePath: SELF_SLIDE_IMAGES.q4_3,
  },
  {
    id: "section_q5",
    type: "section",
    indexLabel: "问题 5",
    title: QUESTION_TITLES.q5,
  },
  {
    id: "image_q5",
    type: "image",
    imagePath: SELF_SLIDE_IMAGES.q5,
  },
  {
    id: "section_q6",
    type: "section",
    indexLabel: "问题 6",
    title: QUESTION_TITLES.q6,
  },
  {
    id: "closing",
    type: "closing",
    title: "汇报结束",
    subtitle: "欢迎老师和同学继续提问讨论",
  },
];

/**
 * 统一的演示主题与尺寸。
 * 这里显式设置字体，避免 PowerPoint 默认字体替换导致画面风格跑偏。
 */
function createPresentation() {
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Codex + 张家赫";
  pptx.company = "天津医科大学";
  pptx.subject = "PBL Case 1 第二幕总汇报";
  pptx.title = "PBL Case 1 第二幕总汇报";
  pptx.lang = "zh-CN";
  pptx.theme = {
    headFontFace: "Microsoft YaHei",
    bodyFontFace: "Microsoft YaHei",
    lang: "zh-CN",
  };

  return pptx;
}

/**
 * 画一个统一页脚。
 * 目的不是堆信息，而是让所有新生成的支持页看起来属于同一套稿子。
 */
function addFooter(slide, leftText) {
  slide.addText(leftText, {
    x: 0.55,
    y: 7.02,
    w: 6.8,
    h: 0.22,
    fontFace: "Microsoft YaHei",
    fontSize: 9,
    color: "94A3B8",
    italic: true,
    margin: 0,
  });

  slide.addText("血液与肿瘤｜PBL Case 1 第二幕", {
    x: 8.65,
    y: 7.0,
    w: 4.1,
    h: 0.25,
    fontFace: "Microsoft YaHei",
    fontSize: 9,
    color: "64748B",
    align: "right",
    margin: 0,
  });
}

/**
 * 统一背景：顶端深蓝横带 + 主体浅灰白底。
 * 这套结构和我们之前 HTML 截图页的视觉语言一致，所以合并后不突兀。
 */
function addBaseChrome(slide, headerText) {
  slide.background = { color: "F8FAFC" };

  slide.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.333,
    h: 0.95,
    line: { color: "2F5597", transparency: 100 },
    fill: { color: "2F5597" },
  });

  slide.addText(headerText, {
    x: 0.5,
    y: 0.18,
    w: 9.8,
    h: 0.42,
    fontFace: "Microsoft YaHei",
    fontSize: 22,
    bold: true,
    color: "FFFFFF",
    margin: 0,
  });

  slide.addShape("line", {
    x: 0,
    y: 0.95,
    w: 13.333,
    h: 0,
    line: { color: "DCE6F2", width: 1.2 },
  });
}

/**
 * 封面页：
 * - 更强调“这是总整合稿”
 * - 视觉上比普通分节页更正式一点
 */
function addCoverSlide(pptx, slideDef) {
  const slide = pptx.addSlide();

  slide.background = {
    color: "F8FAFC",
  };

  slide.addShape("roundRect", {
    x: 0.88,
    y: 1.05,
    w: 11.58,
    h: 5.55,
    rectRadius: 0.06,
    line: { color: "DCE6F2", width: 1.1 },
    fill: { color: "FFFFFF" },
  });

  slide.addText(slideDef.title, {
    x: 1.35,
    y: 1.72,
    w: 10.6,
    h: 0.8,
    fontFace: "Microsoft YaHei",
    fontSize: 28,
    bold: true,
    color: "1E3C72",
    align: "center",
    margin: 0,
  });

  slide.addShape("line", {
    x: 3.05,
    y: 2.7,
    w: 7.2,
    h: 0,
    line: { color: "BFDBFE", width: 1.3 },
  });

  slide.addText("汇报成员", {
    x: 1.35,
    y: 3.05,
    w: 10.6,
    h: 0.34,
    fontFace: "Microsoft YaHei",
    fontSize: 15,
    bold: true,
    color: "475569",
    align: "center",
    margin: 0,
  });

  slide.addText(slideDef.members.join("  ·  "), {
    x: 1.18,
    y: 3.58,
    w: 11.0,
    h: 1.1,
    fontFace: "Microsoft YaHei",
    fontSize: 18,
    color: "475569",
    align: "center",
    margin: 0,
    breakLine: false,
  });

  slide.addText("血液与肿瘤课程 PBL 汇报", {
    x: 1.35,
    y: 5.22,
    w: 10.6,
    h: 0.3,
    fontFace: "Microsoft YaHei",
    fontSize: 13,
    color: "64748B",
    align: "center",
    margin: 0,
  });

  return slide;
}

/**
 * 目录页：
 * - 让老师一眼看到整套顺序
 * - 也方便主持人自己看串讲节奏
 */
function addAgendaSlide(pptx, slideDef) {
  const slide = pptx.addSlide();
  addBaseChrome(slide, slideDef.title);

  slide.addText("本次汇报按问题链依次推进，重点放在 Q4 的机制讲解与同学文献补充。", {
    x: 0.72,
    y: 1.22,
    w: 9.8,
    h: 0.36,
    fontFace: "Microsoft YaHei",
    fontSize: 14,
    color: "475569",
    margin: 0,
  });

  const cardPositions = [
    { x: 0.72, y: 1.85 },
    { x: 4.48, y: 1.85 },
    { x: 8.24, y: 1.85 },
    { x: 0.72, y: 3.85 },
    { x: 4.48, y: 3.85 },
    { x: 8.24, y: 3.85 },
  ];

  slideDef.items.forEach((item, index) => {
    const pos = cardPositions[index];
    const orderText = `0${index + 1}`;

    slide.addShape("roundRect", {
      x: pos.x,
      y: pos.y,
      w: 3.25,
      h: 1.45,
      rectRadius: 0.05,
      line: { color: "DCE6F2", width: 1 },
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 1, angle: 45, distance: 1, opacity: 0.06 },
    });

    slide.addText(orderText, {
      x: pos.x + 0.18,
      y: pos.y + 0.18,
      w: 0.55,
      h: 0.3,
      fontFace: "Microsoft YaHei",
      fontSize: 12,
      bold: true,
      color: "0F766E",
      margin: 0,
    });

    slide.addText(item, {
      x: pos.x + 0.18,
      y: pos.y + 0.55,
      w: 2.85,
      h: 0.68,
      fontFace: "Microsoft YaHei",
      fontSize: 13,
      color: "1E293B",
      bold: true,
      margin: 0,
      fit: "shrink",
      breakLine: false,
    });
  });

  addFooter(slide, "第二幕总汇报目录");
  return slide;
}

/**
 * 问题过渡页：
 * - 每个问题前单独起一页，解决“同学页没有写清楚是哪一题”的问题。
 * - 这一页不塞过多知识点，重点是“告诉听众现在要切到哪一题”。
 */
function addSectionSlide(pptx, slideDef) {
  const slide = pptx.addSlide();
  addBaseChrome(slide, slideDef.indexLabel);

  slide.addShape("roundRect", {
    x: 0.9,
    y: 1.55,
    w: 11.55,
    h: 4.15,
    rectRadius: 0.08,
    line: { color: "DCE6F2", width: 1 },
    fill: { color: "FFFFFF" },
  });

  slide.addShape("roundRect", {
    x: 1.15,
    y: 2.0,
    w: 1.55,
    h: 0.9,
    rectRadius: 0.06,
    line: { color: "BBF7D0", width: 1 },
    fill: { color: "F0FDF4" },
  });

  slide.addText(slideDef.indexLabel, {
    x: 1.15,
    y: 2.22,
    w: 1.55,
    h: 0.3,
    fontFace: "Microsoft YaHei",
    fontSize: 19,
    bold: true,
    color: "166534",
    align: "center",
    margin: 0,
  });

  slide.addText(slideDef.title, {
    x: 3.05,
    y: 1.98,
    w: 8.45,
    h: 2.25,
    fontFace: "Microsoft YaHei",
    fontSize: 23,
    bold: true,
    color: "1E3C72",
    margin: 0,
    valign: "mid",
  });

  addFooter(slide, `${slideDef.indexLabel} 标题页`);
  return slide;
}

/**
 * 把 HTML 导出的截图直接做成整页图片页。
 * 这类页不再额外加标题栏，因为图片里已经带有完整版式。
 */
function addImageSlide(pptx, slideDef) {
  const slide = pptx.addSlide();

  slide.background = { color: "FFFFFF" };
  slide.addImage({
    path: slideDef.imagePath,
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
  });

  return slide;
}

/**
 * 结束页：
 * - 让总稿有一个完整收束，而不是最后突然停在某个同学页。
 */
function addClosingSlide(pptx, slideDef) {
  const slide = pptx.addSlide();
  addBaseChrome(slide, "汇报结束");

  slide.addShape("roundRect", {
    x: 1.1,
    y: 1.85,
    w: 11.1,
    h: 2.85,
    rectRadius: 0.08,
    line: { color: "DCE6F2", width: 1 },
    fill: { color: "FFFFFF" },
  });

  slide.addText(slideDef.title, {
    x: 1.45,
    y: 2.25,
    w: 5.4,
    h: 0.55,
    fontFace: "Microsoft YaHei",
    fontSize: 26,
    bold: true,
    color: "1E3C72",
    margin: 0,
  });

  slide.addText(slideDef.subtitle, {
    x: 1.45,
    y: 3.05,
    w: 5.8,
    h: 0.36,
    fontFace: "Microsoft YaHei",
    fontSize: 15,
    color: "475569",
    margin: 0,
  });

  slide.addShape("roundRect", {
    x: 8.1,
    y: 2.18,
    w: 2.7,
    h: 1.1,
    rectRadius: 0.05,
    line: { color: "BFDBFE", width: 1 },
    fill: { color: "EFF6FF" },
  });

  slide.addText("谢谢聆听", {
    x: 8.1,
    y: 2.55,
    w: 2.7,
    h: 0.24,
    fontFace: "Microsoft YaHei",
    fontSize: 18,
    bold: true,
    color: "1D4ED8",
    align: "center",
    margin: 0,
  });

  addFooter(slide, "总汇报结束页");
  return slide;
}

/**
 * 根据 slideDef.type 分发到对应的构建函数。
 */
function buildSlideByType(pptx, slideDef) {
  if (slideDef.type === "cover") {
    return addCoverSlide(pptx, slideDef);
  }

  if (slideDef.type === "agenda") {
    return addAgendaSlide(pptx, slideDef);
  }

  if (slideDef.type === "section") {
    return addSectionSlide(pptx, slideDef);
  }

  if (slideDef.type === "image") {
    return addImageSlide(pptx, slideDef);
  }

  if (slideDef.type === "closing") {
    return addClosingSlide(pptx, slideDef);
  }

  throw new Error(`未知的支持页类型：${slideDef.type}`);
}

/**
 * 主流程：
 * 1. 创建输出目录；
 * 2. 依次生成支持页；
 * 3. 写出 pptx；
 * 4. 写出 manifest。
 */
async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  Object.entries(SELF_SLIDE_IMAGES).forEach(([id, imagePath]) => {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`缺少自制截图资源：${id} -> ${imagePath}`);
    }
  });

  const pptx = createPresentation();
  const manifest = {
    supportDeckPath: SUPPORT_DECK_PATH,
    slides: {},
  };

  SUPPORT_SLIDES.forEach((slideDef, index) => {
    buildSlideByType(pptx, slideDef);
    manifest.slides[slideDef.id] = index + 1;
  });

  await pptx.writeFile({ fileName: SUPPORT_DECK_PATH });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`支持页 PPT 已生成：${SUPPORT_DECK_PATH}`);
  console.log(`支持页清单已生成：${MANIFEST_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
