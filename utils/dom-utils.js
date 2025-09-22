/**
 * DOM工具函数库 - 用于文本提取和DOM清理
 * @author 琪.R
 */

/**
 * 文本提取和内容识别工具类
 */
class ContentExtractor {
  constructor() {
    // 常见的内容选择器
    this.contentSelectors = [
      'article',
      '[role="main"]',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.content',
      '.main-content',
      '#content',
      '.post-body',
      '.article-body'
    ];

    // 需要移除的干扰元素选择器
    this.noiseSelectors = [
      'header', 'nav', 'aside', 'footer',
      '.advertisement', '.ads', '.sidebar',
      '.social-share', '.comments', '.related-posts',
      '.popup', '.modal', '.overlay',
      '[class*="ad-"]', '[id*="ad-"]',
      '[class*="banner"]', '[class*="promo"]',
      '.cookie-notice', '.newsletter',
      '.share-buttons', '.social-buttons'
    ];

    // 文本密度阈值
    this.textDensityThreshold = 25;
  }

  /**
   * 提取页面主要内容
   * @returns {Element|null} 主要内容元素
   */
  extractMainContent() {
    // 首先尝试使用语义化标签
    let content = this.findContentBySelectors();
    
    if (!content) {
      // 使用文本密度算法
      content = this.findContentByTextDensity();
    }

    if (!content) {
      // 最后尝试查找最大文本块
      content = this.findLargestTextBlock();
    }

    return content;
  }

  /**
   * 通过选择器查找内容
   * @returns {Element|null}
   */
  findContentBySelectors() {
    for (const selector of this.contentSelectors) {
      const element = document.querySelector(selector);
      if (element && this.isValidContent(element)) {
        return element;
      }
    }
    return null;
  }

  /**
   * 通过文本密度算法查找内容
   * @returns {Element|null}
   */
  findContentByTextDensity() {
    const candidates = document.querySelectorAll('div, section, main');
    let bestCandidate = null;
    let bestScore = 0;

    candidates.forEach(element => {
      const score = this.calculateTextDensity(element);
      if (score > bestScore && score > this.textDensityThreshold) {
        bestScore = score;
        bestCandidate = element;
      }
    });

    return bestCandidate;
  }

  /**
   * 查找最大文本块
   * @returns {Element|null}
   */
  findLargestTextBlock() {
    const allElements = document.querySelectorAll('*');
    let largestElement = null;
    let maxTextLength = 0;

    allElements.forEach(element => {
      const textLength = element.textContent.trim().length;
      if (textLength > maxTextLength && this.isValidContent(element)) {
        maxTextLength = textLength;
        largestElement = element;
      }
    });

    return largestElement;
  }

  /**
   * 计算元素的文本密度
   * @param {Element} element
   * @returns {number}
   */
  calculateTextDensity(element) {
    const textLength = element.textContent.trim().length;
    const linkLength = Array.from(element.querySelectorAll('a'))
      .reduce((sum, link) => sum + link.textContent.length, 0);
    
    const textDensity = textLength - linkLength;
    const tagCount = element.querySelectorAll('*').length;
    
    return tagCount > 0 ? textDensity / tagCount : 0;
  }

  /**
   * 验证内容是否有效
   * @param {Element} element
   * @returns {boolean}
   */
  isValidContent(element) {
    if (!element) return false;
    
    const text = element.textContent.trim();
    if (text.length < 100) return false;
    
    // 检查是否包含太多链接
    const links = element.querySelectorAll('a');
    const linkTextLength = Array.from(links)
      .reduce((sum, link) => sum + link.textContent.length, 0);
    
    const linkRatio = linkTextLength / text.length;
    if (linkRatio > 0.5) return false;
    
    return true;
  }

  /**
   * 清理内容元素
   * @param {Element} content
   * @returns {Element}
   */
  cleanContent(content) {
    if (!content) return null;
    
    const cleanedContent = content.cloneNode(true);
    
    // 移除干扰元素
    this.noiseSelectors.forEach(selector => {
      const elements = cleanedContent.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });
    
    // 清理属性
    this.cleanAttributes(cleanedContent);
    
    // 优化图片
    this.optimizeImages(cleanedContent);
    
    return cleanedContent;
  }

  /**
   * 清理元素属性
   * @param {Element} element
   */
  cleanAttributes(element) {
    const allowedAttributes = ['src', 'alt', 'href', 'title'];
    
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );
    
    const elements = [];
    let node;
    while (node = walker.nextNode()) {
      elements.push(node);
    }
    
    elements.forEach(el => {
      const attributes = Array.from(el.attributes);
      attributes.forEach(attr => {
        if (!allowedAttributes.includes(attr.name)) {
          el.removeAttribute(attr.name);
        }
      });
    });
  }

  /**
   * 优化图片显示
   * @param {Element} element
   */
  optimizeImages(element) {
    const images = element.querySelectorAll('img');
    images.forEach(img => {
      // 添加懒加载
      if (!img.loading) {
        img.loading = 'lazy';
      }
      
      // 确保图片有alt属性
      if (!img.alt) {
        img.alt = '图片';
      }
      
      // 移除内联样式
      img.removeAttribute('style');
    });
  }
}

/**
 * 阅读模式管理器
 */
class ReadingModeManager {
  constructor() {
    this.isActive = false;
    this.originalContent = null;
    this.readingContainer = null;
    this.extractor = new ContentExtractor();
  }

  /**
   * 激活阅读模式
   */
  activate() {
    if (this.isActive) return;
    
    try {
      // 保存原始内容
      this.originalContent = document.body.cloneNode(true);
      
      // 提取主要内容
      const mainContent = this.extractor.extractMainContent();
      if (!mainContent) {
        throw new Error('无法找到主要内容');
      }
      
      // 清理内容
      const cleanedContent = this.extractor.cleanContent(mainContent);
      
      // 创建阅读容器
      this.createReadingContainer(cleanedContent);
      
      // 隐藏原始内容
      this.hideOriginalContent();
      
      // 添加样式类
      document.documentElement.classList.add('reading-assistant-active');
      
      this.isActive = true;
      
      // 触发自定义事件
      this.dispatchEvent('reading-mode-activated');
      
    } catch (error) {
      console.error('激活阅读模式失败:', error);
      this.dispatchEvent('reading-mode-error', { error: error.message });
    }
  }

  /**
   * 退出阅读模式
   */
  deactivate() {
    if (!this.isActive) return;
    
    try {
      // 移除阅读容器
      if (this.readingContainer) {
        this.readingContainer.remove();
        this.readingContainer = null;
      }
      
      // 显示原始内容
      this.showOriginalContent();
      
      // 移除样式类
      document.documentElement.classList.remove('reading-assistant-active');
      
      this.isActive = false;
      
      // 触发自定义事件
      this.dispatchEvent('reading-mode-deactivated');
      
    } catch (error) {
      console.error('退出阅读模式失败:', error);
    }
  }

  /**
   * 创建阅读容器
   * @param {Element} content
   */
  createReadingContainer(content) {
    this.readingContainer = document.createElement('div');
    this.readingContainer.className = 'reading-assistant-container';
    this.readingContainer.id = 'reading-assistant-container';
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'reading-assistant-content';
    contentWrapper.appendChild(content);
    
    this.readingContainer.appendChild(contentWrapper);
    document.body.appendChild(this.readingContainer);
  }

  /**
   * 隐藏原始内容
   */
  hideOriginalContent() {
    // 保存原始body的显示状态
    this.originalBodyStyle = {
      overflow: document.body.style.overflow,
      background: document.body.style.background
    };
    
    // 隐藏body的所有直接子元素
    const children = Array.from(document.body.children);
    children.forEach(child => {
      if (child.id !== 'reading-assistant-container') {
        child.classList.add('reading-assistant-hidden');
      }
    });
    
    // 设置body样式以确保只显示阅读内容
    document.body.style.overflow = 'auto';
    document.body.style.background = '#ffffff';
  }

  /**
   * 显示原始内容
   */
  showOriginalContent() {
    const hiddenElements = document.querySelectorAll('.reading-assistant-hidden');
    hiddenElements.forEach(element => {
      element.classList.remove('reading-assistant-hidden');
    });
    
    // 恢复原始body样式
    if (this.originalBodyStyle) {
      document.body.style.overflow = this.originalBodyStyle.overflow || '';
      document.body.style.background = this.originalBodyStyle.background || '';
      this.originalBodyStyle = null;
    }
  }

  /**
   * 切换阅读模式
   */
  toggle() {
    if (this.isActive) {
      this.deactivate();
    } else {
      this.activate();
    }
  }

  /**
   * 应用主题
   * @param {string} theme - 主题名称 (light, dark, sepia)
   */
  applyTheme(theme) {
    const themes = ['reading-assistant-light', 'reading-assistant-dark', 'reading-assistant-sepia'];
    
    // 移除所有主题类
    themes.forEach(themeClass => {
      document.documentElement.classList.remove(themeClass);
    });
    
    // 添加新主题类
    if (theme && theme !== 'light') {
      document.documentElement.classList.add(`reading-assistant-${theme}`);
    }
    
    this.dispatchEvent('theme-changed', { theme });
  }

  /**
   * 设置字体大小
   * @param {string} size - 字体大小 (small, medium, large, xlarge)
   */
  setFontSize(size) {
    const sizes = ['reading-assistant-font-small', 'reading-assistant-font-medium', 
                   'reading-assistant-font-large', 'reading-assistant-font-xlarge'];
    
    // 移除所有字体大小类
    sizes.forEach(sizeClass => {
      document.documentElement.classList.remove(sizeClass);
    });
    
    // 添加新字体大小类
    document.documentElement.classList.add(`reading-assistant-font-${size}`);
    
    this.dispatchEvent('font-size-changed', { size });
  }

  /**
   * 设置行间距
   * @param {string} spacing - 行间距 (compact, normal, loose)
   */
  setLineSpacing(spacing) {
    const spacings = ['reading-assistant-line-compact', 'reading-assistant-line-normal', 
                      'reading-assistant-line-loose'];
    
    // 移除所有行间距类
    spacings.forEach(spacingClass => {
      document.documentElement.classList.remove(spacingClass);
    });
    
    // 添加新行间距类
    document.documentElement.classList.add(`reading-assistant-line-${spacing}`);
    
    this.dispatchEvent('line-spacing-changed', { spacing });
  }

  /**
   * 触发自定义事件
   * @param {string} eventName
   * @param {Object} detail
   */
  dispatchEvent(eventName, detail = {}) {
    const event = new CustomEvent(`reading-assistant-${eventName}`, {
      detail,
      bubbles: true
    });
    document.dispatchEvent(event);
  }
}

// 导出到全局作用域
window.ContentExtractor = ContentExtractor;
window.ReadingModeManager = ReadingModeManager;

// 创建全局实例
window.readingModeManager = new ReadingModeManager();