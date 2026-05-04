import os
import re

ignore_patterns = [
            '^_', # 忽略以下划线开头的文件或目录
            '^.git', # 忽略.git目录
            '^.obsidian', # 忽略.obsidian
            '^.vscode', # 忽略.vscode
            '^README.md', # 忽略README.md
            '^imgs', # 忽略imgs
            '^gen_toc.py', # 忽略自身
            'infomation.md' # 忽略特定文件
            ]  
def should_ignore(name):
    return any(re.search(pattern, name) for pattern in ignore_patterns)

def generate_markdown_list(dir_path, level=0):
    markdown_list = []
    for name in os.listdir(dir_path):
        path = os.path.join(dir_path, name)
        if should_ignore(name):  # 使用正则表达式匹配需要忽略的文件或目录
            continue
        if os.path.isdir(path):
            markdown_list.append('{}* {}'.format('    ' * level, name))  # 列出目录名
            markdown_list.extend(generate_markdown_list(path, level + 1))  # 递归处理子目录
        elif os.path.isfile(path) and path.endswith('.md'):
            markdown_list.append("{}* [{}]({})".format('    ' * level, name.replace('.md', ''), path))  # 列出文件
    return markdown_list

markdown_list = generate_markdown_list('.')
output_file = '_sidebar.md'  # 指定输出文件名
with open(output_file, 'w') as f:
    for item in markdown_list:
        f.write(item + '\n')