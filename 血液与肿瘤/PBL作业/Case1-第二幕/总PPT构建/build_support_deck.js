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
const SUPPORT_DECK_NAME = "第二幕总汇报-支持页.pptx";
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
 * 自制截图页在总稿里需要补回原网页页脚。
 * 这里不再改 HTML 本体，而是在最终 PPT 合成阶段把页脚作为原生元素叠加回去。
 */
const SELF_IMAGE_FOOTERS = {
  q2: "来源：《内科学》第10版 九章白血病；Li W. WHO 5th Ed Classification. Leukemia, 2022.",
  q3: "来源：国家卫健委《慢性髓性白血病诊疗指南（2022年版）》；《内科学》第10版；中国 CML 指南 2025.",
  q4_1: "引证：Hantschel O, et al. Nat Chem Biol. 2012；Targeting Leukemic Stem Cells, 2021.",
  q4_2: "引证：Hayashi Y, et al. Leukemia. 2013；Srutova K, et al. Haematologica. 2018.",
  q4_3: "引证：Peled A, Stem Cells 2002；Zhang B, Cancer Cell 2012；Krishnan V, Blood 2023；Warfvinge R, eLife 2024；Purhonen M, Leukemia 2025.",
  q5: "来源：《内科学》第10版 p.585；Gianelli U, et al. Virchows Arch, 2023；Case1-第二幕报告正文。",
};

const SELF_IMAGE_AUTHOR = "张家赫｜学号：2024193112｜儿科班｜PBL Case 1";

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
 * 老师临时要求补入的两张“讨论提示页”。
 * 这里不照搬 Word 大段正文，而是只保留课堂展示真正需要的短标题和关键词。
 */
const DISCUSSION_SLIDES = {
  differential: {
    id: "discussion_q3_differential",
    type: "discussion",
    headerText: "问题 3｜补充讨论",
    title: "鉴别诊断",
    subtitle: "具体鉴别点课上展开，这里只保留需要点到的对象。",
    sections: [
      {
        label: "重点对象",
        accentColor: "1D4ED8",
        bgColor: "EFF6FF",
        borderColor: "BFDBFE",
        items: [
          "其他原因引起的脾大",
          "类白血病反应",
          "骨髓纤维化",
        ],
      },
      {
        label: "课堂提示",
        accentColor: "0F766E",
        bgColor: "F0FDF4",
        borderColor: "BBF7D0",
        items: [
          "结合脾大背景、血象和骨髓象讨论",
          "重点回到 Ph 染色体 / BCR::ABL1 证据",
          "必要时补充 NAP、JAK2 / CALR / MPL 等线索",
        ],
      },
    ],
    footerText: "补充页｜依据 Word 标注整理：鉴别诊断",
  },
  riskFactors: {
    id: "discussion_q6_risk",
    type: "discussion",
    headerText: "问题 6｜补充讨论",
    title: "病因、基本机制、诱因与高危因素",
    subtitle: "不放长段解释，只保留课堂要展开的主轴。",
    sections: [
      {
        label: "病因与基本机制",
        accentColor: "DC2626",
        bgColor: "FEF2F2",
        borderColor: "FECACA",
        items: [
          "费城染色体 t(9;22)",
          "BCR::ABL1 融合基因",
          "持续活化酪氨酸激酶",
          "髓系细胞异常增殖、抗凋亡",
        ],
      },
      {
        label: "诱因与高危因素",
        accentColor: "7C3AED",
        bgColor: "FAF5FF",
        borderColor: "DDD6FE",
        items: [
          "生物因素",
          "物理因素：电离辐射",
          "化学因素：苯 / 有机溶剂等",
          "遗传因素",
          "其他血液病背景",
          "年龄因素",
          "性别因素",
        ],
      },
    ],
    footerText: "补充页｜依据 Word 标注整理：病因 / 基本机制 / 诱因 / 高危因素",
  },
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
    footerRef: SELF_IMAGE_FOOTERS.q2,
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
    footerRef: SELF_IMAGE_FOOTERS.q3,
  },
  DISCUSSION_SLIDES.differential,
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
    footerRef: SELF_IMAGE_FOOTERS.q4_1,
  },
  {
    id: "image_q4_2",
    type: "image",
    imagePath: SELF_SLIDE_IMAGES.q4_2,
    footerRef: SELF_IMAGE_FOOTERS.q4_2,
  },
  {
    id: "image_q4_3",
    type: "image",
    imagePath: SELF_SLIDE_IMAGES.q4_3,
    footerRef: SELF_IMAGE_FOOTERS.q4_3,
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
    footerRef: SELF_IMAGE_FOOTERS.q5,
  },
  {
    id: "section_q6",
    type: "section",
    indexLabel: "问题 6",
    title: QUESTION_TITLES.q6,
  },
  DISCUSSION_SLIDES.riskFactors,
  {
    id: "closing",
    type: "closing",
    title: "汇报结束",
    subtitle: "欢迎老师和同学继续提问讨论",
  },
];

/**
 * 如果目标文件被 WPS / PowerPoint / VS Code 预览占用，就自动换一个“修订版”文件名继续写。
 * 这样不会因为旧稿还开着而让整套重建流程直接失败。
 */
function resolveWritableOutputPath(outputDir, fileName) {
  const parsedPath = path.parse(fileName);
  const primaryPath = path.join(outputDir, fileName);

  try {
    if (fs.existsSync(primaryPath)) {
      const testFileHandle = fs.openSync(primaryPath, "r+");
      fs.closeSync(testFileHandle);
    }

    return primaryPath;
  } catch (error) {
    if (!["EBUSY", "EPERM"].includes(error.code)) {
      throw error;
    }
  }

  let fallbackIndex = 1;

  while (true) {
    const fallbackName = `${parsedPath.name}-修订版${fallbackIndex}${parsedPath.ext}`;
    const fallbackPath = path.join(outputDir, fallbackName);

    if (!fs.existsSync(fallbackPath)) {
      return fallbackPath;
    }

    fallbackIndex += 1;
  }
}

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

  /*
   * 这些截图页本来在 HTML 里就有页脚信息。
   * 由于浏览器导图时底部页脚没有被带进最终 PNG，这里在 PPT 合成阶段补回去。
   */
  slide.addShape("rect", {
    x: 0,
    y: 7.015,
    w: 13.333,
    h: 0.485,
    line: { color: "E2E8F0", width: 0.8 },
    fill: { color: "F8FAFC" },
  });

  slide.addText(slideDef.footerRef, {
    x: 0.42,
    y: 7.12,
    w: 7.65,
    h: 0.18,
    fontFace: "Microsoft YaHei",
    fontSize: 8.2,
    color: "94A3B8",
    italic: true,
    margin: 0,
    fit: "shrink",
  });

  slide.addText(SELF_IMAGE_AUTHOR, {
    x: 8.2,
    y: 7.11,
    w: 4.72,
    h: 0.2,
    fontFace: "Microsoft YaHei",
    fontSize: 8.4,
    color: "64748B",
    align: "right",
    margin: 0,
    fit: "shrink",
  });

  return slide;
}

/**
 * 讨论提示页：
 * - 只承载课堂上需要点到的主题词，不展开成长段文献摘要；
 * - 用双卡片布局把“老师要求临时补的块”清楚塞进总稿；
 * - 保持与当前总稿同一套蓝色标题带和浅底卡片风格。
 */
function addDiscussionSlide(pptx, slideDef) {
  const slide = pptx.addSlide();
  addBaseChrome(slide, slideDef.headerText);

  slide.addText(slideDef.title, {
    x: 0.78,
    y: 1.18,
    w: 4.9,
    h: 0.42,
    fontFace: "Microsoft YaHei",
    fontSize: 24,
    bold: true,
    color: "1E3C72",
    margin: 0,
  });

  slide.addText(slideDef.subtitle, {
    x: 0.8,
    y: 1.66,
    w: 8.8,
    h: 0.28,
    fontFace: "Microsoft YaHei",
    fontSize: 13,
    color: "64748B",
    margin: 0,
  });

  const cardPositions = [
    { x: 0.82, y: 2.15, w: 5.85, h: 3.95 },
    { x: 6.68, y: 2.15, w: 5.85, h: 3.95 },
  ];

  slideDef.sections.forEach((section, index) => {
    const card = cardPositions[index];
    const textLines = section.items.map((item) => ({ text: item, options: { bullet: true } }));

    slide.addShape("roundRect", {
      x: card.x,
      y: card.y,
      w: card.w,
      h: card.h,
      rectRadius: 0.05,
      line: { color: section.borderColor, width: 1.1 },
      fill: { color: section.bgColor },
    });

    slide.addText(section.label, {
      x: card.x + 0.24,
      y: card.y + 0.24,
      w: card.w - 0.48,
      h: 0.3,
      fontFace: "Microsoft YaHei",
      fontSize: 17,
      bold: true,
      color: section.accentColor,
      margin: 0,
    });

    slide.addShape("line", {
      x: card.x + 0.24,
      y: card.y + 0.62,
      w: card.w - 0.48,
      h: 0,
      line: { color: section.borderColor, width: 1 },
    });

    slide.addText(textLines, {
      x: card.x + 0.28,
      y: card.y + 0.84,
      w: card.w - 0.56,
      h: card.h - 1.08,
      fontFace: "Microsoft YaHei",
      fontSize: 18,
      color: "334155",
      breakLine: false,
      margin: 0,
      paraSpaceAfterPt: 10,
      bullet: { indent: 14 },
    });
  });

  addFooter(slide, slideDef.footerText);
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

  if (slideDef.type === "discussion") {
    return addDiscussionSlide(pptx, slideDef);
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
  const supportDeckPath = resolveWritableOutputPath(OUTPUT_DIR, SUPPORT_DECK_NAME);

  Object.entries(SELF_SLIDE_IMAGES).forEach(([id, imagePath]) => {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`缺少自制截图资源：${id} -> ${imagePath}`);
    }
  });

  const pptx = createPresentation();
  const manifest = {
    supportDeckPath,
    slides: {},
  };

  SUPPORT_SLIDES.forEach((slideDef, index) => {
    buildSlideByType(pptx, slideDef);
    manifest.slides[slideDef.id] = index + 1;
  });

  await pptx.writeFile({ fileName: supportDeckPath });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`支持页 PPT 已生成：${supportDeckPath}`);
  console.log(`支持页清单已生成：${MANIFEST_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
