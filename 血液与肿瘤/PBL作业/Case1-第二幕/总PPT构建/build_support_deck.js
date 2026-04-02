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
const { imageSizingContain } = require("./pptxgenjs_helpers/image");

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
 * 支持页顺序表。
 * id 用于后续 merge 脚本精确引用；title/subtitle/content 只服务于本次生成。
 */
const SUPPORT_SLIDES = [
  {
    id: "cover",
    type: "cover",
    title: "PBL Case 1 第二幕",
    subtitle: "血液与肿瘤课程汇报总整合版",
    note: "主持串讲稿 · 问题1到问题6完整顺序",
  },
  {
    id: "agenda",
    type: "agenda",
    title: "汇报主线",
    items: [
      "问题1：胸水穿刺检查与当前胸水性质判断",
      "问题2：白血病分类与 CML 在现代分类中的位置",
      "问题3：CML 的诊断标准、分期标准与病例缺口",
      "问题4：为什么会出现幼稚白细胞、核左移及相关机制",
      "问题5：外周血涂片与骨髓象的典型形态学特征",
      "问题6：病因、高危暴露与一级 / 二级预防",
    ],
  },
  {
    id: "section_q1",
    type: "section",
    indexLabel: "Q1",
    title: "胸水穿刺检查与当前胸水性质判断",
    description: "先把胸水性质讲清楚，再把诊断重心转回 CML 主线。",
  },
  {
    id: "section_q2",
    type: "section",
    indexLabel: "Q2",
    title: "白血病分类与 CML 的现代定位",
    description: "从传统“四大型”入门，再过渡到 WHO / ICC 下的 MPN 定位。",
  },
  {
    id: "image_q2",
    type: "image",
    imagePath: SELF_SLIDE_IMAGES.q2,
  },
  {
    id: "section_q3",
    type: "section",
    indexLabel: "Q3",
    title: "CML 的诊断标准、分期标准与病例缺口",
    description: "先定疑诊方向，再指出确诊和分期仍缺少哪些关键证据。",
  },
  {
    id: "image_q3",
    type: "image",
    imagePath: SELF_SLIDE_IMAGES.q3,
  },
  {
    id: "section_q4",
    type: "section",
    indexLabel: "Q4",
    title: "为什么会产生幼稚白细胞与核左移",
    description: "这一题是第二幕重点，先走主线机制，再接同学补充文献与前沿研究。",
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
    id: "transition_q4_extra",
    type: "section",
    indexLabel: "Q4-补充",
    title: "同学补充文献：从驱动机制到急变、微环境与演化",
    description: "排序原则：基础驱动在前，分化与急变居中，微环境与演化收尾。",
  },
  {
    id: "section_q5",
    type: "section",
    indexLabel: "Q5",
    title: "外周血涂片与骨髓象的典型形态学特征",
    description: "先看我们的总表，再看同学补充的骨髓相与镜下形态图片。",
  },
  {
    id: "image_q5",
    type: "image",
    imagePath: SELF_SLIDE_IMAGES.q5,
  },
  {
    id: "section_q6",
    type: "section",
    indexLabel: "Q6",
    title: "病因、高危暴露与一级 / 二级预防",
    description: "回到暴露史追问、风险因素判断以及如何做一级、二级预防。",
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

  slide.addText("张家赫｜儿科班｜PBL Case 1 第二幕", {
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

  slide.addShape(pptx.ShapeType.rect, {
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

  slide.addShape(pptx.ShapeType.line, {
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

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: 13.333,
    h: 1.2,
    line: { color: "274B87", transparency: 100 },
    fill: { color: "274B87" },
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.72,
    y: 1.75,
    w: 11.9,
    h: 3.45,
    rectRadius: 0.08,
    line: { color: "DCE6F2", width: 1 },
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 1, angle: 45, distance: 1, opacity: 0.08 },
  });

  slide.addText(slideDef.title, {
    x: 0.92,
    y: 2.15,
    w: 7.8,
    h: 0.7,
    fontFace: "Microsoft YaHei",
    fontSize: 26,
    bold: true,
    color: "1E3C72",
    margin: 0,
  });

  slide.addText(slideDef.subtitle, {
    x: 0.92,
    y: 2.95,
    w: 7.8,
    h: 0.45,
    fontFace: "Microsoft YaHei",
    fontSize: 18,
    color: "475569",
    margin: 0,
  });

  slide.addText(slideDef.note, {
    x: 0.92,
    y: 3.55,
    w: 5.2,
    h: 0.38,
    fontFace: "Microsoft YaHei",
    fontSize: 13,
    color: "0F766E",
    bold: true,
    margin: 0,
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 8.95,
    y: 2.0,
    w: 2.95,
    h: 1.65,
    rectRadius: 0.06,
    line: { color: "BFDBFE", width: 1.2 },
    fill: { color: "EFF6FF" },
  });

  slide.addText("第二幕问题主线", {
    x: 9.2,
    y: 2.25,
    w: 2.45,
    h: 0.28,
    fontFace: "Microsoft YaHei",
    fontSize: 12,
    color: "2563EB",
    bold: true,
    align: "center",
    margin: 0,
  });

  slide.addText("Q1 → Q2 → Q3 → Q4 → Q5 → Q6", {
    x: 9.2,
    y: 2.72,
    w: 2.45,
    h: 0.46,
    fontFace: "Microsoft YaHei",
    fontSize: 16,
    bold: true,
    color: "1E3A8A",
    align: "center",
    margin: 0,
  });

  slide.addText("主持人负责串讲顺序与起承转合", {
    x: 8.98,
    y: 3.25,
    w: 2.9,
    h: 0.24,
    fontFace: "Microsoft YaHei",
    fontSize: 10,
    color: "64748B",
    align: "center",
    margin: 0,
  });

  addFooter(slide, "第二幕总汇报封面");
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

    slide.addShape(pptx.ShapeType.roundRect, {
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
  addBaseChrome(slide, `${slideDef.indexLabel}｜问题过渡`);

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 0.9,
    y: 1.75,
    w: 11.55,
    h: 3.1,
    rectRadius: 0.08,
    line: { color: "DCE6F2", width: 1 },
    fill: { color: "FFFFFF" },
  });

  slide.addShape(pptx.ShapeType.roundRect, {
    x: 1.15,
    y: 2.15,
    w: 1.25,
    h: 0.78,
    rectRadius: 0.06,
    line: { color: "BBF7D0", width: 1 },
    fill: { color: "F0FDF4" },
  });

  slide.addText(slideDef.indexLabel, {
    x: 1.15,
    y: 2.33,
    w: 1.25,
    h: 0.26,
    fontFace: "Microsoft YaHei",
    fontSize: 18,
    bold: true,
    color: "166534",
    align: "center",
    margin: 0,
  });

  slide.addText(slideDef.title, {
    x: 2.7,
    y: 2.02,
    w: 8.4,
    h: 0.52,
    fontFace: "Microsoft YaHei",
    fontSize: 24,
    bold: true,
    color: "1E3C72",
    margin: 0,
  });

  slide.addText(slideDef.description, {
    x: 2.72,
    y: 2.88,
    w: 8.55,
    h: 0.7,
    fontFace: "Microsoft YaHei",
    fontSize: 15,
    color: "475569",
    margin: 0,
  });

  addFooter(slide, `${slideDef.indexLabel} 过渡页`);
  return slide;
}

/**
 * 把 HTML 导出的截图直接做成整页图片页。
 * 这类页不再额外加标题栏，因为图片里已经带有完整版式。
 */
function addImageSlide(pptx, slideDef) {
  const slide = pptx.addSlide();

  slide.background = { color: "111827" };
  slide.addImage({
    path: slideDef.imagePath,
    ...imageSizingContain(slideDef.imagePath, 0, 0, 13.333, 7.5),
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

  slide.addShape(pptx.ShapeType.roundRect, {
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

  slide.addShape(pptx.ShapeType.roundRect, {
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
