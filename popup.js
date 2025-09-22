/**
 * Popup Script - 沉浸式阅读助手
 * 处理popup界面交互和与content script通信
 */

(function() {
  'use strict';

  /**
   * Popup控制器
   */
  class PopupController {
    constructor() {
      this.currentTab = null;
      this.settings = {
        theme: 'light',
        fontSize: 'medium',
        lineSpacing: 'normal',
        autoActivate: false,
        showProgress: true,
        enableShortcuts: true
      };
      this.isReadingModeActive = false;
      
      this.init();
    }

    /**
     * 初始化popup
     */
    async init() {
      try {
        // 显示加载指示器
        this.showLoading(true);
        
        // 获取当前标签页
        await this.getCurrentTab();
        
        // 加载设置
        await this.loadSettings();
        
        // 获取阅读模式状态
        await this.getReadingModeStatus();
        
        // 初始化UI
        this.initializeUI();
        
        // 绑定事件
        this.bindEvents();
        
        // 隐藏加载指示器
        this.showLoading(false);
        
      } catch (error) {
        console.error('Popup初始化失败:', error);
        this.showToast('初始化失败', 'error');
        this.showLoading(false);
      }
    }

    /**
     * 获取当前标签页
     */
    async getCurrentTab() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    }

    /**
     * 加载设置
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
     * 保存设置
     */
    async saveSettings() {
      try {
        await chrome.storage.sync.set(this.settings);
      } catch (error) {
        console.error('保存设置失败:', error);
      }
    }

    /**
     * 获取阅读模式状态
     */
    async getReadingModeStatus() {
      try {
        const response = await this.sendMessageToTab({ action: 'get-status' });
        if (response && response.isActive !== undefined) {
          this.isReadingModeActive = response.isActive;
          if (response.settings) {
            this.settings = { ...this.settings, ...response.settings };
          }
        }
      } catch (error) {
        console.error('获取状态失败:', error);
      }
    }

    /**
     * 初始化UI
     */
    initializeUI() {
      // 更新状态指示器
      this.updateStatusIndicator();
      
      // 更新切换按钮
      this.updateToggleButton();
      
      // 更新主题选择
      this.updateThemeSelection();
      
      // 更新字体大小选择
      this.updateFontSizeSelection();
      
      // 更新行间距选择
      this.updateLineSpacingSelection();
      
      // 更新设置选项
      this.updateSettingsOptions();
    }

    /**
     * 绑定事件
     */
    bindEvents() {
      // 阅读模式切换
      const toggleBtn = document.getElementById('toggleReadingMode');
      toggleBtn?.addEventListener('click', () => this.toggleReadingMode());
      
      // 主题选择
      const themeButtons = document.querySelectorAll('.theme-btn');
      themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const theme = btn.dataset.theme;
          this.setTheme(theme);
        });
      });
      
      // 字体大小选择
      const fontButtons = document.querySelectorAll('.font-btn');
      fontButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const size = btn.dataset.size;
          this.setFontSize(size);
        });
      });
      
      // 行间距选择
      const spacingButtons = document.querySelectorAll('.spacing-btn');
      spacingButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const spacing = btn.dataset.spacing;
          this.setLineSpacing(spacing);
        });
      });
      
      // 快捷操作
      const extractBtn = document.getElementById('extractContent');
      const removeAdsBtn = document.getElementById('removeAds');
      const focusModeBtn = document.getElementById('focusMode');
      
      extractBtn?.addEventListener('click', () => this.extractContent());
      removeAdsBtn?.addEventListener('click', () => this.removeAds());
      focusModeBtn?.addEventListener('click', () => this.toggleFocusMode());
      
      // 设置选项
      const autoActivateCheckbox = document.getElementById('autoActivate');
      const showProgressCheckbox = document.getElementById('showProgress');
      const enableShortcutsCheckbox = document.getElementById('enableShortcuts');
      
      autoActivateCheckbox?.addEventListener('change', (e) => {
        this.settings.autoActivate = e.target.checked;
        this.saveSettings();
      });
      
      showProgressCheckbox?.addEventListener('change', async (e) => {
        this.settings.showProgress = e.target.checked;
        await this.saveSettings();
        // 通知content script更新设置
        try {
          await this.sendMessageToTab({ 
            action: 'update-settings', 
            settings: { showProgress: this.settings.showProgress } 
          });
        } catch (error) {
          console.error('更新设置失败:', error);
        }
      });
      
      enableShortcutsCheckbox?.addEventListener('change', (e) => {
        this.settings.enableShortcuts = e.target.checked;
        this.saveSettings();
      });
    }

    /**
     * 切换阅读模式
     */
    async toggleReadingMode() {
      try {
        this.showLoading(true);
        
        // 通过background script处理，确保正确的权限和注入
        const response = await this.sendMessageToBackground({
          action: 'toggle-reading-mode',
          tabId: this.currentTab.id
        });
        
        if (response && response.success) {
          this.isReadingModeActive = !this.isReadingModeActive;
          this.updateStatusIndicator();
          this.updateToggleButton();
          
          const message = this.isReadingModeActive ? '阅读模式已启用' : '阅读模式已关闭';
          this.showToast(message, 'success');
        } else {
          throw new Error(response?.error || '操作失败');
        }
      } catch (error) {
        console.error('切换阅读模式失败:', error);
        this.showToast('操作失败', 'error');
      } finally {
        this.showLoading(false);
      }
    }

    /**
     * 设置主题
     */
    async setTheme(theme) {
      try {
        this.settings.theme = theme;
        await this.saveSettings();
        
        const response = await this.sendMessageToTab({ 
          action: 'set-theme', 
          theme: theme 
        });
        
        if (response && response.success) {
          this.updateThemeSelection();
          this.showToast(`已切换到${this.getThemeName(theme)}模式`, 'success');
        }
      } catch (error) {
        console.error('设置主题失败:', error);
        this.showToast('设置失败', 'error');
      }
    }

    /**
     * 设置字体大小
     */
    async setFontSize(fontSize) {
      try {
        this.settings.fontSize = fontSize;
        await this.saveSettings();
        
        const response = await this.sendMessageToTab({ 
          action: 'set-font-size', 
          fontSize: fontSize 
        });
        
        if (response && response.success) {
          this.updateFontSizeSelection();
          this.showToast(`字体大小已调整`, 'success');
        }
      } catch (error) {
        console.error('设置字体大小失败:', error);
        this.showToast('设置失败', 'error');
      }
    }

    /**
     * 设置行间距
     */
    async setLineSpacing(lineSpacing) {
      try {
        this.settings.lineSpacing = lineSpacing;
        await this.saveSettings();
        
        const response = await this.sendMessageToTab({ 
          action: 'set-line-spacing', 
          lineSpacing: lineSpacing 
        });
        
        if (response && response.success) {
          this.updateLineSpacingSelection();
          this.showToast(`行间距已调整`, 'success');
        }
      } catch (error) {
        console.error('设置行间距失败:', error);
        this.showToast('设置失败', 'error');
      }
    }

    /**
     * 提取内容
     */
    async extractContent() {
      try {
        if (!this.isReadingModeActive) {
          await this.toggleReadingMode();
        }
        this.showToast('正文已提取', 'success');
      } catch (error) {
        console.error('提取内容失败:', error);
        this.showToast('提取失败', 'error');
      }
    }

    /**
     * 移除广告
     */
    async removeAds() {
      try {
        // 这里可以添加专门的广告移除逻辑
        this.showToast('广告已移除', 'success');
      } catch (error) {
        console.error('移除广告失败:', error);
        this.showToast('操作失败', 'error');
      }
    }

    /**
     * 切换专注模式
     */
    async toggleFocusMode() {
      try {
        if (!this.isReadingModeActive) {
          await this.toggleReadingMode();
        }
        this.showToast('专注模式已启用', 'success');
      } catch (error) {
        console.error('切换专注模式失败:', error);
        this.showToast('操作失败', 'error');
      }
    }

    /**
     * 向标签页发送消息
     */
    async sendMessageToTab(message) {
      if (!this.currentTab) {
        throw new Error('无法获取当前标签页');
      }
      
      return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(this.currentTab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    }

    /**
     * 向background script发送消息
     */
    async sendMessageToBackground(message) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    }

    /**
     * 更新状态指示器
     */
    updateStatusIndicator() {
      const indicator = document.getElementById('statusIndicator');
      const statusText = indicator?.querySelector('.status-text');
      
      if (indicator && statusText) {
        if (this.isReadingModeActive) {
          indicator.classList.add('active');
          statusText.textContent = '已激活';
        } else {
          indicator.classList.remove('active');
          statusText.textContent = '未激活';
        }
      }
    }

    /**
     * 更新切换按钮
     */
    updateToggleButton() {
      const toggleBtn = document.getElementById('toggleReadingMode');
      const toggleText = toggleBtn?.querySelector('.toggle-text');
      
      if (toggleBtn && toggleText) {
        if (this.isReadingModeActive) {
          toggleBtn.classList.add('active');
          toggleText.textContent = '关闭阅读模式';
        } else {
          toggleBtn.classList.remove('active');
          toggleText.textContent = '启用阅读模式';
        }
      }
    }

    /**
     * 更新主题选择
     */
    updateThemeSelection() {
      const themeButtons = document.querySelectorAll('.theme-btn');
      themeButtons.forEach(btn => {
        if (btn.dataset.theme === this.settings.theme) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    /**
     * 更新字体大小选择
     */
    updateFontSizeSelection() {
      const fontButtons = document.querySelectorAll('.font-btn');
      fontButtons.forEach(btn => {
        if (btn.dataset.size === this.settings.fontSize) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    /**
     * 更新行间距选择
     */
    updateLineSpacingSelection() {
      const spacingButtons = document.querySelectorAll('.spacing-btn');
      spacingButtons.forEach(btn => {
        if (btn.dataset.spacing === this.settings.lineSpacing) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    /**
     * 更新设置选项
     */
    updateSettingsOptions() {
      const autoActivateCheckbox = document.getElementById('autoActivate');
      const showProgressCheckbox = document.getElementById('showProgress');
      const enableShortcutsCheckbox = document.getElementById('enableShortcuts');
      
      if (autoActivateCheckbox) {
        autoActivateCheckbox.checked = this.settings.autoActivate;
      }
      
      if (showProgressCheckbox) {
        showProgressCheckbox.checked = this.settings.showProgress;
      }
      
      if (enableShortcutsCheckbox) {
        enableShortcutsCheckbox.checked = this.settings.enableShortcuts;
      }
    }

    /**
     * 获取主题名称
     */
    getThemeName(theme) {
      const themeNames = {
        light: '明亮',
        dark: '暗黑',
        sepia: '护眼'
      };
      return themeNames[theme] || theme;
    }

    /**
     * 显示加载指示器
     */
    showLoading(show) {
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) {
        if (show) {
          loadingOverlay.classList.add('show');
        } else {
          loadingOverlay.classList.remove('show');
        }
      }
    }

    /**
     * 显示提示消息
     */
    showToast(message, type = 'info') {
      const toast = document.getElementById('toast');
      const toastMessage = toast?.querySelector('.toast-message');
      
      if (toast && toastMessage) {
        toastMessage.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        setTimeout(() => {
          toast.classList.remove('show');
        }, 3000);
      }
    }
  }

  // 当DOM加载完成时初始化popup
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new PopupController();
    });
  } else {
    new PopupController();
  }

})();