import re

md_path = r'c:\Users\ZJHSteven\Desktop\大二下笔记\血液与肿瘤\PBL作业\Case1-第一幕\Case1-第一幕.md'
html_path = r'c:\Users\ZJHSteven\Desktop\大二下笔记\血液与肿瘤\PBL作业\Case1-第一幕\Case1-第一幕-美化版.html'

with open(md_path, 'r', encoding='utf-8') as f:
    md = f.read()

# 1. 提取文档末尾的引用链接定义为全局后备（不删除原文中的定义，
#    因为文档中各章节可能有自己的本地定义，解析时优先使用本地定义）
global_refs = {}
for match in re.finditer(r'^\[([^\]]+)\]:\s*(\S+)(?:\s+"([^"]+)")?\s*$', md, re.MULTILINE):
    key = match.group(1)
    # 只在尚未存在时设置全局后备，避免被后面的重复定义覆盖
    if key not in global_refs:
        global_refs[key] = match.group(2)

# 1. 提取文档末尾的引用链接定义： [id]: url "title"
refs = {}
# 匹配 [1]: https://... "标题" 或 [1]: https://...
for match in re.finditer(r'^\[([^\]]+)\]:\s*(\S+)(?:\s+"([^"]+)")?\s*$', md, re.MULTILINE):
    refs[match.group(1)] = match.group(2)

# 2. 将引用链接定义的行从文档中移除，防止在末尾显示为文本
md = re.sub(r'^\[([^\]]+)\]:\s*(\S+)(?:\s+"([^"]+)")?\s*$\n?', '', md, flags=re.MULTILINE)

# Base HTML template
html = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>Case 1 第一幕作业</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
<div class="container">
'''

# Parse Title
html += '<h1 class="main-title">Case 1 第一幕作业</h1>\n'

# Parse Student Info
name_match = re.search(r'姓名：(.*?)\n', md)
cls_match = re.search(r'班级：(.*?)\n', md)
stu_id_match = re.search(r'学号：(.*?)\n', md)

name = name_match.group(1).strip() if name_match else '张家赫'
cls = cls_match.group(1).strip() if cls_match else '儿科班'
stu_id = stu_id_match.group(1).strip() if stu_id_match else '2024193112'

html += f'''<div class="student-info">
    <p><strong>姓名：</strong>{name}</p>
    <p><strong>班级：</strong>{cls}</p>
    <p><strong>学号：</strong>{stu_id}</p>
</div>\n'''

# Parse Global Questions
html += '<h2 class="section-title">①列出所有问题（最终整合版）</h2>\n'
html += '<ol class="question-list">\n'
questions = re.findall(r'^\d+\.\s(.*?)$', md, re.MULTILINE)
for q in questions[:10]: # Extract the first 10 questions which belong to this section
    q_clean = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', q)
    html += f'    <li>{q_clean}</li>\n'
html += '</ol>\n'

# Parse Keywords
html += '<h2 class="section-title">②整幕关键词</h2>\n'
keywords_match = re.search(r'整幕关键词\n\n\*\*(.*?)\*\*', md)
if keywords_match:
    keywords = keywords_match.group(1).split('、')
    html += '<div class="keyword-bubbles">\n'
    for kw in keywords:
        html += f'    <span class="keyword">{kw.strip()}</span>\n'
    html += '</div>\n\n'

# Split into Q&A sections
# Find all '## 问题X：...' sections + '三、总结'
sections = re.split(r'\n## (?=问题\d+：|三、总结)', md)

def basic_md_to_html(text, refs):
    # bold
    text = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', text)
    
    # 内联链接 [text](url)
    # 使用自定义解析来支持 URL 中包含括号的情况（例如 S1538-7836(25)00220-X）
    def replace_inline_links(s):
        res = []
        last = 0
        # 找到所有形如 [text]( 的起始位置
        for m in re.finditer(r'\[([^\]]+)\]\(', s):
            start = m.start()
            res.append(s[last:start])
            link_text = m.group(1)
            url_start = m.end()
            pos = url_start
            depth = 1
            # 向后扫描，按括号深度匹配右括号，支持嵌套括号
            while pos < len(s):
                ch = s[pos]
                if ch == '(':
                    depth += 1
                elif ch == ')':
                    depth -= 1
                    if depth == 0:
                        break
                pos += 1
            # 若未找到匹配右括号，则不替换（保留原文本的一部分）
            if depth != 0:
                res.append(s[start:m.end()])
                last = m.end()
                continue
            url_content = s[url_start:pos].strip()
            # 支持可选标题：url "title"
            mtitle = re.match(r'^(.*?)(?:\s+"([^"]+)")?$', url_content)
            href = mtitle.group(1) if mtitle else url_content
            href = href.replace('"', '&quot;')
            res.append(f'<a href="{href}" target="_blank">{link_text}</a>')
            last = pos + 1
        res.append(s[last:])
        return ''.join(res)

    text = replace_inline_links(text)
    
    # 引用链接 [text][id]
    def repl_ref(m):
        text_part = m.group(1)
        id_part = m.group(2) if m.group(2) else text_part
        if id_part in refs:
            return f'<a href="{refs[id_part]}" target="_blank">{text_part}</a>'
        return m.group(0)
        
    text = re.sub(r'\[([^\]]+)\]\[([^\]]*)\]', repl_ref, text)
    
    # 单独的隐式引用链接 [id] (防止匹配到前面的href等内容里的中括号)
    def repl_single_ref(m):
        id_part = m.group(1)
        if id_part in refs:
            return f'<a href="{refs[id_part]}" target="_blank">{id_part}</a>'
        return m.group(0)
    text = re.sub(r'(?<!")(?<!\])\[([^\]]+)\](?!\])(?!\()', repl_single_ref, text)
    
    # list items
    lines = text.split('\n')
    res_lines = []
    in_ul = False
    
    for line in lines:
        line = line.strip()
        # 如果行仅由三个或以上的短横线/星号/下划线组成（Markdown 的分隔线），直接忽略
        if re.match(r'^(?:-{3,}|_{3,}|\*{3,})$', line):
            continue
        if not line:
            if in_ul:
                res_lines.append('</ul>')
                in_ul = False
            continue
            
        if line.startswith('* '):
            if not in_ul:
                res_lines.append('<ul>')
                in_ul = True
            res_lines.append(f'<li>{line[2:]}</li>')
        else:
            if in_ul:
                res_lines.append('</ul>')
                in_ul = False
            res_lines.append(f'<p>{line}</p>')
            
    if in_ul:
        res_lines.append('</ul>')
        
    return '\n'.join(res_lines)
    
for section in sections[1:]:
    if '三、总结第一幕分析结论' in section:
        html += '<hr>\n'
        html += '<h2 class="section-title">三、总结第一幕分析结论</h2>\n'
        summary_content = section.split('三、总结第一幕分析结论')[1].strip()
        # 本节优先解析本节内的引用定义
        local_refs = {}
        for m in re.finditer(r'^\[([^\]]+)\]:\s*(\S+)(?:\s+"([^"]+)")?\s*$', section, re.MULTILINE):
            local_refs[m.group(1)] = m.group(2)
        # 从本节内容移除引用定义行，避免在页面中残留
        summary_content = re.sub(r'^\[([^\]]+)\]:\s*(\S+)(?:\s+"([^"]+)")?\s*$\n?', '', summary_content, flags=re.MULTILINE)
        refs_to_use = local_refs if local_refs else global_refs
        summary_content = basic_md_to_html(summary_content, refs_to_use)
        # remove dangling lines
        summary_content = summary_content.replace('<p>---</p>', '')
        html += f'<div class="summary-text">\n{summary_content}\n</div>\n'
        break
        
    # skip intermediate chat texts
    if '先说我觉得最重要的两个问题' in section or '然后是回答剩下其他' in section:
        pass
        
    title_match = re.match(r'(问题\d+：.*?)(?:\n|$)', section)
    if not title_match:
        continue
    title = title_match.group(1).replace('**', '')
    
    html += f'<div class="qa-section">\n<h2 class="qa-title">{title}</h2>\n'
    
    # Split into sub-sections: ① 学习内容, ② 出处, ③ 实际应用
    sub_sections = re.split(r'\n### (①.*?|②.*?|③.*?)\n', section)
    
    for i in range(1, len(sub_sections), 2):
        sub_title = sub_sections[i]
        sub_content = sub_sections[i+1].strip() if i+1 < len(sub_sections) else ""
        html += f'<div class="sub-section">\n<h3 class="sub-title">{sub_title}</h3>\n'
        # 提取本子节内的本地引用定义（如果有），并从文本中移除这些定义行
        local_refs = {}
        for m in re.finditer(r'^\[([^\]]+)\]:\s*(\S+)(?:\s+"([^"]+)")?\s*$', sub_content, re.MULTILINE):
            local_refs[m.group(1)] = m.group(2)
        sub_content = re.sub(r'^\[([^\]]+)\]:\s*(\S+)(?:\s+"([^"]+)")?\s*$\n?', '', sub_content, flags=re.MULTILINE)
        refs_to_use = local_refs if local_refs else global_refs
        html += basic_md_to_html(sub_content, refs_to_use)
        html += '</div>\n'
        
    html += '</div>\n'

html += '''
</div>
</body>
</html>
'''

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("HTML generation successful!")