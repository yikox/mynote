/**
 * Markdown文档阅读器 - 主逻辑文件
 * 功能：文件列表加载、Markdown渲染、目录生成等
 */

// ==================== DOM元素引用 ====================
const fileListElement = document.getElementById('fileList'); // 文件列表容器
const articleContentElement = document.getElementById('articleContent'); // 文章内容容器
const tocListElement = document.getElementById('tocList'); // 目录列表容器
const emptyStateElement = document.getElementById('emptyState'); // 空状态提示元素
const toggleFilesHeaderBtn = document.getElementById('toggleFilesHeader'); // 顶部文件列表切换按钮
const toggleTocHeaderBtn = document.getElementById('toggleTocHeader'); // 顶部目录切换按钮

// ==================== 状态变量 ====================
let currentFile = null; // 当前选中的文件路径

// ==================== 初始化函数 ====================

/**
 * 初始化应用 - 应用启动时调用
 */
function initApp() {
  // 加载文件列表
  loadFileList();
  
  // 设置事件监听器
  setupEventListeners();
}

/**
 * 设置事件监听器 - 绑定各种交互事件
 */
function setupEventListeners() {
  // 文件列表侧边栏切换按钮（顶部）
  toggleFilesHeaderBtn.addEventListener('click', () => {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('collapsed');
    
    // 更新按钮文本
    const btnText = toggleFilesHeaderBtn.querySelector('.btn-text');
    btnText.textContent = sidebar.classList.contains('collapsed') ? '文档列表 ▶' : '◀ 文档列表';
  });
  
  // 目录侧边栏切换按钮（顶部）
  toggleTocHeaderBtn.addEventListener('click', () => {
    const tocContainer = document.querySelector('.toc-container');
    tocContainer.classList.toggle('collapsed');
    
    // 更新按钮文本
    const btnText = toggleTocHeaderBtn.querySelector('.btn-text');
    btnText.textContent = tocContainer.classList.contains('collapsed') ? '文章目录 ◀' : '文章目录 ▶';
  });
}

// ==================== 文件列表相关函数 ====================

/**
 * 加载文件列表 - 从files.md文件获取文档列表
 */
function loadFileList() {
  // 加载files.md文件作为文档列表
  fetch('files.md')
    .then(response => {
      if (!response.ok) throw new Error('文件列表加载失败');
      return response.text();
    })
    .then(text => {
      // 解析Markdown文件列表
      const fileItems = parseFileList(text);
      renderFileList(fileItems);
    })
    .catch(error => {
      console.error('加载文件列表失败:', error);
      fileListElement.innerHTML = `<div class="file-item">无法加载文件列表</div>`;
    });
}

/**
 * 解析文件列表 - 从Markdown文本解析出文件项
 * @param {string} markdown - 包含文件列表的Markdown文本
 * @returns {Array} 文件项数组
 */
function parseFileList(markdown) {
  const lines = markdown.split('\n');
  const fileItems = [];
  
  lines.forEach(line => {
    // 跳过空行
    if (!line.trim()) return;
    
    // 解析缩进级别（每2个空格为一级）
    const indentMatch = line.match(/^(\s*)/);
    const indentLevel = indentMatch ? Math.floor(indentMatch[0].length / 2) : 0;
    
    // 解析链接格式 [名称](路径)
    const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
    
    if (linkMatch) {
      // 有链接的行 - 文件项
      fileItems.push({
        name: linkMatch[1],
        path: linkMatch[2],
        level: indentLevel
      });
    } else {
      // 无链接的行 - 分类标题
      const textMatch = line.match(/^\s*[-*]\s+(.+)$/);
      if (textMatch) {
        fileItems.push({
          name: textMatch[1],
          path: null,
          level: indentLevel
        });
      }
    }
  });
  
  return fileItems;
}

/**
 * 渲染文件列表 - 将文件项数组渲染到DOM中
 * @param {Array} fileItems - 文件项数组
 */
function renderFileList(fileItems) {
  fileListElement.innerHTML = '';
  
  fileItems.forEach(item => {
    const fileItem = document.createElement('div');
    fileItem.className = `file-item level-${item.level}`;
    
    if (item.path) {
      // 可点击的文件项
      fileItem.textContent = item.name;
      fileItem.dataset.path = item.path;
      fileItem.addEventListener('click', () => {
        // 移除之前选中的文件
        document.querySelectorAll('.file-item').forEach(el => {
          el.classList.remove('active');
        });
        
        // 设置当前选中文件
        fileItem.classList.add('active');
        currentFile = item.path;
        
        // 加载并显示文件内容
        loadFileContent(item.path);
      });
    } else {
      // 分类标题（不可点击）
      fileItem.textContent = item.name;
      fileItem.style.fontWeight = 'bold';
      fileItem.style.cursor = 'default';
    }
    
    fileListElement.appendChild(fileItem);
  });
}

// ==================== 文件内容加载和渲染函数 ====================

/**
 * 加载文件内容 - 根据路径获取Markdown文件内容
 * @param {string} path - 文件路径
 */
function loadFileContent(path) {
  fetch(path)
    .then(response => {
      if (!response.ok) throw new Error('文件加载失败');
      return response.text();
    })
    .then(text => {
      // 渲染Markdown内容
      renderMarkdownContent(text);
      // 生成目录
      generateTOC(text);
      // 隐藏空状态
      emptyStateElement.classList.add('hidden');
    })
    .catch(error => {
      console.error('加载文件失败:', error);
      articleContentElement.innerHTML = `<div class="empty-state">
        <div>❌❌</div>
        <h3>文件加载失败</h3>
        <p>无法加载文件: ${path}</p>
      </div>`;
    });
}

/**
 * 滚动到指定标题 - 平滑滚动到页面中的指定标题位置
 * @param {string} anchor - 标题的锚点ID
 */
function scrollToHeading(anchor) {
  const heading = document.getElementById(anchor);
  if (heading) {
    heading.scrollIntoView({ behavior: 'smooth' });
  }
}

/**
 * 使用开源库增强的Markdown阅读器功能
 */

// 引入开源库的CDN链接（在HTML中添加）
// <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css">
// <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/markdown-it/13.0.1/markdown-it.min.js"></script>
// <script src="https://cdnjs.cloudflare.com/ajax/libs/anchor-js/5.0.0/anchor.min.js"></script>

// 初始化markdown-it解析器
const md = window.markdownit({
  html: true,           // 允许HTML标签
  xhtmlOut: true,       // 使用XHTML闭合标签
  breaks: true,         // 转换换行符为<br>
  langPrefix: 'language-', // 代码块语言前缀
  linkify: true,        // 自动链接URL
  typographer: true,    // 启用排版优化
  quotes: '「」『』',     // 引号样式
  highlight: function (str, lang) {
    // 代码高亮
    if (lang && hljs.getLanguage(lang)) {
      try {
        return '<pre class="hljs"><code>' +
               hljs.highlight(str, { language: lang, ignoreIllegals: true }).value +
               '</code></pre>';
      } catch (__) {}
    }
    return '<pre class="hljs"><code>' + md.utils.escapeHtml(str) + '</code></pre>';
  }
});

/**
 * 增强版Markdown内容渲染
 * @param {string} markdown - Markdown格式的文本
 */
function renderMarkdownContentEnhanced(markdown) {
  // 使用markdown-it解析Markdown
  const html = md.render(markdown);
  articleContentElement.innerHTML = html;
  
  // 初始化代码高亮
  if (window.hljs) {
    articleContentElement.querySelectorAll('pre code').forEach((block) => {
      window.hljs.highlightElement(block);
    });
  }
  
  // 使用anchor.js自动添加锚点
  if (window.anchors) {
    window.anchors.options = {
      placement: 'left',
      visible: 'hover',
      icon: '¶'
    };
    window.anchors.add('.article-content h1, .article-content h2, .article-content h3, .article-content h4, .article-content h5, .article-content h6');
  }
}

/**
 * 使用markdown-it-anchor生成增强版目录
 * @param {string} markdown - Markdown格式的文本
 */
function generateTOCEnhanced(markdown) {
  tocListElement.innerHTML = '';
  
  // 使用markdown-it解析并提取标题
  const tokens = md.parse(markdown, {});
  const headings = [];
  
  tokens.forEach(token => {
    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.slice(1)); // h1 -> 1, h2 -> 2, etc.
      const contentToken = tokens[tokens.indexOf(token) + 1];
      
      if (contentToken && contentToken.type === 'inline') {
        const text = contentToken.content;
        const anchor = text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-');
        
        headings.push({
          level: level,
          text: text,
          anchor: anchor
        });
      }
    }
  });
  
  // 渲染目录
  headings.forEach(item => {
    const tocItem = document.createElement('li');
    tocItem.className = `toc-item level-${item.level}`;
    tocItem.textContent = item.text;
    tocItem.dataset.anchor = item.anchor;
    
    tocItem.addEventListener('click', () => {
      scrollToHeading(item.anchor);
    });
    
    tocListElement.appendChild(tocItem);
  });
}

/**
 * 使用Tocbot库的简化方案（推荐）
 * 需要引入: <script src="https://cdnjs.cloudflare.com/ajax/libs/tocbot/4.12.3/tocbot.min.js"></script>
 */
function generateTOCWithTocbot() {
  tocListElement.innerHTML = '';
  
  if (window.tocbot) {
    window.tocbot.init({
      tocSelector: '.toc-list',
      contentSelector: '.article-content',
      headingSelector: 'h1, h2, h3, h4, h5, h6',
      collapseDepth: 6,
      orderedList: false,
      scrollSmooth: true
    });
  }
}

// 替换原有的函数
function renderMarkdownContent(markdown) {
  return renderMarkdownContentEnhanced(markdown);
}

function generateTOC(markdown) {
  return generateTOCEnhanced(markdown);
}

// ==================== 应用启动 ====================
// 确保DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', initApp);