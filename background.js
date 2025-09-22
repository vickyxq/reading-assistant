/**
 * Background Service Worker - 沉浸式阅读助手
 * 处理扩展的后台逻辑、消息传递和状态管理
 */

/**
 * 背景脚本控制器
 */
class BackgroundController {
  constructor() {
    this.activeTabsReadingMode = new Map(); // 存储各标签页的阅读模式状态
    this.defaultSettings = {
      theme: 'light',
      fontSize: 'medium',
      lineSpacing: 'normal',
      autoActivate: false,
      showProgress: true,
      enableShortcuts: true
    };
    
    this.init();
  }

  /**
   * 初始化背景脚本
   */
  init() {
    // 监听扩展安装/更新事件
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });

    // 监听消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开放
    });

    // 监听标签页更新
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });

    // 监听标签页移除
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });

    // 监听扩展图标点击
    chrome.action.onClicked.addListener((tab) => {
      this.handleActionClicked(tab);
    });

    // 监听键盘快捷键
    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });

    console.log('阅读助手背景脚本已初始化');
  }

  /**
   * 处理扩展安装/更新
   */
  async handleInstalled(details) {
    try {
      if (details.reason === 'install') {
        // 首次安装
        await this.initializeSettings();
        await this.showWelcomeNotification();
        console.log('阅读助手首次安装完成');
      } else if (details.reason === 'update') {
        // 扩展更新
        await this.migrateSettings(details.previousVersion);
        console.log(`阅读助手已更新到版本 ${chrome.runtime.getManifest().version}`);
      }
    } catch (error) {
      console.error('处理安装事件失败:', error);
    }
  }

  /**
   * 初始化默认设置
   */
  async initializeSettings() {
    try {
      const existingSettings = await chrome.storage.sync.get(this.defaultSettings);
      const settings = { ...this.defaultSettings, ...existingSettings };
      await chrome.storage.sync.set(settings);
    } catch (error) {
      console.error('初始化设置失败:', error);
    }
  }

  /**
   * 显示通知（统一处理权限检查）
   */
  async showNotification({ title, message, iconUrl = 'icons/icon48.png' }) {
    try {
      // 检查是否有通知权限
      if (chrome.notifications && typeof chrome.notifications.create === 'function') {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: iconUrl,
          title: title,
          message: message
        });
      } else {
        console.log('通知权限不可用，跳过通知:', title);
      }
    } catch (error) {
      console.error('显示通知失败:', error);
      // 不影响其他功能，仅记录错误
    }
  }

  /**
   * 显示欢迎通知
   */
  async showWelcomeNotification() {
    await this.showNotification({
      title: '沉浸式阅读助手',
      message: '扩展已安装完成！使用 Ctrl+Shift+R 快速启用阅读模式。'
    });
  }

  /**
   * 迁移设置（版本更新时）
   */
  async migrateSettings(previousVersion) {
    try {
      // 这里可以添加版本迁移逻辑
      console.log(`从版本 ${previousVersion} 迁移设置`);
    } catch (error) {
      console.error('迁移设置失败:', error);
    }
  }

  /**
   * 处理消息
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case 'open-popup':
          await this.openPopup(sender.tab);
          sendResponse({ success: true });
          break;

        case 'update-reading-mode-status':
          this.updateReadingModeStatus(sender.tab.id, request.isActive);
          sendResponse({ success: true });
          break;

        case 'get-settings':
          const settings = await this.getSettings();
          sendResponse({ settings });
          break;

        case 'save-settings':
          await this.saveSettings(request.settings);
          sendResponse({ success: true });
          break;

        case 'toggle-reading-mode':
          // 支持从popup传来的tabId，或使用sender.tab.id
          const tabId = request.tabId || sender.tab?.id;
          if (tabId) {
            const response = await this.toggleReadingModeForTab(tabId);
            sendResponse({ success: true, response });
          } else {
            sendResponse({ error: '无法获取标签页ID' });
          }
          break;

        case 'get-tab-status':
          const status = this.getTabStatus(sender.tab.id);
          sendResponse({ status });
          break;

        default:
          sendResponse({ error: '未知操作' });
      }
    } catch (error) {
      console.error('处理消息失败:', error);
      sendResponse({ error: error.message });
    }
  }

  /**
   * 处理标签页更新
   */
  async handleTabUpdated(tabId, changeInfo, tab) {
    try {
      // 当页面加载完成时，检查是否需要自动激活阅读模式
      if (changeInfo.status === 'complete' && tab.url) {
        const settings = await this.getSettings();
        if (settings.autoActivate && this.isValidUrl(tab.url)) {
          // 延迟一点时间确保content script已加载
          setTimeout(() => {
            this.sendMessageToTab(tabId, { action: 'auto-activate' });
          }, 1000);
        }
      }
    } catch (error) {
      console.error('处理标签页更新失败:', error);
    }
  }

  /**
   * 处理标签页移除
   */
  handleTabRemoved(tabId) {
    // 清理标签页状态
    this.activeTabsReadingMode.delete(tabId);
  }

  /**
   * 处理扩展图标点击
   */
  async handleActionClicked(tab) {
    try {
      if (this.isValidUrl(tab.url)) {
        await this.toggleReadingModeForTab(tab.id);
      } else {
        // 在无效页面显示提示
        await this.showNotification({
          title: '阅读助手',
          message: '此页面不支持阅读模式'
        });
      }
    } catch (error) {
      console.error('处理图标点击失败:', error);
    }
  }

  /**
   * 处理键盘快捷键
   */
  async handleCommand(command) {
    try {
      if (command === 'toggle-reading-mode') {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (activeTab && this.isValidUrl(activeTab.url)) {
          await this.toggleReadingModeForTab(activeTab.id);
        }
      }
    } catch (error) {
      console.error('处理快捷键失败:', error);
    }
  }

  /**
   * 打开popup
   */
  async openPopup(tab) {
    try {
      await chrome.action.openPopup();
    } catch (error) {
      console.error('打开popup失败:', error);
    }
  }

  /**
   * 更新阅读模式状态
   */
  updateReadingModeStatus(tabId, isActive) {
    this.activeTabsReadingMode.set(tabId, isActive);
    this.updateBadge(tabId, isActive);
  }

  /**
   * 更新扩展图标徽章
   */
  async updateBadge(tabId, isActive) {
    try {
      await chrome.action.setBadgeText({
        tabId: tabId,
        text: isActive ? '●' : ''
      });
      
      await chrome.action.setBadgeBackgroundColor({
        tabId: tabId,
        color: '#4CAF50'
      });
    } catch (error) {
      console.error('更新徽章失败:', error);
    }
  }

  /**
   * 获取设置
   */
  async getSettings() {
    try {
      return await chrome.storage.sync.get(this.defaultSettings);
    } catch (error) {
      console.error('获取设置失败:', error);
      return this.defaultSettings;
    }
  }

  /**
   * 保存设置
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
    } catch (error) {
      console.error('保存设置失败:', error);
      throw error;
    }
  }

  /**
   * 切换标签页阅读模式
   */
  async toggleReadingModeForTab(tabId) {
    try {
      // 先注入content script
      await this.injectContentScript(tabId);
      
      // 等待一小段时间确保脚本完全加载
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 然后发送切换消息，带重试机制
      const response = await this.sendMessageWithRetry(tabId, { action: 'toggle-reading-mode' });
      if (response && response.success) {
        const isActive = !this.activeTabsReadingMode.get(tabId);
        this.updateReadingModeStatus(tabId, isActive);
      }
      return response;
    } catch (error) {
      console.error('切换阅读模式失败:', error);
      // 显示用户友好的错误提示
      await this.showNotification({
        title: '阅读助手',
        message: '启用阅读模式失败，请刷新页面后重试'
      });
      throw error;
    }
  }

  /**
   * 带重试机制的消息发送
   */
  async sendMessageWithRetry(tabId, message, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await this.sendMessageToTab(tabId, message);
        return response;
      } catch (error) {
        console.log(`消息发送失败，第${i + 1}次重试:`, error.message);
        if (i === maxRetries - 1) {
          throw error;
        }
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
      }
    }
  }

  /**
   * 注入content script
   */
  async injectContentScript(tabId) {
    try {
      // 检查是否已经注入过
      const isInjected = await this.checkIfScriptInjected(tabId);
      if (isInjected) {
        console.log('Content script已经注入，跳过重复注入');
        return;
      }

      // 注入工具函数
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['utils/dom-utils.js']
      });
      
      // 注入主要content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      
      // 注入CSS样式
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['styles/reading-mode.css']
      });
      
      console.log('Content script注入成功');
    } catch (error) {
      console.error('注入content script失败:', error);
      throw error;
    }
  }

  /**
   * 检查脚本是否已经注入
   */
  async checkIfScriptInjected(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return typeof window.readingAssistantController !== 'undefined';
        }
      });
      return results && results[0] && results[0].result;
    } catch (error) {
      // 如果执行失败，说明还没有注入
      return false;
    }
  }

  /**
   * 获取标签页状态
   */
  getTabStatus(tabId) {
    return {
      isReadingModeActive: this.activeTabsReadingMode.get(tabId) || false
    };
  }

  /**
   * 向标签页发送消息
   */
  async sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * 检查URL是否有效
   */
  isValidUrl(url) {
    if (!url) return false;
    
    // 排除特殊页面
    const invalidProtocols = ['chrome:', 'chrome-extension:', 'moz-extension:', 'edge:', 'about:'];
    const invalidDomains = ['chrome.google.com', 'addons.mozilla.org', 'microsoftedge.microsoft.com'];
    
    // 检查协议
    if (invalidProtocols.some(protocol => url.startsWith(protocol))) {
      return false;
    }
    
    // 检查域名
    try {
      const urlObj = new URL(url);
      if (invalidDomains.some(domain => urlObj.hostname.includes(domain))) {
        return false;
      }
    } catch (error) {
      return false;
    }
    
    return true;
  }

  /**
   * 清理过期数据
   */
  async cleanupExpiredData() {
    try {
      // 获取所有打开的标签页
      const tabs = await chrome.tabs.query({});
      const activeTabIds = new Set(tabs.map(tab => tab.id));
      
      // 清理不存在的标签页数据
      for (const tabId of this.activeTabsReadingMode.keys()) {
        if (!activeTabIds.has(tabId)) {
          this.activeTabsReadingMode.delete(tabId);
        }
      }
    } catch (error) {
      console.error('清理过期数据失败:', error);
    }
  }
}

// 创建背景控制器实例
const backgroundController = new BackgroundController();

// 定期清理过期数据
setInterval(() => {
  backgroundController.cleanupExpiredData();
}, 5 * 60 * 1000); // 每5分钟清理一次

// 导出到全局作用域供调试使用
self.backgroundController = backgroundController;