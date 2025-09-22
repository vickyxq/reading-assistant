/**
 * Content Script - 沉浸式阅读助手
 * 负责在网页中注入阅读功能和处理用户交互
 */

(function() {
  'use strict';

  // 防止重复注入
  if (window.readingAssistantInjected) {
    return;
  }
  window.readingAssistantInjected = true;

  /**
   * 阅读助手主控制器
   */
  class ReadingAssistantController {
    constructor() {
      this.settings = {
        theme: 'light',
        fontSize: 'medium',
        lineSpacing: 'normal',
        autoActivate: false
      };
      
      this.progressBar = null;
      this.toolbar = null;
      this.toolbarVisible = false;
      this.isInitialized = false;
      
      this.init();
    }

    /**
     * 初始化阅读助手
     */
    async init() {
      try {
        // 等待DOM加载完成
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
          this.setup();
        }
      } catch (error) {
        console.error('阅读助手初始化失败:', error);
      }
    }

    /**
     * 设置阅读助手
     */
    async setup() {
      try {
        // 加载用户设置
        await this.loadSettings();
        
        // 创建UI组件
        this.createProgressBar();
        this.createToolbar();
        
        // 绑定事件监听器
        this.bindEventListeners();
        
        // 监听来自popup的消息
        this.setupMessageListener();
        
        // 如果设置了自动激活，则激活阅读模式
        if (this.settings.autoActivate) {
          this.activateReadingMode();
        }
        
        this.isInitialized = true;
        console.log('阅读助手初始化完成');
        
      } catch (error) {
        console.error('阅读助手设置失败:', error);
      }
    }

    /**
     * 加载用户设置
     */
    async loadSettings() {
      try {
        const result = await chrome.storage.sync.get({
          theme: 'light',
          fontSize: 'medium',
          lineSpacing: 'normal',
          autoActivate: false,
          showProgress: true,
          enableShortcuts: true
        });
        
        this.settings = { ...this.settings, ...result };
      } catch (error) {
        console.error('加载设置失败:', error);
      }
    }

    /**
     * 保存用户设置
     */
    async saveSettings() {
      try {
        await chrome.storage.sync.set(this.settings);
      } catch (error) {
        console.error('保存设置失败:', error);
      }
    }

    /**
     * 创建阅读进度条
     */
    createProgressBar() {
      this.progressBar = document.createElement('div');
      this.progressBar.className = 'reading-assistant-progress';
      this.progressBar.id = 'reading-assistant-progress';
      this.progressBar.style.display = this.settings.showProgress ? 'block' : 'none';
      document.body.appendChild(this.progressBar);
    }

    /**
     * 创建浮动工具栏
     */
    createToolbar() {
      this.toolbar = document.createElement('div');
      this.toolbar.className = 'reading-assistant-toolbar';
      this.toolbar.id = 'reading-assistant-toolbar';
      this.toolbar.style.display = 'none';
      
      this.toolbar.innerHTML = `
        <button id="ra-toggle" title="切换阅读模式">📖</button>
        <button id="ra-theme" title="切换主题">🌙</button>
        <button id="ra-font-size" title="调整字体大小">🔤</button>
        <button id="ra-line-spacing" title="调整行间距">📏</button>
        <button id="ra-settings" title="设置">⚙️</button>
      `;
      
      document.body.appendChild(this.toolbar);
      
      // 绑定工具栏按钮事件
      this.bindToolbarEvents();
    }

    /**
     * 绑定工具栏事件
     */
    bindToolbarEvents() {
      const toggleBtn = this.toolbar.querySelector('#ra-toggle');
      const themeBtn = this.toolbar.querySelector('#ra-theme');
      const fontSizeBtn = this.toolbar.querySelector('#ra-font-size');
      const lineSpacingBtn = this.toolbar.querySelector('#ra-line-spacing');
      const settingsBtn = this.toolbar.querySelector('#ra-settings');
      
      toggleBtn?.addEventListener('click', () => this.toggleReadingMode());
      themeBtn?.addEventListener('click', () => this.cycleTheme());
      fontSizeBtn?.addEventListener('click', () => this.cycleFontSize());
      lineSpacingBtn?.addEventListener('click', () => this.cycleLineSpacing());
      settingsBtn?.addEventListener('click', () => this.openSettings());
    }

    /**
     * 绑定事件监听器
     */
    bindEventListeners() {
      // 滚动事件 - 更新进度条
      window.addEventListener('scroll', this.throttle(() => {
        this.updateProgress();
      }, 100));
      
      // 键盘快捷键
      document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
          e.preventDefault();
          this.toggleReadingMode();
        }
      });
      
      // 阅读模式事件监听
      document.addEventListener('reading-assistant-reading-mode-activated', () => {
        // 阅读模式激活时自动显示工具栏
        this.toolbarVisible = true;
        this.toolbar.style.display = 'flex';
        this.applyCurrentSettings();
      });
      
      document.addEventListener('reading-assistant-reading-mode-deactivated', () => {
        this.toolbar.style.display = 'none';
        this.toolbarVisible = false;
      });
      
      // 工具栏快捷键已移除，避免与浏览器快捷键冲突
    }

    /**
     * 设置消息监听器
     */
    setupMessageListener() {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        try {
          switch (request.action) {
            case 'toggle-reading-mode':
              this.toggleReadingMode();
              sendResponse({ success: true });
              break;
              
            case 'set-theme':
              this.setTheme(request.theme);
              sendResponse({ success: true });
              break;
              
            case 'set-font-size':
              this.setFontSize(request.fontSize);
              sendResponse({ success: true });
              break;
              
            case 'set-line-spacing':
              this.setLineSpacing(request.lineSpacing);
              sendResponse({ success: true });
              break;
              
            case 'update-settings':
              this.settings = { ...this.settings, ...request.settings };
              this.updateProgressBarVisibility();
              sendResponse({ success: true });
              break;
              
            case 'get-status':
              sendResponse({
                isActive: window.readingModeManager?.isActive || false,
                settings: this.settings
              });
              break;
              
            default:
              sendResponse({ error: '未知操作' });
          }
        } catch (error) {
          console.error('处理消息失败:', error);
          sendResponse({ error: error.message });
        }
        
        return true; // 保持消息通道开放
      });
    }

    /**
     * 激活阅读模式
     */
    activateReadingMode() {
      if (window.readingModeManager) {
        window.readingModeManager.activate();
      }
    }

    /**
     * 退出阅读模式
     */
    deactivateReadingMode() {
      if (window.readingModeManager) {
        window.readingModeManager.deactivate();
      }
    }

    /**
     * 切换阅读模式
     */
    toggleReadingMode() {
      if (window.readingModeManager) {
        window.readingModeManager.toggle();
      }
    }

    /**
     * 设置主题
     * @param {string} theme
     */
    setTheme(theme) {
      this.settings.theme = theme;
      if (window.readingModeManager) {
        window.readingModeManager.applyTheme(theme);
      }
      this.saveSettings();
    }

    /**
     * 循环切换主题
     */
    cycleTheme() {
      const themes = ['light', 'dark', 'sepia'];
      const currentIndex = themes.indexOf(this.settings.theme);
      const nextTheme = themes[(currentIndex + 1) % themes.length];
      this.setTheme(nextTheme);
    }

    /**
     * 设置字体大小
     * @param {string} fontSize
     */
    setFontSize(fontSize) {
      this.settings.fontSize = fontSize;
      if (window.readingModeManager) {
        window.readingModeManager.setFontSize(fontSize);
      }
      this.saveSettings();
    }

    /**
     * 循环切换字体大小
     */
    cycleFontSize() {
      const sizes = ['small', 'medium', 'large', 'xlarge'];
      const currentIndex = sizes.indexOf(this.settings.fontSize);
      const nextSize = sizes[(currentIndex + 1) % sizes.length];
      this.setFontSize(nextSize);
    }

    /**
     * 设置行间距
     * @param {string} lineSpacing
     */
    setLineSpacing(lineSpacing) {
      this.settings.lineSpacing = lineSpacing;
      if (window.readingModeManager) {
        window.readingModeManager.setLineSpacing(lineSpacing);
      }
      this.saveSettings();
    }

    /**
     * 循环切换行间距
     */
    cycleLineSpacing() {
      const spacings = ['compact', 'normal', 'loose'];
      const currentIndex = spacings.indexOf(this.settings.lineSpacing);
      const nextSpacing = spacings[(currentIndex + 1) % spacings.length];
      this.setLineSpacing(nextSpacing);
    }

    /**
     * 应用当前设置
     */
    applyCurrentSettings() {
      if (window.readingModeManager) {
        window.readingModeManager.applyTheme(this.settings.theme);
        window.readingModeManager.setFontSize(this.settings.fontSize);
        window.readingModeManager.setLineSpacing(this.settings.lineSpacing);
      }
    }

    /**
     * 更新阅读进度
     */
    updateProgress() {
      if (!this.settings.showProgress || !this.progressBar) return;
      
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      
      this.progressBar.style.width = `${Math.min(progress, 100)}%`;
    }

    /**
     * 更新进度条显示状态
     */
    updateProgressBarVisibility() {
      if (this.progressBar) {
        this.progressBar.style.display = this.settings.showProgress ? 'block' : 'none';
      }
    }

    // 工具栏快捷键功能已移除，避免与浏览器快捷键冲突

    /**
     * 打开设置
     */
    openSettings() {
      // 发送消息给background script打开popup
      chrome.runtime.sendMessage({ action: 'open-popup' });
    }

    /**
     * 节流函数
     * @param {Function} func
     * @param {number} delay
     * @returns {Function}
     */
    throttle(func, delay) {
      let timeoutId;
      let lastExecTime = 0;
      
      return function(...args) {
        const currentTime = Date.now();
        
        if (currentTime - lastExecTime > delay) {
          func.apply(this, args);
          lastExecTime = currentTime;
        } else {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            func.apply(this, args);
            lastExecTime = Date.now();
          }, delay - (currentTime - lastExecTime));
        }
      };
    }
  }

  // 检查是否在iframe中，并防止重复初始化
  if (window.self === window.top && !window.readingAssistantController) {
    // 只在顶级窗口中初始化，且未初始化过
    const controller = new ReadingAssistantController();
    
    // 导出到全局作用域供调试使用
    window.readingAssistantController = controller;
    
    console.log('沉浸式阅读助手已初始化');
  } else if (window.readingAssistantController) {
    console.log('沉浸式阅读助手已存在，跳过重复初始化');
  }

})();