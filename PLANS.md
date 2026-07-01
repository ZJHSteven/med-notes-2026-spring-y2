# ExecPlan

## 当前未完成计划
- 完成 `消化系统/PBL作业/Case3-第三幕` PBL 作业最终版整理与 PDF 导出。
  - 先按既有 Case2 / Case3 格式，把第三幕 Markdown 统一为 `# 标题`、`## ①列出所有问题`、`## ②整幕关键词`、`## 问题N`、`### ③学习内容 / ④出处 / ⑤实际应用`。
  - 清理脚注式链接定义、正文残留 `utm_source/chatgpt`、AI 草稿口吻和不适合正式提交的宽泛出处。
  - 教材/专著出处只保留《内科学》第10版；删除《药理学》《外科学》《消化内镜学》《Harrison》等其他教材/专著条目。
  - 用根目录《内科学 （第10版）.pdf》逐条核对第三幕涉及的病毒性肝炎、肝硬化、消化道出血、输血、肝癌等页码和章节位置。
  - 迁入或复用已验证的 `build_html.py`、`style.css`，生成 `Case3-第三幕-美化版.html` 与 `Case3-第三幕-美化版.pdf`。
  - 验收至少包括：Python 语法检查、Markdown 结构计数、旧教材/占位/污染链接残留检查、HTML 生成、PDF 生成、`qpdf --check`、PDF 页数/文本抽取/必要页面渲染检查。

- 按“课程/材料类型”逐波次整理并提交 `大二下笔记` 当前工作区，并在收口后把仓库历史里的 `ppt/pptx` 也一并踢出后强推远端。
  - 先核对当前脏工作区，按 `git status --short` 把内容拆成“循环系统 Anki/笔记修订”“医学人文英语/毛思想新增课堂资料”“消化系统新增课堂资料与脚本删除”“遗传学整课新增资料”几波。
  - 先把忽略边界落盘：新增 `*.ppt`、`*.pptx`、`~$*.pptx`、`output/tmp-case3-preview/` 等规则，避免新的 PPT、PowerPoint 锁文件和临时预览图继续混进工作区。
  - 先按课程/材料类型完成本轮普通提交，让当前非 PPT 内容有清晰提交边界。
  - 普通提交完成后，使用历史重写工具把整个分支历史中的 `*.ppt`、`*.pptx` 从 Git 对象里移除，并同步清掉当前索引中的 PPT 跟踪。
  - 历史改写后重新校验 `git log`、`git ls-files "*.ppt" "*.pptx"`、`git rev-list --objects --all` 与工作区状态，确认 PPT 已从历史和当前树里同时移除。
  - 最后对 `origin/main` 执行强推，接受“远端提交哈希整体变化”的后果。
  - 每一波提交前同步更新 `PROGRESS.md`，提交后再次检查 `git status --short`，确认该波目标文件已收口且没有误带入 PPT。
  - 预计波次：
    1. 仓库规则与记录：`PLANS.md`、`PROGRESS.md`、`.gitignore`
    2. `循环系统`：Anki 规范化结果 + `10-心功能不全.md` 公式修正
    3. `医学人文英语` + `毛思想`：新增课堂转写与课程笔记
    4. `消化系统`：新增 `Audio/Notes`，并提交 `merge_case3_second_act_ppt.ps1` 删除
    5. `遗传学`：整课新增 `Audio/Notes`

- 在 `192.168.50.179` 的 Phicomm N1（`iStoreOS 24.10.6`）上评估并尽量完成 `QQ Chat Exporter` 常驻部署，优先采用 `Docker + NapCat + QCE` 路线，而不是直接在宿主机裸跑。
  - 已完成当前机器真实约束复核：`4 核 A53 / 2GB RAM / overlay 可用约 4.8G / Docker 已安装 / 宿主机为 musl / 当前无外挂数据盘`。
  - 已完成官方资料交叉核对：QCE 插件包自带 `webui`，默认把数据落在用户主目录下的 `.qq-chat-exporter`；`ARM64` 需要补 `@esbuild/linux-arm64@0.25.10`。
  - 已完成部署路径设计与落盘：编排文件在 `/opt/qqce/compose/docker-compose.yml`，QQ 数据在 `/opt/qqce/data/qq`，NapCat 配置在 `/opt/qqce/data/napcat-config`，QCE 插件在 `/opt/qqce/data/plugins/qq-chat-exporter`，QCE 数据根目录在 `/opt/qqce/data/qce-home`。
  - 已完成“本机代拉 -> 远端导入”链路：本机通过 `GHCR` 拉下 `ghcr.io/napneko/nodenapcat:latest` 的 `linux/arm64` 镜像，再用 `skopeo` 导出 tar 并通过 `scp` 传到远端 `docker load`；QCE 插件 zip 与 ARM64 esbuild 包也已一并传上并解包完成。
  - 已完成远端容器启动：`napcat-qce` 当前已启动，`6099` WebUI 正常对外，QQ 登录方式为二维码登录；当前最后的人工步骤是用户扫码授权登录。
  - 已完成问题定位收缩：当前已排除 `OpenClash / fake-ip` 和 `QCE` 插件本身作为直接主因；在 `OpenClash` 完全停用且 `QCE` 插件临时关闭的情况下，`NapCat v4.18.7` 仍会在“登录成功”后出现 `Worker进程意外退出`。
  - 已完成回退验证准备：已将远端镜像从 `ghcr.io/napneko/nodenapcat:latest` 切换到 `ghcr.io/napneko/nodenapcat:v4.17.10`，同时修正 QQ 持久化挂载点为 `/root/.config/QQ`（此前误挂到了 `/app/.config/QQ`）；当前待用户在 `v4.17.10` 上重新扫码一次，以验证“登录成功后 worker 是否仍然崩溃”。
  - 已完成运行时环境补强：当前容器已额外补上 `XDG_RUNTIME_DIR=/tmp/runtime-root`、宿主 `DBus` socket 挂载、`shm_size=512m`、`LIBGL_ALWAYS_SOFTWARE=1` 与 `QT_X11_NO_MITSHM=1`，用于修正 QQNT/NapCat 在 Docker ARM64 运行态下常见的 `XDG_RUNTIME_DIR / DBus / EGL / shared memory` 缺口；下一步待用户在这个补强环境上重新扫码验证是否仍会在登录后崩溃。
  - 已完成 `Worker` 退出链路再定位：当前已确认 `NapCat` 主进程源码在 `child.on("exit")` 中只打印 `exit code`，并未打印 `signal`；而我们现场日志只有 `Worker进程意外退出` 的 `warn`，没有对应的 `退出码` `error`，这更像子进程被信号打死后 `code=null` 被主进程吞成了 `0`。同时公开 issue 已存在与当前症状高度相似的 Linux 原生崩溃样例，崩溃点落在 `MoeHoo.linux.*.node` 的 packet hook。
  - 已完成单进程绕过实验：当前远端 compose 已加入 `NAPCAT_DISABLE_MULTI_PROCESS=1` 并重建容器。切换后宿主机上只剩一个 `node /app/load.cjs` 主进程，不再有独立 `node /app/napcat/napcat.mjs` worker；连续观察一轮后，`Worker进程意外退出` 已不再复现，但 `Login Error, ErrType: 1 ErrCode: 3` 仍会约每 2 分钟出现一次并刷新二维码。说明“worker 崩溃”这条线目前已被单进程绕开，而“二维码登录失败”仍需继续单独排查。
  - 已完成当前主因再收束：本轮重新抓取 `2026-06-23 22:18:20` 重启后的完整日志，确认从 `22:18:24` 到 `22:22:29` 的连续几个二维码周期里，容器都保持存活，只表现为“打印二维码 -> 约 2 分钟后 `Login Error, ErrType: 1 ErrCode: 3` -> 换新二维码”；期间 `docker inspect` 的 `RestartCount` 一直停在 `1`。这说明“当前用户看到的 `network error`”对应的是 QQ 登录授权链路被拒，而不是服务每次扫码后都在继续崩。
- 设计“课程笔记分享站”方案，只分发各课程公开课堂笔记，不暴露仓库中的其他私有资料。
  - 先核对当前仓库目录是否稳定满足 `课程/Notes/*.md` 与 `课程/Audio/*` 结构，并确认哪些 `Notes` 文件能安全纳入公开站点。
  - 明确公开筛选规则：默认仅纳入 `Notes` 目录下文件名满足“数字开头 + 连字符”的 Markdown 课堂笔记；默认排除 `PBL*`、`考试提纲`、`教学大纲-课堂笔记覆盖核对`、`前六组作业` 等非普通课堂笔记文件。
  - 调研 Cloudflare Pages 自定义域名、Direct Upload、Cloudflare Access（邮箱/OTP）等官方能力，确认最省事的部署链路与访问控制边界。
  - 调研前端反复制方案的真实边界：Canvas 渲染、禁止选中、禁右键、打印样式、长截图/系统截图能力；明确哪些只能“提高门槛”，哪些根本不能防。
  - 产出静态站工作流设计：本地选取源 Markdown -> 生成结构化索引 -> React 静态构建 -> 输出静态文件 -> Cloudflare Pages 部署。
  - 如果方案敲定，再进入实现阶段：新建独立站点目录、编写笔记发现脚本、Markdown 渲染层、课程导航页、部署脚本与验证流程。
- 修正 `循环系统/Anki/cards.csv` 中 384 张英文词根词缀卡的格式偏差，使其回到当前 Skill 已固定的输出骨架。
  - 先统计现有不合规模式，确认不是字段数问题，而是 `BackHtml` 内部结构仍保留旧版生成风格。
  - 编写可重复执行的规范化脚本，批量清理双引号嵌套、旧回退说明、无信息量的统一尾句，并统一内部行的展示格式。
  - 同步更新 `循环系统/Anki/cards.csv` 与 `循环系统/Anki/exports/AnkiTemp.csv`，确保主卡库与导出位一致。
  - 抽样核对病理学、病理生理学、药理学三类词条，确认题头、字段数、tag 与关键 HTML 结构稳定。
  - 更新 `PROGRESS.md` 并提交课程仓库本轮修正。

## 最近完成
- 已完成 `消化系统/PBL作业/Case3-第二幕` 的主持人最终整合版 PPT：以 `张家赫.pptx` 为主持人底稿，按 `新建 文本文档.txt` 中的临床问题顺序与文献机制顺序，插入 9 位同学的题目页/文献页，生成 `Case3-第二幕-PBL汇报整合版.pptx`。
- 已完成 `Case3-第二幕` 的题号与页序收束：当前整合顺序为 `总起 -> Q6 -> Q1 -> Q2 -> Q4 -> Q3 -> Q5 -> Q7 -> Q8 -> Q9 -> Q10 -> 过渡 -> 空间转录组总框架 -> 失代偿病理生理 -> MIF/CD74 -> DLL4/Notch -> 白细胞跨内皮迁移 -> 利福昔明/LSEC -> YAP/EMT -> 黄芪汤/自噬 -> MOTS-c/Nrf2 -> HSC综述补充 -> 主持人总结`；并明确排除了误放的 `王鹤/case2第一幕.pptx`。
- 已完成 `Case3-第二幕` 整合验收链路：`merge_case3_second_act_ppt.ps1` 成功插入全部计划页段并产出 47 页终稿；PowerPoint 成功导出 47 张逐页 PNG 预览；`python-pptx` 成功读取终稿并核对页序；最终稿可被 `artifact-tool` 成功导入、渲染和 round-trip 导出。
- 已完成 `消化系统/PBL作业/Case3-第二幕/Case3-第二幕.md` 的基线保存、Markdown 清洗与 HTML/PDF 构建：先将原稿单独提交为 Git 基线，再复用 `Case3-第一幕` 的 `build_html.py` 与 `style.css`，把全文统一到 `## 问题` + `### ③学习内容 / ④出处 / ⑤实际应用` 骨架，补入题目加粗、关键词强调、题间分隔线与可见网页链接标签。
- 已完成 `消化系统/PBL作业/Case3-第二幕/Case3-第二幕.md` 的教材与病例修订：各题教材出处统一收敛到《内科学》第10版并补齐真实页码，清除全部 `第9版` 与 `页码待补` 占位；同时修正问题1、问题9中乙肝血清学状态与 `HBV-DNA` 表述前后不一致的问题。
- 已完成 `消化系统/PBL作业/Case3-第二幕` 成品验证：成功生成 `Case3-第二幕-美化版.html` 与 `Case3-第二幕-美化版.pdf`，并通过 `python -m py_compile build_html.py`、`python .\build_html.py --no-pdf`、`python .\build_html.py` 与 `qpdf --check Case3-第二幕-美化版.pdf`；同时确认 Markdown 中 `第9版`、`页码待补`、`utm_source`、`chatgpt` 和错误的 `<re.Match object ...>` 链接残留均已清零。
- 已完成 `NapCat` 运行时补丁：对照官方 issue 中常见的 `XDG_RUNTIME_DIR is invalid`、`Failed to connect to the bus`、`Exiting GPU process due to errors during initialization` 症状后，已在远端 compose 中加入 `XDG_RUNTIME_DIR=/tmp/runtime-root`、`DBUS_SYSTEM_BUS_ADDRESS=unix:path=/run/dbus/system_bus_socket`、`/run/dbus/system_bus_socket` 挂载、`shm_size: 512m`、`LIBGL_ALWAYS_SOFTWARE=1` 与 `QT_X11_NO_MITSHM=1`。当前容器内已确认这些环境变量、DBus socket 与 512MiB 的 `/dev/shm` 全部生效。
- 已完成 `Worker` 退出再定位：这轮重新抓了远端 `v4.17.10` 日志、容器内运行态、`NapCat` 主进程源码与宿主机进程信息。当前确认实际是 `node /app/load.cjs` 主进程再 fork 一个 `node /app/napcat/napcat.mjs` worker；源码里 `child.on("exit")` 只在 `code != 0` 时打印 `退出码`，但我们现场崩溃日志只有 `Worker进程意外退出` 的 `warn` 而没有对应 `error`，因此更像 worker 被 signal 杀死而不是正常 `exit(1/11)`。同时本轮 `strace` 抓到的最新样本里，worker 在最新阶段并未崩，而是稳定停留在“每约 2 分钟一次 `Login Error, ErrCode: 3` -> 刷新二维码”的路径上，说明“worker 崩溃”和“当前登录失败”至少在最新现场里并不总是同时出现。
- 已完成当前 `network error` 与运行时退出拆线：本轮再次抓取重启后的完整日志，确认 `22:18:19` 那次容器退出确实发生过一次，但重启完成后直到 `22:22:29` 都只有 `ErrCode: 3` 循环，没有新的 `RestartCount` 增长，也没有新的 `Worker进程意外退出`。这意味着当前最稳定复现的问题已收缩为“二维码授权失败 / QQ 侧拒绝登录”，而不是“每次扫码必崩”。
- 已完成 `NapCat` 回退与持久化修正：对照官方 release 与历史 issue 后，选择 `ghcr.io/napneko/nodenapcat:v4.17.10` 作为回退验证版本；该 tag 的 `linux/arm64` 镜像已在本机通过 `skopeo` 导出并重新传到远端 N1，`docker-compose.yml` 现已固定使用 `v4.17.10`。同时确认 `NapCat` 实际把 QQ 数据写到 `/root/.config/QQ` 而非 `/app/.config/QQ`，因此已把宿主挂载修正为 `/opt/qqce/data/qq:/root/.config/QQ`，避免后续快速登录和会话持久化继续失真。
- 已完成 `QCE` 插件干扰排除：远端 `plugins.json` 当前已临时改为 `\"qq-chat-exporter\": false`，用于只验证 `NapCat` 本体稳定性；在 `4.18.7` + 禁用 `QCE` 的情况下，仍可复现“快速登录成功后 worker 意外退出”，因此本轮已基本排除 `QCE` 作为直接崩溃源。
- 已完成 N1 上 `NapCat + QCE` 的本机代拉与远端部署：由于远端无法稳定访问 `Docker Hub / GHCR` 容器仓库，改为在本机启动 Docker Desktop，通过 `GHCR` 拉取 `ghcr.io/napneko/nodenapcat:latest` 的 `linux/arm64` 镜像，再用 `quay.io/skopeo/stable` 导出为 `docker-archive` tar，通过 `scp` 传到远端 `docker load`；同时把 `napcat-plugin-qce.zip` 与 `esbuild-linux-arm64-0.25.10.tgz` 一并传到远端，解压到 `/opt/qqce/data/plugins/qq-chat-exporter` 并补入 `node_modules/@esbuild/linux-arm64`。
- 已完成 N1 上 `NapCat + QCE` 的目录和编排初始化：远端已生成 `/opt/qqce/compose/docker-compose.yml`，并把数据目录明确拆分为 `/opt/qqce/data/qq`、`/opt/qqce/data/napcat-config`、`/opt/qqce/data/plugins`、`/opt/qqce/data/qce-home`；其中 `plugins.json` 已启用 `qq-chat-exporter` 插件，`docker compose up -d` 后 `napcat-qce` 容器正常运行，对外暴露 `3000`、`3001`、`6099`、`40653` 端口。
- 已完成 N1 上登录入口验收：`http://192.168.50.179:6099/` 会重定向到 `/webui`，当前日志明确给出了 WebUI token 和二维码登录提示；已确认当前必须由用户手动扫码 QQ 才能进入下一步的功能验收。
- 已完成 N1/iStoreOS 预检：直接登录 `192.168.50.179` 复核到真实机器为 `Phicomm N1`、`iStoreOS 24.10.6`、`aarch64`、`4 核`、`2GB RAM`；当前 `/overlay` 总量约 `6.3G`、可用约 `4.8G`，`Docker 27.3.1`、`containerd`、`docker-compose` 均已安装但尚无现有容器；宿主机 libc 为 `musl 1.2.5`，因此后续默认不走宿主机裸装 QCE，而转向 `Docker + NapCat + QCE`。
- 已完成 `消化系统/PBL作业/Case3-第一幕/Case3-第一幕.md` 的提交前最后精修：按评审清单删除“课堂笔记 / 老师提示 / 课堂讨论”残留表述，逐题校正文中 `[n]` 与本题 `④出处` 的编号错位，重点修复问题1-4与问题7-9；并补全 APASL 2025、EASL 2025、AASLD/IDSA 慢乙肝实践指导等文献格式，重新生成 HTML/PDF 且通过 `qpdf --check`。
- 已完成 `消化系统/PBL作业/Case3-第一幕/Case3-第一幕.md` 的系统清洗与转换验证：先将原稿单独提交为 Git 基线，再按 `Case2` 骨架把题目层级统一为 `## 问题` + `### ③/④/⑤`，清掉题间 AI 连接语、脚注定义、`utm_source/chatgpt`、目录中悬空的第 10 题及旧版教材写法；各题教材出处统一收敛为《内科学》第10版并补到具体页码，随后迁入 `build_html.py` 与 `style.css` 生成 `Case3-第一幕-美化版.html`、`Case3-第一幕-美化版.pdf`，并通过 `py_compile`、HTML/PDF 导出和 `qpdf --check`。
- 已完成 `消化系统/PBL作业/Case3-第一幕/Case3-第一幕.md` 问题1、问题2轻量加固：先将原稿单独作为 Git 基线提交，再补入“首次静脉曲张出血提示失代偿”“风险量化仍需结合红色征/Child-Pugh/感染等信息”“拒绝治疗代表一级预防链条中断”“GBS 不能单独替代静脉曲张出血风险评估”“大量呕血需警惕误吸和气道风险”等接口句，同时保留两题原有边界，不提前展开后续问题5、6、8、9、10 的详细内容。
- 已完成 `循环系统/Notes` 教学大纲层级标签与覆盖核对：依据 `C:/Users/ZJHSteven/Downloads/循环学习通/01-教学大纲与课程指南/教学大纲-循环系统-2023修订.pdf`，为 `1-开课介绍.md` 到 `16-研究进展.md` 全部改为在对应标题旁直接标注 `【教学大纲：掌握 / 熟悉 / 了解】`；并新增 `循环系统/Notes/教学大纲-课堂笔记覆盖核对.md` 汇总覆盖结论、薄弱点和未单独展开点。
- 已完成 `循环系统/PBL作业/Case2-第三幕/AMI-mindmap.html` 按老师课堂总结正式化修订：删除“整幕归纳版”“放大主线”“归纳总结，不按幕次硬拆”等草稿式括号标题；中心词改为“急性心肌梗死”，把“急性前壁 STEMI / LAD / PCI”作为本病例具体诊断和治疗证据；一级主题改为并列的“病因与危险因素、发病机制、诊断、鉴别诊断、治疗与管理、预后与并发症”；PCI 已归入治疗分支；节点整体收短，更接近最终提交版导图。
- 已完成 `循环系统/PBL作业/Case2-第三幕/AMI-mindmap.html` 老师批注修订：放大“明确诊断”，把急性前壁 STEMI、LAD 责任血管、PCI 再灌注放入中心主题和第 1 主干；发病机制改为“危险因素 → 冠脉粥样硬化 → 劳力性缺血 → 斑块破裂/血栓 → LAD 严重狭窄/近闭塞 → 前壁 STEMI → 心肌坏死”的归纳链路，不再按第一幕、第二幕硬拆；诊断与术后监测合并整理为入院快速判断、确诊定位、PCI 后再灌注评价、术后监测重点和出院前评估；已通过静态关键词、敏感残留、7 个主干标题和本地 HTTP 返回检查。
- 已完成仓库清理与分组提交：按“课程 / 材料类型 / 是否为最终交付资产”重新梳理当前工作区，删除 `循环系统/PBL作业/Case2-第一幕` 中未跟踪的同学原始 PPT 素材，清理误放到 `循环系统` 与 `毛思想` 目录下的病毒课程重复文件，并将本轮新增资料拆成 `病毒课程 / 医学人文英语 / 局部解剖学 / 毛思想 / 综合素养课程4 / 循环系统` 多笔提交。
- 已完成 `循环系统/PBL作业/Case2` 本轮收口：第二幕补入 `journal.pone.0311157.pdf` 并提交最新 Markdown、HTML/PDF 与文献汇报 PPT；第三幕删除“全 Case 收束”总结段后重新导出 HTML/PDF，且两份 PDF 已再次通过 `qpdf --check`。
- 已完成 `循环系统/PBL作业/Case2-第三幕` Markdown 清洗与 HTML/PDF 构建：先提交原始 `Case2-第三幕.md` 作为 Git 基线，再清理 AI 续写提示、草稿说明、正文直链、`utm_source` 和底部链接定义；保留“我认为/我倾向于”等自然病例推理语气；将每题出处重排为数字列表，补齐正文引用编号闭环；使用《内科学》第10版 PDF 已知页段补全教材页码，未找到《药理学》PDF，因此未保留无页码的药理学教材出处；迁移第二幕 `build_html.py` 与 `style.css`，生成 `Case2-第三幕-美化版.html` 和 `Case2-第三幕-美化版.pdf`，PDF 共 33 页，并通过 `qpdf --check`、引用锚点、正文外链残留和关键词残留检查。
- 已完成 `循环系统/PBL作业/Case2-第二幕` 二次修订与教材核对：先单独提交用户手改后的第二幕原稿；将根目录 `内科学 （第10版）.pdf` 写入 `.gitignore`；给 `build_html.py` 增加 Markdown 管道表格渲染并在 `style.css` 中补充表格样式；使用根目录《内科学》第10版 PDF 逐条核对第二幕教材页码，把宽泛页段收窄到真实支持内容并移除全部 `【待核对教材页码】`；重新生成 HTML/PDF，并通过表格落地、`utm_source/chatgpt` 残留清零和 `qpdf --check` 验证。
- 已完成 `循环系统/PBL作业/Case2-第二幕` Markdown 清洗与 HTML/PDF 构建：先提交原始 `Case2-第二幕.md` 作为 Git 备份，再迁移第一幕 `build_html.py` 与 `style.css`，补强正文引用上标跳转、出处锚点和 `####` 小标题渲染；清洗正文直链、`utm_source`、AI 草稿口吻和方框式出处；统一每题数字出处列表，生成 `Case2-第二幕-美化版.html` 与 `Case2-第二幕-美化版.pdf`；已通过 `py_compile`、HTML 引用锚点闭环、正文外链残留、关键词残留和 `qpdf --check` 验证，PDF 共 41 页。
- 已完成 `循环系统/PBL作业/Case2-第一幕` 汇报整合 PPT 新增机制文献页：恢复上一版 `Case2-第一幕-PBL汇报整合版-16比9旧版样式.pptx` 为底稿，将新补交的 `AMI沉默斑块破裂与愈合机制.pptx`、`LcnRNA在AMI发病机制、诊断、治疗中的意义_20260514_214555_0000.pptx`、`新建 PPTX Presentation.pptx` 原样插入第四部分“冠脉事件病理机制”；最终共 30 页，已通过 16:9 比例、PowerPoint 导出 30 页 PNG、PPTX ZIP 包结构、非空媒体、草稿词检查和对象越界检查。
- 已完成 `循环系统/PBL作业/Case2-第一幕` 宽屏旧版样式稿：从 Git 提取上一版参考稿，保留当前 16:9、同学原稿插入和新同学内容顺序，恢复上一版棕色封面、编号目录、深棕章节页和表格式总结页，生成 `Case2-第一幕-PBL汇报整合版-16比9旧版样式.pptx`；已通过 25 页数量、960×540 比例、PPTX ZIP 包结构、非空媒体、草稿词检查、对象越界检查和 PowerPoint 导出 25 页 PNG 预览。
- 已完成 `循环系统/PBL作业/Case2-第一幕` 汇报整合 PPT 修订：将最终稿重建为 16:9 宽屏比例，用 PowerPoint 原生插入方式合并可打开的同学 PPT，新增 `case2第一幕.pptx` 到“病因诱因与早期症状线索”开头，去掉上一版正式补位页，并修正林诚亚兜底页对象越界；已通过 25 页数量、960×540 比例、PPTX ZIP 包结构、非空媒体、草稿词检查、对象越界检查和 PowerPoint 导出 25 页 PNG 预览。
- 已完成 `循环系统/PBL作业/Case2-第一幕` 汇总版课堂 PPT：按主持人整合版结构生成 `Case2-第一幕-PBL汇报整合版.pptx`，包含封面、汇报路线、章节过渡、正式补位页、同学原稿页、重建页和总结致谢页；已通过 PowerPoint 打开导出、25页数量、PPTX ZIP 包结构、非空媒体和草稿词检查。
- 已完成循环系统 Case2 第一幕问题2两页 PPT：范围收窄为“既往高血压、糖尿病如何增加/促发本次急性心肌梗死风险”，排除外卖/奶茶、ST段定位、查体、治疗等后续同学讲点；改为论文图主视觉，并通过 PPTX 包结构、2页数量、非空媒体和布局检查。
- 已完成 Case2 第一幕本轮小修：解释出处分类逻辑；在问题2-13补充《内科学》第10版具体章节和页码出处；重新生成美化版 HTML/PDF，并完成引用编号、残留关键词、问题块和 PDF 完整性检查。
- 已完成 `循环系统/PBL作业/Case2-第一幕` 第一幕 PBL 作业整理：统一幕次文件名，删除草稿/AI/课堂转写痕迹，按 Case1 新版脚本格式重排，重建引用与 DOI/链接，补强问题6、7、10、12、13，并导出美化版 HTML/PDF。
- 已完成 `心理危机干预与预防` 7 份课堂笔记合订本 PDF 导出。
- 已完成 `心理危机干预与预防/Notes/考试提纲.md` 单独 PDF 导出。
- 当前状态与复现方法已记录到 `PROGRESS.md`。
